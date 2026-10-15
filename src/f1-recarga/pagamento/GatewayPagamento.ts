import type { Dinheiro } from "../../dominio";

/** Situação de um pagamento, já traduzida para o vocabulário do sistema. */
export const StatusPagamento = {
  APROVADO: "APROVADO",
  /** Ainda não pago, ou recusado com nova tentativa possível no checkout. */
  PENDENTE: "PENDENTE",
  RECUSADO: "RECUSADO",
} as const;

export type StatusPagamento = (typeof StatusPagamento)[keyof typeof StatusPagamento];

/** Resultado de `iniciarCheckout`: o pagamento criado no processador, ainda não pago. */
export interface SessaoCheckout {
  /** Identificador do pagamento no processador; é o mesmo usado em `consultarPagamento`. */
  readonly idCheckout: string;
  /** O que o espectador usa para pagar (Pix copia e cola, segredo do cliente, link). */
  readonly instrucoes: string;
}

/** Resultado de `consultarPagamento`. */
export interface SituacaoPagamento {
  readonly idPagamento: string;
  /** Referência externa enviada no checkout: o id da recarga. */
  readonly referencia: string;
  readonly status: StatusPagamento;
  readonly valorPago: Dinheiro;
}

/** Aviso de pagamento recebido pelo webhook (já extraído da requisição HTTP). */
export interface NotificacaoPagamento {
  readonly idEvento: string;
  readonly idPagamento: string;
  readonly recargaId: string;
  readonly assinatura: string;
}

/**
 * Target do Adapter: a única interface de pagamento que o sistema conhece
 * (Entrega 2: GatewayPagamento com iniciarCheckout e validarWebhook).
 *
 * Contrato das falhas: indisponibilidade do processador (rede, 5xx, moeda não
 * atendida) vira `ErroGatewayIndisponivel`, que aciona o próximo gateway (O07).
 * Qualquer outro erro é propagado como está.
 */
export interface GatewayPagamento {
  readonly nome: string;
  iniciarCheckout(valor: Dinheiro, recargaId: string): Promise<SessaoCheckout>;
  consultarPagamento(idPagamento: string): Promise<SituacaoPagamento>;
  /** Confere a assinatura do aviso com o segredo deste processador (O14). */
  validarWebhook(notificacao: NotificacaoPagamento): boolean;
}
