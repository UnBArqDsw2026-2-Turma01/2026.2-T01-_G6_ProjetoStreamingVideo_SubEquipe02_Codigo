import type { Dinheiro } from "../../dominio";

/** Situação de um pagamento, já traduzida para o vocabulário do sistema. */
export const StatusPagamento = {
  APROVADO: "APROVADO",
  /** Ainda não pago, ou recusado com nova tentativa possível no checkout. */
  PENDENTE: "PENDENTE",
  RECUSADO: "RECUSADO",
} as const;

export type StatusPagamento = (typeof StatusPagamento)[keyof typeof StatusPagamento];

/** Resultado de `iniciarCheckout`: o checkout criado no processador, ainda não pago. */
export interface SessaoCheckout {
  /**
   * Identificador do checkout no processador (Mercado Pago: id da preferência;
   * Stripe: id da sessão). É o valor passado a `consultarPagamento` e o que chega
   * como `idPagamento` na `SituacaoPagamento` e na `NotificacaoPagamento`.
   */
  readonly idCheckout: string;
  /** Link do checkout em que o espectador paga. */
  readonly instrucoes: string;
}

/** Resultado de `consultarPagamento`. */
export interface SituacaoPagamento {
  /** O `idCheckout` consultado (não o id interno do pagamento no processador). */
  readonly idPagamento: string;
  /** Referência externa enviada no checkout: o id da recarga. */
  readonly referencia: string;
  readonly status: StatusPagamento;
  readonly valorPago: Dinheiro;
}

/** Aviso de pagamento recebido pelo webhook (já extraído da requisição HTTP). */
export interface NotificacaoPagamento {
  readonly idEvento: string;
  /** O `idCheckout` da recarga; é também a chave de idempotência do Proxy (O11). */
  readonly idPagamento: string;
  readonly recargaId: string;
  readonly assinatura: string;
}

/**
 * Target do Adapter: a única interface de pagamento que o sistema conhece
 * (Entrega 2: GatewayPagamento com iniciarCheckout e validarWebhook).
 *
 * Contrato das falhas: indisponibilidade do processador (rede, 5xx, limite de
 * requisições, moeda não atendida) vira `ErroGatewayIndisponivel`. O `ServicoRecarga`
 * a traduz em `ErroMeioPagamentoIndisponivel` quando o espectador escolheu o meio,
 * ou tenta o próximo gateway quando não escolheu (O07).
 * Qualquer outro erro é propagado como está.
 */
export interface GatewayPagamento {
  readonly nome: string;
  iniciarCheckout(valor: Dinheiro, recargaId: string): Promise<SessaoCheckout>;
  /** Recebe o `idCheckout` devolvido por `iniciarCheckout`. */
  consultarPagamento(idPagamento: string): Promise<SituacaoPagamento>;
  /** Confere a assinatura do aviso com o segredo deste processador (O14). */
  validarWebhook(notificacao: NotificacaoPagamento): boolean;
}
