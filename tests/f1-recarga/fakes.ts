/**
 * Implementações falsas dos SDKs externos (Adaptees), no formato das APIs reais.
 * Permitem testar os adaptadores sem internet e sem credenciais.
 */
import type { MPRequest, MPResponse, MPStatus, PaymentIntent, SdkMercadoPago, SdkStripe, StripeParams, StripeStatus } from "../../src/f1-recarga";

export class FakeSdkMercadoPago implements SdkMercadoPago {
  readonly pagamentos = new Map<number, MPResponse>();
  readonly requisicoes: MPRequest[] = [];
  /** Erro a lançar na próxima chamada (ex.: { status: 503 } ou { code: "ETIMEDOUT" }). */
  proximoErro?: object;
  private sequencia = 1000;

  async paymentCreate(body: MPRequest): Promise<MPResponse> {
    this.lancarSePreciso();
    this.requisicoes.push(body);
    const id = ++this.sequencia;
    const resposta: MPResponse = {
      id,
      status: "pending",
      transaction_amount: body.transaction_amount,
      currency_id: "BRL",
      external_reference: body.external_reference,
      point_of_interaction: { transaction_data: { qr_code: `pix-copia-e-cola-${id}` } },
    };
    this.pagamentos.set(id, resposta);
    return { ...resposta };
  }

  async paymentGet(id: string): Promise<MPResponse> {
    this.lancarSePreciso();
    const pagamento = this.pagamentos.get(Number(id));
    if (!pagamento) throw { status: 404, message: "Payment not found" };
    return { ...pagamento };
  }

  /** Simula o espectador pagando (ou o processador mudando o status). */
  definirStatus(id: string, status: MPStatus, valorPago?: number): void {
    const pagamento = this.pagamentos.get(Number(id))!;
    pagamento.status = status;
    if (valorPago !== undefined) pagamento.transaction_amount = valorPago;
  }

  private lancarSePreciso(): void {
    if (this.proximoErro) {
      const erro = this.proximoErro;
      this.proximoErro = undefined;
      throw erro;
    }
  }
}

export class FakeSdkStripe implements SdkStripe {
  readonly intencoes = new Map<string, PaymentIntent>();
  proximoErro?: object;
  private sequencia = 0;

  async paymentIntentsCreate(params: StripeParams): Promise<PaymentIntent> {
    this.lancarSePreciso();
    const id = `pi_${++this.sequencia}`;
    const intencao: PaymentIntent = {
      id,
      amount: params.amount,
      amount_received: 0,
      currency: params.currency,
      status: "requires_payment_method",
      client_secret: `${id}_secret`,
      metadata: { ...params.metadata },
    };
    this.intencoes.set(id, intencao);
    return { ...intencao };
  }

  async paymentIntentsRetrieve(id: string): Promise<PaymentIntent> {
    this.lancarSePreciso();
    const intencao = this.intencoes.get(id);
    if (!intencao) throw { type: "StripeInvalidRequestError", statusCode: 404, message: "No such payment_intent" };
    return { ...intencao };
  }

  definirStatus(id: string, status: StripeStatus): void {
    const intencao = this.intencoes.get(id)!;
    intencao.status = status;
    intencao.amount_received = status === "succeeded" ? intencao.amount : 0;
  }

  private lancarSePreciso(): void {
    if (this.proximoErro) {
      const erro = this.proximoErro;
      this.proximoErro = undefined;
      throw erro;
    }
  }
}
