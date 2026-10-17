import { ErroDominio, StatusTransacao } from "../../src/dominio";
import { type NotificadorChat } from "../../src/contratos";
import { criarCenario } from "./cenario";

describe("DoacaoController (Cliente da Facade)", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  test("consultarOpcoesDoacao busca usuários no repositório e delega à Facade", () => {
    const { controller, doador, criador } = criarCenario({ saldoDoador: 1500 });
    const opcoes = controller.consultarOpcoesDoacao(criador.id, doador.id);

    expect(opcoes.canalId).toBe(criador.id);
    expect(opcoes.saldoMoedaVirtualDoador).toBe(1500);
    expect(opcoes.habilitadoAReceber).toBe(true);
  });

  test("doar resolve usuários e aciona a Facade sem mensagem", () => {
    const { controller, doador, criador } = criarCenario({ saldoDoador: 3000 });

    const resultado = controller.doar(doador.id, criador.id, 2000);

    expect(resultado.doacao.status).toBe(StatusTransacao.CONCLUIDA);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "[F2 Facade] doacao-1 (CONCLUIDA): Espectador doou 2000 de moeda virtual para Criador",
      ),
    );
  });

  test("doarComMensagem aciona a Facade e imprime faixa no log", () => {
    const { controller, doador, criador } = criarCenario({ saldoDoador: 3000 });

    const resultado = controller.doarComMensagem(
      doador.id,
      criador.id,
      2000,
      "Excelente transmissão!",
    );

    expect(resultado.doacao.status).toBe(StatusTransacao.CONCLUIDA);
    expect(resultado.doacao.faixa.codigo).toBe("FAIXA_3");
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("FAIXA_3"));
  });

  test("emite aviso assíncrono no terminal quando o chat falha", () => {
    const chatComFalha: NotificadorChat = {
      exibirMensagemDestacada: () => {
        throw new Error("Timeout na fila do chat");
      },
    };
    const { controller, doador, criador } = criarCenario({
      chat: chatComFalha,
      saldoDoador: 1000,
    });

    const resultado = controller.doarComMensagem(doador.id, criador.id, 500, "Apoio");

    expect(resultado.doacao.status).toBe(StatusTransacao.CONCLUIDA);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "[F2 Facade] Aviso: Doação e repasse concluídos, mas o chat falhou ao exibir o destaque",
      ),
    );
  });

  test("lança ErroDominio se o espectador de origem não for encontrado", () => {
    const { controller, criador } = criarCenario();
    expect(() => controller.doar("id-fantasma", criador.id, 500)).toThrow(ErroDominio);
  });

  test("lança ErroDominio se o criador destinatário não for encontrado", () => {
    const { controller, doador } = criarCenario();
    expect(() =>
      controller.doarComMensagem(doador.id, "id-fantasma", 500, "Mensagem"),
    ).toThrow(ErroDominio);
  });
});
