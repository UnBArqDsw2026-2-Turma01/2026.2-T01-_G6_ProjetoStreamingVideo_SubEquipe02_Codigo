import { ErroDominio, StatusTransacao, Usuario } from "../../src/dominio";
import { Doacao, DoacaoComMensagem } from "../../src/f2-doacao";

const criarUsuarios = () => ({
  doador: new Usuario("u1", "Doador", "d@exemplo.com"),
  criador: new Usuario("u2", "Criador", "c@exemplo.com"),
});

describe("Doacao", () => {
  test("nasce PENDENTE com valor de repasse calculado", () => {
    const { doador, criador } = criarUsuarios();
    const doacao = new Doacao("doa-1", doador, criador, 2000);

    expect(doacao.id).toBe("doa-1");
    expect(doacao.status).toBe(StatusTransacao.PENDENTE);
    expect(doacao.doador).toBe(doador);
    expect(doacao.criador).toBe(criador);
    expect(doacao.quantidadeMoedaVirtual).toBe(2000);
    expect(doacao.valorRepasse.centavos).toBe(1400);
    expect(doacao.valorRepasse.moeda).toBe("BRL");
  });

  test("calcula repasse com taxa personalizada", () => {
    const { doador, criador } = criarUsuarios();
    const doacao = new Doacao("doa-2", doador, criador, 1000, 0.8);
    expect(doacao.valorRepasse.centavos).toBe(800);
  });

  test("rejeita taxa de repasse inválida", () => {
    const { doador, criador } = criarUsuarios();
    expect(() => new Doacao("d", doador, criador, 500, 0)).toThrow(ErroDominio);
    expect(() => new Doacao("d", doador, criador, 500, -0.5)).toThrow(ErroDominio);
    expect(() => new Doacao("d", doador, criador, 500, 1.5)).toThrow(ErroDominio);
  });

  test("rejeita quantidade não positiva", () => {
    const { doador, criador } = criarUsuarios();
    expect(() => new Doacao("d", doador, criador, 0)).toThrow(ErroDominio);
    expect(() => new Doacao("d", doador, criador, -10)).toThrow(ErroDominio);
  });

  test("pode ser concluída e cancelada respeitando o ciclo de vida de Transacao", () => {
    const { doador, criador } = criarUsuarios();
    const doacao = new Doacao("doa-status", doador, criador, 500);
    expect(doacao.estaPendente()).toBe(true);

    doacao.concluir();
    expect(doacao.status).toBe(StatusTransacao.CONCLUIDA);
    expect(() => doacao.cancelar()).toThrow(ErroDominio);
  });
});

describe("DoacaoComMensagem", () => {
  test("nasce com mensagem e faixa classificada", () => {
    const { doador, criador } = criarUsuarios();
    const doacao = new DoacaoComMensagem(
      "doa-1",
      doador,
      criador,
      2000,
      "Parabéns pela live!",
    );

    expect(doacao.mensagem).toBe("Parabéns pela live!");
    expect(doacao.faixa.codigo).toBe("FAIXA_3");
    expect(doacao.valorRepasse.centavos).toBe(1400);
  });

  test("rejeita mensagem vazia ou só espaços", () => {
    const { doador, criador } = criarUsuarios();
    expect(() => new DoacaoComMensagem("d", doador, criador, 200, "")).toThrow(ErroDominio);
    expect(() => new DoacaoComMensagem("d", doador, criador, 200, "   ")).toThrow(ErroDominio);
  });

  test("rejeita mensagem que excede o limite da faixa (SC02)", () => {
    const { doador, criador } = criarUsuarios();
    expect(() => new DoacaoComMensagem("d", doador, criador, 200, "a".repeat(51))).toThrow(
      "A mensagem excede o limite de 50 caracteres da FAIXA_1 (SC02).",
    );
    expect(() => new DoacaoComMensagem("d", doador, criador, 500, "a".repeat(151))).toThrow(
      "A mensagem excede o limite de 150 caracteres da FAIXA_2 (SC02).",
    );
  });

  test("aceita mensagem no limite exato de caracteres da faixa", () => {
    const { doador, criador } = criarUsuarios();
    const doacao = new DoacaoComMensagem("d", doador, criador, 200, "a".repeat(50));
    expect(doacao.mensagem.length).toBe(50);
  });
});
