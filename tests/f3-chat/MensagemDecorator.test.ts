import { ErroDominio } from "../../src/dominio";
import {
  ComFaixaCor,
  ComFixacao,
  ComLimiteCaracteres,
  MensagemBase,
  type MensagemDestacada,
} from "../../src/f3-chat";

function base(texto = "Valeu pela live!"): MensagemBase {
  return new MensagemBase("Espectador", texto, 2000);
}

describe("MensagemBase (ConcreteComponent)", () => {
  test("exibe autor e valor, sem destaque nem fixação", () => {
    const mensagem = base();
    expect(mensagem.cabecalho()).toBe("Espectador · 2000 de moeda virtual");
    expect(mensagem.texto()).toBe("Valeu pela live!");
    expect(mensagem.cor()).toBeNull();
    expect(mensagem.tempoFixacaoMin()).toBe(0);
    expect(mensagem.descrever()).toBe("mensagem");
  });

  test("recusa autor vazio e quantidade inválida", () => {
    expect(() => new MensagemBase("  ", "oi", 200)).toThrow(ErroDominio);
    expect(() => new MensagemBase("Espectador", "oi", 0)).toThrow(ErroDominio);
    expect(() => new MensagemBase("Espectador", "oi", 2.5)).toThrow(ErroDominio);
  });
});

describe("ComFaixaCor", () => {
  test("acrescenta a cor ao cabeçalho sem mexer no texto", () => {
    const mensagem = new ComFaixaCor(base(), "LARANJA");
    expect(mensagem.cabecalho()).toBe("[LARANJA] Espectador · 2000 de moeda virtual");
    expect(mensagem.texto()).toBe("Valeu pela live!");
    expect(mensagem.tempoFixacaoMin()).toBe(0);
  });

  test("define a cor da mensagem, que as camadas de fora repassam", () => {
    expect(new ComFaixaCor(base(), "LARANJA").cor()).toBe("LARANJA");
    expect(new ComFixacao(new ComFaixaCor(base(), "ROSA"), 30).cor()).toBe("ROSA");
    expect(new ComFixacao(base(), 30).cor()).toBeNull();
  });

  test("recusa cor vazia", () => {
    expect(() => new ComFaixaCor(base(), "")).toThrow(ErroDominio);
  });
});

describe("ComFixacao", () => {
  test("fixa a mensagem e mostra o tempo no cabeçalho", () => {
    const mensagem = new ComFixacao(base(), 10);
    expect(mensagem.tempoFixacaoMin()).toBe(10);
    expect(mensagem.cabecalho()).toBe("Espectador · 2000 de moeda virtual · fixada por 10 min");
  });

  test("mostra horas cheias em horas", () => {
    expect(new ComFixacao(base(), 300).cabecalho()).toContain("fixada por 5 h");
    expect(new ComFixacao(base(), 90).cabecalho()).toContain("fixada por 90 min");
  });

  test("recusa tempo zero, negativo ou fracionado", () => {
    expect(() => new ComFixacao(base(), 0)).toThrow(ErroDominio);
    expect(() => new ComFixacao(base(), -5)).toThrow(ErroDominio);
    expect(() => new ComFixacao(base(), 1.5)).toThrow(ErroDominio);
  });
});

describe("ComLimiteCaracteres", () => {
  test("mantém o texto que cabe no limite", () => {
    const mensagem = new ComLimiteCaracteres(base("12345"), 5);
    expect(mensagem.texto()).toBe("12345");
  });

  test("recusa o texto que passa do limite, dizendo o tamanho e o limite", () => {
    const mensagem = new ComLimiteCaracteres(base("1234567890"), 5);
    expect(() => mensagem.texto()).toThrow(ErroDominio);
    expect(() => mensagem.texto()).toThrow("tem 10 caracteres e excede o limite de 5");
  });

  test("conta emojis como um caractere", () => {
    const mensagem = new ComLimiteCaracteres(base("🎉🎉🎉"), 3);
    expect(mensagem.texto()).toBe("🎉🎉🎉");
  });

  test("o limite vale só para o texto, não para o cabeçalho", () => {
    const mensagem = new ComLimiteCaracteres(base("curto"), 5);
    expect(mensagem.cabecalho()).toBe("Espectador · 2000 de moeda virtual");
    expect(mensagem.texto()).toBe("curto");
  });

  test("recusa limite inválido", () => {
    expect(() => new ComLimiteCaracteres(base(), 0)).toThrow(ErroDominio);
  });
});

describe("Empilhamento das camadas (Decorator)", () => {
  test("as camadas se combinam e cada uma mexe só na sua parte", () => {
    let mensagem: MensagemDestacada = base("Valeu!");
    mensagem = new ComLimiteCaracteres(mensagem, 10);
    mensagem = new ComFaixaCor(mensagem, "LARANJA");
    mensagem = new ComFixacao(mensagem, 10);

    expect(mensagem.cabecalho()).toBe(
      "[LARANJA] Espectador · 2000 de moeda virtual · fixada por 10 min",
    );
    expect(mensagem.texto()).toBe("Valeu!");
    expect(mensagem.tempoFixacaoMin()).toBe(10);
    expect(mensagem.descrever()).toBe(
      "mensagem → limite de 10 caracteres → cor LARANJA → fixação de 10 min",
    );
  });

  test("tirar uma camada não quebra as outras", () => {
    const semFixacao = new ComFaixaCor(new ComLimiteCaracteres(base(), 50), "AZUL");
    expect(semFixacao.tempoFixacaoMin()).toBe(0);
    expect(semFixacao.cabecalho()).toBe("[AZUL] Espectador · 2000 de moeda virtual");
  });

  test("a mensagem original não é alterada pelos decoradores", () => {
    const original = base("texto original");
    new ComLimiteCaracteres(original, 3);
    new ComFaixaCor(original, "VERDE");
    expect(original.texto()).toBe("texto original");
    expect(original.cabecalho()).toBe("Espectador · 2000 de moeda virtual");
  });
});
