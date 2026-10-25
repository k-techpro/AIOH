// Firebase JWT + Neon Data API only. There is no secondary database path.
export class NeonDataError extends Error {
  constructor(message, code, status) { super(message); this.name = 'NeonDataError'; this.code = code; this.status = status; }
}
export const newOperationId = () => globalThis.crypto?.randomUUID?.() || `op-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
export function createNeonRepository({ endpoint, getToken, fetchImpl = globalThis.fetch, pollMs = 30000, isActive = () => true }) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.neon.tech') || !url.pathname.endsWith('/rest/v1')) throw new Error('A public HTTPS Neon Data API endpoint is required.');
  const subscribers = new Set();
  async function rpc(name, params, signal) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await getToken(attempt > 0);
      if (!token) throw new NeonDataError('Sign in before accessing business data.', 'unauthenticated', 401);
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal?.aborted) controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, 25000);
      let response;
      try {
        response = await fetchImpl(`${endpoint}/rpc/${name}`, { method: 'POST', signal: controller.signal,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept-Profile': 'retailprime', 'Content-Profile': 'retailprime' }, body: JSON.stringify(params) });
      } catch (error) {
        throw new NeonDataError(error?.name === 'AbortError' ? 'Neon request was cancelled or timed out.' : 'Neon is unavailable. Please retry.', 'network', 0);
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
      if (response.status === 401 && attempt === 0) continue;
      let result;
      try { result = await response.json(); } catch { throw new NeonDataError('Invalid database response.', 'invalid_response', response.status); }
      // PostgreSQL still denies access. Refresh only its explicit missing-JWT
      // classification, never a genuine membership/branch/role denial (42501).
      if (!response.ok && result?.code === '28000' && attempt === 0) continue;
      if (!response.ok) throw new NeonDataError(typeof result?.message === 'string' ? result.message.slice(0, 500) : 'Database request failed.', result?.code || 'database_error', response.status);
      return result;
    }
    throw new NeonDataError('Your sign-in expired.', 'unauthenticated', 401);
  }
  const context = scope => {
    if (!scope?.businessId) throw new Error('Verified business context is required.');
    return { p_owner: scope.businessId, p_shop: scope.shopId || null };
  };
  const operation = id => { if (typeof id !== 'string' || id.length < 8 || id.length > 160) throw new Error('A stable operation ID is required.'); return id; };
  async function mutate(name, params) { const result = await rpc(name, params); subscribers.forEach(refresh => refresh()); return result; }
  const api = {
    session: () => rpc('api_session_context', {}),
    getRecord: (scope, entity, id) => rpc('api_get_record', {...context(scope),p_entity:entity,p_id:id}),
    mutateRecord: (scope, entity, id, action, data, operationId) => mutate('api_mutate_record', {...context(scope),p_entity:entity,p_id:id,p_action:action,p_input:data,p_operation:operation(operationId)}),
    branchOperation: (scope, action, id, input, operationId) => mutate('api_branch_operation', {...context(scope),p_action:action,p_id:id,p_input:input,p_operation:operation(operationId)}),
    submitAttendance: (scope, input, operationId) => mutate('api_submit_attendance', {...context(scope),p_input:input,p_operation:operation(operationId)}),
    processReturn: (scope, input, operationId) => mutate('api_process_return', {...context(scope),p_input:input,p_operation:operation(operationId)}),
    collectReceivable: (scope, id, payments, operationId) => mutate('api_collect_receivable', {...context(scope),p_id:id,p_payments:payments,p_operation:operation(operationId)}),
    transferOrder: (scope,input,operationId) => mutate('api_transfer_order',{...context(scope),p_input:input,p_operation:operation(operationId)}),
    recordPayment: (scope,input,operationId)=>mutate('api_record_payment',{...context(scope),p_input:input,p_operation:operation(operationId)}),
    changeStock: (scope,input) => mutate('api_change_stock',{...context(scope),p_product:input.productId,p_delta:input.delta,p_expected:input.expectedQuantity??null,p_reason:input.reason,p_operation:operation(input.operationId)}),
    listPage: (scope, entity, { limit = 100, cursor = null, search = null, signal } = {}) => rpc('api_list_records', { ...context(scope), p_entity: entity, p_limit: Math.min(250, Math.max(1, limit)), p_after: cursor, p_search: search }, signal),
    async listAll(scope,entity,options={}) {
      const rows=new Map();let cursor=null;const cursors=new Set();
      do { const page=await api.listPage(scope,entity,{...options,limit:250,cursor});page.records.forEach(row=>rows.set(row.id,row));cursor=page.next_cursor;
        if(page.has_more&&!cursor)throw new NeonDataError('Incomplete database page.','invalid_response',0);
        if(cursor&&cursors.has(cursor))throw new NeonDataError('Database pagination did not advance.','invalid_response',0);cursors.add(cursor);
      } while(cursor);
      return [...rows.values()];
    },
    subscribeRecords(scope,entity,onRows,onError,options={}) {
      let stopped=false,busy=false,pending=false;const controller=new AbortController();
      const refresh=async()=>{if(stopped||!isActive())return;if(busy){pending=true;return;}busy=true;
        try{const rows=await api.listAll(scope,entity,{...options,signal:controller.signal});if(!stopped)onRows(rows);}catch(error){if(!stopped)onError?.(error);}
        finally{busy=false;if(pending&&!stopped){pending=false;void refresh();}}};
      subscribers.add(refresh);const timer=setInterval(()=>void refresh(),Math.max(5000,pollMs));void refresh();
      return{refresh,unsubscribe(){stopped=true;controller.abort();clearInterval(timer);subscribers.delete(refresh);}};
    },
    checkout: (scope, input) => mutate('api_checkout', { ...context(scope), p_operation: operation(input.operationId), p_input: {
      items: input.items, customer_id: input.customerId || null, payments: input.payments, coupon_id: input.couponId || null,
      expected_total: input.expectedTotal, discount_override: input.discountOverride === true, primary_method: input.primaryMethod || 'Split',
    } }),
    adjustStock: (scope, input) => mutate('api_adjust_stock', { ...context(scope), p_product: input.productId, p_quantity: input.quantity, p_reason: input.reason, p_operation: operation(input.operationId) }),
    transferStock: (scope, input) => mutate('api_transfer_stock', { ...context(scope), p_operation: operation(input.operationId), p_input: {
      to_shop_id: input.destinationShopId, items: input.items, notes: input.notes || '',
    } }),
    createService: (scope, input) => mutate('api_create_service', { ...context(scope), p_operation: operation(input.operationId), p_input: {
      customer_id: input.customerId || null, ticket: input.ticket, items: input.items, payments: input.payments, expected_total: input.expectedTotal,
    } }),
    postCustomerLedger: (scope, input) => mutate('api_post_customer_ledger', { ...context(scope), p_customer: input.customerId, p_operation: operation(input.operationId), p_input: {
      type: input.type, amount: input.amount, payment_method: input.paymentMethod, notes: input.notes || '', reference: input.reference,
      ...(input.receivableId ? { receivable_id: input.receivableId } : {}),
    } }),
    subscribePage(scope, entity, onPage, onError, options = {}) {
      let stopped = false, inFlight = false, pending = false;
      const controller = new AbortController();
      const refresh = async () => {
        if (stopped || !isActive()) return;
        if (inFlight) { pending = true; return; }
        inFlight = true;
        try { const page = await api.listPage(scope, entity, { ...options, signal: controller.signal }); if (!stopped) onPage(page); }
        catch (error) { if (!stopped) onError?.(error); }
        finally { inFlight = false; if (pending && !stopped) { pending = false; void refresh(); } }
      };
      subscribers.add(refresh);
      const timer = setInterval(() => { void refresh(); }, Math.max(5000, pollMs));
      void refresh();
      return { refresh, unsubscribe() { stopped = true; controller.abort(); clearInterval(timer); subscribers.delete(refresh); } };
    },
  };
  return api;
}
