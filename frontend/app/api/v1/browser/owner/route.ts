import { NextRequest, NextResponse } from 'next/server';
import { loadClientApp, originAllowedForAnyApp } from '@/lib/server/clientApps';
import { corsHeaders } from '@/lib/server/hubHttp';
import { verifyFirebaseIdToken } from '@/lib/server/firebaseIdToken';
import { getServiceClient } from '@/lib/server/session';
import { decryptSecret } from '@/lib/payments/secretBox';

const methods = (origin: string) => ({ ...corsHeaders(origin), 'Access-Control-Allow-Methods': 'GET, PATCH, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' });
const masked = (email: string) => `${email[0] ?? ''}***@${email.split('@')[1] ?? ''}`;
const fail = (code: string, status: number, origin?: string | null) => NextResponse.json({ error: code, code }, { status, headers: origin ? methods(origin) : undefined });
export async function OPTIONS(request: NextRequest) {
 const origin=request.headers.get('origin'); if(!origin || !await originAllowedForAnyApp(origin)) return new NextResponse(null,{status:403});
 return new NextResponse(null,{status:204,headers:methods(origin)});
}
async function authorize(request: NextRequest, slug: unknown) {
 const origin=request.headers.get('origin');
 if(typeof slug!=='string'||!slug) return { response: fail('invalid_app',400,origin) };
 const app=await loadClientApp(slug); if(!app) return { response: fail('app_not_found',404,origin) };
 if(!origin||!app.allowed_origins.includes(origin)) return { response: fail('origin_not_allowed',403) };
 if(!app.firebase_project_id) return { response: fail('firebase_not_configured',400,origin) };
 const token=(request.headers.get('authorization')??'').match(/^Bearer\s+(.+)$/i)?.[1];
 let identity; try { identity=token?await verifyFirebaseIdToken(token,app.firebase_project_id):{ok:false as const,reason:'malformed' as const}; } catch { return { response: fail('token_verification_failed',502,origin) }; }
 if(!identity.ok) return { response: fail(identity.reason,identity.reason==='jwks_fetch_failed'?502:401,origin) };
 if(!(app.owner_emails??[]).map(x=>x.toLowerCase()).includes(identity.email.toLowerCase())) return { response: fail('not_owner',403,origin) };
 return { app, origin, email: identity.email.toLowerCase() };
}
async function audit(request: NextRequest, app: any, email: string, action: string, extra: Record<string,unknown>) {
 try { await getServiceClient().from('audit_logs').insert({ action, entity_type:'client_app', entity_id:app.id, business_id:app.business_id, user_id:null, new_data:{email:masked(email),...extra}, ip_address:request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??null, user_agent:request.headers.get('user-agent') }); } catch(error) { console.error('[browser/owner] audit insert failed',error); }
}
export async function GET(request: NextRequest) {
 const result=await authorize(request,new URL(request.url).searchParams.get('app')); if('response' in result) return result.response;
 const {app,origin}=result; let connection: any=null;
 if(app.connection_id) {
  try {
   const {data,error}=await getServiceClient().from('payment_connections').select('id,provider_account_id,created_at,credentials_encrypted').eq('id',app.connection_id).maybeSingle();
   if(!error&&data) { const creds=JSON.parse(decryptSecret(data.credentials_encrypted)) as {access_token?:string}; const token=creds.access_token?.trim(); let nickname=null,name=null,email=null;
    if(token) { const r=await fetch('https://api.mercadopago.com/users/me',{headers:{Authorization:`Bearer ${token}`}}); if(r.ok) { const u=await r.json() as any; nickname=typeof u.nickname==='string'?u.nickname:null; name=[u.first_name,u.last_name].filter((v)=>typeof v==='string'&&v).join(' ')||null; email=typeof u.email==='string'?u.email:null; } }
    connection={account_id:data.provider_account_id??null,nickname,name,email,connected_at:data.created_at??null};
   }
  } catch { connection=null; }
 }
 return NextResponse.json({owners:app.owner_emails??[],connection},{headers:methods(origin)});
}
function normalizeOwners(value: unknown): string[] | null {
 if(!Array.isArray(value)) return null; const values=value.map(v=>typeof v==='string'?v.trim().toLowerCase():'');
 if(values.some(v=>!v||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) return null;
 const owners=[...new Set(values)]; return owners.length>=1&&owners.length<=10?owners:null;
}
export async function PATCH(request: NextRequest) {
 let body:any; try{body=await request.json()}catch{return fail('invalid_body',400,request.headers.get('origin'))}
 const result=await authorize(request,body.app); if('response' in result)return result.response;
 const {app,origin,email}=result; const owners=normalizeOwners(body.owners); if(!owners)return fail('invalid_owners',400,origin);
 if(!owners.includes(email))return fail('cannot_remove_self',400,origin);
 const old=app.owner_emails??[]; const {error}=await getServiceClient().from('client_apps').update({owner_emails:owners}).eq('id',app.id);
 if(error)return fail('db_error',500,origin);
 await audit(request,app,email,'browser_owners_update',{old_owners:old.map(masked),new_owners:owners.map(masked)});
 return NextResponse.json({owners},{headers:methods(origin)});
}
export async function POST(request: NextRequest) {
 let body:any; try{body=await request.json()}catch{return fail('invalid_body',400,request.headers.get('origin'))}
 const result=await authorize(request,body.app); if('response' in result)return result.response;
 const {app,origin,email}=result; if(body.action!=='disconnect')return fail('invalid_action',400,origin);
 const {error}=await getServiceClient().from('client_apps').update({connection_id:null}).eq('id',app.id); if(error)return fail('db_error',500,origin);
 await audit(request,app,email,'browser_disconnect',{connection_id:app.connection_id});
 return NextResponse.json({connected:false},{headers:methods(origin)});
}
