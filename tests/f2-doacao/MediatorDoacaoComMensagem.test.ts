import type { DoacaoNotificada, NotificadorChat } from "../../src/contratos";
import { StatusTransacao } from "../../src/dominio";
import { DoacaoComMensagem } from "../../src/f2-doacao";
import { criarCenario } from "./cenario";

describe("MediatorDoacaoComMensagem (Padrão GoF: Mediator)", () => {
  test("processa doação com mensagem: transfere, conclui, persiste e notifica o chat", () => {
    const notificacoes: DoacaoNotificada[] = [];
    const chat: NotificadorChat = {
      exibirMensagemDestacada: (doacao) => {
        notificacoes.push(doacao);
      },
    };
    const { mediadorComMensagem, doador, criador, repositorioDoacoes } = criarCenario({
      chat,
      saldoDoador: 3000,
    });

    const resultado = mediadorComMensagem.processar(
      doador,
      criador,
      2000,
      "Excelente transmissão!",
    );

    expect(resultado.doacao).toBeInstanceOf(DoacaoComMensagem);
    expect(resultado.doacao.status).toBe(StatusTransacao.CONCLUIDA);
    expect(resultado.doacao.mensagem).toBe("Excelente transmissão!");
    expect(resultado.doacao.faixa.codigo).toBe("FAIXA_3");
    expect(resultado.notificacaoChatEnviada).toBe(true);
    expect(resultado.avisoChat).toBeUndefined();
    expect(doador.carteira.saldoMoedaVirtual).toBe(1000);
    expect(criador.carteira.saldoDinheiro.centavos).toBe(4000);
    expect(repositorioDoacoes.buscarPorId(resultado.doacao.id)).toBe(resultado.doacao);
    expect(notificacoes).toHaveLength(1);
    expect(notificacoes[0]).toMatchObject({
      doacaoId: resultado.doacao.id,
      quantidadeMoedaVirtual: 2000,
      mensagem: "Excelente transmissão!",
    });
  });

  test("falha no chat não invalida doação nem repasse (D05)", () => {
    const chat: NotificadorChat = {
      exibirMensagemDestacada: () => {
        throw new Error("Chat indisponível");
      },
    };
    const { mediadorComMensagem, doador, criador } = criarCenario({
      chat,
      saldoDoador: 1000,
    });

    const resultado = mediadorComMensagem.processar(doador, criador, 500, "Apoio");

    expect(resultado.doacao.status).toBe(StatusTransacao.CONCLUIDA);
    expect(resultado.notificacaoChatEnviada).toBe(false);
    expect(resultado.avisoChat).toContain(
      "chat falhou ao exibir o destaque: Chat indisponível",
    );
    expect(doador.carteira.saldoMoedaVirtual).toBe(500);
    expect(criador.carteira.saldoDinheiro.centavos).toBe(1000);
  });

  test("rejeita criador não monetizado antes de debitar", () => {
    const { mediadorComMensagem, doador, criadorNaoMonetizado, repositorioDoacoes } =
      criarCenario({ saldoDoador: 1000 });

    expect(() =>
      mediadorComMensagem.processar(doador, criadorNaoMonetizado, 500, "Tentativa"),
    ).toThrow("não está habilitado a receber doações");

    expect(repositorioDoacoes.listar()).toHaveLength(0);
    expect(doador.carteira.saldoMoedaVirtual).toBe(1000);
  });

  test("rejeita auto-doação", () => {
    const { mediadorComMensagem, criador } = criarCenario({ saldoDoador: 1000 });

    expect(() => mediadorComMensagem.processar(criador, criador, 500, "Auto")).toThrow(
      "não pode doar para o próprio canal",
    );
  });

  test("salva doação cancelada quando o saldo é insuficiente", () => {
    const { mediadorComMensagem, doador, criador, repositorioDoacoes } = criarCenario({
      saldoDoador: 300,
    });

    expect(() =>
      mediadorComMensagem.processar(doador, criador, 500, "Sem saldo"),
    ).toThrow("Saldo de moeda virtual insuficiente");

    const [doacao] = repositorioDoacoes.listar();
    expect(doacao).toBeInstanceOf(DoacaoComMensagem);
    expect(doacao!.status).toBe(StatusTransacao.CANCELADA);
  });

  test("cancela e repropaga erro se a transferência financeira falhar", () => {
    const { mediadorComMensagem, doador, criador, financeiro, repositorioDoacoes } =
      criarCenario({ saldoDoador: 1000 });
    jest.spyOn(financeiro, "transferirDoacao").mockImplementation(() => {
      throw new Error("Falha no crédito");
    });

    expect(() =>
      mediadorComMensagem.processar(doador, criador, 500, "Falha"),
    ).toThrow("Falha no crédito");

    const [doacao] = repositorioDoacoes.listar();
    expect(doacao!.status).toBe(StatusTransacao.CANCELADA);
  });

  test("propaga erro de domínio quando a mensagem é inválida para a faixa", () => {
    const { mediadorComMensagem, doador, criador, repositorioDoacoes } = criarCenario({
      saldoDoador: 1000,
    });

    expect(() =>
      mediadorComMensagem.processar(doador, criador, 200, "a".repeat(51)),
    ).toThrow("excede o limite de 50 caracteres");

    expect(repositorioDoacoes.listar()).toHaveLength(0);
    expect(doador.carteira.saldoMoedaVirtual).toBe(1000);
  });
});
