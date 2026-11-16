import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const {loadClientApp,verifyFirebaseIdToken,insert,update,select}=vi.hoisted(()=>({loadClientApp:vi.fn(),verifyFirebaseIdToken:vi.fn(),insert:vi.fn(),update:vi.fn(),select:vi.fn()}));
vi.mock('@/lib/server/clientApps',()=>({loadClientApp,originAllowedForAnyApp:vi.fn()}));
vi.mock('@/lib/server/firebaseIdToken',()=>({verifyFirebaseIdToken}));
vi.mock('@/lib/payments/secretBox',()=>({decryptSecret:vi.fn()}));
vi.mock('@/lib/server/session',()=>({getServiceClient:()=>({from:(table:string)=>({insert,update:(v:unknown)=>{update(v);return{eq:async()=>({error:null})}},select:(cols:string)=>{select(table,cols);return{eq:()=>({maybeSingle:async()=>({data:null,error:null})})}}})})}));
import { GET,PATCH,POST } from '@/app/api/v1/browser/owner/route';
const app={id:'a1',slug:'app',connection_id:'c1',firebase_project_id:'p',owner_emails:['owner@example.com'],allowed_origins:['https://app.test'],business_id:'b'};
const req=(method:string,body?:unknown,url='https://payalert.test/api/v1/browser/owner?app=app')=>new NextRequest(url,{method,headers:{origin:'https://app.test',authorization:'Bearer tok','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
beforeEach(()=>{vi.clearAllMocks();loadClientApp.mockResolvedValue(app);verifyFirebaseIdToken.mockResolvedValue({ok:true,uid:'u',email:'owner@example.com'});insert.mockResolvedValue({error:null});select.mockImplementation(()=>{});});
describe('browser owner endpoints',()=>{
 it('403 not_owner',async()=>{verifyFirebaseIdToken.mockResolvedValue({ok:true,uid:'u',email:'x@example.com'});expect((await GET(req('GET')) as any).status).toBe(403)});
 it('GET sin conexión',async()=>{loadClientApp.mockResolvedValue({...app,connection_id:null});const r=await GET(req('GET')) as any;expect(await r.json()).toEqual({owners:['owner@example.com'],connection:null})});
 it('PATCH valida emails',async()=>{for(const owners of [[],['bad'],Array.from({length:11},(_,i)=>`a${i}@b.com`)])
      expect(((await PATCH(req('PATCH',{app:'app',owners}))) as any).status).toBe(400)});
 it('PATCH cannot_remove_self',async()=>{const r=await PATCH(req('PATCH',{app:'app',owners:['other@example.com']})) as any;expect(r.status).toBe(400);expect(await r.json()).toMatchObject({code:'cannot_remove_self'})});
 it('PATCH ok',async()=>{const r=await PATCH(req('PATCH',{app:'app',owners:[' OWNER@example.com ','other@example.com','other@example.com']})) as any;expect(r.status).toBe(200);expect(await r.json()).toEqual({owners:['owner@example.com','other@example.com']});expect(update).toHaveBeenCalledWith({owner_emails:['owner@example.com','other@example.com']});expect(insert).toHaveBeenCalledWith(expect.objectContaining({action:'browser_owners_update'}))});
 it('POST disconnect pone connection_id null',async()=>{const r=await POST(req('POST',{app:'app',action:'disconnect'})) as any;expect(r.status).toBe(200);expect(await r.json()).toEqual({connected:false});expect(update).toHaveBeenCalledWith({connection_id:null});expect(insert).toHaveBeenCalledWith(expect.objectContaining({action:'browser_disconnect'}))});
});
