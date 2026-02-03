import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos las variables de entorno para Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// IMPORTANTE: Se requiere el SERVICE_ROLE_KEY para que el servidor pueda insertar transacciones sin restricciones de RLS
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || searchParams.get('data.id');
    const topic = searchParams.get('topic') || searchParams.get('type');

    console.log(`[IPN Mercado Pago] Recibido: id=${id}, topic=${topic}`);

    if (topic === 'payment' && id) {
      // 1. Obtener los detalles del pago desde Mercado Pago
      // Nota: En una app real, aquí buscaríamos el access_token del comercio en la tabla 'payment_tokens'
      // por ahora usaremos una variable de entorno general si existe, o fallaremos con gracia.
      const mpAccessToken = process.env.MP_ACCESS_TOKEN;

      if (!mpAccessToken) {
        console.error('[IPN] MP_ACCESS_TOKEN no configurado en el servidor.');
        return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 });
      }

      const response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error consultando pago en MP: ${response.statusText}`);
      }

      const paymentData = await response.json();

      // 2. Extraer datos relevantes
      const { 
        status, 
        transaction_amount, 
        description, 
        external_reference,
        status_detail
      } = paymentData;

      console.log(`[IPN] Pago ${id} validado: ${status} ($${transaction_amount})`);

      // 3. Mapear a nuestra tabla de transacciones
      // Intentamos identificar la sucursal por el external_reference
      let storeId = null;
      if (external_reference) {
        // En un flujo real, external_reference contendría el UUID de la store
        storeId = external_reference;
      }

      const { data, error } = await supabase
        .from('transactions')
        .upsert({
          id: `mp_${id}`, // Prefijo para evitar colisiones entre providers
          amount: transaction_amount,
          description: description || `Pago Mercado Pago ${id}`,
          status: status === 'approved' ? 'completed' : status,
          type: 'income',
          provider: 'mercadopago',
          external_id: id,
          store_id: storeId,
          metadata: paymentData // Guardamos todo el JSON por si acaso
        }, { onConflict: 'id' });

      if (error) {
        console.error('[IPN] Error guardando en Supabase:', error.message);
        return NextResponse.json({ error: 'DB Error' }, { status: 500 });
      }

      console.log('[IPN] Transacción registrada exitosamente.');
    }

    // Mercado Pago requiere un 200 o 201 para confirmar recepción
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: any) {
    console.error('[IPN Error]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Permitir GET para pruebas rápidas o configuraciones de webhook
export async function GET() {
  return NextResponse.json({ message: 'IPN Endpoint is active' });
}
