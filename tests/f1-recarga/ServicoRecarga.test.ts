import { GeradorId, RepositorioEmMemoria } from "../../src/compartilhado";
import { Dinheiro, StatusTransacao } from "../../src/dominio";
import {
  ErroGatewayIndisponivel,
  MetodoRecarga,
  Recarga,
  ServicoRecarga,
  type GatewayPagamento,
} from "../../src/f1-recarga";
import { criarCenario, pacotes } from "./cenario";

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

    test("monta as camadas na ordem desconto → taxa → imposto → conversão", () => {
      const { servico } = criarCenario({
        descontoPercentual: 10,
        taxaFixa: Dinheiro.deReais(1),
        aliquotaImposto: 5,
        conversao: { taxaCambio: 0.2, moedaDestino: "USD" },
      });
      const preco = servico.montarPreco(pacotes[0]!);
      // ((20,00 − 10%) + 1,00) × 1,05 = 19,95 → × 0,2 = 3,99 USD
      expect(preco.calcular().centavos).toBe(399);
      expect(preco.calcular().moeda).toBe("USD");
      expect(preco.descrever()).toContain("desconto de 10% → taxa de R$ 1,00 → imposto de 5% → conversão para USD");
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
