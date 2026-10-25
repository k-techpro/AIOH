export interface Scope { businessId: string; shopId?: string | null }
export interface Page { records: Record<string, any>[]; next_cursor: string | null; has_more: boolean }
export interface PageOptions { limit?: number; cursor?: string | null; search?: string | null; signal?: AbortSignal }
export interface Repository {
 getRecord(scope: Scope, entity: string, id: string): Promise<Record<string, any> | null>;
 mutateRecord(scope: Scope, entity: string, id: string, action: string, data: Record<string, any>, operationId: string): Promise<Record<string, any>>;
 branchOperation(scope: Scope, action: string, id: string | null, input: Record<string, any>, operationId: string): Promise<any>;
 submitAttendance(scope: Scope,input: Record<string, any>,operationId: string): Promise<any>;
 processReturn(scope: Scope,input: Record<string, any>,operationId: string): Promise<any>;
 collectReceivable(scope: Scope,id: string,payments: Record<string, any>[],operationId: string): Promise<any>;
 transferOrder(scope: Scope,input: Record<string, any>,operationId: string): Promise<any>;
 recordPayment(scope:Scope,input:Record<string,any>,operationId:string):Promise<any>;
 changeStock(scope: Scope,input: {productId:string;delta:number;expectedQuantity?:number;reason:string;operationId:string}):Promise<any>;
 listAll(scope: Scope,entity: string,options?: PageOptions): Promise<Record<string, any>[]>;
 subscribeRecords(scope: Scope,entity: string,onRows: (rows: any[])=>void,onError?: (error: Error)=>void,options?: PageOptions): {refresh():Promise<void>;unsubscribe():void};
 session(): Promise<{profile: Record<string, any>; session: Record<string, any>}>;
 listPage(scope: Scope, entity: string, options?: PageOptions): Promise<Page>;
 checkout(scope: Scope, input: {operationId: string; items: Record<string, unknown>[]; payments: Record<string, unknown>[]; customerId?: string; couponId?: string; expectedTotal?: number | string; discountOverride?: boolean; primaryMethod?: string}): Promise<Record<string, any>>;
 adjustStock(scope: Scope, input: {operationId: string; productId: string; quantity: number | string; reason: string}): Promise<Record<string, any>>;
 transferStock(scope: Scope, input: {operationId: string; destinationShopId: string; items: {product_id: string; destination_product_id: string; quantity: number | string}[]; notes?: string}): Promise<Record<string, any>>;
 createService(scope: Scope, input: {operationId: string; customerId?: string; ticket: Record<string, unknown>; items: Record<string, unknown>[]; payments: Record<string, unknown>[]; expectedTotal: number | string}): Promise<Record<string, any>>;
 postCustomerLedger(scope: Scope, input: {operationId: string; customerId: string; type: string; amount: number | string; paymentMethod?: string; notes?: string; reference?: string; receivableId?: string}): Promise<Record<string, any>>;
 subscribePage(scope: Scope, entity: string, onPage: (page: Page) => void, onError?: (error: Error) => void, options?: PageOptions): {refresh(): Promise<void>; unsubscribe(): void};
}
export class NeonDataError extends Error { code: string; status: number }
export function newOperationId(): string;
export function createNeonRepository(options: {endpoint: string; getToken: (force: boolean) => Promise<string>; fetchImpl?: typeof fetch; pollMs?: number; isActive?: () => boolean}): Repository;
