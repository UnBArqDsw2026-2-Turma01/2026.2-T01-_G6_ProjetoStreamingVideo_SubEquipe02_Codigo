import { Dinheiro, ErroDominio } from "../../src/dominio";
import {
  ComConversaoMoeda,
  ComDesconto,
  ComImposto,
  ComTaxaFixa,
  PrecoPacote,
  type Pacote,
} from "../../src/f1-recarga";

const pacote300: Pacote = { id: "p300", quantidadeMoedaVirtual: 300, valorBase: Dinheiro.deReais(20) };

describe("Decorator do preço", () => {
  test("o componente base devolve o preço de tabela", () => {
    const preco = new PrecoPacote(pacote300);
    expect(preco.calcular().centavos).toBe(2000);
    expect(preco.descrever()).toBe("pacote de 300 (R$ 20,00)");
  });

  test("desconto de 29% (RN01)", () => {
    expect(new ComDesconto(new PrecoPacote(pacote300), 29).calcular().centavos).toBe(1420);
  });

  test("imposto de 5% sobre o valor", () => {
    expect(new ComImposto(new PrecoPacote(pacote300), 5).calcular().centavos).toBe(2100);
  });

  test("camadas se empilham: desconto e depois imposto", () => {
    const preco = new ComImposto(new ComDesconto(new PrecoPacote(pacote300), 29), 5);
    expect(preco.calcular().centavos).toBe(1491);
    expect(preco.descrever()).toBe("pacote de 300 (R$ 20,00) → desconto de 29% → imposto de 5%");
  });

  test("com valor fixo, a ordem das camadas muda o resultado", () => {
    const taxa = Dinheiro.deReais(1);
    const taxaDepoisDoDesconto = new ComTaxaFixa(new ComDesconto(new PrecoPacote(pacote300), 10), taxa);
    const taxaAntesDoDesconto = new ComDesconto(new ComTaxaFixa(new PrecoPacote(pacote300), taxa), 10);
    expect(taxaDepoisDoDesconto.calcular().centavos).toBe(1900); // 18,00 + 1,00
    expect(taxaAntesDoDesconto.calcular().centavos).toBe(1890); // 21,00 − 10%
  });

  test("conversão de moeda como última camada", () => {
    const preco = new ComConversaoMoeda(new ComImposto(new PrecoPacote(pacote300), 5), 0.2, "USD");
    const valor = preco.calcular();
    expect(valor.moeda).toBe("USD");
    expect(valor.centavos).toBe(420); // 21,00 × 0,2
  });

  test("taxa em reais depois da conversão falha por moedas incompatíveis", () => {
    const convertido = new ComConversaoMoeda(new PrecoPacote(pacote300), 0.2, "USD");
    expect(() => new ComTaxaFixa(convertido, Dinheiro.deReais(1)).calcular()).toThrow(ErroDominio);
  });

  test("parâmetros inválidos são rejeitados na construção", () => {
    const base = new PrecoPacote(pacote300);
    expect(() => new ComDesconto(base, 0)).toThrow(ErroDominio);
    expect(() => new ComDesconto(base, 100)).toThrow(ErroDominio);
    expect(() => new ComImposto(base, -1)).toThrow(ErroDominio);
    expect(() => new ComTaxaFixa(base, Dinheiro.zero())).toThrow(ErroDominio);
    expect(() => new ComConversaoMoeda(base, 0, "USD")).toThrow(ErroDominio);
  });
});
