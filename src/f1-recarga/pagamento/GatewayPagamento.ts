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
export interface GatewayPagamento extends ValidadorWebhook {
  readonly nome: string;
  iniciarCheckout(valor: Dinheiro, recargaId: string): Promise<SessaoCheckout>;
  /** Recebe o `idCheckout` devolvido por `iniciarCheckout`. */
  consultarPagamento(idPagamento: string): Promise<SituacaoPagamento>;
  /**
   * Verifica, sem criar cobrança, se o processador consegue atender agora.
   * Usado para oferecer só alternativas que funcionam (O07). Nunca lança: falha é `false`.
   */
  estaDisponivel(): Promise<boolean>;
}

/**
 * A única capacidade do processador de que o Proxy precisa: conferir a
 * autenticidade do aviso (O14). Separada do `GatewayPagamento` para que o Proxy
 * dependa só da verificação, e não da cobrança nem da consulta.
 */
export interface ValidadorWebhook {
  /** Confere a assinatura do aviso com o segredo deste processador. */
  validarWebhook(notificacao: NotificacaoPagamento): boolean;
}
