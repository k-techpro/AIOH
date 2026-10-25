import {create}from 'zustand';
import {AppState}from 'react-native';
import {useAppStore}from './shop';
import {normalizeRecord}from './recordShape';
import {neonRepository}from '../services/neonRepository';
import {newOperationId}from '../services/neon/client';
import * as repository from '../services/repository.neon';
import type {useMockStore as LegacyStore}from './mock-data.firestore';
type State=ReturnType<typeof LegacyStore.getState>;
export const branches=[{id:'shop-1',name:'Poonamallee Branch',location:'Poonamallee'},{id:'shop-2',name:'Kundrathur Branch',location:'Kundrathur'}];
const names=['products','customers','coupons','invoices','staff','attendance','services','returns','shops','expenses','payments','paylater','transfers','inventoryMovements','activities','usedMobiles','productCategories']as const;
const empty=()=>({products:[],customers:[],coupons:[],invoices:[],staff:[],attendance:[],services:[],returns:[],shops:[],expenses:[],payments:[],paylater:[],transfers:[],inventoryMovements:[],activities:[],usedMobiles:[],productCategories:[]});
let stops:(()=>void)[]=[],generation=0,owner:string|null=null,actor:string|null=null,scopeKey='';
const stop=()=>{generation++;stops.forEach(s=>s());stops=[];scopeKey='';};
const connect=(businessId:string,uid?:string)=>{
 const shop=useAppStore.getState().shopId||'all',next=`${businessId}:${uid}:${shop}`;if(next===scopeKey&&stops.length)return;stop();scopeKey=next;owner=businessId;actor=uid||businessId;const epoch=generation,pending=new Set<string>(names);
 useMockStore.setState({...empty(),loading:true,hydrated:false,error:null});
 for(const name of names){const scope={businessId,shopId:shop==='all'||['shops','coupons','productCategories'].includes(name)?null:shop};
  const subscription=neonRepository.subscribeRecords(scope,name,rows=>{if(generation!==epoch)return;const normalized=rows.map(r=>normalizeRecord(name,r));pending.delete(name);useMockStore.setState({[name]:normalized,hydrated:pending.size===0,loading:pending.size!==0}as any);
   if(name==='customers'||name==='invoices'){const state=useMockStore.getState();useMockStore.setState({customers:state.customers.map(c=>({...c,invoices:state.invoices.filter(i=>i.customer_id===c.id)}))});}
  },error=>{if(generation===epoch)useMockStore.setState({loading:false,hydrated:true,error:error.message});});
  stops.push(()=>subscription.unsubscribe());const foreground=AppState.addEventListener('change',v=>{if(v==='active')void subscription.refresh();});stops.push(()=>foreground.remove());
 }
};
const scope=(shop?:string)=>{if(!owner)throw new Error('Verified access required.');return{businessId:owner,shopId:shop||useAppStore.getState().shopId};};
const save=async(name:string,data:any,shop?:string)=>{const id=data.id||newOperationId();const row=await neonRepository.mutateRecord(scope(shop||data.shop_id||data.branchId),name,id,data.id?'update':'create',repository.sanitize(data),data.operation_id||newOperationId());return normalizeRecord(name,row);};
const remove=(name:string,id:string)=>neonRepository.mutateRecord(scope(),name,id,'delete',{},newOperationId()).then(()=>{});
export const useMockStore=create<State>((set,get)=>({...empty(),hydrated:false,loading:false,error:null,connect,
 retry:()=>{if(owner){scopeKey='';connect(owner,actor||undefined);}},disconnect:()=>{stop();owner=null;actor=null;set({...empty(),hydrated:false,loading:false,error:null});},
 addCustomer:async(x,shop)=>({...await repository.createPhoneCustomer({...x,shop_id:shop}),invoices:[]}),
 saveProduct:(x,shop)=>save('products',x,shop),deleteProduct:id=>remove('products',id),
 saveCoupon:async x=>{await save('coupons',{...x,code:x.code.trim().toUpperCase()});},deleteCoupon:id=>remove('coupons',id),
 createInvoice:async x=>repository.completeSale({...x,operation_id:x.operation_id||x.id},get().customers.find(c=>c.id===x.customer_id)||null,x.coupon_id?{id:x.coupon_id}:null),
 settlePayLater:async(id,payments)=>{await neonRepository.collectReceivable(scope(),id,payments,newOperationId());},
 createReturn:async(invoice,reason)=>neonRepository.processReturn(scope(invoice.shop_id),{invoice_id:invoice.id,items:invoice.items.map(i=>({...i,returnQty:i.quantity??i.qty})),reason,restock:true,refund_method:invoice.payment_method},newOperationId()),
 saveStaff:x=>save('staff',x),setStaffStatus:async(id,status)=>{await save('staff',{id,status,active:status==='active'});},
 saveAttendance:async(staffId,date,status,shopId)=>{await neonRepository.submitAttendance(scope(shopId),{staff_id:staffId,date,status,manual:true,reason:'Staff attendance status change',staffName:get().staff.find(s=>s.id===staffId)?.name},newOperationId());},
 saveService:async x=>{if(x.id)return save('services',x,x.shop_id);if(!x.paymentBreakdown&&Number(x.price)>0)throw new Error('Complete the service billing payment split before saving.');return repository.createServiceWithUsage({...x,operation_id:x.operation_id||newOperationId(),items:x.items||[{kind:'custom',name:x.serviceName||'Service',qty:1,price:x.price||0}],total:x.total??x.price??0,paymentBreakdown:x.paymentBreakdown||[]});},
 saveUsedMobile:async x=>{const imei=String(x.imei||x.IMEI||'').trim();if(!imei)throw new Error('IMEI required.');return save('usedMobiles',{...x,imei,IMEI:imei,shop_id:x.shop_id||x.branchId});},
}));
// Keep each polling subscription bound to the selected immutable shop ID.
// Otherwise a later refresh can replace the visible catalogue with the shop
// that was selected when the session first connected.
useAppStore.subscribe((next,previous)=>{
 if(next.shopId!==previous.shopId&&owner)connect(owner,actor||undefined);
});
export {buildDashboard}from './dashboard.neon';
