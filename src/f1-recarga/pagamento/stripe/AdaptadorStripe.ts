import { Dinheiro } from "../../../dominio";
import { assinaturaConfere } from "../AssinaturaWebhook";
import { ErroGatewayIndisponivel } from "../ErroGatewayIndisponivel";
import {
  StatusPagamento,
  type GatewayPagamento,
  type NotificacaoPagamento,
  type SessaoCheckout,
  type SituacaoPagamento,
} from "../GatewayPagamento";
import type { PaymentIntent, SdkStripe, StripeErro, StripeStatus } from "./SdkStripe";

const TRADUCAO_STATUS: Record<StripeStatus, StatusPagamento> = {
  succeeded: StatusPagamento.APROVADO,
  // requires_payment_method também aparece depois de uma tentativa recusada:
  // o espectador ainda pode tentar outro cartão, então segue PENDENTE (Entrega 2).
  requires_payment_method: StatusPagamento.PENDENTE,
  requires_confirmation: StatusPagamento.PENDENTE,
  requires_action: StatusPagamento.PENDENTE,
  processing: StatusPagamento.PENDENTE,
  requires_capture: StatusPagamento.PENDENTE,
  canceled: StatusPagamento.RECUSADO,
};

const TIPOS_INDISPONIBILIDADE = new Set(["StripeConnectionError", "StripeAPIError", "StripeRateLimitError"]);

/**
 * Adapter: faz o Stripe parecer um `GatewayPagamento`.
 * Traduz entrada (moeda em minúsculas, referência nos metadados), saída
 * (status, valor recebido) e falhas (conexão, 5xx, limite → `ErroGatewayIndisponivel`).
 */
export class AdaptadorStripe implements GatewayPagamento {
  readonly nome = "Stripe";
  private readonly sdk: SdkStripe;
  private readonly segredoWebhook: string;

  constructor(sdk: SdkStripe, segredoWebhook: string) {
    this.sdk = sdk;
    this.segredoWebhook = segredoWebhook;
  }

  async iniciarCheckout(valor: Dinheiro, recargaId: string): Promise<SessaoCheckout> {
    const intencao = await this.chamar(() =>
      this.sdk.paymentIntentsCreate({
        amount: valor.centavos,
        currency: valor.moeda.toLowerCase(),
        metadata: { recargaId },
      }),
    );
    return { idCheckout: intencao.id, instrucoes: intencao.client_secret };
  }

  async consultarPagamento(idPagamento: string): Promise<SituacaoPagamento> {
    const intencao = await this.chamar(() => this.sdk.paymentIntentsRetrieve(idPagamento));
    return this.traduzirSituacao(intencao);
  }

  validarWebhook(notificacao: NotificacaoPagamento): boolean {
    return assinaturaConfere(this.segredoWebhook, notificacao);
  }

  private traduzirSituacao(intencao: PaymentIntent): SituacaoPagamento {
    return {
      idPagamento: intencao.id,
      referencia: intencao.metadata.recargaId ?? "",
      status: TRADUCAO_STATUS[intencao.status],
      valorPago: Dinheiro.deCentavos(intencao.amount_received, intencao.currency.toUpperCase()),
    };
  }

  private async chamar<T>(operacao: () => Promise<T>): Promise<T> {
    try {
      return await operacao();
    } catch (erro) {
      const { type, statusCode, message } = (erro ?? {}) as StripeErro;
      const indisponivel =
        (type !== undefined && TIPOS_INDISPONIBILIDADE.has(type)) || (statusCode !== undefined && statusCode >= 500);
      if (indisponivel) {
        throw new ErroGatewayIndisponivel(this.nome, message ?? type ?? `HTTP ${statusCode}`);
      }
      throw erro;
    }
  }
}
