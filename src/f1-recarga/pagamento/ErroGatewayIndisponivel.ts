/** O processador não pode atender agora; o sistema deve tentar o próximo gateway (O07). */
export class ErroGatewayIndisponivel extends Error {
  readonly gateway: string;

  constructor(gateway: string, motivo: string) {
    super(`Gateway ${gateway} indisponível: ${motivo}`);
    this.name = "ErroGatewayIndisponivel";
    this.gateway = gateway;
  }
}
