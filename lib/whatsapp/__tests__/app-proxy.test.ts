import test from 'node:test';
import assert from 'node:assert/strict';

import { verifyShopifyAppProxy } from '../../shopify-app-proxy';

test('Shopify app proxy signatures are verified using grouped, sorted parameters', () => {
  const params = new URLSearchParams('extra=1&extra=2&shop=shop-name.myshopify.com&logged_in_customer_id=1&path_prefix=%2Fapps%2Fawesome_reviews&timestamp=1317327555&signature=4c68c8624d737112c91818c11017d24d334b524b5c2b8ba08daa056f7395ddb');
  assert.equal(verifyShopifyAppProxy(params, 'hush'), false, 'rejects a mistyped signature');
  params.set('signature', '4c68c8624d737112c91818c11017d24d334b524cb5c2b8ba08daa056f7395ddb');
  assert.equal(verifyShopifyAppProxy(params, 'hush'), true);
  params.set('shop', 'attacker.myshopify.com');
  assert.equal(verifyShopifyAppProxy(params, 'hush'), false);
});
