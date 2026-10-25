import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDatabaseBackend } from '../src/services/databaseBackend.ts';

test('future Android builds default to Neon instead of Firestore', () => {
  assert.equal(resolveDatabaseBackend(undefined), 'neon');
  assert.equal(resolveDatabaseBackend(''), 'neon');
});

test('legacy Firestore backend requires an explicit build setting', () => {
  assert.equal(resolveDatabaseBackend('firestore'), 'firestore');
  assert.equal(resolveDatabaseBackend('neon'), 'neon');
  assert.throws(() => resolveDatabaseBackend('unknown'), /DATABASE_BACKEND must be neon or firestore/);
});
