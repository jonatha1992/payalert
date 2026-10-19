export interface PaymentHint { amount: number; payerName: string | null }

/** Parses only explicit Argentine peso receipt phrases, not arbitrary amounts. */
export function parsePaymentNotification(title: string, text: string): PaymentHint | null {
  const source = `${title}\n${text}`;
  if (!/\b(recibiste|recibiste un pago|transferencia recibida)\b/i.test(source)) return null;
  const match = source.match(/\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?)/);
  if (!match) return null;
  const amount = Number(match[1].replaceAll('.', '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return null;
  const payer = source.match(/\bde\s+([^\n,.]{1,100}?)(?=\s+(?:a\s+tu|\.|,|$)|$)/i)?.[1]?.trim();
  return { amount, payerName: payer || null };
}
