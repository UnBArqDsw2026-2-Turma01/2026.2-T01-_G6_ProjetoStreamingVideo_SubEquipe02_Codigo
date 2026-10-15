import { Dinheiro } from "../../../src/dominio";
import { AdaptadorStripe, ErroGatewayIndisponivel, assinarNotificacao } from "../../../src/f1-recarga";
import { FakeSdkStripe } from "../fakes";

const SEGREDO = "segredo-stripe";

describe("AdaptadorStripe", () => {
  const criar = () => {
    const sdk = new FakeSdkStripe();
    return { sdk, adaptador: new AdaptadorStripe(sdk, SEGREDO) };
  };

  test("traduz o checkout: moeda em minúsculas e recarga nos metadados", async () => {
    const { sdk, adaptador } = criar();
    const sessao = await adaptador.iniciarCheckout(Dinheiro.deCentavos(420, "USD"), "recarga-7");

    const intencao = sdk.intencoes.get(sessao.idCheckout)!;
    expect(intencao.amount).toBe(420);
    expect(intencao.currency).toBe("usd");
    expect(intencao.metadata).toEqual({ recargaId: "recarga-7" });
    expect(sessao.instrucoes).toBe(`${sessao.idCheckout}_secret`);
  });

  test("pagamento concluído: APROVADO com o valor recebido", async () => {
    const { sdk, adaptador } = criar();
    const { idCheckout } = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");
    sdk.definirStatus(idCheckout, "succeeded");

    const situacao = await adaptador.consultarPagamento(idCheckout);
    expect(situacao.status).toBe("APROVADO");
    expect(situacao.referencia).toBe("recarga-1");
    expect(situacao.valorPago.igual(Dinheiro.deCentavos(1491, "BRL"))).toBe(true);
  });

  test("tentativa recusada continua PENDENTE (o espectador pode tentar de novo); cancelado é RECUSADO", async () => {
    const { sdk, adaptador } = criar();
    const { idCheckout } = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");
    expect((await adaptador.consultarPagamento(idCheckout)).status).toBe("PENDENTE");
    sdk.definirStatus(idCheckout, "canceled");
    expect((await adaptador.consultarPagamento(idCheckout)).status).toBe("RECUSADO");
  });

  test.each([{ type: "StripeConnectionError" }, { type: "StripeAPIError", statusCode: 500 }, { statusCode: 503 }])(
    "indisponibilidade %o vira ErroGatewayIndisponivel",
    async (erro) => {
      const { sdk, adaptador } = criar();
      sdk.proximoErro = erro;
      await expect(adaptador.iniciarCheckout(Dinheiro.deCentavos(100), "recarga-1")).rejects.toBeInstanceOf(
        ErroGatewayIndisponivel,
      );
    },
  );

  test("erro de requisição é propagado como está", async () => {
    const { adaptador } = criar();
    await expect(adaptador.consultarPagamento("pi_inexistente")).rejects.toMatchObject({ statusCode: 404 });
  });

  test("valida a assinatura do aviso", () => {
    const { adaptador } = criar();
    const dados = { idEvento: "evt_1", idPagamento: "pi_1", recargaId: "recarga-1" };
    expect(adaptador.validarWebhook({ ...dados, assinatura: assinarNotificacao(SEGREDO, dados) })).toBe(true);
    expect(adaptador.validarWebhook({ ...dados, assinatura: assinarNotificacao("segredo-mp", dados) })).toBe(false);
  });
});
