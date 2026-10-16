import { Dinheiro, ErroDominio, StatusTransacao, Usuario } from "../../src/dominio";
import { MetodoRecarga, Recarga } from "../../src/f1-recarga";

const criar = () =>
  new Recarga(
    "recarga-1",
    new Usuario("u1", "Espectador", "e@exemplo.com"),
    300,
    Dinheiro.deCentavos(1491),
    "pacote de 300",
    MetodoRecarga.PROCESSADOR_EXTERNO,
  );

describe("Recarga", () => {
  test("nasce PENDENTE e sem checkout", () => {
    const recarga = criar();
    expect(recarga.status).toBe(StatusTransacao.PENDENTE);
    expect(recarga.gatewayUtilizado).toBeUndefined();
  });

  test("rejeita quantidade de moeda virtual inválida", () => {
    expect(
      () => new Recarga("r", new Usuario("u", "U", "u@e.com"), 0, Dinheiro.deCentavos(1), "", MetodoRecarga.SALDO_DO_CRIADOR),
    ).toThrow(ErroDominio);
  });

  test("registra o checkout uma única vez", () => {
    const recarga = criar();
    recarga.registrarCheckout("Simulado-A", "sim-1", "pague sim-1");
    expect(recarga.idCheckout).toBe("sim-1");
    expect(recarga.instrucoesPagamento).toBe("pague sim-1");
    expect(() => recarga.registrarCheckout("Simulado-B", "sim-2")).toThrow(ErroDominio);
  });

  test("não registra checkout em recarga encerrada", () => {
    const recarga = criar();
    recarga.cancelarComMotivo("teste");
    expect(recarga.motivoCancelamento).toBe("teste");
    expect(() => recarga.registrarCheckout("Simulado-A", "sim-1")).toThrow(ErroDominio);
  });
});
