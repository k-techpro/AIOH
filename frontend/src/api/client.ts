/* eslint-disable @typescript-eslint/no-require-imports -- backend modules load only after explicit backend selection. */
import {IS_NEON}from '../services/databaseBackend';
export const api:typeof import('./client.firestore').api=IS_NEON?require('./client.neon').api:require('./client.firestore').api;
