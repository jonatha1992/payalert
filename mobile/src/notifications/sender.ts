export type PaymentHintPayload = { packageName: string; title: string; text: string; postedAt: string; notificationKey: string };
type FetchResponse = { ok: boolean; status?: number; json(): Promise<{ accepted?: boolean }> };
type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<FetchResponse>;

export function createPaymentHintSender(baseUrl: string, token: () => Promise<string | null>, fetcher: Fetcher = fetch as Fetcher): (hint: PaymentHintPayload) => Promise<void> {
  return async (hint) => {
    const bearer = await token();
    if (!bearer) throw new Error('No hay una sesión activa.');
    const response = await fetcher(`${baseUrl.replace(/\/$/, '')}/api/mobile/payment-hints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(hint),
    });
    if (!response.ok) throw new Error(`El servidor respondió ${response.status ?? 'con error'}.`);
    const result = await response.json();
    if (result.accepted !== true) throw new Error('El servidor no aceptó el aviso.');
  };
}
