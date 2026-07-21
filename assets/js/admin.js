/* ============================================================
 *  ADMIN PANEL LOGIC
 * ============================================================ */

let ADMIN_PASSWORD = sessionStorage.getItem('admin_pw') || '';
let ADMIN_PRODUCTS = [];
let ADMIN_ORDERS = [];
let ADMIN_GALLERY = [];
let ADMIN_BANNERS = [];
let PENDING_IMAGE = null; // { base64, mimeType, filename }
let PENDING_GALLERY_IMAGE = null;
let PENDING_BANNER_IMAGE = null;

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.brand-mark').forEach(el => {
    if (el.textContent === 'Admin panel') return;
  });

  if (ADMIN_PASSWORD) {
    showDashboard();
  } else {
    showLogin();
  }

  bindLogin();
  bindTabs();
  bindProductModal();
  bindGalleryModal();
  bindBannerModal();
  bindSettingsForm();
});

/* ---------- Login ---------- */
function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminWrap').style.display = 'none';
}

function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminWrap').style.display = 'block';
  loadProductsAdmin();
  loadOrdersAdmin();
  loadGalleryAdmin();
  loadBannersAdmin();
  loadSettingsAdmin();
}

function bindLogin() {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = document.getElementById('adminPassword').value;
    const btn = document.getElementById('loginBtn');
    const errorBox = document.getElementById('loginError');
    errorBox.classList.remove('show');
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    try {
      await callApi('adminLogin', { password: pw });
      ADMIN_PASSWORD = pw;
      sessionStorage.setItem('admin_pw', pw);
      showDashboard();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('admin_pw');
    ADMIN_PASSWORD = '';
    showLogin();
  });
}

/* ---------- Tabs ---------- */
function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

/* ---------- Products ---------- */
async function loadProductsAdmin() {
  const wrap = document.getElementById('productsTableWrap');
  try {
    const data = await callApi('getAdminProducts', { password: ADMIN_PASSWORD });
    ADMIN_PRODUCTS = data.products || [];
    renderProductsTable();
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function renderProductsTable() {
  const wrap = document.getElementById('productsTableWrap');

  if (ADMIN_PRODUCTS.length === 0) {
    wrap.innerHTML = '<div class="empty-state">No products yet. Add your first one.</div>';
    return;
  }

  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th></th><th>Name</th><th>Category</th><th>Price</th><th>Discount</th><th>Stock</th><th>Video</th><th>Status</th><th></th>
        </tr>
      </thead>
      <tbody>
        ${ADMIN_PRODUCTS.map(p => `
          <tr>
            <td>${p.imageUrl ? `<img class="table-thumb" src="${escapeHtml(p.imageUrl)}">` : '<div class="table-thumb"></div>'}</td>
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.category || '—')}</td>
            <td>${formatMoney(p.price)}</td>
            <td>${p.discount ? escapeHtml(p.discount) + '%' : '—'}</td>
            <td>${escapeHtml(p.stock)}</td>
            <td>${p.videoUrl ? '✅' : '—'}</td>
            <td><span class="badge ${p.active ? 'active' : 'inactive'}">${p.active ? 'Visible' : 'Hidden'}</span></td>
            <td>
              <div class="table-actions">
                <button class="icon-btn" data-edit="${escapeHtml(p.id)}">Edit</button>
                <button class="icon-btn danger" data-delete="${escapeHtml(p.id)}">Delete</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  wrap.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openProductModal(b.dataset.edit)));
  wrap.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.delete)));
}

function bindProductModal() {
  document.getElementById('newProductBtn').addEventListener('click', () => openProductModal(null));
  document.getElementById('productForm').addEventListener('submit', saveProduct);
  document.getElementById('prodImage').addEventListener('change', handleImageSelect);
  document.getElementById('overlay') || createOverlayIfMissing();
}

function createOverlayIfMissing() {
  // admin.html has no cart drawer, so add a lightweight overlay for modal backdrop clicks
  if (document.getElementById('overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'overlay';
  overlay.className = 'overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', () => closeModal('productModal'));
}

function openModal(id) {
  createOverlayIfMissing();
  document.getElementById('overlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.classList.remove('open');
}

function openProductModal(id) {
  const form = document.getElementById('productForm');
  form.reset();
  document.getElementById('productError').classList.remove('show');
  document.getElementById('imagePreviewWrap').innerHTML = '';
  PENDING_IMAGE = null;

  if (id) {
    const p = ADMIN_PRODUCTS.find(x => String(x.id) === String(id));
    document.getElementById('productModalTitle').textContent = 'Edit product';
    document.getElementById('prodId').value = p.id;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodDescription').value = p.description || '';
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodStock').value = p.stock;
    document.getElementById('prodDiscount').value = p.discount || 0;
    document.getElementById('prodVideoUrl').value = p.videoUrl || '';
    document.getElementById('prodCategory').value = p.category || '';
    document.getElementById('prodActive').checked = !!p.active;
    if (p.imageUrl) {
      document.getElementById('imagePreviewWrap').innerHTML = `<img src="${escapeHtml(p.imageUrl)}">`;
      PENDING_IMAGE = { existingUrl: p.imageUrl };
    }
  } else {
    document.getElementById('productModalTitle').textContent = 'Add product';
    document.getElementById('prodId').value = '';
    document.getElementById('prodDiscount').value = 0;
    document.getElementById('prodActive').checked = true;
  }

  openModal('productModal');
}

function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    PENDING_IMAGE = { base64: reader.result, mimeType: file.type, filename: file.name };
    document.getElementById('imagePreviewWrap').innerHTML = `<img src="${reader.result}">`;
  };
  reader.readAsDataURL(file);
}

async function saveProduct(e) {
  e.preventDefault();
  const btn = document.getElementById('saveProductBtn');
  const errorBox = document.getElementById('productError');
  errorBox.classList.remove('show');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    let imageUrl = PENDING_IMAGE && PENDING_IMAGE.existingUrl ? PENDING_IMAGE.existingUrl : '';

    if (PENDING_IMAGE && PENDING_IMAGE.base64) {
      btn.textContent = 'Uploading image…';
      const uploadResult = await callApi('uploadImage', {
        password: ADMIN_PASSWORD,
        base64: PENDING_IMAGE.base64,
        mimeType: PENDING_IMAGE.mimeType,
        filename: PENDING_IMAGE.filename,
      });
      imageUrl = uploadResult.url;
    }

    btn.textContent = 'Saving…';
    const id = document.getElementById('prodId').value;
    const payload = {
      password: ADMIN_PASSWORD,
      name: document.getElementById('prodName').value.trim(),
      description: document.getElementById('prodDescription').value.trim(),
      price: document.getElementById('prodPrice').value,
      stock: document.getElementById('prodStock').value,
      discount: document.getElementById('prodDiscount').value || 0,
      videoUrl: document.getElementById('prodVideoUrl').value.trim(),
      category: document.getElementById('prodCategory').value.trim(),
      active: document.getElementById('prodActive').checked,
      imageUrl,
    };

    if (id) {
      payload.id = id;
      await callApi('updateProduct', payload);
    } else {
      await callApi('addProduct', payload);
    }

    closeModal('productModal');
    showToast('Product saved');
    loadProductsAdmin();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save product';
  }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  try {
    await callApi('deleteProduct', { password: ADMIN_PASSWORD, id });
    showToast('Product deleted');
    loadProductsAdmin();
  } catch (err) {
    showToast(err.message);
  }
}

/* ---------- Orders ---------- */
async function loadOrdersAdmin() {
  const wrap = document.getElementById('ordersTableWrap');
  try {
    const data = await callApi('getOrders', { password: ADMIN_PASSWORD });
    ADMIN_ORDERS = data.orders || [];
    renderOrderStats();
    renderOrdersTable();
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function renderOrderStats() {
  const total = ADMIN_ORDERS.length;
  const pending = ADMIN_ORDERS.filter(o => o.status === 'Pending').length;
  const revenue = ADMIN_ORDERS
    .filter(o => o.status !== 'Cancelled')
    .reduce((s, o) => s + Number(o.totalAmount || 0), 0);

  document.getElementById('orderStats').innerHTML = `
    <span class="stat-pill">${total} orders</span>
    <span class="stat-pill">${pending} pending</span>
    <span class="stat-pill">${formatMoney(revenue)} total</span>
  `;
}

function renderOrdersTable() {
  const wrap = document.getElementById('ordersTableWrap');

  if (ADMIN_ORDERS.length === 0) {
    wrap.innerHTML = '<div class="empty-state">No orders yet.</div>';
    return;
  }

  const statuses = ['Pending', 'Confirmed', 'Out for delivery', 'Delivered', 'Cancelled'];

  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Order</th><th>Customer</th><th>Mobile</th><th>Address</th><th>Items</th><th>Total</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${ADMIN_ORDERS.map(o => `
          <tr>
            <td>${escapeHtml(o.orderId)}<br><small>${formatDate(o.timestamp)}</small></td>
            <td>${escapeHtml(o.customerName)}</td>
            <td>${escapeHtml(o.mobile)}</td>
            <td class="order-items-cell">${escapeHtml(o.address)}, ${escapeHtml(o.city)} - ${escapeHtml(o.pincode)}${o.landmark ? '<br>Landmark: ' + escapeHtml(o.landmark) : ''}</td>
            <td class="order-items-cell">${formatItems(o.items)}</td>
            <td>${formatMoney(o.totalAmount)}</td>
            <td>
              <select class="status-select ${escapeHtml((o.status || '').replace(' ', ''))}" data-status="${escapeHtml(o.orderId)}">
                ${statuses.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  wrap.querySelectorAll('[data-status]').forEach(sel => {
    sel.addEventListener('change', () => updateOrderStatus(sel.dataset.status, sel.value));
  });
}

function formatItems(itemsJson) {
  try {
    const items = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson;
    return items.map(i => `${escapeHtml(i.name)} &times;${i.qty}`).join('<br>');
  } catch (e) {
    return '';
  }
}

function formatDate(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function updateOrderStatus(orderId, status) {
  try {
    await callApi('updateOrderStatus', { password: ADMIN_PASSWORD, orderId, status });
    showToast('Order status updated');
    const order = ADMIN_ORDERS.find(o => o.orderId === orderId);
    if (order) order.status = status;
    renderOrderStats();
  } catch (err) {
    showToast(err.message);
  }
}

/* ---------- Delivery settings ---------- */
async function loadSettingsAdmin() {
  try {
    const data = await callApi('getSettings', { password: ADMIN_PASSWORD });
    const s = data.settings || {};
    document.getElementById('deliveryCharge').value = s.deliveryCharge;
    document.getElementById('freeDeliveryThreshold').value = s.freeDeliveryThreshold;
  } catch (err) {
    showToast(err.message);
  }
}

function bindSettingsForm() {
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveSettingsBtn');
    const errorBox = document.getElementById('settingsError');
    errorBox.classList.remove('show');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await callApi('updateSettings', {
        password: ADMIN_PASSWORD,
        deliveryCharge: document.getElementById('deliveryCharge').value,
        freeDeliveryThreshold: document.getElementById('freeDeliveryThreshold').value,
      });
      showToast('Delivery settings saved');
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save delivery settings';
    }
  });
}

/* ---------- Gallery ---------- */
async function loadGalleryAdmin() {
  const wrap = document.getElementById('galleryAdminWrap');
  try {
    const data = await callApi('getGallery', { password: ADMIN_PASSWORD });
    ADMIN_GALLERY = data.images || [];
    renderGalleryAdmin();
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function renderGalleryAdmin() {
  const wrap = document.getElementById('galleryAdminWrap');
  if (ADMIN_GALLERY.length === 0) {
    wrap.innerHTML = '<div class="empty-state">No gallery photos yet.</div>';
    return;
  }
  wrap.innerHTML = `
    <div class="media-admin-grid">
      ${ADMIN_GALLERY.map(img => `
        <div class="media-admin-item">
          <img src="${escapeHtml(img.imageUrl)}">
          <div class="media-admin-caption">${escapeHtml(img.caption || '')}</div>
          <div class="media-admin-actions">
            <button class="icon-btn danger" data-gallery-delete="${escapeHtml(img.id)}">Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  wrap.querySelectorAll('[data-gallery-delete]').forEach(b =>
    b.addEventListener('click', () => deleteGalleryImage(b.dataset.galleryDelete)));
}

function bindGalleryModal() {
  document.getElementById('newGalleryBtn').addEventListener('click', () => {
    document.getElementById('galleryForm').reset();
    document.getElementById('galleryError').classList.remove('show');
    document.getElementById('galleryPreviewWrap').innerHTML = '';
    PENDING_GALLERY_IMAGE = null;
    openModal('galleryModal');
  });

  document.getElementById('galleryImage').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      PENDING_GALLERY_IMAGE = { base64: reader.result, mimeType: file.type, filename: file.name };
      document.getElementById('galleryPreviewWrap').innerHTML = `<img src="${reader.result}" style="width:90px;height:90px;object-fit:cover;border-radius:8px;margin-top:10px;">`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('galleryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveGalleryBtn');
    const errorBox = document.getElementById('galleryError');
    errorBox.classList.remove('show');

    if (!PENDING_GALLERY_IMAGE) {
      errorBox.textContent = 'Please choose a photo';
      errorBox.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Uploading…';
    try {
      const uploadResult = await callApi('uploadImage', {
        password: ADMIN_PASSWORD,
        base64: PENDING_GALLERY_IMAGE.base64,
        mimeType: PENDING_GALLERY_IMAGE.mimeType,
        filename: PENDING_GALLERY_IMAGE.filename,
      });
      await callApi('addGalleryImage', {
        password: ADMIN_PASSWORD,
        imageUrl: uploadResult.url,
        caption: document.getElementById('galleryCaption').value.trim(),
      });
      closeModal('galleryModal');
      showToast('Photo added to gallery');
      loadGalleryAdmin();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add photo';
    }
  });
}

async function deleteGalleryImage(id) {
  if (!confirm('Delete this gallery photo?')) return;
  try {
    await callApi('deleteGalleryImage', { password: ADMIN_PASSWORD, id });
    showToast('Photo deleted');
    loadGalleryAdmin();
  } catch (err) {
    showToast(err.message);
  }
}

/* ---------- Banners ---------- */
async function loadBannersAdmin() {
  const wrap = document.getElementById('bannerAdminWrap');
  try {
    const data = await callApi('getAdminBanners', { password: ADMIN_PASSWORD });
    ADMIN_BANNERS = data.banners || [];
    renderBannersAdmin();
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function renderBannersAdmin() {
  const wrap = document.getElementById('bannerAdminWrap');
  if (ADMIN_BANNERS.length === 0) {
    wrap.innerHTML = '<div class="empty-state">No banners yet.</div>';
    return;
  }
  wrap.innerHTML = `
    <div class="media-admin-grid">
      ${ADMIN_BANNERS.map(b => `
        <div class="media-admin-item banner-admin-item">
          <img src="${escapeHtml(b.imageUrl)}">
          <div class="media-admin-caption">${b.linkUrl ? escapeHtml(b.linkUrl) : 'No link'} · <span class="badge ${b.active ? 'active' : 'inactive'}">${b.active ? 'Live' : 'Hidden'}</span></div>
          <div class="media-admin-actions">
            <button class="icon-btn" data-banner-toggle="${escapeHtml(b.id)}" data-active="${b.active ? 'true' : 'false'}">${b.active ? 'Hide' : 'Show'}</button>
            <button class="icon-btn danger" data-banner-delete="${escapeHtml(b.id)}">Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  wrap.querySelectorAll('[data-banner-delete]').forEach(b =>
    b.addEventListener('click', () => deleteBanner(b.dataset.bannerDelete)));
  wrap.querySelectorAll('[data-banner-toggle]').forEach(b =>
    b.addEventListener('click', () => toggleBanner(b.dataset.bannerToggle, b.dataset.active !== 'true')));
}

function bindBannerModal() {
  document.getElementById('newBannerBtn').addEventListener('click', () => {
    document.getElementById('bannerForm').reset();
    document.getElementById('bannerError').classList.remove('show');
    document.getElementById('bannerPreviewWrap').innerHTML = '';
    PENDING_BANNER_IMAGE = null;
    openModal('bannerModal');
  });

  document.getElementById('bannerImage').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      PENDING_BANNER_IMAGE = { base64: reader.result, mimeType: file.type, filename: file.name };
      document.getElementById('bannerPreviewWrap').innerHTML = `<img src="${reader.result}" style="width:100%;max-width:260px;aspect-ratio:16/6;object-fit:cover;border-radius:8px;margin-top:10px;">`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('bannerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveBannerBtn');
    const errorBox = document.getElementById('bannerError');
    errorBox.classList.remove('show');

    if (!PENDING_BANNER_IMAGE) {
      errorBox.textContent = 'Please choose a banner image';
      errorBox.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Uploading…';
    try {
      const uploadResult = await callApi('uploadImage', {
        password: ADMIN_PASSWORD,
        base64: PENDING_BANNER_IMAGE.base64,
        mimeType: PENDING_BANNER_IMAGE.mimeType,
        filename: PENDING_BANNER_IMAGE.filename,
      });
      await callApi('addBanner', {
        password: ADMIN_PASSWORD,
        imageUrl: uploadResult.url,
        linkUrl: document.getElementById('bannerLink').value.trim(),
      });
      closeModal('bannerModal');
      showToast('Banner added');
      loadBannersAdmin();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add banner';
    }
  });
}

async function deleteBanner(id) {
  if (!confirm('Delete this banner?')) return;
  try {
    await callApi('deleteBanner', { password: ADMIN_PASSWORD, id });
    showToast('Banner deleted');
    loadBannersAdmin();
  } catch (err) {
    showToast(err.message);
  }
}

async function toggleBanner(id, active) {
  try {
    await callApi('toggleBannerActive', { password: ADMIN_PASSWORD, id, active });
    showToast(active ? 'Banner is now live' : 'Banner hidden');
    loadBannersAdmin();
  } catch (err) {
    showToast(err.message);
  }
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
