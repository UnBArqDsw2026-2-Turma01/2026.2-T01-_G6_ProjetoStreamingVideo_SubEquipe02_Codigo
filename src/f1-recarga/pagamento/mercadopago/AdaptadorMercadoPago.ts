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
import type { MPErro, MPResponse, MPStatus, SdkMercadoPago } from "./SdkMercadoPago";

const TRADUCAO_STATUS: Record<MPStatus, StatusPagamento> = {
  approved: StatusPagamento.APROVADO,
  pending: StatusPagamento.PENDENTE,
  authorized: StatusPagamento.PENDENTE,
  in_process: StatusPagamento.PENDENTE,
  in_mediation: StatusPagamento.PENDENTE,
  rejected: StatusPagamento.RECUSADO,
  cancelled: StatusPagamento.RECUSADO,
  refunded: StatusPagamento.RECUSADO,
  charged_back: StatusPagamento.RECUSADO,
};

const ERROS_DE_REDE = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"]);

/**
 * Adapter: faz o Mercado Pago (Pix) parecer um `GatewayPagamento`.
 * Traduz entrada (centavos → reais), saída (ids, status, referência) e falhas
 * (rede ou 5xx → `ErroGatewayIndisponivel`). Não contém regra de negócio.
 */
export class AdaptadorMercadoPago implements GatewayPagamento {
  readonly nome = "MercadoPago";
  private readonly sdk: SdkMercadoPago;
  private readonly segredoWebhook: string;

  constructor(sdk: SdkMercadoPago, segredoWebhook: string) {
    this.sdk = sdk;
    this.segredoWebhook = segredoWebhook;
  }

  async iniciarCheckout(valor: Dinheiro, recargaId: string): Promise<SessaoCheckout> {
    if (valor.moeda !== "BRL") {
      throw new ErroGatewayIndisponivel(this.nome, `Pix só aceita BRL, recebido ${valor.moeda}`);
    }
    const resposta = await this.chamar(() =>
      this.sdk.paymentCreate({
        transaction_amount: valor.centavos / 100,
        description: `Recarga de moeda virtual ${recargaId}`,
        payment_method_id: "pix",
        external_reference: recargaId,
      }),
    );
    return {
      idCheckout: String(resposta.id),
      instrucoes: resposta.point_of_interaction?.transaction_data?.qr_code ?? "",
    };
  }

  async consultarPagamento(idPagamento: string): Promise<SituacaoPagamento> {
    const resposta = await this.chamar(() => this.sdk.paymentGet(idPagamento));
    return this.traduzirSituacao(resposta);
  }

  validarWebhook(notificacao: NotificacaoPagamento): boolean {
    return assinaturaConfere(this.segredoWebhook, notificacao);
  }

  private traduzirSituacao(resposta: MPResponse): SituacaoPagamento {
    return {
      idPagamento: String(resposta.id),
      referencia: resposta.external_reference,
      status: TRADUCAO_STATUS[resposta.status],
      valorPago: Dinheiro.deReais(resposta.transaction_amount, resposta.currency_id),
    };
  }

  private async chamar<T>(operacao: () => Promise<T>): Promise<T> {
    try {
      return await operacao();
    } catch (erro) {
      const { status, code, message } = (erro ?? {}) as MPErro;
      const indisponivel = (status !== undefined && status >= 500) || (code !== undefined && ERROS_DE_REDE.has(code));
      if (indisponivel) {
        throw new ErroGatewayIndisponivel(this.nome, message ?? code ?? `HTTP ${status}`);
      }
      throw erro;
    }
  }
}
