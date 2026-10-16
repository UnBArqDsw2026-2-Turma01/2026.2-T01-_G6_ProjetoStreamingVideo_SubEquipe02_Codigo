/**
 * O meio de pagamento escolhido pelo espectador não pode atender agora.
 * Em vez de trocar de processador sem perguntar, o sistema devolve os outros
 * meios disponíveis para o modal oferecer (O07 com a escolha do espectador).
 */
export class ErroMeioPagamentoIndisponivel extends Error {
  readonly gateway: string;
  readonly alternativas: readonly string[];

  constructor(gateway: string, alternativas: readonly string[]) {
    super(
      alternativas.length > 0
        ? `${gateway} indisponível no momento. Escolha outro meio: ${alternativas.join(", ")}`
        : `${gateway} indisponível no momento e não há outro meio de pagamento`,
    );
    this.name = "ErroMeioPagamentoIndisponivel";
    this.gateway = gateway;
    this.alternativas = alternativas;
  }
}
