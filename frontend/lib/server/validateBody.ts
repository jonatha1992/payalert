import { NextResponse } from 'next/server';
import type { Schema } from '@/lib/validation/schemas';

export async function validateBody<T extends object>(
  request: Request,
  schema: Schema,
): Promise<{ ok: true; value: T } | { ok: false; response: NextResponse }> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return { ok: false, response: invalidBody({ form: 'Ingresá datos válidos.' }) };
  }

  const result = schema(input);
  if (!result.ok) return { ok: false, response: invalidBody(result.fields) };
  return { ok: true, value: result.value as T };
}

function invalidBody(fields: Record<string, string>): NextResponse {
  return NextResponse.json({ error: 'Datos inválidos', fields }, { status: 400 });
}
