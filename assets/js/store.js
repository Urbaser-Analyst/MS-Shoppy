/* ============================================================
 *  STOREFRONT LOGIC
 * ============================================================ */

let ALL_PRODUCTS = [];
let ACTIVE_CATEGORY = 'all';
let SEARCH_TERM = '';
let CART = loadCart();
let SETTINGS = { deliveryCharge: 0, freeDeliveryThreshold: 0 };
let BANNER_INDEX = 0;
let BANNER_TIMER = null;

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('footerNameEl').textContent = CONFIG.SITE_NAME;
  document.getElementById('siteTagEl').textContent = CONFIG.TAGLINE;
  document.getElementById('yearEl').textContent = new Date().getFullYear();
  if (CONFIG.SUPPORT_PHONE) {
    document.getElementById('supportEl').textContent = 'Support: ' + CONFIG.SUPPORT_PHONE;
  }
  document.title = CONFIG.SITE_NAME + ' — Shop';

  loadSettings();
  loadProducts();
  loadBanners();
  loadGallery();
  renderCart();
  bindEvents();
});

/* ---------- Settings (delivery) ---------- */
async function loadSettings() {
  try {
    const data = await callApi('getSettings');
    SETTINGS = data.settings || SETTINGS;
    renderCart();
  } catch (err) {
    // fall back to zero delivery charge if settings can't be loaded
  }
}

function computeDelivery(subtotal) {
  if (subtotal <= 0) return 0;
  if (SETTINGS.freeDeliveryThreshold && subtotal >= SETTINGS.freeDeliveryThreshold) return 0;
  return Number(SETTINGS.deliveryCharge) || 0;
}

/* ---------- Banners ---------- */
async function loadBanners() {
  try {
    const data = await callApi('getBanners');
    renderBanners(data.banners || []);
  } catch (err) {
    // banner section just stays hidden
  }
}

function renderBanners(banners) {
  const section = document.getElementById('bannerCarousel');
  const track = document.getElementById('bannerTrack');
  const dots = document.getElementById('bannerDots');
  if (!banners.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  track.innerHTML = banners.map(b => `
    <div class="banner-slide">
      ${CONFIG.SHOW_BANNER_LINKS && b.linkUrl
        ? `<a href="${escapeHtml(b.linkUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(b.imageUrl)}" alt=""></a>`
        : `<img src="${escapeHtml(b.imageUrl)}" alt="">`}
    </div>
  `).join('');
  dots.innerHTML = banners.map((_, i) => `<button class="banner-dot${i === 0 ? ' active' : ''}" data-dot="${i}"></button>`).join('');

  BANNER_INDEX = 0;
  const goTo = (i) => {
    BANNER_INDEX = (i + banners.length) % banners.length;
    track.style.transform = `translateX(-${BANNER_INDEX * 100}%)`;
    dots.querySelectorAll('.banner-dot').forEach((d, idx) => d.classList.toggle('active', idx === BANNER_INDEX));
  };
  dots.querySelectorAll('[data-dot]').forEach(d => d.addEventListener('click', () => { goTo(Number(d.dataset.dot)); restartBannerTimer(goTo, banners.length); }));
  document.getElementById('bannerPrev').onclick = () => { goTo(BANNER_INDEX - 1); restartBannerTimer(goTo, banners.length); };
  document.getElementById('bannerNext').onclick = () => { goTo(BANNER_INDEX + 1); restartBannerTimer(goTo, banners.length); };

  restartBannerTimer(goTo, banners.length);
}

function restartBannerTimer(goTo, count) {
  if (BANNER_TIMER) clearInterval(BANNER_TIMER);
  if (count <= 1) return;
  BANNER_TIMER = setInterval(() => goTo(BANNER_INDEX + 1), 4500);
}

/* ---------- Gallery ---------- */
async function loadGallery() {
  try {
    const data = await callApi('getGallery');
    renderGallery(data.images || []);
  } catch (err) {
    // gallery section just stays hidden
  }
}

function renderGallery(images) {
  const section = document.getElementById('gallerySection');
  const grid = document.getElementById('galleryGrid');
  if (!images.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  grid.innerHTML = images.map((img, i) => `
    <div class="gallery-item" data-gallery-index="${i}">
      <img src="${escapeHtml(img.imageUrl)}" alt="${escapeHtml(img.caption || '')}" loading="lazy">
    </div>
  `).join('');
  grid.querySelectorAll('[data-gallery-index]').forEach(el => {
    const img = images[Number(el.dataset.galleryIndex)];
    el.addEventListener('click', () => openLightbox(img.imageUrl, img.caption));
  });
}

function openLightbox(src, caption) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightboxCaption').textContent = caption || '';
  openModal('lightboxModal');
}

/* ---------- Load & render products ---------- */
async function loadProducts() {
  const grid = document.getElementById('productGrid');
  try {
    const data = await callApi('getProducts');
    ALL_PRODUCTS = data.products || [];
    renderCategories();
    renderProducts();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Couldn't load products.<br><small>${escapeHtml(err.message)}</small></div>`;
  }
}

function renderCategories() {
  const row = document.getElementById('categoryRow');
  const categories = Array.from(new Set(ALL_PRODUCTS.map(p => p.category).filter(Boolean)));
  row.innerHTML = '';

  const allChip = makeChip('All', 'all');
  row.appendChild(allChip);
  categories.forEach(cat => row.appendChild(makeChip(cat, cat)));
}

function makeChip(label, value) {
  const btn = document.createElement('button');
  btn.className = 'chip' + (value === ACTIVE_CATEGORY ? ' active' : '');
  btn.textContent = label;
  btn.dataset.category = value;
  btn.addEventListener('click', () => {
    ACTIVE_CATEGORY = value;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderProducts();
  });
  return btn;
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  let list = ALL_PRODUCTS;

  if (ACTIVE_CATEGORY !== 'all') {
    list = list.filter(p => p.category === ACTIVE_CATEGORY);
  }
  if (SEARCH_TERM) {
    const term = SEARCH_TERM.toLowerCase();
    list = list.filter(p =>
      (p.name || '').toLowerCase().includes(term) ||
      (p.description || '').toLowerCase().includes(term)
    );
  }

  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-state">No products found.</div>';
    return;
  }

  grid.innerHTML = list.map(productCardHtml).join('');

  grid.querySelectorAll('[data-add-id]').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.addId));
  });
  grid.querySelectorAll('[data-video-id]').forEach(btn => {
    btn.addEventListener('click', () => openProductVideo(btn.dataset.videoId));
  });
}

function openProductVideo(productId) {
  const product = ALL_PRODUCTS.find(p => String(p.id) === String(productId));
  if (!product || !product.videoUrl) return;
  const embedUrl = extractVideoEmbedUrl(product.videoUrl);
  const wrap = document.getElementById('videoEmbedWrap');
  if (embedUrl) {
    wrap.innerHTML = `<iframe src="${escapeHtml(embedUrl)}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    openModal('videoModal');
  } else {
    window.open(product.videoUrl, '_blank', 'noopener');
  }
}

function discountedPrice(p) {
  const price = Number(p.price) || 0;
  const discount = Number(p.discount) || 0;
  if (discount <= 0) return price;
  return Math.round((price * (1 - discount / 100)) * 100) / 100;
}

function priceRowHtml(p) {
  const discount = Number(p.discount) || 0;
  if (discount <= 0) {
    return `<span class="product-price">${formatMoney(p.price)}</span>`;
  }
  return `
    <span class="price-row">
      <span class="price-discounted">${formatMoney(discountedPrice(p))}</span>
      <span class="price-original">${formatMoney(p.price)}</span>
      <span class="discount-badge">${discount}% off</span>
    </span>`;
}

function extractVideoEmbedUrl(url) {
  if (!url) return null;
  try {
    const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  } catch (e) {}
  return null; // Instagram and other links open in a new tab instead of embedding
}

function productCardHtml(p) {
  const outOfStock = Number(p.stock) <= 0;
  const thumb = p.imageUrl
    ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy">`
    : `<span class="placeholder">${escapeHtml((p.name || '?').charAt(0))}</span>`;
  const videoBtn = CONFIG.SHOW_PRODUCT_VIDEO && p.videoUrl
    ? `<button class="video-badge" data-video-id="${escapeHtml(p.id)}" aria-label="Watch video" title="Watch video">&#9658;</button>`
    : '';

  return `
    <div class="product-card">
      <div class="product-thumb">${thumb}${videoBtn}</div>
      <div class="product-body">
        ${p.category ? `<span class="product-category">${escapeHtml(p.category)}</span>` : ''}
        <span class="product-name">${escapeHtml(p.name)}</span>
        ${p.description ? `<span class="product-desc">${escapeHtml(p.description)}</span>` : ''}
        <div class="product-footer">
          ${priceRowHtml(p)}
          ${outOfStock
            ? '<span class="stock-flag">Out of stock</span>'
            : `<button class="add-btn" data-add-id="${escapeHtml(p.id)}">Add</button>`}
        </div>
      </div>
    </div>`;
}

/* ---------- Cart ---------- */
function loadCart() {
  try {
    return JSON.parse(localStorage.getItem('cod_cart') || '[]');
  } catch (e) {
    return [];
  }
}

function saveCart() {
  localStorage.setItem('cod_cart', JSON.stringify(CART));
}

function addToCart(productId) {
  const product = ALL_PRODUCTS.find(p => String(p.id) === String(productId));
  if (!product) return;

  const existing = CART.find(i => i.id === product.id);
  const maxStock = Number(product.stock) || 0;

  if (existing) {
    if (existing.qty < maxStock) existing.qty += 1;
  } else {
    CART.push({ id: product.id, name: product.name, price: discountedPrice(product), imageUrl: product.imageUrl, qty: 1 });
  }
  saveCart();
  renderCart();
  showToast(product.name + ' added to cart');
}

function updateQty(productId, delta) {
  const item = CART.find(i => i.id === productId);
  if (!item) return;
  const product = ALL_PRODUCTS.find(p => String(p.id) === String(productId));
  const maxStock = product ? Number(product.stock) : 999;

  item.qty += delta;
  if (item.qty > maxStock) item.qty = maxStock;
  if (item.qty <= 0) {
    CART = CART.filter(i => i.id !== productId);
  }
  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  CART = CART.filter(i => i.id !== productId);
  saveCart();
  renderCart();
}

function cartTotal() {
  return CART.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function renderCart() {
  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');
  const count = CART.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cartCount').textContent = count;

  if (CART.length === 0) {
    body.innerHTML = '<div class="empty-cart">Your cart is empty.<br>Add something you like!</div>';
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';
  const subtotal = cartTotal();
  const delivery = computeDelivery(subtotal);
  document.getElementById('cartSubtotal').textContent = formatMoney(subtotal);
  document.getElementById('cartDelivery').textContent = delivery === 0 ? 'Free' : formatMoney(delivery);
  document.getElementById('cartGrandTotal').textContent = formatMoney(subtotal + delivery);

  const noteEl = document.getElementById('freeDeliveryNote');
  if (delivery > 0 && SETTINGS.freeDeliveryThreshold) {
    const remaining = SETTINGS.freeDeliveryThreshold - subtotal;
    noteEl.textContent = remaining > 0 ? `Add ${formatMoney(remaining)} more for free delivery` : '';
  } else if (delivery === 0 && SETTINGS.freeDeliveryThreshold) {
    noteEl.textContent = "You've unlocked free delivery!";
  } else {
    noteEl.textContent = '';
  }

  body.innerHTML = CART.map(item => `
    <div class="cart-item">
      ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="">` : '<img src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2756%27 height=%2756%27/%3E" alt="">'}
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">${formatMoney(item.price)} each</div>
        <div class="qty-control">
          <button data-qty-minus="${escapeHtml(item.id)}">&minus;</button>
          <span>${item.qty}</span>
          <button data-qty-plus="${escapeHtml(item.id)}">+</button>
          <button class="remove-link" data-remove="${escapeHtml(item.id)}">Remove</button>
        </div>
      </div>
    </div>
  `).join('');

  body.querySelectorAll('[data-qty-minus]').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.qtyMinus, -1)));
  body.querySelectorAll('[data-qty-plus]').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.qtyPlus, 1)));
  body.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => removeFromCart(b.dataset.remove)));
}

/* ---------- Drawer / modal controls ---------- */
function bindEvents() {
  const overlay = document.getElementById('overlay');
  const drawer = document.getElementById('cartDrawer');

  document.getElementById('openCartBtn').addEventListener('click', () => {
    overlay.classList.add('open');
    drawer.classList.add('open');
  });
  document.getElementById('closeCartBtn').addEventListener('click', closeDrawer);
  overlay.addEventListener('click', () => {
    closeDrawer();
    closeModal('checkoutModal');
    closeModal('confirmModal');
    closeModal('lightboxModal');
    closeModal('videoModal');
  });

  document.getElementById('lightboxClose').addEventListener('click', () => closeModal('lightboxModal'));
  document.getElementById('videoClose').addEventListener('click', () => {
    document.getElementById('videoEmbedWrap').innerHTML = '';
    closeModal('videoModal');
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    SEARCH_TERM = e.target.value;
    renderProducts();
  });

  document.getElementById('checkoutBtn').addEventListener('click', () => {
    if (CART.length === 0) return;
    closeDrawer();
    openModal('checkoutModal');
  });

  document.getElementById('checkoutForm').addEventListener('submit', handleCheckoutSubmit);

  document.getElementById('custMobile').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });
  document.getElementById('custPincode').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });
}

function closeDrawer() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('cartDrawer').classList.remove('open');
}

function openModal(id) {
  document.getElementById('overlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  const stillOpen = ['confirmModal', 'checkoutModal', 'lightboxModal', 'videoModal']
    .some(mid => document.getElementById(mid).classList.contains('open'));
  if (!stillOpen) {
    document.getElementById('overlay').classList.remove('open');
  }
}

/* ---------- Checkout ---------- */
function validateCheckoutForm() {
  let valid = true;
  const checks = [
    { id: 'custName', test: v => v.trim().length > 0 },
    { id: 'custMobile', test: v => /^[6-9]\d{9}$/.test(v.trim()) },
    { id: 'custAddress', test: v => v.trim().length > 4 },
    { id: 'custCity', test: v => v.trim().length > 0 },
    { id: 'custPincode', test: v => /^\d{6}$/.test(v.trim()) },
  ];

  checks.forEach(({ id, test }) => {
    const el = document.getElementById(id);
    const field = el.closest('.field');
    if (!test(el.value)) {
      field.classList.add('invalid');
      valid = false;
    } else {
      field.classList.remove('invalid');
    }
  });

  return valid;
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  const errorBox = document.getElementById('checkoutError');
  errorBox.classList.remove('show');

  if (!validateCheckoutForm()) return;

  const btn = document.getElementById('placeOrderBtn');
  btn.disabled = true;
  btn.textContent = 'Placing order…';

  const itemsSubtotal = cartTotal();
  const deliveryCharge = computeDelivery(itemsSubtotal);

  const orderPayload = {
    customerName: document.getElementById('custName').value.trim(),
    mobile: document.getElementById('custMobile').value.trim(),
    address: document.getElementById('custAddress').value.trim(),
    city: document.getElementById('custCity').value.trim(),
    pincode: document.getElementById('custPincode').value.trim(),
    landmark: document.getElementById('custLandmark').value.trim(),
    notes: document.getElementById('custNotes').value.trim(),
    items: CART.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
    deliveryCharge: deliveryCharge,
    totalAmount: itemsSubtotal + deliveryCharge,
  };

  try {
    const result = await callApi('placeOrder', orderPayload);
    showReceipt(result.orderId, orderPayload);
    CART = [];
    saveCart();
    renderCart();
    document.getElementById('checkoutForm').reset();
    closeModal('checkoutModal');
    openModal('confirmModal');
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Place order';
  }
}

function showReceipt(orderId, order) {
  const itemRows = order.items.map(i => `
    <div class="receipt-row"><span>${escapeHtml(i.name)} &times;${i.qty}</span><span>${formatMoney(i.price * i.qty)}</span></div>
  `).join('');

  const deliveryRow = order.deliveryCharge
    ? `<div class="receipt-row"><span>Delivery</span><span>${formatMoney(order.deliveryCharge)}</span></div>`
    : `<div class="receipt-row"><span>Delivery</span><span>Free</span></div>`;

  document.getElementById('receiptContent').innerHTML = `
    <div class="receipt-head">
      <div class="stamp">COD confirmed</div>
      <div class="order-id">#${escapeHtml(orderId)}</div>
    </div>
    <div class="receipt-divider"></div>
    ${itemRows}
    ${deliveryRow}
    <div class="receipt-divider"></div>
    <div class="receipt-row total"><span>Total to pay on delivery</span><span>${formatMoney(order.totalAmount)}</span></div>
    <div class="receipt-note">
      Thanks, ${escapeHtml(order.customerName)}! Our executive will call you shortly to confirm this order, then deliver to ${escapeHtml(order.address)}, ${escapeHtml(order.city)} and collect payment in cash on arrival.
    </div>
    <button class="continue-btn" onclick="closeModal('confirmModal')">Continue shopping</button>
  `;
}

/* ---------- Utilities ---------- */
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let toastTimer;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
