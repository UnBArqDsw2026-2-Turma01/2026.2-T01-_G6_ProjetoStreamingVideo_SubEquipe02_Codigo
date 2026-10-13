import { Dinheiro, ErroDominio } from "../../src/dominio";

describe("Dinheiro", () => {
  test("converte reais em centavos inteiros", () => {
    expect(Dinheiro.deReais(16.8).centavos).toBe(1680);
  });

  test("soma e subtrai sem erro de ponto flutuante", () => {
    const a = Dinheiro.deReais(0.1);
    const b = Dinheiro.deReais(0.2);
    expect(a.somar(b).centavos).toBe(30);
    expect(Dinheiro.deReais(1).subtrair(a).centavos).toBe(90);
  });

  test("calcula percentual arredondando para o centavo", () => {
    expect(Dinheiro.deReais(16.8).percentual(29).centavos).toBe(487);
  });

  test("é imutável: operações devolvem nova instância", () => {
    const original = Dinheiro.deReais(10);
    original.somar(Dinheiro.deReais(5));
    expect(original.centavos).toBe(1000);
  });

  test("rejeita valor negativo", () => {
    expect(() => Dinheiro.deReais(1).subtrair(Dinheiro.deReais(2))).toThrow(ErroDominio);
  });

  test("rejeita operação entre moedas diferentes", () => {
    expect(() => Dinheiro.deReais(1).somar(Dinheiro.deReais(1, "USD"))).toThrow(ErroDominio);
  });

  test("compara e formata valores", () => {
    expect(Dinheiro.deReais(2).ehMaiorOuIgual(Dinheiro.deReais(1))).toBe(true);
    expect(Dinheiro.zero().ehZero()).toBe(true);
    expect(Dinheiro.deReais(16.8).igual(Dinheiro.deCentavos(1680))).toBe(true);
    expect(Dinheiro.deReais(16.8).formatar()).toBe("R$ 16,80");
  });
});
