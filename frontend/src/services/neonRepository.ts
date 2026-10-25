import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { AppState } from 'react-native';
import { createNeonRepository, type Scope } from './neon/client';

const endpoint = process.env.EXPO_PUBLIC_NEON_DATA_API_URL || 'https://ep-curly-field-b3bee2jv.apirest.c-4.ap-southeast-1.aws.neon.tech/neondb/rest/v1';
export const neonRepository = createNeonRepository({ endpoint,
  getToken: async force => { const user = getAuth(getApp()).currentUser; if (!user) throw new Error('Sign in to continue.'); return user.getIdToken(force); },
  isActive: () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
});
export function completeNeonSale(scope: Scope, sale: Record<string, any>, customer: {id: string} | null, coupon: {id: string} | null = null) {
  return neonRepository.checkout(scope, {
    operationId: sale.operation_id, customerId: customer?.id, couponId: coupon?.id,
    items: (sale.items || []).map((i: Record<string, any>) => ({product_id: i.productId ?? i.product_id, qty: i.qty ?? i.quantity, price: i.price, gst: i.gst, discount: i.discount ?? 0})),
    payments: sale.paymentBreakdown ?? sale.payment_breakdown ?? [], expectedTotal: sale.grandTotal ?? sale.total,
    discountOverride: sale.discount_override === true || !!sale.discount_override?.override_reason, primaryMethod: sale.paymentMethod ?? sale.payment_method,
  });
}

export function createNeonService(scope: Scope, service: Record<string, any>) {
  return neonRepository.createService(scope, {operationId: service.operation_id, customerId: service.customer_id,
    ticket: service, items: service.items || [], payments: service.paymentBreakdown || [], expectedTotal: service.total});
}
