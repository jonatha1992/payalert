import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Validar firma del webhook de Mercado Pago
async function validateMercadoPagoSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false;

  try {
    // Mercado Pago usa HMAC-SHA256
    const computed = createHmac('sha256', secret).update(payload).digest('hex');
    return computed === signature;
  } catch {
    return false;
  }
}

// Guardar log del webhook
async function logWebhook(data: {
  provider: string;
  eventType?: string;
  payload: unknown;
  headers?: Record<string, string>;
  status: string;
  signatureValid?: boolean;
  signatureReceived?: string | null;
  signatureCalculated?: string;
  errorMessage?: string;
  processingTimeMs?: number;
  storeId?: string | null;
  transactionId?: string | null;
}) {
  try {
    await supabase.from('webhook_logs').insert([{
      ...data,
      processed_at: new Date().toISOString(),
    }]);
  } catch (error) {
    console.error('[Webhook Log] Error saving log:', error);
  }
}

// Obtener secret del webhook desde la base de datos
async function getWebhookSecret(): Promise<string | null> {
  try {
    // Por ahora usamos variable de entorno, pero idealmente vendría de payment_tokens
    return process.env.MP_WEBHOOK_SECRET || null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  let webhookId = '';
  let signatureValid = false;
  let storeId: string | null = null;
  let errorMessage = '';
  let transactionId: string | null = null;

  try {
    // Obtener headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Leer payload
    const payload = await request.text();
    const data = JSON.parse(payload);
    
    webhookId = data.data?.id || data.id || 'unknown';
    const topic = data.type || data.topic || data.action;

    console.log(`[Webhook MP] Recibido: id=${webhookId}, topic=${topic}`);

    // Validar firma si tenemos secret configurado
    const secret = await getWebhookSecret();
    const signature = headers['x-signature'] || headers['x-hook-signature'];
    
    if (secret) {
      signatureValid = await validateMercadoPagoSignature(payload, signature, secret);
      
      if (!signatureValid) {
        errorMessage = 'Firma de webhook inválida';
        console.error('[Webhook MP] Firma inválida');
        
        await logWebhook({
          provider: 'mercado_pago',
          eventType: topic,
          payload: data,
          headers,
          status: 'invalid',
          signatureValid: false,
          signatureReceived: signature,
          errorMessage,
          processingTimeMs: Date.now() - startTime,
        });

        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Procesar solo pagos
    if (topic?.includes('payment') && webhookId !== 'unknown') {
      // 1. Obtener detalles del pago desde MP
      const mpAccessToken = process.env.MP_ACCESS_TOKEN;

      if (!mpAccessToken) {
        errorMessage = 'MP_ACCESS_TOKEN no configurado';
        throw new Error(errorMessage);
      }

      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${webhookId}`, {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
        },
      });

      if (!mpResponse.ok) {
        errorMessage = `Error consultando pago: ${mpResponse.statusText}`;
        throw new Error(errorMessage);
      }

      const paymentData = await mpResponse.json();
      
      const { 
        status, 
        transaction_amount, 
        description, 
        external_reference,
      } = paymentData;

      // 2. Identificar tienda por external_reference
      if (external_reference) {
        // Validar que sea un UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(external_reference)) {
          storeId = external_reference;
        } else {
          // Intentar buscar tienda por otro campo si external_reference no es UUID
          console.log(`[Webhook MP] External reference no es UUID: ${external_reference}`);
        }
      }

      // 3. Buscar business_id basado en la tienda
      let businessId = null;
      if (storeId) {
        const { data: storeData } = await supabase
          .from('stores')
          .select('business_id')
          .eq('id', storeId)
          .single();
        
        if (storeData) {
          businessId = storeData.business_id;
        }
      }

      if (!businessId) {
        // Si no encontramos tienda, intentar buscar por token de pago
        const { data: tokenData } = await supabase
          .from('payment_tokens')
          .select('business_id')
          .eq('provider', 'mercado_pago')
          .eq('is_active', true)
          .limit(1)
          .single();
        
        if (tokenData) {
          businessId = tokenData.business_id;
        }
      }

      if (!businessId) {
        errorMessage = 'No se pudo identificar el negocio para este pago';
        throw new Error(errorMessage);
      }

      transactionId = `mp_${webhookId}`;

      // 4. Guardar en transacciones
      const { error: upsertError } = await supabase
        .from('transactions')
        .upsert({
          id: transactionId,
          business_id: businessId,
          store_id: storeId,
          amount: transaction_amount,
          description: description || `Pago Mercado Pago ${webhookId}`,
          status: status === 'approved' ? 'completed' : status,
          type: 'income',
          category: 'Ventas',
          provider: 'mercado_pago',
          external_id: webhookId,
          metadata: {
            ...paymentData,
            webhook_topic: topic,
            received_at: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (upsertError) {
        errorMessage = `Error guardando transacción: ${upsertError.message}`;
        throw new Error(errorMessage);
      }

      // 5. Log exitoso
      await logWebhook({
        provider: 'mercado_pago',
        eventType: topic,
        payload: data,
        headers,
        status: 'completed',
        signatureValid: signatureValid || undefined,
        signatureReceived: signature,
        processingTimeMs: Date.now() - startTime,
        storeId,
        transactionId,
      });

      console.log(`[Webhook MP] Transacción ${transactionId} procesada exitosamente`);
    }

    return NextResponse.json({ received: true, id: webhookId }, { status: 200 });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    console.error('[Webhook MP Error]:', errorMessage);

    // Log del error
    await logWebhook({
      provider: 'mercado_pago',
      payload: { error: errorMessage },
      status: 'failed',
      signatureValid,
      errorMessage,
      processingTimeMs: processingTime,
      storeId,
      transactionId,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// GET para verificación de estado
export async function GET() {
  return NextResponse.json({ 
    message: 'Mercado Pago Webhook Endpoint is active',
    timestamp: new Date().toISOString(),
    version: '2.0',
  });
}
