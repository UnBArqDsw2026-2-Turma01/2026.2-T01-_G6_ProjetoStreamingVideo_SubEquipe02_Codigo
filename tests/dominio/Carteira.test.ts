import { Carteira, Dinheiro, ErroDominio } from "../../src/dominio";

describe("Carteira", () => {
  test("começa com saldos zerados", () => {
    const carteira = new Carteira();
    expect(carteira.saldoMoedaVirtual).toBe(0);
    expect(carteira.saldoDinheiro.ehZero()).toBe(true);
  });

  test("dedução de moeda virtual verifica e debita na mesma operação", () => {
    const carteira = new Carteira();
    carteira.adicionarMoedaVirtual(100);
    expect(carteira.deduzirMoedaVirtual(150)).toBe(false);
    expect(carteira.saldoMoedaVirtual).toBe(100);
    expect(carteira.deduzirMoedaVirtual(60)).toBe(true);
    expect(carteira.saldoMoedaVirtual).toBe(40);
  });

  test("dedução de dinheiro não deixa saldo negativo", () => {
    const carteira = new Carteira();
    carteira.adicionarDinheiro(Dinheiro.deReais(10));
    expect(carteira.deduzirDinheiro(Dinheiro.deReais(20))).toBe(false);
    expect(carteira.deduzirDinheiro(Dinheiro.deReais(4))).toBe(true);
    expect(carteira.saldoDinheiro.centavos).toBe(600);
  });

  test("rejeita quantidade de moeda virtual inválida", () => {
    const carteira = new Carteira();
    expect(() => carteira.adicionarMoedaVirtual(0)).toThrow(ErroDominio);
    expect(() => carteira.adicionarMoedaVirtual(1.5)).toThrow(ErroDominio);
  });
});
