import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Validar firma del webhook de Ualá
async function validateUalaSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false;

  try {
    // Ualá usa HMAC-SHA256
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
    // Por ahora usamos variable de entorno
    return process.env.UALA_WEBHOOK_SECRET || null;
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
    
    webhookId = data.id || data.payment?.id || 'unknown';
    const eventType = data.event || data.type || 'unknown';

    console.log(`[Webhook Ualá] Recibido: id=${webhookId}, event=${eventType}`);

    // Validar firma si tenemos secret configurado
    const secret = await getWebhookSecret();
    const signature = headers['x-signature'] || headers['x-hook-signature'] || headers['signature'];
    
    if (secret) {
      signatureValid = await validateUalaSignature(payload, signature, secret);
      
      if (!signatureValid) {
        errorMessage = 'Firma de webhook inválida';
        console.error('[Webhook Ualá] Firma inválida');
        
        await logWebhook({
          provider: 'uala',
          eventType,
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

    // Procesar solo eventos de pago exitosos
    if (eventType?.includes('payment') && webhookId !== 'unknown') {
      // Extraer datos del pago
      const { 
        amount, 
        status, 
        description,
      } = data;

      if (!amount) {
        errorMessage = 'Monto no especificado en el webhook';
        throw new Error(errorMessage);
      }

      // Mapeo de estados de Ualá
      const mappedStatus = status === 'PAID' || status === 'approved' ? 'completed' : 
                          status === 'PENDING' ? 'pending' : 'failed';

      // Intentar identificar tienda
      const checkout_id = data.checkout_id;
      if (checkout_id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(checkout_id)) {
          storeId = checkout_id;
        }
      }

      // Buscar business_id
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
        // Buscar por token de Ualá
        const { data: tokenData } = await supabase
          .from('payment_tokens')
          .select('business_id')
          .eq('provider', 'uala')
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

      transactionId = `uala_${webhookId}`;

      // Guardar transacción
      const { error: upsertError } = await supabase
        .from('transactions')
        .upsert({
          id: transactionId,
          business_id: businessId,
          store_id: storeId,
          amount: amount,
          description: description || `Pago Ualá Bis ${webhookId}`,
          status: mappedStatus,
          type: 'income',
          category: 'Ventas',
          provider: 'uala',
          external_id: webhookId,
          metadata: {
            ...data,
            webhook_event: eventType,
            received_at: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (upsertError) {
        errorMessage = `Error guardando transacción: ${upsertError.message}`;
        throw new Error(errorMessage);
      }

      // Log exitoso
      await logWebhook({
        provider: 'uala',
        eventType,
        payload: data,
        headers,
        status: 'completed',
        signatureValid: signatureValid || undefined,
        signatureReceived: signature,
        processingTimeMs: Date.now() - startTime,
        storeId,
        transactionId,
      });

      console.log(`[Webhook Ualá] Transacción ${transactionId} procesada exitosamente`);
    }

    return NextResponse.json({ received: true, id: webhookId }, { status: 200 });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    console.error('[Webhook Ualá Error]:', errorMessage);

    // Log del error
    await logWebhook({
      provider: 'uala',
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
    message: 'Ualá Webhook Endpoint is active',
    timestamp: new Date().toISOString(),
    version: '2.0',
  });
}
