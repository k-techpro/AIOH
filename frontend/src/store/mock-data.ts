/* eslint-disable @typescript-eslint/no-require-imports -- backend modules must load only after explicit backend selection. */
import {IS_NEON}from '../services/databaseBackend';
export type {Invoice,Customer,Product,Coupon,Staff,Attendance,ServiceRecord,ReturnRecord,Activity} from './recordShape';
const implementation: typeof import('./mock-data.firestore')=IS_NEON?require('./mock-data.neon'):require('./mock-data.firestore');
export const useMockStore=implementation.useMockStore;export const branches=implementation.branches;export const buildDashboard=implementation.buildDashboard;
