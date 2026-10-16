/**
 * Demonstração da F1 · Recarga de moeda virtual (Decorator, Adapter e Proxy).
 *
 * Usa dois processadores simulados, para rodar sem internet e sem credenciais:
 * o espectador escolhe o primeiro, que está fora do ar, recebe as alternativas
 * e escolhe o segundo (O07 com a escolha do espectador).
 *
 * Executar sozinha: npx tsx src/demo/f1-recarga.ts
 */
import { RepositorioEmMemoria } from "../compartilhado";
import { Usuario } from "../dominio";
import { ServicoFinanceiro } from "../financeiro";
import {
  AdaptadorProcessadorSimulado,
  ErroMeioPagamentoIndisponivel,
  MetodoRecarga,
  ProcessadorSimulado,
  assinarNotificacao,
  montarRecarga,
  type NotificacaoPagamento,
} from "../f1-recarga";


function aviso(segredo: string, idEvento: string, idPagamento: string, recargaId: string): NotificacaoPagamento {
  const dados = { idEvento, idPagamento, recargaId };
  return { ...dados, assinatura: assinarNotificacao(segredo, dados) };
}

/** Executa a recarga do pacote de R$ 10 (210 de moeda virtual) para o espectador, narrando cada padrão. */
export async function demonstrarRecarga(espectador: Usuario, financeiro: ServicoFinanceiro): Promise<void> {
  const usuarios = new RepositorioEmMemoria<Usuario>();
  usuarios.salvar(espectador);

  const processadorA = new ProcessadorSimulado();
  const processadorB = new ProcessadorSimulado();
  processadorA.online = false;
  const gatewayA = new AdaptadorProcessadorSimulado(processadorA, "segredo-a", "Simulado-A");
  const gatewayB = new AdaptadorProcessadorSimulado(processadorB, "segredo-b", "Simulado-B");

  const { controller } = montarRecarga({
    gateways: [gatewayA, gatewayB],
    financeiro,
    usuarios,
  });

  console.log("  [Decorator] Modal de moeda virtual:");
  for (const oferta of controller.consultarOfertas(espectador.id)) {
    console.log(
      `    ${oferta.pacote.quantidadeMoedaVirtual} de moeda virtual: de ${oferta.precoOriginal.formatar()} por ${oferta.precoPromocional.formatar()}`,
    );
    console.log(`      composição: ${oferta.composicao}`);
  }

  console.log("\n  [Adapter] Espectador compra o pacote de R$ 10 pelo processador externo:");
  console.log(`    Meios oferecidos no modal: ${controller.consultarMeiosPagamento().join(", ")}`);
  console.log("    Escolhe Simulado-A, que está fora do ar.");
  try {
    await controller.recarregar(espectador.id, "p10", MetodoRecarga.PROCESSADOR_EXTERNO, "Simulado-A");
  } catch (erro) {
    if (!(erro instanceof ErroMeioPagamentoIndisponivel)) throw erro;
    console.log(`    ${erro.message}`);
  }
  console.log("    Escolhe Simulado-B.");
  const recarga = await controller.recarregar(espectador.id, "p10", MetodoRecarga.PROCESSADOR_EXTERNO, "Simulado-B");
  console.log(
    `    ${recarga.id} ${recarga.status}: ${recarga.valor.formatar()} no ${recarga.gatewayUtilizado} (${recarga.instrucoesPagamento})`,
  );

  const idPagamento = recarga.idCheckout!;
  console.log("\n  [Proxy] Avisos de pagamento recebidos pelo webhook do Simulado-B:");
  const casos: [string, NotificacaoPagamento, (() => void)?][] = [
    ["aviso falsificado (O14)", aviso("segredo-do-atacante", "ev-0", idPagamento, recarga.id)],
    ["aviso antes do pagamento", aviso("segredo-b", "ev-1", idPagamento, recarga.id)],
    ["aviso após o pagamento", aviso("segredo-b", "ev-2", idPagamento, recarga.id), () => processadorB.aprovar(idPagamento)],
    ["reenvio do mesmo aviso (O11)", aviso("segredo-b", "ev-3", idPagamento, recarga.id)],
  ];
  for (const [descricao, notificacao, antes] of casos) {
    antes?.();
    const resultado = await controller.receberWebhook("Simulado-B", notificacao);
    console.log(`    ${descricao}: ${resultado.efeito} (${resultado.motivo})`);
  }
}

if (require.main === module) {
  const espectador = new Usuario("usuario-1", "Espectador", "espectador@exemplo.com");
  console.log("=== F1 · Recarga de moeda virtual ===\n");
  demonstrarRecarga(espectador, new ServicoFinanceiro()).then(() => {
    console.log(`\nSaldo final: ${espectador.carteira.saldoMoedaVirtual} de moeda virtual`);
  });
}
