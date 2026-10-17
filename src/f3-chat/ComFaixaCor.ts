import { ErroDominio } from "../dominio";
import type { MensagemDestacada } from "./MensagemDestacada";
import { MensagemDecorator } from "./MensagemDecorator";

/** ConcreteDecorator: destaca a mensagem com a cor da faixa do valor doado (SC01). */
export class ComFaixaCor extends MensagemDecorator {
  private readonly cor: string;

  constructor(interna: MensagemDestacada, cor: string) {
    super(interna);
    if (cor.trim().length === 0) {
      throw new ErroDominio("A cor da faixa de destaque não pode estar vazia.");
    }
    this.cor = cor;
  }

  override cabecalho(): string {
    return `[${this.cor}] ${this.interna.cabecalho()}`;
  }

  override descrever(): string {
    return `${this.interna.descrever()} → cor ${this.cor}`;
  }
}
