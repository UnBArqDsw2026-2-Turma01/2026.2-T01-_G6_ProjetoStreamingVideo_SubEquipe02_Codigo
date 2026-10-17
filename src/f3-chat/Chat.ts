import type { DoacaoNotificada, NotificadorChat } from "../contratos";
import { FaixaDestaque } from "../f2-doacao";
import { ComFaixaCor } from "./ComFaixaCor";
import { ComFixacao } from "./ComFixacao";
import { ComLimiteCaracteres } from "./ComLimiteCaracteres";
import { MensagemBase } from "./MensagemBase";
import type { MensagemDestacada } from "./MensagemDestacada";

/**
 * Chat da F3: implementação real do contrato `NotificadorChat`, que substitui o
 * `NotificadorChatProvisorio` na integração.
 *
 * É o Client do Decorator: monta a pilha de camadas conforme a faixa do valor doado
 * e usa o resultado sem saber quantas camadas ele tem.
 *
 * A exibição é assíncrona em relação à doação (Ata S2_02, D05): se algo falhar aqui,
 * o erro sobe para a F2, que mantém a doação e o repasse e apenas registra um aviso.
 */
export class Chat implements NotificadorChat {
  private readonly historico: MensagemDestacada[] = [];
  private readonly saida: (linha: string) => void;

  /** @param saida para onde as linhas do chat são escritas; o padrão é o terminal. */
  constructor(saida: (linha: string) => void = console.log) {
    this.saida = saida;
  }

  exibirMensagemDestacada(doacao: DoacaoNotificada): void {
    const mensagem = this.montarMensagem(doacao);
    // Monta as duas linhas antes de exibir: se alguma camada recusar a mensagem
    // (por exemplo, acima do limite de caracteres), nada aparece pela metade.
    const linhas = [`[chat] ${mensagem.cabecalho()}`, `       "${mensagem.texto()}"`];
    this.historico.push(mensagem);
    linhas.forEach((linha) => this.saida(linha));
  }

  /** Mensagens já exibidas, na ordem em que chegaram. */
  mensagensExibidas(): readonly MensagemDestacada[] {
    return [...this.historico];
  }

  /**
   * Monta a pilha de decoradores a partir da faixa do valor doado (SC01, SC02):
   * limite de caracteres → cor da faixa → fixação (só nas faixas que fixam).
   */
  private montarMensagem(doacao: DoacaoNotificada): MensagemDestacada {
    const faixa = FaixaDestaque.paraQuantidade(doacao.quantidadeMoedaVirtual);

    let mensagem: MensagemDestacada = new MensagemBase(
      doacao.doador.nome,
      doacao.mensagem,
      doacao.quantidadeMoedaVirtual,
    );
    mensagem = new ComLimiteCaracteres(mensagem, faixa.limiteCaracteres);
    mensagem = new ComFaixaCor(mensagem, faixa.cor);
    if (faixa.tempoFixacaoMin > 0) {
      mensagem = new ComFixacao(mensagem, faixa.tempoFixacaoMin);
    }
    return mensagem;
  }
}
