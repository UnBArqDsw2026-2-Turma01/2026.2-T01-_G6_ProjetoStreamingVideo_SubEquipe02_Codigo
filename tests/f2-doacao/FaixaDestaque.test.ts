import { ErroDominio } from "../../src/dominio";
import { FaixaDestaque } from "../../src/f2-doacao";

describe("FaixaDestaque", () => {
  describe("classificação por faixas de valor (SC01 e SC02)", () => {
    test("classifica na FAIXA_1 (200 a 499 moedas: azul, sem fixação, limite de 50 caracteres)", () => {
      const faixaMinima = FaixaDestaque.paraQuantidade(200);
      expect(faixaMinima.codigo).toBe("FAIXA_1");
      expect(faixaMinima.cor).toBe("AZUL");
      expect(faixaMinima.tempoFixacaoMin).toBe(0);
      expect(faixaMinima.limiteCaracteres).toBe(50);

      const faixaLimite = FaixaDestaque.paraQuantidade(499);
      expect(faixaLimite.codigo).toBe("FAIXA_1");
    });

    test("classifica na FAIXA_2 (500 a 1999 moedas: verde, fixada por 2 min, limite de 150 caracteres)", () => {
      const faixa = FaixaDestaque.paraQuantidade(500);
      expect(faixa.codigo).toBe("FAIXA_2");
      expect(faixa.cor).toBe("VERDE");
      expect(faixa.tempoFixacaoMin).toBe(2);
      expect(faixa.limiteCaracteres).toBe(150);

      expect(FaixaDestaque.paraQuantidade(1999).codigo).toBe("FAIXA_2");
    });

    test("classifica na FAIXA_3 (2000 a 4999 moedas: laranja, fixada por 10 min, limite de 225 caracteres)", () => {
      const faixa = FaixaDestaque.paraQuantidade(2000);
      expect(faixa.codigo).toBe("FAIXA_3");
      expect(faixa.cor).toBe("LARANJA");
      expect(faixa.tempoFixacaoMin).toBe(10);
      expect(faixa.limiteCaracteres).toBe(225);

      expect(FaixaDestaque.paraQuantidade(4999).codigo).toBe("FAIXA_3");
    });

    test("classifica na FAIXA_4 (5000 a 49999 moedas: rosa, fixada por 30 min, limite de 250 caracteres)", () => {
      const faixa = FaixaDestaque.paraQuantidade(5000);
      expect(faixa.codigo).toBe("FAIXA_4");
      expect(faixa.cor).toBe("ROSA");
      expect(faixa.tempoFixacaoMin).toBe(30);
      expect(faixa.limiteCaracteres).toBe(250);

      expect(FaixaDestaque.paraQuantidade(49999).codigo).toBe("FAIXA_4");
    });

    test("classifica na FAIXA_5 (a partir de 50000 moedas: vermelho, fixada por 5h / 300 min, limite de 350 caracteres)", () => {
      const faixa = FaixaDestaque.paraQuantidade(50000);
      expect(faixa.codigo).toBe("FAIXA_5");
      expect(faixa.cor).toBe("VERMELHO");
      expect(faixa.tempoFixacaoMin).toBe(300);
      expect(faixa.limiteCaracteres).toBe(350);

      expect(FaixaDestaque.paraQuantidade(100000).codigo).toBe("FAIXA_5");
    });
  });

  describe("validações de quantidade mínima e formato", () => {
    test("rejeita quantidade inferior ao mínimo global de 200 moedas virtuais", () => {
      expect(() => FaixaDestaque.paraQuantidade(199)).toThrow(ErroDominio);
      expect(() => FaixaDestaque.paraQuantidade(0)).toThrow(ErroDominio);
      expect(() => FaixaDestaque.paraQuantidade(-500)).toThrow(ErroDominio);
    });

    test("rejeita valores com ponto flutuante", () => {
      expect(() => FaixaDestaque.paraQuantidade(200.5)).toThrow(ErroDominio);
      expect(() => FaixaDestaque.paraQuantidade(NaN)).toThrow(ErroDominio);
    });
  });
});
