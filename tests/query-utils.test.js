import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEEP_LINK_QUERY_PARAM,
  decodeDeepLinkValue,
  extractDeepLinkQuery
} from '../src/utils/query.js';

test('extractDeepLinkQuery reads explicit q parameter', () => {
  const result = extractDeepLinkQuery('?q=hello%20there');
  assert.deepEqual(result, {
    rawValue: 'hello there',
    mode: 'param'
  });
});

test('extractDeepLinkQuery falls back to bare query strings', () => {
  const result = extractDeepLinkQuery('?hello%20there');
  assert.deepEqual(result, {
    rawValue: 'hello%20there',
    mode: 'entire'
  });
});

test('extractDeepLinkQuery ignores unrelated parameters', () => {
  assert.equal(extractDeepLinkQuery('?foo=bar'), null);
});

test('decodeDeepLinkValue decodes percent-encoding and pluses', () => {
  assert.equal(decodeDeepLinkValue('hello%2Bthere'), 'hello there');
  assert.equal(decodeDeepLinkValue('hello+there'), 'hello there');
});

test('decodeDeepLinkValue tolerates malformed encodings', () => {
  assert.equal(decodeDeepLinkValue('100% ready'), '100% ready');
});

test('extractDeepLinkQuery honors custom parameter names', () => {
  const search = '?prompt=hi';
  const result = extractDeepLinkQuery(search, 'prompt');
  assert.deepEqual(result, {
    rawValue: 'hi',
    mode: 'param'
  });
  assert.equal(DEEP_LINK_QUERY_PARAM, 'q');
});
