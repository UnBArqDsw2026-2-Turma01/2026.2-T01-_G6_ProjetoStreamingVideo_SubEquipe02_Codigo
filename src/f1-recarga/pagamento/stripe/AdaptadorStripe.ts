import Stripe from "stripe";
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

type SessoesCheckout = Stripe["checkout"]["sessions"];

/**
 * Adaptee: o SDK oficial do Stripe (pacote `stripe`), Checkout Session.
 * Só as operações usadas aqui, para os testes poderem trocar a API por dublês.
 */
export interface SdkStripe {
  readonly checkout: { readonly sessions: Pick<SessoesCheckout, "create" | "retrieve"> };
}

/** Página para onde o Stripe manda o espectador depois de pagar (o front-end, quando existir). */
const URL_RETORNO_PADRAO = "http://localhost:3000/recarga/concluida";

/**
 * Validade da sessão: o mínimo aceito pelo Stripe. Sem isso a sessão fica
 * aberta por 24 h, e um Pix não pago segue PENDENTE durante todo esse tempo.
 */
const VALIDADE_SESSAO_MINUTOS = 30;

/**
 * Adapter: faz o Stripe (Checkout Session) parecer um `GatewayPagamento`.
 * Traduz entrada (centavos e moeda em minúsculas, recarga como
 * `client_reference_id`), saída (`payment_status`, valor total) e falhas
 * (conexão, 5xx, limite → `ErroGatewayIndisponivel`). Não contém regra de negócio.
 *
 * `idCheckout` é o id da sessão (`cs_...`), que também identifica o pagamento:
 * cada sessão tem um único pagamento. Chave `sk_test_` gera links de teste.
 */
export class AdaptadorStripe implements GatewayPagamento {
  readonly nome = "Stripe";
  private readonly sdk: SdkStripe;
  private readonly segredoWebhook: string;
  private readonly urlRetorno: string;

  constructor(sdk: SdkStripe, segredoWebhook: string, urlRetorno = URL_RETORNO_PADRAO) {
    this.sdk = sdk;
    this.segredoWebhook = segredoWebhook;
    this.urlRetorno = urlRetorno;
  }

  /** Cria o adaptador ligado à API real do Stripe. */
  static conectar(chaveSecreta: string, segredoWebhook: string, urlRetorno?: string): AdaptadorStripe {
    return new AdaptadorStripe(new Stripe(chaveSecreta), segredoWebhook, urlRetorno);
  }

  async iniciarCheckout(valor: Dinheiro, recargaId: string): Promise<SessaoCheckout> {
    const sessao = await this.chamar(() =>
      this.sdk.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: valor.moeda.toLowerCase(),
              unit_amount: valor.centavos,
              product_data: { name: `Recarga de moeda virtual ${recargaId}` },
            },
          },
        ],
        client_reference_id: recargaId,
        metadata: { recargaId },
        success_url: this.urlRetorno,
        expires_at: Math.floor(Date.now() / 1000) + VALIDADE_SESSAO_MINUTOS * 60,
      }),
    );
    return { idCheckout: sessao.id, instrucoes: sessao.url ?? "" };
  }

  async consultarPagamento(idCheckout: string): Promise<SituacaoPagamento> {
    const sessao = await this.chamar(() => this.sdk.checkout.sessions.retrieve(idCheckout));
    const pago = sessao.payment_status !== "unpaid";
    return {
      idPagamento: sessao.id,
      referencia: sessao.client_reference_id ?? sessao.metadata?.recargaId ?? "",
      // Enquanto a sessão está aberta, o espectador pode tentar outro cartão: segue PENDENTE.
      // Sessão expirada sem pagamento não aceita mais tentativas: RECUSADO.
      status: pago
        ? StatusPagamento.APROVADO
        : sessao.status === "expired"
          ? StatusPagamento.RECUSADO
          : StatusPagamento.PENDENTE,
      valorPago: Dinheiro.deCentavos(pago ? (sessao.amount_total ?? 0) : 0, (sessao.currency ?? "brl").toUpperCase()),
    };
  }

  validarWebhook(notificacao: NotificacaoPagamento): boolean {
    return assinaturaConfere(this.segredoWebhook, notificacao);
  }

  private async chamar<T>(operacao: () => Promise<T>): Promise<T> {
    try {
      return await operacao();
    } catch (erro) {
      const indisponivel =
        erro instanceof Stripe.errors.StripeConnectionError ||
        erro instanceof Stripe.errors.StripeAPIError ||
        erro instanceof Stripe.errors.StripeRateLimitError ||
        (erro instanceof Stripe.errors.StripeError && (erro.statusCode ?? 0) >= 500);
      if (indisponivel) {
        throw new ErroGatewayIndisponivel(this.nome, erro.message);
      }
      throw erro;
    }
  }
}
