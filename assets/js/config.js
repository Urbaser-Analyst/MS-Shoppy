/**
 * ============================================================
 *  STORE CONFIGURATION
 *  Edit these values for your own store.
 * ============================================================
 */
const CONFIG = {
  // ⚠️ PASTE YOUR NEW WEB APP URL HERE (Deploy > New deployment > Web app
  // in your NEW Apps Script project). The store will show a clear error
  // instead of working until you replace this.
  API_URL: 'https://script.google.com/macros/s/AKfycbyXYw6e9clVuJzWBN5fJ3DtBKCS2JD5KLKPeTQTdlrejIkGr_ohl_PR2_6pvdmWoSYC2Q/exec',

  SITE_NAME: 'MS-Shoppy',
  TAGLINE: 'From Handmade Creations to Healthy Traditions',
  CURRENCY: '\u20B9',

  // Optional: shown on the order confirmation ticket
  SUPPORT_PHONE: '+91 9940959840 | msshoppyecom@gmail.com',

  // ------------------------------------------------------------------
  // SHOW_PRODUCT_VIDEO / SHOW_BANNER_LINKS
  // The video URL (on products) and link URL (on banners) are always
  // saved in the admin panel, but whether they show up / work on the
  // live storefront is controlled here.
  //   false = URL is stored but hidden — the video play button on
  //           products and the click-through on banners are switched
  //           off on the storefront.
  //   true  = URL is shown and active.
  // Flip to `true` whenever you're ready to switch it on. No other
  // changes needed.
  // ------------------------------------------------------------------
  SHOW_PRODUCT_VIDEO: false,
  SHOW_BANNER_LINKS: false,
};
