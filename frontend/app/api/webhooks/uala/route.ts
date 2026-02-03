import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('[Webhook Ualá] Recibido:', JSON.stringify(payload));

    // Estructura típica de Ualá Bis
    const { id, amount, status, description, checkout_id } = payload;

    if (!id) {
       return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    // Mapeo de estados de Ualá
    const mappedStatus = status === 'PAID' ? 'completed' : 'pending';

    const { error } = await supabase
      .from('transactions')
      .upsert({
        id: `uala_${id}`,
        amount: amount,
        description: description || `Pago Ualá Bis ${id}`,
        status: mappedStatus,
        type: 'income',
        provider: 'uala',
        external_id: id,
        metadata: payload
      }, { onConflict: 'id' });

    if (error) {
       console.error('[Webhook Ualá] Error DB:', error.message);
       return NextResponse.json({ error: 'DB Error' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error('[Webhook Ualá Error]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
