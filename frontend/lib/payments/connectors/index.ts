import type { PaymentConnector, Provider } from '../types';
import { MercadoPagoConnector } from './mercadopago';
import { MockConnector } from './mock';
import { UalaConnector } from './uala';

const connectors: Record<Provider, PaymentConnector> = {
  mercado_pago: new MercadoPagoConnector(), uala: new UalaConnector(), mock: new MockConnector(),
};

export function getConnector(provider: Provider): PaymentConnector {
  return connectors[provider];
}
