import type { MensagemDestacada } from "./MensagemDestacada";

/**
 * Decorator: é uma `MensagemDestacada` e tem uma `MensagemDestacada` (a que ele envolve).
 * Por padrão apenas delega; cada subclasse acrescenta a sua camada de destaque
 * sobre o resultado da camada interna.
 */
export abstract class MensagemDecorator implements MensagemDestacada {
  protected readonly interna: MensagemDestacada;

  protected constructor(interna: MensagemDestacada) {
    this.interna = interna;
  }

  cabecalho(): string {
    return this.interna.cabecalho();
  }

  texto(): string {
    return this.interna.texto();
  }

  cor(): string | null {
    return this.interna.cor();
  }

  tempoFixacaoMin(): number {
    return this.interna.tempoFixacaoMin();
  }

  descrever(): string {
    return this.interna.descrever();
  }
}
