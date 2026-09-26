import type { Provider } from '../types';

/** Only safe HTTP metadata is retained; response bodies may contain credentials. */
export class ProviderError extends Error {
  readonly retriable: boolean;

  constructor(readonly provider: Provider, readonly status: number) {
    super(`${provider} request failed with HTTP ${status}`);
    this.name = 'ProviderError';
    this.retriable = status >= 500 || status === 429;
  }
}
