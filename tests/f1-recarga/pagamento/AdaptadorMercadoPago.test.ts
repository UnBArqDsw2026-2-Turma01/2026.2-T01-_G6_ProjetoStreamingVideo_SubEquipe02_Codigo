import { MPBadRequestError, MPConnectionError, MPRateLimitError, MPServerError } from "mercadopago";
import { Dinheiro } from "../../../src/dominio";
import { AdaptadorMercadoPago, ErroGatewayIndisponivel, assinarNotificacao } from "../../../src/f1-recarga";
import { FakeSdkMercadoPago } from "../fakes";

const SEGREDO = "segredo-mp";

describe("AdaptadorMercadoPago", () => {
  const criar = (usarLinkSandbox = false) => {
    const sdk = new FakeSdkMercadoPago();
    return { sdk, adaptador: new AdaptadorMercadoPago(sdk, SEGREDO, usarLinkSandbox) };
  };

  test("traduz o checkout: centavos viram reais, a recarga vira external_reference e o link vira instruções", async () => {
    const { sdk, adaptador } = criar();
    const sessao = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");

    expect(sdk.requisicoes[0]).toEqual({
      items: [{ id: "recarga-1", title: "Recarga de moeda virtual recarga-1", quantity: 1, currency_id: "BRL", unit_price: 14.91 }],
      external_reference: "recarga-1",
    });
    expect(sessao.idCheckout).toBe("pref-1");
    expect(sessao.instrucoes).toBe("https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1");
  });

  test("com credenciais TEST- usa o link de sandbox", async () => {
    const { adaptador } = criar(true);
    const sessao = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");
    expect(sessao.instrucoes).toContain("sandbox.mercadopago.com.br");
  });

  test("antes do espectador pagar, a preferência fica PENDENTE", async () => {
    const { adaptador } = criar();
    const { idCheckout } = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");

    const situacao = await adaptador.consultarPagamento(idCheckout);

    expect(situacao.status).toBe("PENDENTE");
    expect(situacao.referencia).toBe("recarga-1");
  });

  test.each([
    ["approved", "APROVADO"],
    ["pending", "PENDENTE"],
    ["in_process", "PENDENTE"],
    ["rejected", "RECUSADO"],
    ["cancelled", "RECUSADO"],
  ])("traduz o status %s para %s", async (statusMP, esperado) => {
    const { sdk, adaptador } = criar();
    const { idCheckout } = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");
    sdk.pagar(idCheckout, statusMP);

    const situacao = await adaptador.consultarPagamento(idCheckout);

    expect(situacao.status).toBe(esperado);
    expect(situacao.referencia).toBe("recarga-1");
    expect(situacao.valorPago.igual(Dinheiro.deCentavos(1491))).toBe(true);
  });

  test("considera o pagamento mais recente da preferência (recusado e depois aprovado)", async () => {
    const { sdk, adaptador } = criar();
    const { idCheckout } = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");
    sdk.pagar(idCheckout, "rejected");
    sdk.pagar(idCheckout, "approved");

    expect((await adaptador.consultarPagamento(idCheckout)).status).toBe("APROVADO");
  });

  test("a situação usa o id do checkout (preferência), não o id interno do pagamento", async () => {
    const { sdk, adaptador } = criar();
    const { idCheckout } = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");
    sdk.pagar(idCheckout, "approved");

    expect((await adaptador.consultarPagamento(idCheckout)).idPagamento).toBe(idCheckout);
  });

  test("ignora pagamento antigo com a mesma referência (ids reiniciados entre execuções)", async () => {
    const { sdk, adaptador } = criar();
    sdk.pagamentoAntigo("recarga-1", "approved", 14.91);
    const { idCheckout } = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");

    expect((await adaptador.consultarPagamento(idCheckout)).status).toBe("PENDENTE");
  });

  test.each([
    ["5xx", () => new MPServerError({ status: 503, message: "Service Unavailable" })],
    ["429", () => new MPRateLimitError({ status: 429, message: "Too Many Requests" })],
    ["rede", () => new MPConnectionError(new Error("ETIMEDOUT"))],
  ])("indisponibilidade (%s) vira ErroGatewayIndisponivel", async (_, erro) => {
    const { sdk, adaptador } = criar();
    sdk.proximoErro = erro();
    await expect(adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1")).rejects.toBeInstanceOf(
      ErroGatewayIndisponivel,
    );
  });

  test("erro de requisição (4xx) é propagado como está, sem acionar o fallback", async () => {
    const { sdk, adaptador } = criar();
    const erro = new MPBadRequestError({ status: 400, message: "invalid unit_price" });
    sdk.proximoErro = erro;
    await expect(adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1")).rejects.toBe(erro);
    await expect(adaptador.consultarPagamento("pref-inexistente")).rejects.toMatchObject({ status: 404 });
  });

  test("moeda diferente de BRL: indisponível para este gateway", async () => {
    const { adaptador } = criar();
    await expect(adaptador.iniciarCheckout(Dinheiro.deCentavos(420, "USD"), "recarga-1")).rejects.toBeInstanceOf(
      ErroGatewayIndisponivel,
    );
  });

  test("valida a assinatura do aviso com o segredo do processador", () => {
    const { adaptador } = criar();
    const dados = { idEvento: "ev-1", idPagamento: "pref-1", recargaId: "recarga-1" };
    expect(adaptador.validarWebhook({ ...dados, assinatura: assinarNotificacao(SEGREDO, dados) })).toBe(true);
    expect(adaptador.validarWebhook({ ...dados, assinatura: assinarNotificacao("outro", dados) })).toBe(false);
    expect(adaptador.validarWebhook({ ...dados, assinatura: "abc" })).toBe(false);
  });
});
