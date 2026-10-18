import { Dinheiro } from "../../src/dominio";
import { AdaptadorProcessadorSimulado, ErroGatewayIndisponivel, ProcessadorSimulado } from "../../src/f1-recarga";
import { GatewayDesligavel } from "../../src/web/GatewayDesligavel";

describe("GatewayDesligavel (demonstração web)", () => {
  const criar = () => new GatewayDesligavel(new AdaptadorProcessadorSimulado(new ProcessadorSimulado(), "s", "Real"));

  test("ligado, repassa ao gateway envolvido com o mesmo nome", async () => {
    const gateway = criar();
    const sessao = await gateway.iniciarCheckout(Dinheiro.deCentavos(746), "recarga-1");
    expect(gateway.nome).toBe("Real");
    expect((await gateway.consultarPagamento(sessao.idCheckout)).status).toBe("PENDENTE");
  });

  test("desligado, responde como processador fora do ar até ser religado", async () => {
    const gateway = criar();
    const { idCheckout } = await gateway.iniciarCheckout(Dinheiro.deCentavos(746), "recarga-1");
    gateway.online = false;

    await expect(gateway.iniciarCheckout(Dinheiro.deCentavos(746), "recarga-2")).rejects.toBeInstanceOf(ErroGatewayIndisponivel);
    await expect(gateway.consultarPagamento(idCheckout)).rejects.toBeInstanceOf(ErroGatewayIndisponivel);

    expect(await gateway.estaDisponivel()).toBe(false);

    gateway.online = true;
    expect(await gateway.estaDisponivel()).toBe(true);
    expect((await gateway.consultarPagamento(idCheckout)).status).toBe("PENDENTE");
  });
});
