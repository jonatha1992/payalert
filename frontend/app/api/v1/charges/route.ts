import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { loadClientApp, originAllowed } from '@/lib/server/clientApps';
import { firebaseForClientApp } from '@/lib/server/firebaseAdmin';
import { createCharge, findCharge } from '@/lib/server/hubCharges';
import { getServiceClient } from '@/lib/server/session';
const cors = (origin: string) => ({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', Vary: 'Origin' });
export async function OPTIONS(request: NextRequest) {
 const app=await loadClientApp(request.nextUrl.searchParams.get('app') ?? ''); const origin=request.headers.get('origin');
 return app && originAllowed(app,origin) ? new NextResponse(null,{status:204,headers:cors(origin!)}) : new NextResponse(null,{status:403});
}
export async function POST(request: NextRequest) {
 const origin=request.headers.get('origin'); let headers:Record<string,string>={};
 try {
  const body=await request.json() as {app?:unknown;bookingId?:unknown};
  if(typeof body.app!=='string'||typeof body.bookingId!=='string'||!body.bookingId) return NextResponse.json({error:'invalid_request'},{status:400});
  const app=await loadClientApp(body.app); if(!app) return NextResponse.json({error:'unknown_app'},{status:404});
  if(!originAllowed(app,origin)) return NextResponse.json({error:'origin_denied'},{status:403}); headers=cors(origin!);
  const bearer=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]; if(!bearer) return NextResponse.json({error:'unauthorized'},{status:401,headers});
  const {auth,firestore}=firebaseForClientApp(app); let decoded;
  try { decoded=await auth.verifyIdToken(bearer); } catch { return NextResponse.json({error:'unauthorized'},{status:401,headers}); }
  const bookingRef=firestore.collection('bookings').doc(body.bookingId); const bookingSnap=await bookingRef.get();
  if(!bookingSnap.exists) return NextResponse.json({error:'booking_not_found'},{status:404,headers}); const booking=bookingSnap.data()!;
  if(booking.uid!==decoded.uid) return NextResponse.json({error:'forbidden'},{status:403,headers});
  if(booking.status!=='pendiente') return NextResponse.json({error:'booking_not_pending'},{status:409,headers});
  const old=await findCharge(app.id,body.bookingId); if(old?.preference_id) return NextResponse.json({init_point:old.preference_id},{headers});
  const configured=booking.config?.pagos?.senia; const amount=configured===undefined?app.deposit_default:configured;
  if(!Number.isInteger(amount)||amount<1||amount>1000000) return NextResponse.json({error:'invalid_deposit'},{status:422,headers});
  const {data:connection,error}=await getServiceClient().from('payment_connections').select('credentials_encrypted').eq('id',app.connection_id).eq('business_id',app.business_id).single(); if(error) throw error;
  const {decryptSecret}=await import('@/lib/payments/secretBox'); const credentials=JSON.parse(decryptSecret(connection.credentials_encrypted)) as {access_token:string};
  const now=Date.now(), expires=new Date(now+15*60_000), ref=randomUUID(); const endpoint='https://api.mercadopago.com/checkout/preferences';
  const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${credentials.access_token}`,'Content-Type':'application/json','X-Idempotency-Key':`${app.id}:${body.bookingId}`},body:JSON.stringify({items:[{title:'Seña de turno',quantity:1,currency_id:'ARS',unit_price:amount/100}],external_reference:ref,notification_url:`${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,back_urls:{success:`${origin}/?pago=exito`,failure:`${origin}/?pago=error`,pending:`${origin}/?pago=pendiente`},auto_return:'approved',expires:true,date_of_expiration:expires.toISOString()})});
  if(!response.ok) throw new Error(`Mercado Pago preference request failed (${response.status})`); const preference=await response.json() as {id:string;init_point:string};
  const charge=await createCharge({client_app_id:app.id,booking_id:body.bookingId,external_reference:ref,amount,currency:'ARS',preference_id:preference.init_point,expires_at:expires.toISOString(),idempotency_key:`${app.id}:${body.bookingId}`});
  await bookingRef.update({'pago.estado':'pendiente',preferenceId:preference.id,pagoVenceEn:expires});
  return NextResponse.json({init_point:preference.init_point,chargeId:charge.id},{headers});
 } catch(error) { console.error('hub_charge_create_failed',error instanceof Error?error.name:'unknown'); return NextResponse.json({error:'charge_creation_failed'},{status:500,headers}); }
}
