import type { NotificacaoPagamento } from "../pagamento";

/** Desfecho de um aviso de pagamento. */
export const EfeitoConfirmacao = {
  /** Pagamento aprovado e moeda virtual creditada. */
  CREDITADO: "CREDITADO",
  /** Pagamento ainda pendente ou recusado; a recarga continua PENDENTE. */
  AGUARDANDO: "AGUARDANDO",
  /** Recarga ausente, referência ou valor divergentes: nada é creditado. */
  INCONSISTENTE: "INCONSISTENTE",
  /** Assinatura inválida (O14): barrado pelo Proxy. */
  NAO_AUTENTICO: "NAO_AUTENTICO",
  /** Pagamento já creditado (O11): barrado pelo Proxy. */
  DUPLICADO: "DUPLICADO",
} as const;

export type EfeitoConfirmacao = (typeof EfeitoConfirmacao)[keyof typeof EfeitoConfirmacao];

export interface ResultadoConfirmacao {
  readonly efeito: EfeitoConfirmacao;
  readonly motivo: string;
}

/**
 * Subject do Proxy: quem trata um aviso de pagamento.
 * O `RecargaController` depende só desta interface e não sabe se fala
 * com o Proxy ou diretamente com o serviço real.
 */
export interface ConfirmadorPagamento {
  confirmar(notificacao: NotificacaoPagamento): Promise<ResultadoConfirmacao>;
}
