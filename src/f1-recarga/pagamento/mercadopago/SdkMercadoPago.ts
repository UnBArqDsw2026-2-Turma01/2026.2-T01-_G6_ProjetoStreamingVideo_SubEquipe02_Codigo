/**
 * Adaptee: o formato da API de pagamentos do Mercado Pago (Pix).
 *
 * Interface no formato da API externa, e não no do sistema: valores em reais
 * com casas decimais, ids numéricos, status em inglês e nomes em snake_case.
 * Nesta entrega, os testes usam uma implementação falsa; na integração real,
 * um envoltório fino sobre o SDK oficial implementará esta interface.
 */
export interface MPRequest {
  transaction_amount: number;
  description: string;
  payment_method_id: "pix";
  external_reference: string;
}

export type MPStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export interface MPResponse {
  id: number;
  status: MPStatus;
  transaction_amount: number;
  currency_id: string;
  external_reference: string;
  point_of_interaction?: { transaction_data?: { qr_code?: string } };
}

/** Erro como o SDK costuma lançar: `status` HTTP quando houve resposta; `code` em falha de rede. */
export interface MPErro {
  status?: number;
  code?: string;
  message?: string;
}

export interface SdkMercadoPago {
  paymentCreate(body: MPRequest): Promise<MPResponse>;
  paymentGet(id: string): Promise<MPResponse>;
}
