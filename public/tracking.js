/**
 * Storefront Tracking Script
 * Embed in your Shopify theme to track product views, add-to-cart, and collection views.
 *
 * Usage: Add to theme.liquid before </body>:
 * <script src="https://YOUR_APP_URL/tracking.js" data-store-id="YOUR_STORE_ID"></script>
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var storeId = script.getAttribute('data-store-id');
  var apiUrl = script.src.replace(/\/tracking\.js.*$/, '/api/tracking/events');

  if (!storeId) {
    console.warn('[Tracking] Missing data-store-id attribute');
    return;
  }

  // Generate or retrieve session ID
  var SESSION_KEY = '_wsa_sid';
  var sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  // Try to get customer ID from Shopify's __st object
  function getCustomerId() {
    try {
      if (window.__st && window.__st.cid) return String(window.__st.cid);
      if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.page) {
        var cid = window.ShopifyAnalytics.meta.page.customerId;
        if (cid) return String(cid);
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function sendEvent(eventType, resourceId, resourceTitle, metadata) {
    var payload = {
      storeId: storeId,
      sessionId: sessionId,
      customerId: getCustomerId(),
      eventType: eventType,
      resourceId: resourceId || null,
      resourceTitle: resourceTitle || null,
      metadata: metadata || null,
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon(apiUrl, JSON.stringify(payload));
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', apiUrl, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(payload));
    }
  }

  // Auto-detect page type and track
  function autoTrack() {
    var meta = window.ShopifyAnalytics && window.ShopifyAnalytics.meta;
    if (!meta || !meta.page) return;

    var pageType = meta.page.pageType;

    if (pageType === 'product') {
      var productId = meta.product && meta.product.id;
      var productTitle = meta.product && meta.product.title;
      sendEvent('product_viewed', productId ? String(productId) : null, productTitle || null);
    } else if (pageType === 'collection') {
      var collectionId = meta.page.resourceId;
      var collectionTitle = meta.page.title;
      sendEvent('collection_viewed', collectionId ? String(collectionId) : null, collectionTitle || null);
    }
  }

  // Track add-to-cart via fetch/XHR interception
  function interceptAddToCart() {
    // Intercept fetch
    var origFetch = window.fetch;
    window.fetch = function () {
      var url = arguments[0];
      if (typeof url === 'string' && url.includes('/cart/add')) {
        try {
          var opts = arguments[1];
          if (opts && opts.body) {
            var body = typeof opts.body === 'string' ? JSON.parse(opts.body) : null;
            var itemId = body && (body.id || (body.items && body.items[0] && body.items[0].id));
            sendEvent('product_added_to_cart', itemId ? String(itemId) : null, null);
          }
        } catch (e) { /* ignore */ }
      }
      return origFetch.apply(this, arguments);
    };

    // Intercept XMLHttpRequest
    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      this._trackUrl = url;
      return origOpen.apply(this, arguments);
    };
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (data) {
      if (this._trackUrl && typeof this._trackUrl === 'string' && this._trackUrl.includes('/cart/add')) {
        try {
          var body = typeof data === 'string' ? JSON.parse(data) : null;
          var itemId = body && (body.id || (body.items && body.items[0] && body.items[0].id));
          sendEvent('product_added_to_cart', itemId ? String(itemId) : null, null);
        } catch (e) { /* ignore */ }
      }
      return origSend.apply(this, arguments);
    };

    // Intercept form submissions to /cart/add
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (form && form.action && form.action.includes('/cart/add')) {
        var idInput = form.querySelector('[name="id"]');
        sendEvent('product_added_to_cart', idInput ? idInput.value : null, null);
      }
    }, true);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      autoTrack();
      interceptAddToCart();
    });
  } else {
    autoTrack();
    interceptAddToCart();
  }
})();
