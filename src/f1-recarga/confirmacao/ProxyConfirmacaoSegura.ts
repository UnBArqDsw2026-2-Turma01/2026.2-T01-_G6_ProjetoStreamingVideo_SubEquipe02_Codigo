import type { NotificacaoPagamento, ValidadorWebhook } from "../pagamento";
import { EfeitoConfirmacao, type ConfirmadorPagamento, type ResultadoConfirmacao } from "./ConfirmadorPagamento";
import type { ServicoConfirmacao } from "./ServicoConfirmacao";

/**
 * Proxy de proteção e de referência inteligente diante do `ServicoConfirmacao`.
 *
 * Como no modelo clássico do GoF, o Proxy implementa o Subject (`ConfirmadorPagamento`)
 * e guarda a referência ao RealSubject (`ServicoConfirmacao`), a quem repassa a
 * requisição intacta quando ela é permitida.
 *
 * 1. Proteção (O14): aviso com assinatura inválida não chega ao serviço real.
 *    O Proxy só conhece o `ValidadorWebhook` do processador, não a cobrança nem a consulta.
 * 2. Referência inteligente (O11): pagamento já creditado não é processado de novo.
 *
 * A chave é o `idPagamento` do aviso, que contém o `idCheckout` da recarga
 * (preferência no Mercado Pago, sessão no Stripe). Ela é reservada antes de delegar,
 * para que dois avisos simultâneos do mesmo pagamento não passem juntos. A reserva só fica quando houve crédito:
 * um aviso "pendente" não pode impedir o aviso seguinte, que trará a aprovação.
 *
 * Limitação: o conjunto vive em memória e se perde ao reiniciar. Em produção,
 * seria uma tabela com restrição de unicidade nessa chave.
 */
export class ProxyConfirmacaoSegura implements ConfirmadorPagamento {
  private readonly real: ServicoConfirmacao;
  private readonly validador: ValidadorWebhook;
  private readonly pagamentosProcessados = new Set<string>();

  constructor(real: ServicoConfirmacao, validador: ValidadorWebhook) {
    this.real = real;
    this.validador = validador;
  }

  async confirmar(notificacao: NotificacaoPagamento): Promise<ResultadoConfirmacao> {
    if (!this.validador.validarWebhook(notificacao)) {
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
