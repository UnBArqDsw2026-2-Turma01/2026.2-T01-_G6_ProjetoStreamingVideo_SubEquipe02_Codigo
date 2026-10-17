import { Dinheiro, ErroDominio, StatusTransacao, Usuario } from "../../src/dominio";
import { Doacao, FaixaDestaque } from "../../src/f2-doacao";

const criarUsuarios = () => ({
  doador: new Usuario("u1", "Doador", "d@exemplo.com"),
  criador: new Usuario("u2", "Criador", "c@exemplo.com"),
});

describe("Doacao", () => {
  test("nasce PENDENTE com classificação de faixa e valor de repasse calculados", () => {
    const { doador, criador } = criarUsuarios();
    const doacao = new Doacao("doa-1", doador, criador, 2000, "Parabéns pela live!");

    expect(doacao.id).toBe("doa-1");
    expect(doacao.status).toBe(StatusTransacao.PENDENTE);
    expect(doacao.doador).toBe(doador);
    expect(doacao.criador).toBe(criador);
    expect(doacao.quantidadeMoedaVirtual).toBe(2000);
    expect(doacao.mensagem).toBe("Parabéns pela live!");
    expect(doacao.faixa.codigo).toBe("FAIXA_3");
    // 2000 centavos * 0.7 = 1400 centavos = R$ 14,00
    expect(doacao.valorRepasse.centavos).toBe(1400);
    expect(doacao.valorRepasse.moeda).toBe("BRL");
  });

  test("calcula repasse com taxa personalizada", () => {
    const { doador, criador } = criarUsuarios();
    const doacao = new Doacao("doa-2", doador, criador, 1000, "Apoio com taxa de 80%", 0.8);
    // 1000 centavos * 0.8 = 800 centavos = R$ 8,00
    expect(doacao.valorRepasse.centavos).toBe(800);
  });

  test("rejeita taxa de repasse menor ou igual a 0 ou maior que 1", () => {
    const { doador, criador } = criarUsuarios();
    expect(() => new Doacao("d", doador, criador, 500, "msg", 0)).toThrow(ErroDominio);
    expect(() => new Doacao("d", doador, criador, 500, "msg", -0.5)).toThrow(ErroDominio);
    expect(() => new Doacao("d", doador, criador, 500, "msg", 1.5)).toThrow(ErroDominio);
  });

  test("rejeita mensagem vazia ou composta apenas de espaços", () => {
    const { doador, criador } = criarUsuarios();
    expect(() => new Doacao("d", doador, criador, 200, "")).toThrow(ErroDominio);
    expect(() => new Doacao("d", doador, criador, 200, "   ")).toThrow(ErroDominio);
  });

  test("rejeita mensagem que excede o limite de caracteres da faixa (SC02)", () => {
    const { doador, criador } = criarUsuarios();
    const msg51 = "a".repeat(51); // FAIXA_1 suporta até 50 caracteres
    expect(() => new Doacao("d", doador, criador, 200, msg51)).toThrow(
      "A mensagem excede o limite de 50 caracteres da FAIXA_1 (SC02).",
    );

    const msg151 = "a".repeat(151); // FAIXA_2 suporta até 150 caracteres
    expect(() => new Doacao("d", doador, criador, 500, msg151)).toThrow(
      "A mensagem excede o limite de 150 caracteres da FAIXA_2 (SC02).",
    );
  });

  test("aceita mensagem no limite exato de caracteres da faixa", () => {
    const { doador, criador } = criarUsuarios();
    const msg50 = "a".repeat(50);
    const doacao = new Doacao("d", doador, criador, 200, msg50);
    expect(doacao.mensagem.length).toBe(50);
  });

  test("pode ser concluída e cancelada respeitando o ciclo de vida de Transacao", () => {
    const { doador, criador } = criarUsuarios();
    const doacao = new Doacao("doa-status", doador, criador, 500, "Boa!");
    expect(doacao.estaPendente()).toBe(true);

    doacao.concluir();
    expect(doacao.status).toBe(StatusTransacao.CONCLUIDA);
    expect(() => doacao.cancelar()).toThrow(ErroDominio);
  });
});
