/**
 * Adaptee: o formato da API de PaymentIntents do Stripe.
 *
 * Interface no formato da API externa: valores em centavos, moeda em minúsculas,
 * referência nos metadados e status próprios. Nesta entrega, os testes usam uma
 * implementação falsa; na integração real, um envoltório fino sobre o SDK
 * oficial implementará esta interface.
 */
export interface StripeParams {
  amount: number;
  currency: string;
  metadata: Record<string, string>;
}

export type StripeStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "requires_capture"
  | "canceled"
  | "succeeded";

export interface PaymentIntent {
  id: string;
  amount: number;
  amount_received: number;
  currency: string;
  status: StripeStatus;
  client_secret: string;
  metadata: Record<string, string>;
}

/** Erro como o SDK costuma lançar: tipo do erro e código HTTP quando houver. */
export interface StripeErro {
  type?: string;
  statusCode?: number;
  message?: string;
}

export interface SdkStripe {
  paymentIntentsCreate(params: StripeParams): Promise<PaymentIntent>;
  paymentIntentsRetrieve(id: string): Promise<PaymentIntent>;
}
