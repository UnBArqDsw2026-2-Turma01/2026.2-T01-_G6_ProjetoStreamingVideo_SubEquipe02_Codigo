/**
 * Implementações falsas dos SDKs externos (Adaptees), no formato das APIs reais.
 * Permitem testar os adaptadores sem internet e sem credenciais.
 */
import { MPNotFoundError, type Payment, type Preference } from "mercadopago";
import Stripe from "stripe";
import type { SdkMercadoPago, SdkStripe } from "../../src/f1-recarga";

type PreferenceCreateData = Parameters<Preference["create"]>[0];
type PreferenceGetData = Parameters<Preference["get"]>[0];
type PreferenceResponse = Awaited<ReturnType<Preference["create"]>>;
type PaymentSearch = Awaited<ReturnType<Payment["search"]>>;
type PagamentoMP = NonNullable<PaymentSearch["results"]>[number];

/** Dublê do SDK oficial do Mercado Pago: preferências (Checkout Pro) e pagamentos. */
export class FakeSdkMercadoPago implements SdkMercadoPago {
  readonly preferencias = new Map<string, PreferenceResponse>();
  readonly pagamentos: PagamentoMP[] = [];
  readonly requisicoes: PreferenceCreateData["body"][] = [];
  /** Erro a lançar na próxima chamada (ex.: new MPServerError({...}) ou new MPConnectionError(...)). */
  proximoErro?: unknown;
  private sequencia = 0;
  /** Relógio do dublê, em ms; cada criação avança 1 s. */
  private agora = Date.parse("2026-10-15T12:00:00.000Z");

  readonly preference = {
    create: async ({ body }: PreferenceCreateData): Promise<PreferenceResponse> => {
      this.lancarSePreciso();
      this.requisicoes.push(body);
      const id = `pref-${++this.sequencia}`;
      const preferencia = {
        id,
        external_reference: body.external_reference,
        date_created: this.carimbo(),
        init_point: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${id}`,
        sandbox_init_point: `https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=${id}`,
      } as PreferenceResponse;
      this.preferencias.set(id, preferencia);
      return preferencia;
    },
    get: async ({ preferenceId }: PreferenceGetData): Promise<PreferenceResponse> => {
      this.lancarSePreciso();
      const preferencia = this.preferencias.get(preferenceId);
      if (!preferencia) throw new MPNotFoundError({ status: 404, message: "Preference not found" });
      return preferencia;
    },
  };

  readonly payment = {
    search: async ({ options }: { options?: { external_reference?: string } } = {}): Promise<PaymentSearch> => {
      this.lancarSePreciso();
      const results = this.pagamentos
        .filter((p) => p.external_reference === options?.external_reference)
        .reverse(); // mais recente primeiro
      return { results } as PaymentSearch;
    },
  } as unknown as SdkMercadoPago["payment"];

  /** Simula o espectador pagando no link da preferência. */
  pagar(idPreferencia: string, status: string, valorPago?: number): void {
    const preferencia = this.preferencias.get(idPreferencia)!;
    const item = this.requisicoes.find((r) => r.external_reference === preferencia.external_reference)!.items[0]!;
    this.pagamentos.push({
      id: String(9000 + this.pagamentos.length),
      status,
      external_reference: preferencia.external_reference,
      transaction_amount: valorPago ?? item.unit_price,
      currency_id: "BRL",
      date_created: this.carimbo(),
    });
  }

  /** Simula um pagamento antigo, de antes de qualquer preferência atual, com a mesma referência. */
  pagamentoAntigo(externalReference: string, status: string, valor: number): void {
    this.pagamentos.push({
      id: String(8000 + this.pagamentos.length),
      status,
      external_reference: externalReference,
      transaction_amount: valor,
      currency_id: "BRL",
      date_created: "2020-01-01T00:00:00.000Z",
    });
  }

  private carimbo(): string {
    this.agora += 1000;
    return new Date(this.agora).toISOString();
  }

  private lancarSePreciso(): void {
    if (this.proximoErro) {
      const erro = this.proximoErro;
      this.proximoErro = undefined;
      throw erro;
    }
  }
}

type ParametrosSessao = NonNullable<Parameters<SdkStripe["checkout"]["sessions"]["create"]>[0]>;
type SessaoStripe = Awaited<ReturnType<SdkStripe["checkout"]["sessions"]["retrieve"]>>;

/** Dublê do SDK oficial do Stripe: Checkout Sessions. */
export class FakeSdkStripe implements SdkStripe {
  readonly sessoes = new Map<string, SessaoStripe>();
  readonly requisicoes: ParametrosSessao[] = [];
  /** Erro a lançar na próxima chamada (ex.: new Stripe.errors.StripeAPIError({...})). */
  proximoErro?: unknown;
  private sequencia = 0;

  readonly checkout = {
    sessions: {
      create: async (params: ParametrosSessao) => {
        this.lancarSePreciso();
        this.requisicoes.push(params);
        const id = `cs_test_${++this.sequencia}`;
        const preco = params.line_items![0]!.price_data!;
        const sessao = {
          id,
          url: `https://checkout.stripe.com/c/pay/${id}`,
          status: "open",
          payment_status: "unpaid",
          amount_total: preco.unit_amount!,
          currency: preco.currency,
          client_reference_id: params.client_reference_id ?? null,
          metadata: { ...params.metadata },
        } as unknown as SessaoStripe;
        this.sessoes.set(id, sessao);
        return sessao;
      },
      list: async () => {
        this.lancarSePreciso();
        return { object: "list", data: [...this.sessoes.values()].slice(-1), has_more: false };
      },
      retrieve: async (id: string) => {
        this.lancarSePreciso();
        const sessao = this.sessoes.get(id);
        if (!sessao) {
          throw new Stripe.errors.StripeInvalidRequestError({ message: `No such checkout.session: '${id}'`, statusCode: 404 });
        }
        return { ...sessao };
      },
    },
  } as unknown as SdkStripe["checkout"];

  /** Simula o espectador concluindo o pagamento na página do Stripe. */
  pagar(id: string): void {
    Object.assign(this.sessoes.get(id)!, { status: "complete", payment_status: "paid" });
  }

  /** Simula a sessão expirando sem pagamento. */
  expirar(id: string): void {
    Object.assign(this.sessoes.get(id)!, { status: "expired" });
  }

  private lancarSePreciso(): void {
    if (this.proximoErro) {
      const erro = this.proximoErro;
      this.proximoErro = undefined;
      throw erro;
    }
  }
}
