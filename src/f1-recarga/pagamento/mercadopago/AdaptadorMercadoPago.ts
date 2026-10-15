import { MPConnectionError, MPRateLimitError, MercadoPagoConfig, MercadoPagoError, Payment, Preference } from "mercadopago";
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

/**
 * Adaptee: o SDK oficial do Mercado Pago (pacote `mercadopago`), Checkout Pro.
 * Só as operações usadas aqui, para os testes poderem trocar a API por dublês.
 */
export interface SdkMercadoPago {
  readonly preference: Pick<Preference, "create" | "get">;
  readonly payment: Pick<Payment, "get" | "search">;
}

const TRADUCAO_STATUS: Record<string, StatusPagamento> = {
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

/**
 * Adapter: faz o Mercado Pago (Checkout Pro) parecer um `GatewayPagamento`.
 * Traduz entrada (centavos → reais, recarga → preferência), saída (status em
 * inglês, ids, referência) e falhas (rede, 5xx, 429 → `ErroGatewayIndisponivel`).
 * Não contém regra de negócio.
 *
 * `idCheckout` é o id da preferência: o pagamento só existe depois que o
 * espectador paga no link, e é achado pela `external_reference` (id da recarga).
 *
 * Teste x produção é decidido pela conta dona do token: token de um usuário
 * vendedor de teste gera links que só aceitam o comprador de teste.
 */
export class AdaptadorMercadoPago implements GatewayPagamento {
  readonly nome = "MercadoPago";
  private readonly sdk: SdkMercadoPago;
  private readonly segredoWebhook: string;
  /** Credenciais `TEST-...` usam o `sandbox_init_point`. */
  private readonly usarLinkSandbox: boolean;

  constructor(sdk: SdkMercadoPago, segredoWebhook: string, usarLinkSandbox = false) {
    this.sdk = sdk;
    this.segredoWebhook = segredoWebhook;
    this.usarLinkSandbox = usarLinkSandbox;
  }

  /** Cria o adaptador ligado à API real do Mercado Pago. */
  static conectar(accessToken: string, segredoWebhook: string): AdaptadorMercadoPago {
    const config = new MercadoPagoConfig({ accessToken });
    const sdk = { preference: new Preference(config), payment: new Payment(config) };
    return new AdaptadorMercadoPago(sdk, segredoWebhook, accessToken.startsWith("TEST-"));
  }

  async iniciarCheckout(valor: Dinheiro, recargaId: string): Promise<SessaoCheckout> {
    if (valor.moeda !== "BRL") {
      throw new ErroGatewayIndisponivel(this.nome, `Mercado Pago só aceita BRL, recebido ${valor.moeda}`);
    }
    const preferencia = await this.chamar(() =>
      this.sdk.preference.create({
        body: {
          items: [
            {
              id: recargaId,
              title: `Recarga de moeda virtual ${recargaId}`,
              quantity: 1,
              currency_id: "BRL",
              unit_price: valor.centavos / 100,
            },
          ],
          external_reference: recargaId,
        },
      }),
    );
    return {
      idCheckout: preferencia.id!,
      instrucoes: (this.usarLinkSandbox ? preferencia.sandbox_init_point : preferencia.init_point) ?? "",
    };
  }

  async consultarPagamento(idCheckout: string): Promise<SituacaoPagamento> {
    const preferencia = await this.chamar(() => this.sdk.preference.get({ preferenceId: idCheckout }));
    const referencia = preferencia.external_reference ?? "";
    const busca = await this.chamar(() =>
      this.sdk.payment.search({ options: { external_reference: referencia, sort: "date_created", criteria: "desc" } }),
    );
    // A referência pode se repetir (outra preferência da mesma recarga, ou ids reiniciados):
    // só valem pagamentos feitos depois que esta preferência foi criada.
    const criadaEm = Date.parse(preferencia.date_created ?? "") || 0;
    const pagamento = busca.results?.find((p) => (Date.parse(p.date_created ?? "") || 0) >= criadaEm);

    // `idPagamento` é o id do checkout (a preferência), como pede o contrato do GatewayPagamento.
    if (!pagamento) {
      // Espectador ainda não pagou: a preferência existe, mas nenhum pagamento foi criado.
      return { idPagamento: idCheckout, referencia, status: StatusPagamento.PENDENTE, valorPago: Dinheiro.deCentavos(0) };
    }
    return {
      idPagamento: idCheckout,
      referencia: pagamento.external_reference ?? referencia,
      status: TRADUCAO_STATUS[pagamento.status ?? "pending"] ?? StatusPagamento.PENDENTE,
      valorPago: Dinheiro.deReais(pagamento.transaction_amount ?? 0, pagamento.currency_id ?? "BRL"),
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
        erro instanceof MPConnectionError ||
        erro instanceof MPRateLimitError ||
        (erro instanceof MercadoPagoError && erro.status >= 500);
      if (indisponivel) {
        throw new ErroGatewayIndisponivel(this.nome, erro.message);
      }
      throw erro;
    }
  }
}
