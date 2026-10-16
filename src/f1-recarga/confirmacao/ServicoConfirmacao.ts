import type { RepositorioEmMemoria } from "../../compartilhado";
import type { ServicoFinanceiro } from "../../financeiro";
import { StatusPagamento, type GatewayPagamento, type NotificacaoPagamento } from "../pagamento";
import type { Recarga } from "../Recarga";
import { EfeitoConfirmacao, type ConfirmadorPagamento, type ResultadoConfirmacao } from "./ConfirmadorPagamento";

/**
 * RealSubject do Proxy: só a regra de negócio da confirmação.
 *
 * Não confia no conteúdo do aviso: consulta a situação no próprio processador,
 * localiza a recarga pela referência e confere o valor pago (Entrega 2).
 * Autenticidade e duplicidade são responsabilidade do Proxy.
 */
export class ServicoConfirmacao implements ConfirmadorPagamento {
  private readonly gateway: GatewayPagamento;
  private readonly recargas: RepositorioEmMemoria<Recarga>;
  private readonly financeiro: ServicoFinanceiro;

  constructor(gateway: GatewayPagamento, recargas: RepositorioEmMemoria<Recarga>, financeiro: ServicoFinanceiro) {
    this.gateway = gateway;
    this.recargas = recargas;
    this.financeiro = financeiro;
  }

  async confirmar(notificacao: NotificacaoPagamento): Promise<ResultadoConfirmacao> {
    const situacao = await this.gateway.consultarPagamento(notificacao.idPagamento);

    if (situacao.referencia !== notificacao.recargaId) {
      return inconsistente(`aviso cita ${notificacao.recargaId}, processador cita ${situacao.referencia}`);
    }
    const recarga = this.recargas.buscarPorId(situacao.referencia);
    if (!recarga) {
      return inconsistente(`recarga ${situacao.referencia} não encontrada`);
    }
    if (recarga.gatewayUtilizado !== this.gateway.nome || recarga.idCheckout !== situacao.idPagamento) {
      return inconsistente(`pagamento ${situacao.idPagamento} não pertence à recarga ${recarga.id}`);
    }
    if (situacao.status !== StatusPagamento.APROVADO) {
      return {
        efeito: EfeitoConfirmacao.AGUARDANDO,
        motivo: `pagamento ${situacao.status}; recarga ${recarga.id} segue ${recarga.status}`,
      };
    }
    if (!situacao.valorPago.igual(recarga.valor)) {
      return inconsistente(`valor pago ${situacao.valorPago.formatar()} difere de ${recarga.valor.formatar()}`);
    }
    if (!recarga.estaPendente()) {
      // Defesa em profundidade: o Proxy já barra duplicados, mas a recarga também se protege.
      return { efeito: EfeitoConfirmacao.DUPLICADO, motivo: `recarga ${recarga.id} já está ${recarga.status}` };
    }

    recarga.concluir(); // primeiro o estado, depois o crédito
    this.financeiro.creditarMoedaVirtual(recarga.usuario, recarga.quantidadeMoedaVirtual);
    recarga.usuario.carteira.registrarTransacao(recarga);
    return {
      efeito: EfeitoConfirmacao.CREDITADO,
      motivo: `${recarga.quantidadeMoedaVirtual} de moeda virtual creditadas para ${recarga.usuario.nome}`,
    };
  }
}

function inconsistente(motivo: string): ResultadoConfirmacao {
  return { efeito: EfeitoConfirmacao.INCONSISTENTE, motivo };
}
