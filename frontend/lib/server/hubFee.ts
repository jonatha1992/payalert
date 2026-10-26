export function computeFee(amount: number, feeType: 'fixed' | 'percent' | undefined, feeValue: number | undefined): { fee: number } | { error: string } {
  const type = feeType ?? 'fixed';
  const value = feeValue ?? 1;
  const fee = type === 'percent' ? Math.round((amount * value / 100) * 100) / 100 : value;
  if (fee >= amount) return { error: 'La comisión no puede ser igual o mayor al monto' };
  return { fee };
}
