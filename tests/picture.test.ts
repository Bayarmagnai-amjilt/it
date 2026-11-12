import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashIp, hashPictures, validPictures } from '../lib/auth/picture.ts';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

test('only 2 or 3 known pictures are accepted', () => {
  assert.ok(validPictures(['horse', 'sun']));
  assert.ok(validPictures(['horse', 'sun', 'ger']));
  assert.ok(validPictures(['star', 'star', 'star']));
  assert.ok(!validPictures(['horse']));
  assert.ok(!validPictures(['horse', 'sun', 'ger', 'moon']));
  assert.ok(!validPictures(['horse', 'dragon']));
  assert.ok(!validPictures('horse,sun'));
  assert.ok(!validPictures(null));
});

test('the hash depends on the pictures, their order and the student', () => {
  const h = hashPictures(A, ['horse', 'sun', 'ger']);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, hashPictures(A, ['horse', 'sun', 'ger']));
  assert.notEqual(h, hashPictures(A, ['sun', 'horse', 'ger']));
  assert.notEqual(h, hashPictures(B, ['horse', 'sun', 'ger']));
});

test('the server-side pepper changes every hash', () => {
  const before = hashPictures(A, ['horse', 'sun']);
  process.env.PICTURE_PASSWORD_PEPPER = 'another-secret';
  assert.notEqual(before, hashPictures(A, ['horse', 'sun']));
  delete process.env.PICTURE_PASSWORD_PEPPER;
});

test('IP addresses are stored as a short hash only', () => {
  assert.equal(hashIp(null), null);
  assert.match(hashIp('203.0.113.7') ?? '', /^[0-9a-f]{32}$/);
});
