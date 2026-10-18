import {
  ErroGatewayIndisponivel,
  type GatewayPagamento,
  type NotificacaoPagamento,
  type SessaoCheckout,
  type SituacaoPagamento,
} from "../f1-recarga";
import type { Dinheiro } from "../dominio";

/**
 * Só para a demonstração: envolve um gateway real (Mercado Pago, Stripe) para a
 * página poder "tirá-lo do ar". Desligado, responde como um processador fora do ar
 * (`ErroGatewayIndisponivel`), e o `ServicoRecarga` reage como reagiria de verdade
 * (O07). Nos simulados isso não é preciso: o próprio processador tem `online`.
 */
export class GatewayDesligavel implements GatewayPagamento {
  online = true;
  private readonly real: GatewayPagamento;

  constructor(real: GatewayPagamento) {
    this.real = real;
  }

  get nome(): string {
    return this.real.nome;
  }

  async iniciarCheckout(valor: Dinheiro, recargaId: string): Promise<SessaoCheckout> {
    this.exigirOnline();
    return this.real.iniciarCheckout(valor, recargaId);
  }

  async consultarPagamento(idPagamento: string): Promise<SituacaoPagamento> {
    this.exigirOnline();
    return this.real.consultarPagamento(idPagamento);
  }

  async estaDisponivel(): Promise<boolean> {
    return this.online && this.real.estaDisponivel();
  }

  validarWebhook(notificacao: NotificacaoPagamento): boolean {
    return this.real.validarWebhook(notificacao);
  }

  private exigirOnline(): void {
    if (!this.online) throw new ErroGatewayIndisponivel(this.nome, "tirado do ar na demonstração");
  }
}
