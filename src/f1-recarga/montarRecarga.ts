import { GeradorId, RepositorioEmMemoria } from "../compartilhado";
import type { Usuario } from "../dominio";
import type { ServicoFinanceiro } from "../financeiro";
import { CONFIGURACAO_PRECO, PACOTES } from "./catalogo";
import { ProxyConfirmacaoSegura, ServicoConfirmacao, type ConfirmadorPagamento } from "./confirmacao";
import type { Pacote } from "./Pacote";
import type { GatewayPagamento } from "./pagamento";
import type { Recarga } from "./Recarga";
import { RecargaController } from "./RecargaController";
import { ServicoRecarga, type ConfiguracaoPreco } from "./ServicoRecarga";

/**
 * Composição da F1: liga controller, serviço, gateways e uma cadeia
 * Proxy → ServicoConfirmacao por gateway. Usado pela demonstração e pelos testes.
 * Pacotes e promoção vêm do catálogo da plataforma; os testes podem trocá-los.
 */
export function montarRecarga(dependencias: {
  pacotes?: readonly Pacote[];
  configuracaoPreco?: ConfiguracaoPreco;
  gateways: readonly GatewayPagamento[];
  financeiro: ServicoFinanceiro;
  usuarios: RepositorioEmMemoria<Usuario>;
  geradorId?: GeradorId;
}) {
  const recargas = new RepositorioEmMemoria<Recarga>();
  const servico = new ServicoRecarga({
    pacotes: dependencias.pacotes ?? PACOTES,
    configuracaoPreco: dependencias.configuracaoPreco ?? CONFIGURACAO_PRECO,
    gateways: dependencias.gateways,
    financeiro: dependencias.financeiro,
    recargas,
    geradorId: dependencias.geradorId ?? new GeradorId(),
  });

  const confirmadores = new Map<string, ConfirmadorPagamento>();
  for (const gateway of dependencias.gateways) {
    const real = new ServicoConfirmacao(gateway, recargas, dependencias.financeiro);
    confirmadores.set(gateway.nome, new ProxyConfirmacaoSegura(real, gateway));
  }

  const controller = new RecargaController(servico, dependencias.usuarios, confirmadores);
  return { controller, servico, recargas };
}
