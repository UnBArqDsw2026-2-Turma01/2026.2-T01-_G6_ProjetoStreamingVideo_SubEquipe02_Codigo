import { Dinheiro } from "../../../src/dominio";
import { AdaptadorMercadoPago, ErroGatewayIndisponivel, assinarNotificacao } from "../../../src/f1-recarga";
import { FakeSdkMercadoPago } from "../fakes";

const SEGREDO = "segredo-mp";

describe("AdaptadorMercadoPago", () => {
  const criar = () => {
    const sdk = new FakeSdkMercadoPago();
    return { sdk, adaptador: new AdaptadorMercadoPago(sdk, SEGREDO) };
  };

  test("traduz o checkout: centavos viram reais e a recarga vira external_reference", async () => {
    const { sdk, adaptador } = criar();
    const sessao = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");

    expect(sdk.requisicoes[0]).toEqual({
      transaction_amount: 14.91,
      description: "Recarga de moeda virtual recarga-1",
      payment_method_id: "pix",
      external_reference: "recarga-1",
    });
    expect(sessao.idCheckout).toBe("1001"); // id numérico vira texto
    expect(sessao.instrucoes).toBe("pix-copia-e-cola-1001");
  });

  test.each([
    ["approved", "APROVADO"],
    ["pending", "PENDENTE"],
    ["in_process", "PENDENTE"],
    ["rejected", "RECUSADO"],
    ["cancelled", "RECUSADO"],
  ] as const)("traduz o status %s para %s", async (statusMP, esperado) => {
    const { sdk, adaptador } = criar();
    const { idCheckout } = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");
    sdk.definirStatus(idCheckout, statusMP);

    const situacao = await adaptador.consultarPagamento(idCheckout);

    expect(situacao.status).toBe(esperado);
    expect(situacao.referencia).toBe("recarga-1");
    expect(situacao.valorPago.igual(Dinheiro.deCentavos(1491))).toBe(true);
  });

  test.each([{ status: 503 }, { status: 500 }, { code: "ETIMEDOUT" }, { code: "ECONNREFUSED" }])(
    "indisponibilidade %o vira ErroGatewayIndisponivel",
    async (erro) => {
      const { sdk, adaptador } = criar();
      sdk.proximoErro = erro;
      await expect(adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1")).rejects.toBeInstanceOf(
        ErroGatewayIndisponivel,
      );
    },
  );

  test("erro de requisição (4xx) é propagado como está, sem acionar o fallback", async () => {
    const { adaptador } = criar();
    await expect(adaptador.consultarPagamento("999")).rejects.toEqual({ status: 404, message: "Payment not found" });
  });

  test("moeda diferente de BRL: indisponível para este gateway", async () => {
    const { adaptador } = criar();
    await expect(adaptador.iniciarCheckout(Dinheiro.deCentavos(420, "USD"), "recarga-1")).rejects.toBeInstanceOf(
      ErroGatewayIndisponivel,
    );
  });

  test("valida a assinatura do aviso com o segredo do processador", () => {
    const { adaptador } = criar();
    const dados = { idEvento: "ev-1", idPagamento: "1001", recargaId: "recarga-1" };
    expect(adaptador.validarWebhook({ ...dados, assinatura: assinarNotificacao(SEGREDO, dados) })).toBe(true);
    expect(adaptador.validarWebhook({ ...dados, assinatura: assinarNotificacao("outro", dados) })).toBe(false);
    expect(adaptador.validarWebhook({ ...dados, assinatura: "abc" })).toBe(false);
  });
});
