import type { DoacaoNotificada } from "../../src/contratos";
import { ErroDominio, Usuario } from "../../src/dominio";
import { Chat } from "../../src/f3-chat";
import { criarCenario } from "../f2-doacao/cenario";

const doador = new Usuario("u1", "Espectador", "espectador@exemplo.com");
const criador = new Usuario("u2", "Criador", "criador@exemplo.com");

function doacao(quantidadeMoedaVirtual: number, mensagem = "Valeu pela live!"): DoacaoNotificada {
  return { doacaoId: "doacao-1", doador, criador, quantidadeMoedaVirtual, mensagem };
}

function chatSilencioso() {
  const linhas: string[] = [];
  const chat = new Chat((linha) => linhas.push(linha));
  return { chat, linhas };
}

describe("Chat (Client do Decorator)", () => {
  test("implementa o contrato e imprime cabeçalho e texto", () => {
    const { chat, linhas } = chatSilencioso();
    chat.exibirMensagemDestacada(doacao(2000));

    expect(linhas).toEqual([
      "[chat] [LARANJA] Espectador · 2000 de moeda virtual · fixada por 10 min",
      '       "Valeu pela live!"',
    ]);
  });

  test.each([
    [200, "AZUL", 0, 50],
    [500, "VERDE", 2, 150],
    [2000, "LARANJA", 10, 225],
    [5000, "ROSA", 30, 250],
    [50000, "VERMELHO", 300, 350],
  ])("doação de %i usa a faixa certa (SC01, SC02)", (quantidade, cor, fixacao, limite) => {
    const { chat } = chatSilencioso();
    chat.exibirMensagemDestacada(doacao(quantidade));
    const [mensagem] = chat.mensagensExibidas();

    expect(mensagem.cabecalho()).toContain(`[${cor}]`);
    expect(mensagem.tempoFixacaoMin()).toBe(fixacao);
    expect(mensagem.descrever()).toContain(`limite de ${limite} caracteres`);
  });

  test("a FAIXA_1 não recebe a camada de fixação", () => {
    const { chat } = chatSilencioso();
    chat.exibirMensagemDestacada(doacao(200));
    const [mensagem] = chat.mensagensExibidas();

    expect(mensagem.descrever()).toBe("mensagem → limite de 50 caracteres → cor AZUL");
    expect(mensagem.cabecalho()).not.toContain("fixada");
  });

  test("recusa uma mensagem acima do limite da faixa, sem exibir nada pela metade", () => {
    const { chat, linhas } = chatSilencioso();

    expect(() => chat.exibirMensagemDestacada(doacao(200, "a".repeat(80)))).toThrow(
      "excede o limite de 50",
    );
    expect(linhas).toHaveLength(0);
    expect(chat.mensagensExibidas()).toHaveLength(0);
  });

  test("guarda o histórico na ordem de chegada, sem expor a lista interna", () => {
    const { chat } = chatSilencioso();
    chat.exibirMensagemDestacada(doacao(200, "primeira"));
    chat.exibirMensagemDestacada(doacao(500, "segunda"));

    const historico = chat.mensagensExibidas();
    expect(historico.map((m) => m.texto())).toEqual(["primeira", "segunda"]);

    (historico as unknown[]).pop();
    expect(chat.mensagensExibidas()).toHaveLength(2);
  });

  test("valor abaixo da faixa mínima é recusado", () => {
    const { chat } = chatSilencioso();
    expect(() => chat.exibirMensagemDestacada(doacao(100))).toThrow(ErroDominio);
  });
});

describe("Integração com a F2 (contrato NotificadorChat)", () => {
  // O controller da F2 narra a doação no terminal; aqui só interessa o que o chat exibiu.
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("a doação da F2 aparece destacada no chat da F3", () => {
    const { chat, linhas } = chatSilencioso();
    const cenario = criarCenario({ chat, saldoDoador: 3000 });

    cenario.controller.doar(cenario.doador.id, cenario.criador.id, 2000, "Apoio enviado!");

    expect(linhas[0]).toBe("[chat] [LARANJA] Espectador · 2000 de moeda virtual · fixada por 10 min");
    expect(linhas[1]).toBe('       "Apoio enviado!"');
  });

  test("se a saída do chat falhar, a doação e o repasse continuam válidos (D05)", () => {
    const chatComFalha = new Chat(() => {
      throw new Error("terminal indisponível");
    });
    const cenario = criarCenario({ chat: chatComFalha, saldoDoador: 3000 });

    const resultado = cenario.controller.doar(cenario.doador.id, cenario.criador.id, 2000, "Oi!");

    expect(cenario.doador.carteira.saldoMoedaVirtual).toBe(1000);
    expect(resultado.notificacaoChatEnviada).toBe(false);
  });
});
