/* eslint-disable @typescript-eslint/no-require-imports -- backend modules must load only after explicit backend selection. */
import {IS_NEON} from './databaseBackend';
export type {Access,GateStatus} from './business.firestore';
const implementation: typeof import('./business.firestore')=IS_NEON?require('./business.neon'):require('./business.firestore');
export const useBusiness=implementation.useBusiness;export const OWNER_UID=implementation.OWNER_UID;export const RETIRED_BRANCHES=implementation.RETIRED_BRANCHES;
