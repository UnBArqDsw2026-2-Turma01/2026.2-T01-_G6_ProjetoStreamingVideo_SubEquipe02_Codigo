/** Montagem comum aos testes da F1: usuários, pacotes, gateways simulados e controller. */
import { RepositorioEmMemoria } from "../../src/compartilhado";
import { Dinheiro, Usuario } from "../../src/dominio";
import { ServicoFinanceiro } from "../../src/financeiro";
import {
  AdaptadorProcessadorSimulado,
  ProcessadorSimulado,
  assinarNotificacao,
  montarRecarga,
  type ConfiguracaoPreco,
  type NotificacaoPagamento,
  type Pacote,
} from "../../src/f1-recarga";

export const SEGREDO_A = "segredo-a";
export const SEGREDO_B = "segredo-b";

export const pacotes: Pacote[] = [
  { id: "p300", quantidadeMoedaVirtual: 300, valorBase: Dinheiro.deReais(20) },
  { id: "p1000", quantidadeMoedaVirtual: 1000, valorBase: Dinheiro.deReais(60) },
];

export function criarCenario(configuracaoPreco: ConfiguracaoPreco = { descontoPercentual: 29, aliquotaImposto: 5 }) {
  const espectador = new Usuario("usuario-1", "Espectador", "espectador@exemplo.com");
  const usuarios = new RepositorioEmMemoria<Usuario>();
  usuarios.salvar(espectador);

  const processadorA = new ProcessadorSimulado();
  const processadorB = new ProcessadorSimulado();
  const gatewayA = new AdaptadorProcessadorSimulado(processadorA, SEGREDO_A, "Simulado-A");
  const gatewayB = new AdaptadorProcessadorSimulado(processadorB, SEGREDO_B, "Simulado-B");
  const financeiro = new ServicoFinanceiro();

  const f1 = montarRecarga({ pacotes, configuracaoPreco, gateways: [gatewayA, gatewayB], financeiro, usuarios });
  return { ...f1, espectador, processadorA, processadorB, gatewayA, gatewayB, financeiro };
}

/** Monta um aviso como o processador enviaria, assinado com o segredo dele. */
export function aviso(segredo: string, idPagamento: string, recargaId: string, idEvento = `ev-${idPagamento}`): NotificacaoPagamento {
  const dados = { idEvento, idPagamento, recargaId };
  return { ...dados, assinatura: assinarNotificacao(segredo, dados) };
}
