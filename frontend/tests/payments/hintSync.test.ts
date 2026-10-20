import { describe, expect, it, vi } from 'vitest';
import { synchronizeHint, type HintSyncDependencies } from '@/lib/payments/hintSync';
import { MercadoPagoConnector } from '@/lib/payments/connectors/mercadopago';
import type { PaymentConnection } from '@/lib/payments/types';
import { randomBytes } from 'node:crypto';
import { encryptSecret } from '@/lib/payments/secretBox';
process.env.PAYMENTS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
const connection: PaymentConnection = { id:'c1', businessId:'biz', storeId:null, provider:'mercado_pago', providerAccountId:'acct', status:'CONNECTED', credentials:{access_token:'mock'}, webhookSecret:null };
function setup(appearsAt?:number, fail?:Error, active=true) {
 let state='PENDING', syncCalls=0, pushed=0, conditionalUpdates=0, mpCalls=0, connectionQueries=0; const logs:Record<string,unknown>[]=[];
 const makeBuilder=(table:string)=>{ let operation='select'; const filters:Record<string,unknown>={}; const b:Record<string,any>={};
  b.select=vi.fn(()=>{operation='select';return b;}); b.update=vi.fn((values:Record<string,unknown>)=>{operation='update';b.values=values;return b;});
  for(const m of ['eq','in','gte','lte']) b[m]=vi.fn((key:string,value:unknown)=>{filters[key]=value;return b;});
  b.maybeSingle=vi.fn(async()=>({data:state==='PENDING'?{provider_status:state,amount:100}:{provider_status:state},error:null}));
  b.then=(resolve:(x:unknown)=>unknown,reject?:(e:unknown)=>unknown)=>{let result:unknown;
   if(table==='payment_connections'&&operation==='select'){connectionQueries++;result={data:active?[{id:connection.id,business_id:'biz',store_id:null,provider:'mercado_pago',provider_account_id:'acct',status:'CONNECTED',credentials_encrypted:encryptSecret(JSON.stringify({access_token:'mock'})),webhook_secret_encrypted:null}]:[],error:null};}
   else if(table==='transactions'&&operation==='select') result={data:state==='PENDING'?{provider_status:state,amount:100}:{provider_status:state},error:null};
   else if(table==='transactions'&&operation==='update'){conditionalUpdates++;const matches=state==='PENDING'&&filters.provider_status==='PENDING';if(matches&&b.values?.provider_status==='CONFIRMED')state='CONFIRMED';result={data:matches?[{id:filters.id}]:[],error:null};}
   else result={data:null,error:null}; return Promise.resolve(result).then(resolve,reject);}; return b; };
 const db={from:vi.fn((table:string)=>makeBuilder(table))} as never;
 const mp=new MercadoPagoConnector(vi.fn(async()=>{mpCalls++;if(fail)throw fail;return new Response(JSON.stringify({results:[{id:'real',status:'approved',transaction_amount:100,date_approved:new Date().toISOString(),payment_type_id:'bank_transfer',collector_id:'acct'}]}),{status:200});}) as typeof fetch);
  const deps:HintSyncDependencies={db,getConnector:()=>mp,ingest:async({transaction})=>{syncCalls++;if(fail)throw fail;if(syncCalls===appearsAt)state='CONFIRMED';return 'processed';},sendPush:async()=>{pushed++;},sleep:async()=>{},logger:(_e,f)=>logs.push(f),oauth:null};
 return {deps,values:()=>({state,syncCalls,pushed,conditionalUpdates,mpCalls,connectionQueries,logs})};
}
describe('synchronizeHint',()=>{
 it('confirms on the second attempt',async()=>{const h=setup(2);await synchronizeHint('biz',null,'hint',h.deps);expect(h.values().state).toBe('CONFIRMED');expect(h.values().pushed).toBe(1);expect(h.values().conditionalUpdates).toBe(0);});
 it('remains pending after retries, no confirmation push/error',async()=>{const h=setup();await synchronizeHint('biz',null,'hint',h.deps);expect(h.values().state).toBe('PENDING');expect(h.values().pushed).toBe(0);expect(h.values().logs.some(x=>x.outcome==='error')).toBe(false);});
 it('handles no active connection',async()=>{const h=setup(undefined,undefined,false);await synchronizeHint('biz',null,'hint',h.deps);expect(h.values().connectionQueries).toBe(1);expect(h.values().mpCalls).toBe(0);expect(h.values().syncCalls).toBe(0);});
 it('coalesces concurrent requests',async()=>{const h=setup(1);await Promise.all([synchronizeHint('biz',null,'hint',h.deps),synchronizeHint('biz',null,'other',h.deps)]);expect(h.values().syncCalls).toBe(1);expect(h.values().pushed).toBe(1);});
 it('logs actual MP error',async()=>{const h=setup(undefined,new Error('MP simulated outage'));await synchronizeHint('biz',null,'hint',h.deps);expect(h.values().logs.some(x=>x.cause==='MP simulated outage')).toBe(true);});
});
