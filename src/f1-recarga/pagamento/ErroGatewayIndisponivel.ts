/**
 * O processador não pode atender agora. Lançado pelos adaptadores; o `ServicoRecarga`
 * o traduz em `ErroMeioPagamentoIndisponivel` (meio escolhido) ou tenta o próximo
 * gateway (sem escolha), conforme O07.
 */
export class ErroGatewayIndisponivel extends Error {
  readonly gateway: string;

  constructor(gateway: string, motivo: string) {
    super(`Gateway ${gateway} indisponível: ${motivo}`);
    this.name = "ErroGatewayIndisponivel";
    this.gateway = gateway;
  }
}
