import { StatusTransacao } from "../../src/dominio";
import { type NotificadorChat } from "../../src/contratos";
import { criarCenario } from "./cenario";

describe("ServicoDoacao (Padrão GoF: Facade)", () => {
  describe("consulta prévia de opções", () => {
    test("retorna status de monetização do canal, saldo do doador e todas as faixas", () => {
      const { servico, criador, doador } = criarCenario({ saldoDoador: 2500 });
      const opcoes = servico.consultarOpcoesDoacao(criador, doador);

      expect(opcoes.canalId).toBe(criador.id);
      expect(opcoes.habilitadoAReceber).toBe(true);
      expect(opcoes.saldoMoedaVirtualDoador).toBe(2500);
      expect(opcoes.faixasDisponiveis).toHaveLength(5);
    });

    test("indica canal não monetizado quando o criador não estiver habilitado", () => {
      const { servico, criadorNaoMonetizado, doador } = criarCenario();
      const opcoes = servico.consultarOpcoesDoacao(criadorNaoMonetizado, doador);

      expect(opcoes.habilitadoAReceber).toBe(false);
    });
  });

  describe("processamento de doação e repasse atômico", () => {
    test("realiza doação com sucesso: debita moedas, repassa dinheiro, conclui transação e notifica chat", () => {
      const { servico, doador, criador, repositorioDoacoes } = criarCenario({ saldoDoador: 3000 });

      const resultado = servico.processarDoacao(
        doador,
        criador,
        2000,
        "Excelente transmissão!",
      );

      // Doação concluída
      expect(resultado.doacao.status).toBe(StatusTransacao.CONCLUIDA);
      expect(resultado.notificacaoChatEnviada).toBe(true);
      expect(resultado.avisoChat).toBeUndefined();

      // Débito no doador (3000 - 2000 = 1000 moedas virtuais)
      expect(doador.carteira.saldoMoedaVirtual).toBe(1000);

      // Crédito de repasse no criador (2000 * 0.7 = R$ 14,00)
      expect(criador.carteira.saldoDinheiro.centavos).toBe(1400);

      // Registro no histórico de ambas as carteiras
      expect(doador.carteira.historico).toContain(resultado.doacao);
      expect(criador.carteira.historico).toContain(resultado.doacao);

      // Salvo no repositório
      expect(repositorioDoacoes.buscarPorId(resultado.doacao.id)).toBe(resultado.doacao);
    });

    test("rejeita doação para canal não monetizado (SQ02, SQ05)", () => {
      const { servico, doador, criadorNaoMonetizado, repositorioDoacoes } = criarCenario({ saldoDoador: 1000 });

      expect(() =>
        servico.processarDoacao(doador, criadorNaoMonetizado, 500, "Tentativa de doação"),
      ).toThrow("não está habilitado a receber doações");

      expect(doador.carteira.saldoMoedaVirtual).toBe(1000);
      expect(repositorioDoacoes.listar()).toHaveLength(0);
    });

    test("rejeita doação quando origem e destino são o mesmo usuário", () => {
      const { servico, criador } = criarCenario({ saldoDoador: 1000 });

      expect(() =>
        servico.processarDoacao(criador, criador, 500, "Auto-doação"),
      ).toThrow("não pode doar para o próprio canal");
    });

    test("rejeita doação por saldo de moeda virtual insuficiente, salvando transação cancelada", () => {
      const { servico, doador, criador, repositorioDoacoes } = criarCenario({ saldoDoador: 300 });

      expect(() =>
        servico.processarDoacao(doador, criador, 500, "Sem saldo suficiente"),
      ).toThrow("Saldo de moeda virtual insuficiente");

      expect(doador.carteira.saldoMoedaVirtual).toBe(300);
      expect(criador.carteira.saldoDinheiro.ehZero()).toBe(true);

      const doacoesSalvas = repositorioDoacoes.listar();
      expect(doacoesSalvas).toHaveLength(1);
      expect(doacoesSalvas[0]!.status).toBe(StatusTransacao.CANCELADA);
    });

    test("desfaz o débito e cancela a doação se o crédito no destino falhar (rollback)", () => {
      const { servico, doador, criador, repositorioDoacoes } = criarCenario({ saldoDoador: 1000 });

      // Simula falha forçada no destino alterando o comportamento do método adicionarDinheiro
      const carteiraOriginal = criador.carteira;
      Object.defineProperty(criador, "carteira", {
        value: {
          ...carteiraOriginal,
          deduzirMoedaVirtual: carteiraOriginal.deduzirMoedaVirtual.bind(carteiraOriginal),
          adicionarMoedaVirtual: carteiraOriginal.adicionarMoedaVirtual.bind(carteiraOriginal),
          adicionarDinheiro: () => {
            throw new Error("Falha no banco de dados durante o crédito");
          },
        },
      });

      expect(() =>
        servico.processarDoacao(doador, criador, 500, "Falha simulada"),
      ).toThrow("Falha no banco de dados durante o crédito");

      expect(doador.carteira.saldoMoedaVirtual).toBe(1000);
      const [doacaoCancelada] = repositorioDoacoes.listar();
      expect(doacaoCancelada!.status).toBe(StatusTransacao.CANCELADA);
    });
  });

  describe("resiliência na exibição do chat (Ata S2_02, D05; SC04)", () => {
    test("falha no serviço de chat não invalida a doação nem o repasse já concluídos", () => {
      const chatComFalha: NotificadorChat = {
        exibirMensagemDestacada: () => {
          throw new Error("Chat indisponível");
        },
      };

      const { servico, doador, criador, repositorioDoacoes } = criarCenario({
        chat: chatComFalha,
        saldoDoador: 1000,
      });

      const resultado = servico.processarDoacao(
        doador,
        criador,
        500,
        "Mensagem mesmo com chat instável",
      );

      // Doação e repasse permanecem válidos
      expect(resultado.doacao.status).toBe(StatusTransacao.CONCLUIDA);
      expect(resultado.notificacaoChatEnviada).toBe(false);
      expect(resultado.avisoChat).toContain("chat falhou ao exibir o destaque: Chat indisponível");

      expect(doador.carteira.saldoMoedaVirtual).toBe(500);
      expect(criador.carteira.saldoDinheiro.centavos).toBe(350); // 500 * 0.7 = 350 centavos = R$ 3,50
      expect(repositorioDoacoes.buscarPorId(resultado.doacao.id)).toBe(resultado.doacao);
    });
  });
});
