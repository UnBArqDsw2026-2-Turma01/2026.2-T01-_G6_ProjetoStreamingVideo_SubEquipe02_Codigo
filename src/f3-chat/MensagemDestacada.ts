/**
 * Component do Decorator: qualquer mensagem que o chat sabe exibir.
 * Tanto a mensagem pura quanto cada camada de destaque (cor da faixa,
 * fixação, limite de caracteres) implementam esta mesma interface.
 */
export interface MensagemDestacada {
  /** Linha de cima: quem doou, quanto doou e os destaques visuais aplicados. */
  cabecalho(): string;
  /** Corpo da mensagem escrita pelo espectador. */
  texto(): string;
  /** Cor de destaque da mensagem no chat (null = sem cor). */
  cor(): string | null;
  /** Minutos em que a mensagem fica fixada no topo do chat (0 = não fixa). */
  tempoFixacaoMin(): number;
  /** Descreve as camadas aplicadas, da mais interna para a mais externa. */
  descrever(): string;
}
