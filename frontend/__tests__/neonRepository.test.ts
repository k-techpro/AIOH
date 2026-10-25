import test from 'node:test';
import assert from 'node:assert/strict';
import { createNeonRepository } from '../src/services/neon/client.js';
const endpoint='https://ep-fixture.apirest.neon.tech/neondb/rest/v1';
test('mobile Neon transport preserves leading-zero lookup and branch scope',async()=>{
 const requests:{url:string;options:RequestInit}[]=[];
 const repo=createNeonRepository({endpoint,getToken:async()=> 'fixture-jwt',fetchImpl:async(input,options)=>{
  requests.push({url:String(input),options:options!});return new Response(JSON.stringify({records:[],has_more:false,next_cursor:null}));
 }});
 await repo.listPage({businessId:'owner',shopId:'shop'},'products',{search:'00123456789'});
 assert.equal(requests.length,1);assert.equal(JSON.parse(String(requests[0].options.body)).p_search,'00123456789');assert.equal(JSON.parse(String(requests[0].options.body)).p_shop,'shop');
});
test('mobile Neon failure has no Firestore fallback',async()=>{
 let requests=0;const repo=createNeonRepository({endpoint,getToken:async()=> 'fixture-jwt',fetchImpl:async()=>{requests++;throw new Error('offline');}});
 await assert.rejects(repo.listPage({businessId:'owner',shopId:'shop'},'invoices'),(e:unknown)=>e instanceof Error&&'code'in e&&e.code==='network');assert.equal(requests,1);
});

test('mobile sends service and transfer operations exclusively to Neon RPCs',async()=>{
 const requests:{url:string;body:any}[]=[];
 const repo=createNeonRepository({endpoint,getToken:async()=> 'fixture-jwt',fetchImpl:async(input,options)=>{requests.push({url:String(input),body:JSON.parse(String(options?.body))});return new Response(JSON.stringify({ok:true}));}});
 const scope={businessId:'owner',shopId:'shop'};
 await repo.createService(scope,{operationId:'fixture-service-create',ticket:{product:'Device'},items:[],payments:[],expectedTotal:0});
 await repo.transferStock(scope,{operationId:'fixture-stock-transfer',destinationShopId:'target-shop',items:[{product_id:'source',destination_product_id:'target',quantity:1}]});
 assert.ok(requests[0].url.endsWith('/rpc/api_create_service'));assert.equal(requests[0].body.p_operation,'fixture-service-create');
 assert.ok(requests[1].url.endsWith('/rpc/api_transfer_stock'));assert.equal(requests[1].body.p_input.to_shop_id,'target-shop');
});
