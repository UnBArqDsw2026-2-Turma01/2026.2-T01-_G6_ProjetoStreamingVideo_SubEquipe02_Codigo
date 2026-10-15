import type { GatewayPagamento, NotificacaoPagamento } from "../pagamento";
import { EfeitoConfirmacao, type ConfirmadorPagamento, type ResultadoConfirmacao } from "./ConfirmadorPagamento";

/**
 * Proxy de proteção e de referência inteligente diante do `ServicoConfirmacao`.
 *
 * 1. Proteção (O14): aviso com assinatura inválida não chega ao serviço real.
 * 2. Referência inteligente (O11): pagamento já creditado não é processado de novo.
 *
 * O id do pagamento é reservado antes de delegar, para que dois avisos simultâneos
 * do mesmo pagamento não passem juntos. A reserva só fica quando houve crédito:
 * um aviso "pendente" não pode impedir o aviso seguinte, que trará a aprovação.
 *
 * Limitação: o conjunto vive em memória e se perde ao reiniciar. Em produção,
 * seria uma tabela com restrição de unicidade no id do pagamento.
 */
export class ProxyConfirmacaoSegura implements ConfirmadorPagamento {
  private readonly real: ConfirmadorPagamento;
  private readonly gateway: GatewayPagamento;
  private readonly pagamentosProcessados = new Set<string>();

  constructor(real: ConfirmadorPagamento, gateway: GatewayPagamento) {
    this.real = real;
    this.gateway = gateway;
  }

  async confirmar(notificacao: NotificacaoPagamento): Promise<ResultadoConfirmacao> {
    if (!this.gateway.validarWebhook(notificacao)) {
      return { efeito: EfeitoConfirmacao.NAO_AUTENTICO, motivo: `assinatura inválida no evento ${notificacao.idEvento}` };
    }
    const chave = notificacao.idPagamento;
    if (this.pagamentosProcessados.has(chave)) {
      return { efeito: EfeitoConfirmacao.DUPLICADO, motivo: `pagamento ${chave} já processado ou em processamento` };
    }

    this.pagamentosProcessados.add(chave);
    let resultado: ResultadoConfirmacao | undefined;
    try {
      resultado = await this.real.confirmar(notificacao);
      return resultado;
    } finally {
      if (resultado?.efeito !== EfeitoConfirmacao.CREDITADO) {
        this.pagamentosProcessados.delete(chave);
      }
    }
  }
}
