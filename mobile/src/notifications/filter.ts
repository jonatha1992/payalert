export const DEFAULT_ALLOWED_PACKAGES = ['com.mercadopago.wallet'] as const;

export type PaymentHint = { packageName: string; title: string; text: string; postedAt: string; notificationKey: string };
export type NativeNotification = { packageName: string; title: string; text: string; postTime: number; key: string };

export function filterNotification(value: NativeNotification, allowed: readonly string[] = DEFAULT_ALLOWED_PACKAGES): PaymentHint | null {
  if (!allowed.includes(value.packageName) || !value.key || !Number.isFinite(value.postTime)) return null;
  return { packageName: value.packageName, title: value.title, text: value.text, postedAt: new Date(value.postTime).toISOString(), notificationKey: value.key };
}
