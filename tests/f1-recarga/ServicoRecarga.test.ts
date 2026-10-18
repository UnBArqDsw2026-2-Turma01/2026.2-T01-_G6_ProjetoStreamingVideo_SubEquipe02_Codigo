import { GeradorId, RepositorioEmMemoria } from "../../src/compartilhado";
import { Dinheiro, ErroDominio, StatusTransacao, Usuario } from "../../src/dominio";
import { ServicoFinanceiro } from "../../src/financeiro";
import {
  AdaptadorProcessadorSimulado,
  ErroGatewayIndisponivel,
  ErroMeioPagamentoIndisponivel,
  MetodoRecarga,
  Recarga,
  ProcessadorSimulado,
  ServicoRecarga,
  montarRecarga,
  type GatewayPagamento,
} from "../../src/f1-recarga";
import { criarCenario, pacotes } from "./cenario";

/** Três meios simulados (A, B, C), para os casos com mais de uma alternativa. */
function cenarioComTresMeios() {
  const usuarios = new RepositorioEmMemoria<Usuario>();
  usuarios.salvar(new Usuario("usuario-1", "Espectador", "espectador@exemplo.com"));
  const processadores = { A: new ProcessadorSimulado(), B: new ProcessadorSimulado(), C: new ProcessadorSimulado() };
  const gateways = Object.entries(processadores).map(
    ([letra, processador]) => new AdaptadorProcessadorSimulado(processador, `segredo-${letra}`, `Simulado-${letra}`),
  );
  const recargas = montarRecarga({ pacotes, configuracaoPreco: {}, gateways, financeiro: new ServicoFinanceiro(), usuarios });
  return { ...recargas, processadores };
}

describe("ServicoRecarga", () => {
  describe("ofertas e preço (cliente do Decorator)", () => {
    test("o modal recebe preço original e promocional de cada pacote", () => {
      const { controller } = criarCenario();
      const [oferta300] = controller.consultarOfertas("usuario-1");

      expect(oferta300!.precoOriginal.centavos).toBe(2000);
      expect(oferta300!.precoPromocional.centavos).toBe(1491);
      expect(oferta300!.composicao).toBe("pacote de 300 (R$ 20,00) → desconto de 29% → imposto de 5%");
    });

    test("sem regras ativas, o preço promocional é o próprio preço de tabela", () => {
      const { servico, espectador } = criarCenario({});
      const [oferta] = servico.consultarOfertas(espectador);
      expect(oferta!.precoPromocional.igual(oferta!.precoOriginal)).toBe(true);
    });

    test("monta as camadas na ordem desconto → taxa → imposto", () => {
      const { servico } = criarCenario({
        descontoPercentual: 10,
        taxaFixa: Dinheiro.deReais(1),
        aliquotaImposto: 5,
      });
      const preco = servico.montarPreco(pacotes[0]!);
      // ((20,00 − 10%) + 1,00) × 1,05 = 19,95
      expect(preco.calcular().centavos).toBe(1995);
      expect(preco.calcular().moeda).toBe("BRL");
      expect(preco.descrever()).toBe("pacote de 300 (R$ 20,00) → desconto de 10% → taxa de R$ 1,00 → imposto de 5%");
    });
  });

  describe("desconto progressivo", () => {
    const progressivo = {
      descontoPercentual: 5,
      descontosProgressivos: [
        { aPartirDe: Dinheiro.deReais(20), percentual: 10 },
        { aPartirDe: Dinheiro.deReais(60), percentual: 30 },
      ],
    };

    test("cada pacote recebe a maior faixa que o valor de tabela alcança", () => {
      const { servico, espectador } = criarCenario(progressivo);
      const [p300, p1000] = servico.consultarOfertas(espectador);

      expect(p300!.descontoPercentual).toBe(10);
      expect(p300!.precoPromocional.centavos).toBe(1800); // R$ 20 − 10%
      expect(p1000!.descontoPercentual).toBe(30);
      expect(p1000!.precoPromocional.centavos).toBe(4200); // R$ 60 − 30%
      expect(p1000!.composicao).toBe("pacote de 1000 (R$ 60,00) → desconto de 30%");
    });

    test("a ordem das faixas na configuração não importa", () => {
      const invertido = { ...progressivo, descontosProgressivos: [...progressivo.descontosProgressivos].reverse() };
      const { servico, espectador } = criarCenario(invertido);
      expect(servico.consultarOfertas(espectador).map((o) => o.descontoPercentual)).toEqual([10, 30]);
    });

    test("pacote abaixo de todas as faixas usa o desconto geral", () => {
      const { servico, espectador } = criarCenario({
        descontoPercentual: 5,
        descontosProgressivos: [{ aPartirDe: Dinheiro.deReais(60), percentual: 30 }],
      });
      expect(servico.consultarOfertas(espectador).map((o) => o.descontoPercentual)).toEqual([5, 30]);
    });
  });

  describe("recarga pelo processador externo (cliente do Adapter)", () => {
    test("cria a recarga PENDENTE com o preço calculado no servidor e o checkout no primeiro gateway", async () => {
      const { controller, recargas } = criarCenario();
      const recarga = await controller.recarregar("usuario-1", "p300", MetodoRecarga.PROCESSADOR_EXTERNO);

      expect(recarga.status).toBe(StatusTransacao.PENDENTE);
      expect(recarga.valor.centavos).toBe(1491);
      expect(recarga.gatewayUtilizado).toBe("Simulado-A");
      expect(recarga.idCheckout).toBe("sim-1");
      expect(recargas.buscarPorId(recarga.id)).toBe(recarga);
    });

    test("fallback (O07): primeiro gateway fora do ar, usa o segundo", async () => {
      const { controller, processadorA } = criarCenario();
      processadorA.online = false;

      const recarga = await controller.recarregar("usuario-1", "p300", MetodoRecarga.PROCESSADOR_EXTERNO);

      expect(recarga.status).toBe(StatusTransacao.PENDENTE);
      expect(recarga.gatewayUtilizado).toBe("Simulado-B");
    });

    test("nenhum gateway disponível: recarga CANCELADA com o motivo", async () => {
      const { controller, processadorA, processadorB } = criarCenario();
      processadorA.online = false;
      processadorB.online = false;

      const recarga = await controller.recarregar("usuario-1", "p300", MetodoRecarga.PROCESSADOR_EXTERNO);

      expect(recarga.status).toBe(StatusTransacao.CANCELADA);
      expect(recarga.motivoCancelamento).toBe("nenhum gateway disponível (Simulado-A, Simulado-B)");
    });

    test("erro que não é indisponibilidade não aciona o fallback: cancela e propaga", async () => {
      const { espectador, financeiro } = criarCenario();
      const quebrado: GatewayPagamento = {
        nome: "Quebrado",
        iniciarCheckout: async () => {
          throw new Error("requisição inválida");
        },
        consultarPagamento: async () => {
          throw new Error("não usado");
        },
        validarWebhook: () => false,
        estaDisponivel: async () => true,
      };
      const recargas = new RepositorioEmMemoria<Recarga>();
      const servico = new ServicoRecarga({
        pacotes,
        configuracaoPreco: {},
        gateways: [quebrado],
        financeiro,
        recargas,
        geradorId: new GeradorId(),
      });

      await expect(servico.processarRecarga(espectador, pacotes[0]!, MetodoRecarga.PROCESSADOR_EXTERNO)).rejects.toThrow(
        "requisição inválida",
      );
      expect(recargas.listar()[0]!.status).toBe(StatusTransacao.CANCELADA);
    });

    test("o modal recebe os meios de pagamento na ordem do sistema", () => {
      const { controller } = criarCenario();
      expect(controller.consultarMeiosPagamento()).toEqual(["Simulado-A", "Simulado-B"]);
    });

    test("o espectador escolhe o meio: usa esse, mesmo não sendo o primeiro", async () => {
      const { controller } = criarCenario();
      const recarga = await controller.recarregar("usuario-1", "p300", MetodoRecarga.PROCESSADOR_EXTERNO, "Simulado-B");

      expect(recarga.status).toBe(StatusTransacao.PENDENTE);
      expect(recarga.gatewayUtilizado).toBe("Simulado-B");
    });

    test("meio escolhido fora do ar e um único outro disponível: segue nele automaticamente", async () => {
      const { controller, processadorB } = criarCenario();
      processadorB.online = false;

      const recarga = await controller.recarregar("usuario-1", "p300", MetodoRecarga.PROCESSADOR_EXTERNO, "Simulado-B");

      expect(recarga.status).toBe(StatusTransacao.PENDENTE);
      expect(recarga.gatewayUtilizado).toBe("Simulado-A");
    });

    test("meio escolhido fora do ar e vários disponíveis: cancela e devolve só os que respondem", async () => {
      const { controller, processadores, recargas } = cenarioComTresMeios();
      processadores.A.online = false;

      const tentativa = controller.recarregar("usuario-1", "p300", MetodoRecarga.PROCESSADOR_EXTERNO, "Simulado-A");

      await expect(tentativa).rejects.toBeInstanceOf(ErroMeioPagamentoIndisponivel);
      await expect(tentativa).rejects.toMatchObject({ gateway: "Simulado-A", alternativas: ["Simulado-B", "Simulado-C"] });
      const [recarga] = recargas.listar();
      expect(recarga!.status).toBe(StatusTransacao.CANCELADA);
      expect(recarga!.gatewayUtilizado).toBeUndefined();
    });

    test("as alternativas não incluem meios que também estão fora do ar", async () => {
      const { controller, processadores } = cenarioComTresMeios();
      processadores.A.online = false;
      processadores.B.online = false;

      // Sobra só o C: não há o que perguntar, a recarga segue nele.
      const recarga = await controller.recarregar("usuario-1", "p300", MetodoRecarga.PROCESSADOR_EXTERNO, "Simulado-A");
      expect(recarga.gatewayUtilizado).toBe("Simulado-C");
    });

    test("todos fora do ar: cancela e avisa que não há outro meio", async () => {
      const { controller, processadorA, processadorB, recargas } = criarCenario();
      processadorA.online = false;
      processadorB.online = false;

      const tentativa = controller.recarregar("usuario-1", "p300", MetodoRecarga.PROCESSADOR_EXTERNO, "Simulado-B");

      await expect(tentativa).rejects.toMatchObject({ gateway: "Simulado-B", alternativas: [] });
      expect(recargas.listar()[0]!.status).toBe(StatusTransacao.CANCELADA);
    });

    test("o único disponível falha ao criar o checkout: cancela sem alternativas", async () => {
      const { controller, processadorB, gatewayA, recargas } = criarCenario();
      processadorB.online = false;
      // Diz que está disponível, mas cai no momento de criar a cobrança.
      jest.spyOn(gatewayA, "iniciarCheckout").mockRejectedValue(new ErroGatewayIndisponivel("Simulado-A", "caiu agora"));

      const tentativa = controller.recarregar("usuario-1", "p300", MetodoRecarga.PROCESSADOR_EXTERNO, "Simulado-B");

      await expect(tentativa).rejects.toMatchObject({ gateway: "Simulado-B", alternativas: [] });
      const [recarga] = recargas.listar();
      expect(recarga!.status).toBe(StatusTransacao.CANCELADA);
      expect(recarga!.gatewayUtilizado).toBeUndefined();
    });

    test("meio de pagamento inexistente é rejeitado antes de criar a recarga", async () => {
      const { controller, recargas } = criarCenario();
      await expect(
        controller.recarregar("usuario-1", "p300", MetodoRecarga.PROCESSADOR_EXTERNO, "Inexistente"),
      ).rejects.toThrow(ErroDominio);
      expect(recargas.listar()).toHaveLength(0);
    });

    test("ErroGatewayIndisponivel guarda o nome do gateway", () => {
      expect(new ErroGatewayIndisponivel("X", "fora").gateway).toBe("X");
    });
  });

  describe("recarga com saldo do criador (SQ08)", () => {
    test("com saldo: debita o dinheiro, credita a moeda virtual e conclui", async () => {
      const { controller, espectador } = criarCenario();
      espectador.carteira.adicionarDinheiro(Dinheiro.deReais(50));

      const recarga = await controller.recarregar("usuario-1", "p300", MetodoRecarga.SALDO_DO_CRIADOR);

      expect(recarga.status).toBe(StatusTransacao.CONCLUIDA);
      expect(espectador.carteira.saldoMoedaVirtual).toBe(300);
      expect(espectador.carteira.saldoDinheiro.centavos).toBe(5000 - 1491);
      expect(espectador.carteira.historico).toContain(recarga);
    });

    test("sem saldo: CANCELADA, sem alterar a carteira", async () => {
      const { controller, espectador } = criarCenario();
      const recarga = await controller.recarregar("usuario-1", "p300", MetodoRecarga.SALDO_DO_CRIADOR);

      expect(recarga.status).toBe(StatusTransacao.CANCELADA);
      expect(recarga.motivoCancelamento).toBe("saldo em dinheiro insuficiente");
      expect(espectador.carteira.saldoMoedaVirtual).toBe(0);
    });
  });

  test("usuário ou pacote inexistente é rejeitado", () => {
    const { controller } = criarCenario();
    expect(() => controller.consultarOfertas("ninguem")).toThrow("Usuário inexistente");
    expect(() => controller.recarregar("usuario-1", "p999", MetodoRecarga.SALDO_DO_CRIADOR)).toThrow("Pacote inexistente");
  });
});
