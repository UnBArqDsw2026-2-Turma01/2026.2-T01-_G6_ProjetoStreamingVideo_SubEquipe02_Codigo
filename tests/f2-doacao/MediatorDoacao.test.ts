import { StatusTransacao } from "../../src/dominio";
import { Doacao, DoacaoComMensagem } from "../../src/f2-doacao";
import { criarCenario } from "./cenario";

describe("MediatorDoacao (Padrão GoF: Mediator)", () => {
  test("processa doação simples: transfere, conclui e persiste sem notificar o chat", () => {
    const { mediadorSimples, doador, criador, repositorioDoacoes, chat } = criarCenario({
      saldoDoador: 3000,
    });
    const exibirSpy = jest.spyOn(chat, "exibirMensagemDestacada");

    const { doacao } = mediadorSimples.processar(doador, criador, 1000);

    expect(doacao).toBeInstanceOf(Doacao);
    expect(doacao).not.toBeInstanceOf(DoacaoComMensagem);
    expect(doacao.status).toBe(StatusTransacao.CONCLUIDA);
    expect(doador.carteira.saldoMoedaVirtual).toBe(2000);
    expect(criador.carteira.saldoDinheiro.centavos).toBe(2000);
    expect(doador.carteira.historico).toContain(doacao);
    expect(criador.carteira.historico).toContain(doacao);
    expect(repositorioDoacoes.buscarPorId(doacao.id)).toBe(doacao);
    expect(exibirSpy).not.toHaveBeenCalled();
  });

  test("rejeita criador não monetizado sem criar doação", () => {
    const { mediadorSimples, doador, criadorNaoMonetizado, repositorioDoacoes } = criarCenario({
      saldoDoador: 1000,
    });

    expect(() => mediadorSimples.processar(doador, criadorNaoMonetizado, 500)).toThrow(
      "não está habilitado a receber doações",
    );
    expect(repositorioDoacoes.listar()).toHaveLength(0);
    expect(doador.carteira.saldoMoedaVirtual).toBe(1000);
  });

  test("rejeita auto-doação", () => {
    const { mediadorSimples, criador } = criarCenario({ saldoDoador: 1000 });

    expect(() => mediadorSimples.processar(criador, criador, 500)).toThrow(
      "não pode doar para o próprio canal",
    );
  });

  test("salva doação cancelada quando o saldo é insuficiente", () => {
    const { mediadorSimples, doador, criador, repositorioDoacoes } = criarCenario({
      saldoDoador: 100,
    });

    expect(() => mediadorSimples.processar(doador, criador, 500)).toThrow(
      "Saldo de moeda virtual insuficiente",
    );

    const [doacao] = repositorioDoacoes.listar();
    expect(doacao!.status).toBe(StatusTransacao.CANCELADA);
    expect(doador.carteira.saldoMoedaVirtual).toBe(100);
    expect(criador.carteira.saldoDinheiro.ehZero()).toBe(true);
  });

  test("cancela e repropaga erro se a transferência financeira falhar", () => {
    const { mediadorSimples, doador, criador, financeiro, repositorioDoacoes } = criarCenario({
      saldoDoador: 1000,
    });
    jest.spyOn(financeiro, "transferirDoacao").mockImplementation(() => {
      throw new Error("Falha simulada no financeiro");
    });

    expect(() => mediadorSimples.processar(doador, criador, 500)).toThrow(
      "Falha simulada no financeiro",
    );

    const [doacao] = repositorioDoacoes.listar();
    expect(doacao!.status).toBe(StatusTransacao.CANCELADA);
  });
});
