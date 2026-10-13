import type { DoacaoNotificada, NotificadorChat } from "./NotificadorChat";

/**
 * Implementação provisória do chat, para a F2 trabalhar antes de a F3 ficar pronta.
 * Apenas registra as doações recebidas e imprime uma linha simples.
 * Será substituída pela implementação da F3 na integração.
 */
export class NotificadorChatProvisorio implements NotificadorChat {
  readonly recebidas: DoacaoNotificada[] = [];
  private readonly silencioso: boolean;

  constructor(silencioso = false) {
    this.silencioso = silencioso;
  }

  exibirMensagemDestacada(doacao: DoacaoNotificada): void {
    this.recebidas.push(doacao);
    if (!this.silencioso) {
      console.log(
        `[chat provisório] ${doacao.doador.nome} doou ${doacao.quantidadeMoedaVirtual} de moeda virtual: "${doacao.mensagem}"`,
      );
    }
  }
}
