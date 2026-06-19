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

  // Build product metadata from whatever the theme exposes. Tags are usually NOT
  // available client-side — the app backfills them server-side from the product id.
  function buildProductMeta(product) {
    if (!product) return null;
    var meta = {};
    if (product.title) meta.title = String(product.title);
    if (product.vendor) meta.vendor = String(product.vendor);
    if (product.type) meta.productType = String(product.type);
    if (Array.isArray(product.tags) && product.tags.length) {
      meta.tags = product.tags.map(String);
    } else if (typeof product.tags === 'string' && product.tags) {
      meta.tags = product.tags.split(',').map(function (t) { return t.trim(); });
    }
    var variants = product.variants;
    if (variants && variants.length && variants[0] && variants[0].price != null) {
      var price = Number(variants[0].price);
      // Shopify analytics prices are often in cents
      meta.price = price > 1000 ? price / 100 : price;
    }
    return Object.keys(meta).length ? meta : null;
  }

  // Read a query-string param (used for search term)
  function getQueryParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  // Auto-detect page type and track
  function autoTrack() {
    // Active on Site — fire on every page load (lightweight session signal)
    sendEvent('active_on_site', null, null, { path: window.location.pathname });

    var meta = window.ShopifyAnalytics && window.ShopifyAnalytics.meta;
    if (!meta || !meta.page) return;

    var pageType = meta.page.pageType;

    if (pageType === 'product') {
      var product = meta.product || (window.meta && window.meta.product);
      var productId = product && product.id;
      var productTitle = product && product.title;
      sendEvent(
        'product_viewed',
        productId ? String(productId) : null,
        productTitle || null,
        buildProductMeta(product)
      );
    } else if (pageType === 'collection') {
      var collectionId = meta.page.resourceId;
      var collectionTitle = meta.page.title;
      sendEvent(
        'collection_viewed',
        collectionId ? String(collectionId) : null,
        collectionTitle || null,
        collectionTitle ? { collectionTitle: String(collectionTitle) } : null
      );
    } else if (pageType === 'search') {
      var query = getQueryParam('q');
      if (query) {
        sendEvent('search_submitted', null, query, { query: query });
      }
    }
  }

  // Inspect a cart request URL + parsed body and emit add/remove events.
  function handleCartRequest(url, body) {
    try {
      if (url.includes('/cart/add')) {
        var addId = body && (body.id || (body.items && body.items[0] && body.items[0].id));
        sendEvent('product_added_to_cart', addId ? String(addId) : null, null);
        return;
      }
      // /cart/change and /cart/update with quantity 0 = removal
      if (url.includes('/cart/change') || url.includes('/cart/update')) {
        if (body && body.updates && typeof body.updates === 'object') {
          // /cart/update: { updates: { variantId: qty } }
          Object.keys(body.updates).forEach(function (variantId) {
            if (Number(body.updates[variantId]) === 0) {
              sendEvent('product_removed_from_cart', String(variantId), null);
            }
          });
        } else if (body && (body.id || body.line) && Number(body.quantity) === 0) {
          sendEvent('product_removed_from_cart', String(body.id || body.line), null);
        }
      }
    } catch (e) { /* ignore */ }
  }

  // Track cart add/remove via fetch/XHR interception
  function interceptCart() {
    // Intercept fetch
    var origFetch = window.fetch;
    window.fetch = function () {
      var url = arguments[0];
      if (typeof url === 'string' && url.indexOf('/cart/') !== -1) {
        try {
          var opts = arguments[1];
          if (opts && opts.body) {
            var body = typeof opts.body === 'string' ? JSON.parse(opts.body) : null;
            if (body) handleCartRequest(url, body);
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
      if (this._trackUrl && typeof this._trackUrl === 'string' && this._trackUrl.indexOf('/cart/') !== -1) {
        try {
          var body = typeof data === 'string' ? JSON.parse(data) : null;
          if (body) handleCartRequest(this._trackUrl, body);
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
      interceptCart();
    });
  } else {
    autoTrack();
    interceptCart();
  }
})();
