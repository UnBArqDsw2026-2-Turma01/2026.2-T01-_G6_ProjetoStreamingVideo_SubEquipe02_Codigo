import Stripe from "stripe";
import { Dinheiro } from "../../../src/dominio";
import { AdaptadorStripe, ErroGatewayIndisponivel, assinarNotificacao } from "../../../src/f1-recarga";
import { FakeSdkStripe } from "../fakes";

const SEGREDO = "segredo-stripe";

describe("AdaptadorStripe", () => {
  const criar = () => {
    const sdk = new FakeSdkStripe();
    return { sdk, adaptador: new AdaptadorStripe(sdk, SEGREDO, "https://exemplo.test/ok") };
  };

  test("traduz o checkout: centavos e moeda em minúsculas, recarga como client_reference_id e link como instruções", async () => {
    const { sdk, adaptador } = criar();
    const agora = Math.floor(Date.now() / 1000);
    const sessao = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-7");

    const { expires_at, ...requisicao } = sdk.requisicoes[0]!;
    expect(expires_at! - agora).toBeGreaterThanOrEqual(30 * 60); // sessão expira em 30 min, não em 24 h
    expect(expires_at! - agora).toBeLessThan(31 * 60);
    expect(requisicao).toEqual({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: { currency: "brl", unit_amount: 1491, product_data: { name: "Recarga de moeda virtual recarga-7" } },
        },
      ],
      client_reference_id: "recarga-7",
      metadata: { recargaId: "recarga-7" },
      success_url: "https://exemplo.test/ok",
    });
    expect(sessao.idCheckout).toBe("cs_test_1");
    expect(sessao.instrucoes).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
  });

  test("antes do pagamento: PENDENTE, sem valor recebido", async () => {
    const { adaptador } = criar();
    const { idCheckout } = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");

    const situacao = await adaptador.consultarPagamento(idCheckout);
    expect(situacao.status).toBe("PENDENTE");
    expect(situacao.valorPago.centavos).toBe(0);
  });

  test("pagamento concluído: APROVADO com o valor total, id da sessão e referência da recarga", async () => {
    const { sdk, adaptador } = criar();
    const { idCheckout } = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");
    sdk.pagar(idCheckout);

    const situacao = await adaptador.consultarPagamento(idCheckout);
    expect(situacao.status).toBe("APROVADO");
    expect(situacao.idPagamento).toBe(idCheckout);
    expect(situacao.referencia).toBe("recarga-1");
    expect(situacao.valorPago.igual(Dinheiro.deCentavos(1491, "BRL"))).toBe(true);
  });

  test("sessão expirada sem pagamento: RECUSADO", async () => {
    const { sdk, adaptador } = criar();
    const { idCheckout } = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");
    sdk.expirar(idCheckout);

    expect((await adaptador.consultarPagamento(idCheckout)).status).toBe("RECUSADO");
  });

  test.each([
    ["conexão", () => new Stripe.errors.StripeConnectionError({ message: "ECONNRESET" })],
    ["erro da API", () => new Stripe.errors.StripeAPIError({ message: "Internal", statusCode: 500 })],
    ["limite", () => new Stripe.errors.StripeRateLimitError({ message: "Too many", statusCode: 429 })],
  ])("indisponibilidade (%s) vira ErroGatewayIndisponivel", async (_, erro) => {
    const { sdk, adaptador } = criar();
    sdk.proximoErro = erro();
    await expect(adaptador.iniciarCheckout(Dinheiro.deCentavos(100), "recarga-1")).rejects.toBeInstanceOf(
      ErroGatewayIndisponivel,
    );
  });

  test("está disponível quando a API responde; indisponível quando falha, sem lançar", async () => {
    const { sdk, adaptador } = criar();
    expect(await adaptador.estaDisponivel()).toBe(true);
    sdk.proximoErro = new Stripe.errors.StripeConnectionError({ message: "ECONNRESET" });
    expect(await adaptador.estaDisponivel()).toBe(false);
    expect(sdk.sessoes.size).toBe(0); // a verificação não cria cobrança
  });

  test("erro de requisição é propagado como está", async () => {
    const { adaptador } = criar();
    await expect(adaptador.consultarPagamento("cs_inexistente")).rejects.toMatchObject({ statusCode: 404 });
  });

  test("valida a assinatura do aviso", () => {
    const { adaptador } = criar();
    const dados = { idEvento: "evt_1", idPagamento: "cs_test_1", recargaId: "recarga-1" };
    expect(adaptador.validarWebhook({ ...dados, assinatura: assinarNotificacao(SEGREDO, dados) })).toBe(true);
    expect(adaptador.validarWebhook({ ...dados, assinatura: assinarNotificacao("segredo-mp", dados) })).toBe(false);
  });
});
