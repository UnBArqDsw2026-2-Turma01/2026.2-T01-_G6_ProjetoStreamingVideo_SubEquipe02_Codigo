import { Dinheiro, Usuario } from "../../src/dominio";
import { ServicoFinanceiro } from "../../src/financeiro";

describe("ServicoFinanceiro", () => {
  const criarUsuarios = () => ({
    doador: new Usuario("u1", "Doador", "d@exemplo.com"),
    criador: new Usuario("u2", "Criador", "c@exemplo.com"),
  });

  test("credita moeda virtual", () => {
    const { doador } = criarUsuarios();
    new ServicoFinanceiro().creditarMoedaVirtual(doador, 300);
    expect(doador.carteira.saldoMoedaVirtual).toBe(300);
  });

  test("transfere doação: debita moeda virtual e credita repasse em dinheiro", () => {
    const { doador, criador } = criarUsuarios();
    const financeiro = new ServicoFinanceiro();
    financeiro.creditarMoedaVirtual(doador, 300);

    const ok = financeiro.transferirDoacao(doador, criador, 100, Dinheiro.deReais(1));

    expect(ok).toBe(true);
    expect(doador.carteira.saldoMoedaVirtual).toBe(200);
    expect(criador.carteira.saldoDinheiro.centavos).toBe(100);
  });

  test("recusa doação sem saldo, sem alterar nenhuma carteira", () => {
    const { doador, criador } = criarUsuarios();
    const ok = new ServicoFinanceiro().transferirDoacao(doador, criador, 100, Dinheiro.deReais(1));
    expect(ok).toBe(false);
    expect(doador.carteira.saldoMoedaVirtual).toBe(0);
    expect(criador.carteira.saldoDinheiro.ehZero()).toBe(true);
  });

  test("desfaz o débito se o crédito no destino falhar", () => {
    const { doador, criador } = criarUsuarios();
    const financeiro = new ServicoFinanceiro();
    financeiro.creditarMoedaVirtual(doador, 300);

    expect(() =>
      financeiro.transferirDoacao(doador, criador, 100, Dinheiro.deReais(1, "USD")),
    ).toThrow();
    expect(doador.carteira.saldoMoedaVirtual).toBe(300);
  });

  test("consulta saldos", () => {
    const { doador } = criarUsuarios();
    const financeiro = new ServicoFinanceiro();
    financeiro.creditarMoedaVirtual(doador, 50);
    expect(financeiro.consultarSaldos(doador).moedaVirtual).toBe(50);
  });
  describe("recarregarComSaldo", () => {
    test("debita o dinheiro e credita a moeda virtual", () => {
      const { criador } = criarUsuarios();
      criador.carteira.adicionarDinheiro(Dinheiro.deReais(50));

      const ok = new ServicoFinanceiro().recarregarComSaldo(criador, Dinheiro.deReais(14.91), 300);

      expect(ok).toBe(true);
      expect(criador.carteira.saldoDinheiro.centavos).toBe(5000 - 1491);
      expect(criador.carteira.saldoMoedaVirtual).toBe(300);
    });

    test("recusa sem saldo em dinheiro, sem alterar a carteira", () => {
      const { criador } = criarUsuarios();
      const ok = new ServicoFinanceiro().recarregarComSaldo(criador, Dinheiro.deReais(14.91), 300);
      expect(ok).toBe(false);
      expect(criador.carteira.saldoMoedaVirtual).toBe(0);
      expect(criador.carteira.saldoDinheiro.ehZero()).toBe(true);
    });

    test("devolve o dinheiro se o crédito da moeda virtual falhar", () => {
      const { criador } = criarUsuarios();
      criador.carteira.adicionarDinheiro(Dinheiro.deReais(50));

      expect(() =>
        new ServicoFinanceiro().recarregarComSaldo(criador, Dinheiro.deReais(10), 0),
      ).toThrow();
      expect(criador.carteira.saldoDinheiro.centavos).toBe(5000);
    });
  });
});
