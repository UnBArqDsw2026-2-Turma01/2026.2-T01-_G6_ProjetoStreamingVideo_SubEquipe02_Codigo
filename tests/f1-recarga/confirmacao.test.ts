import { StatusTransacao } from "../../src/dominio";
import {
  EfeitoConfirmacao,
  MetodoRecarga,
  ProxyConfirmacaoSegura,
  ServicoConfirmacao,
} from "../../src/f1-recarga";
import { SEGREDO_A, SEGREDO_B, aviso, criarCenario } from "./cenario";

async function recargaPendente() {
  const cenario = criarCenario();
  const recarga = await cenario.controller.recarregar("usuario-1", "p300", MetodoRecarga.PROCESSADOR_EXTERNO);
  return { ...cenario, recarga, idPagamento: recarga.idCheckout! };
}

describe("Confirmação do pagamento (Proxy)", () => {
  test("aviso autêntico de pagamento aprovado: conclui e credita", async () => {
    const { controller, processadorA, recarga, idPagamento, espectador } = await recargaPendente();
    processadorA.aprovar(idPagamento);

    const resultado = await controller.receberWebhook("Simulado-A", aviso(SEGREDO_A, idPagamento, recarga.id));

    expect(resultado.efeito).toBe(EfeitoConfirmacao.CREDITADO);
    expect(recarga.status).toBe(StatusTransacao.CONCLUIDA);
    expect(espectador.carteira.saldoMoedaVirtual).toBe(300);
    expect(espectador.carteira.historico).toContain(recarga);
  });

  test("O14: assinatura inválida é barrada antes do serviço real", async () => {
    const { controller, processadorA, recarga, idPagamento, espectador } = await recargaPendente();
    processadorA.aprovar(idPagamento);

    const falsificado = aviso("segredo-do-atacante", idPagamento, recarga.id);
    const resultado = await controller.receberWebhook("Simulado-A", falsificado);

    expect(resultado.efeito).toBe(EfeitoConfirmacao.NAO_AUTENTICO);
    expect(recarga.status).toBe(StatusTransacao.PENDENTE);
    expect(espectador.carteira.saldoMoedaVirtual).toBe(0);
  });

  test("O14: aviso assinado com o segredo de outro gateway também é barrado", async () => {
    const { controller, processadorA, recarga, idPagamento } = await recargaPendente();
    processadorA.aprovar(idPagamento);
    const resultado = await controller.receberWebhook("Simulado-A", aviso(SEGREDO_B, idPagamento, recarga.id));
    expect(resultado.efeito).toBe(EfeitoConfirmacao.NAO_AUTENTICO);
  });

  test("O11: o mesmo pagamento avisado de novo não credita duas vezes", async () => {
    const { controller, processadorA, recarga, idPagamento, espectador } = await recargaPendente();
    processadorA.aprovar(idPagamento);

    await controller.receberWebhook("Simulado-A", aviso(SEGREDO_A, idPagamento, recarga.id, "ev-1"));
    const reenvio = await controller.receberWebhook("Simulado-A", aviso(SEGREDO_A, idPagamento, recarga.id, "ev-2"));

    expect(reenvio.efeito).toBe(EfeitoConfirmacao.DUPLICADO);
    expect(espectador.carteira.saldoMoedaVirtual).toBe(300);
  });

  test("O11: dois avisos simultâneos do mesmo pagamento creditam uma vez só", async () => {
    const { controller, processadorA, recarga, idPagamento, espectador } = await recargaPendente();
    processadorA.aprovar(idPagamento);

    const resultados = await Promise.all([
      controller.receberWebhook("Simulado-A", aviso(SEGREDO_A, idPagamento, recarga.id, "ev-1")),
      controller.receberWebhook("Simulado-A", aviso(SEGREDO_A, idPagamento, recarga.id, "ev-2")),
    ]);

    expect(resultados.map((r) => r.efeito).sort()).toEqual([EfeitoConfirmacao.CREDITADO, EfeitoConfirmacao.DUPLICADO]);
    expect(espectador.carteira.saldoMoedaVirtual).toBe(300);
  });

  test("pagamento pendente: AGUARDANDO, e o aviso seguinte ainda pode creditar", async () => {
    const { controller, processadorA, recarga, idPagamento, espectador } = await recargaPendente();

    const primeiro = await controller.receberWebhook("Simulado-A", aviso(SEGREDO_A, idPagamento, recarga.id, "ev-1"));
    expect(primeiro.efeito).toBe(EfeitoConfirmacao.AGUARDANDO);

    processadorA.aprovar(idPagamento);
    const segundo = await controller.receberWebhook("Simulado-A", aviso(SEGREDO_A, idPagamento, recarga.id, "ev-2"));
    expect(segundo.efeito).toBe(EfeitoConfirmacao.CREDITADO);
    expect(espectador.carteira.saldoMoedaVirtual).toBe(300);
  });

  test("pagamento recusado: AGUARDANDO e a recarga segue PENDENTE (Entrega 2)", async () => {
    const { controller, processadorA, recarga, idPagamento } = await recargaPendente();
    processadorA.negar(idPagamento);

    const resultado = await controller.receberWebhook("Simulado-A", aviso(SEGREDO_A, idPagamento, recarga.id));

    expect(resultado.efeito).toBe(EfeitoConfirmacao.AGUARDANDO);
    expect(recarga.status).toBe(StatusTransacao.PENDENTE);
  });

  test("valor pago diferente do cobrado: INCONSISTENTE, sem crédito", async () => {
    const { controller, processadorA, recarga, idPagamento, espectador } = await recargaPendente();
    processadorA.aprovar(idPagamento, 1);

    const resultado = await controller.receberWebhook("Simulado-A", aviso(SEGREDO_A, idPagamento, recarga.id));

    expect(resultado.efeito).toBe(EfeitoConfirmacao.INCONSISTENTE);
    expect(espectador.carteira.saldoMoedaVirtual).toBe(0);
  });

  test("aviso que cita outra recarga: INCONSISTENTE (a referência vem do processador)", async () => {
    const { controller, processadorA, idPagamento } = await recargaPendente();
    processadorA.aprovar(idPagamento);
    const resultado = await controller.receberWebhook("Simulado-A", aviso(SEGREDO_A, idPagamento, "recarga-99"));
    expect(resultado.efeito).toBe(EfeitoConfirmacao.INCONSISTENTE);
  });

  test("pagamento de outro gateway enviado pela rota errada: INCONSISTENTE", async () => {
    const { controller, processadorA, processadorB, recarga, idPagamento } = await recargaPendente();
    // O Simulado-B cria uma cobrança com o mesmo protocolo e a mesma referência.
    const { protocolo } = processadorB.criarCobranca(1491, recarga.id);
    processadorB.aprovar(protocolo!);
    processadorA.aprovar(idPagamento);
    expect(protocolo).toBe(idPagamento);

    const resultado = await controller.receberWebhook("Simulado-B", aviso(SEGREDO_B, protocolo!, recarga.id));
    expect(resultado.efeito).toBe(EfeitoConfirmacao.INCONSISTENTE);
  });

  test("gateway desconhecido na rota do webhook é rejeitado", async () => {
    const { controller } = await recargaPendente();
    const resultado = await controller.receberWebhook("Inexistente", aviso("x", "1", "recarga-1"));
    expect(resultado.efeito).toBe(EfeitoConfirmacao.NAO_AUTENTICO);
  });

  test("processador fora do ar na consulta: erro propaga e o aviso pode ser reenviado depois", async () => {
    const { controller, processadorA, recarga, idPagamento, espectador } = await recargaPendente();
    processadorA.aprovar(idPagamento);
    processadorA.online = false;

    await expect(
      controller.receberWebhook("Simulado-A", aviso(SEGREDO_A, idPagamento, recarga.id, "ev-1")),
    ).rejects.toThrow("indisponível");

    processadorA.online = true;
    const reenvio = await controller.receberWebhook("Simulado-A", aviso(SEGREDO_A, idPagamento, recarga.id, "ev-2"));
    expect(reenvio.efeito).toBe(EfeitoConfirmacao.CREDITADO);
    expect(espectador.carteira.saldoMoedaVirtual).toBe(300);
  });

  test("o Proxy não chama o serviço real para avisos barrados", async () => {
    const { gatewayA, recargas, financeiro } = criarCenario();
    const real = new ServicoConfirmacao(gatewayA, recargas, financeiro);
    const confirmarReal = jest
      .spyOn(real, "confirmar")
      .mockResolvedValue({ efeito: EfeitoConfirmacao.CREDITADO, motivo: "ok" });
    const proxy = new ProxyConfirmacaoSegura(real, gatewayA);

    await proxy.confirmar(aviso("errado", "sim-1", "recarga-1"));
    await proxy.confirmar(aviso(SEGREDO_A, "sim-1", "recarga-1", "ev-1"));
    await proxy.confirmar(aviso(SEGREDO_A, "sim-1", "recarga-1", "ev-2"));

    expect(confirmarReal.mock.calls.map(([n]) => n.idEvento)).toEqual(["ev-1"]);
  });
});
