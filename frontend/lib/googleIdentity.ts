export interface GoogleCredentialResponse {
  credential: string;
}

export interface GoogleIdentityApi {
  initialize: (options: {
    client_id: string;
    nonce: string;
    callback: (response: GoogleCredentialResponse) => void;
    use_fedcm_for_prompt: boolean;
  }) => void;
  renderButton: (element: HTMLElement, options: { type: 'standard'; theme: 'outline'; size: 'large'; text: 'continue_with'; shape: 'rectangular'; width: number; locale: 'es' }) => void;
}

export interface GoogleIdentityWindow {
  google?: { accounts: { id: GoogleIdentityApi } };
}

export function generateNonce(): string {
  const random = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function shouldUseGoogleIdentity(clientId: string | undefined): boolean {
  return Boolean(clientId?.trim());
}

export function googleLoginError(): string {
  return 'No pudimos ingresar con Google. Probá de nuevo.';
}
