import { Dinheiro } from "../../../src/dominio";
import {
  AdaptadorProcessadorSimulado,
  ErroGatewayIndisponivel,
  ProcessadorSimulado,
  assinarNotificacao,
} from "../../../src/f1-recarga";

describe("AdaptadorProcessadorSimulado", () => {
  const criar = () => {
    const processador = new ProcessadorSimulado();
    return { processador, adaptador: new AdaptadorProcessadorSimulado(processador, "segredo-sim") };
  };

  test("está disponível enquanto o processador está no ar", async () => {
    const { processador, adaptador } = criar();
    expect(await adaptador.estaDisponivel()).toBe(true);
    processador.online = false;
    expect(await adaptador.estaDisponivel()).toBe(false);
  });

  test("cria a cobrança e devolve o protocolo como id do checkout", async () => {
    const { adaptador } = criar();
    const sessao = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");
    expect(sessao.idCheckout).toBe("sim-1");
  });

  test("traduz a consulta em texto para SituacaoPagamento", async () => {
    const { processador, adaptador } = criar();
    const { idCheckout } = await adaptador.iniciarCheckout(Dinheiro.deCentavos(1491), "recarga-1");

    expect((await adaptador.consultarPagamento(idCheckout)).status).toBe("PENDENTE");

    processador.aprovar(idCheckout);
    const situacao = await adaptador.consultarPagamento(idCheckout);
    expect(situacao).toMatchObject({ idPagamento: "sim-1", referencia: "recarga-1", status: "APROVADO" });
    expect(situacao.valorPago.centavos).toBe(1491);

    processador.negar(idCheckout);
    expect((await adaptador.consultarPagamento(idCheckout)).status).toBe("RECUSADO");
  });

  test("código 503 e consulta fora do ar viram ErroGatewayIndisponivel", async () => {
    const { processador, adaptador } = criar();
    const { idCheckout } = await adaptador.iniciarCheckout(Dinheiro.deCentavos(100), "recarga-1");
    processador.online = false;

    await expect(adaptador.iniciarCheckout(Dinheiro.deCentavos(100), "recarga-2")).rejects.toBeInstanceOf(
      ErroGatewayIndisponivel,
    );
    await expect(adaptador.consultarPagamento(idCheckout)).rejects.toBeInstanceOf(ErroGatewayIndisponivel);
  });

  test("outros códigos e pagamento inexistente são erros comuns, sem fallback", async () => {
    const { adaptador } = criar();
    await expect(adaptador.iniciarCheckout(Dinheiro.deCentavos(100), "")).rejects.not.toBeInstanceOf(
      ErroGatewayIndisponivel,
    );
    await expect(adaptador.consultarPagamento("sim-99")).rejects.toThrow("inexistente");
  });

  test("usa o nome configurado e valida assinaturas", () => {
    const adaptador = new AdaptadorProcessadorSimulado(new ProcessadorSimulado(), "s", "Simulado-B");
    const dados = { idEvento: "e", idPagamento: "sim-1", recargaId: "recarga-1" };
    expect(adaptador.nome).toBe("Simulado-B");
    expect(adaptador.validarWebhook({ ...dados, assinatura: assinarNotificacao("s", dados) })).toBe(true);
  });
});
