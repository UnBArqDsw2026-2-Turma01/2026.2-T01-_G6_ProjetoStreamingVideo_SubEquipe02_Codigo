import { ErroDominio } from "../dominio";
import type { MensagemDestacada } from "./MensagemDestacada";
import { MensagemDecorator } from "./MensagemDecorator";

/** ConcreteDecorator: destaca a mensagem com a cor da faixa do valor doado (SC01). */
export class ComFaixaCor extends MensagemDecorator {
  private readonly corFaixa: string;

  constructor(interna: MensagemDestacada, cor: string) {
    super(interna);
    if (cor.trim().length === 0) {
      throw new ErroDominio("A cor da faixa de destaque não pode estar vazia.");
    }
    this.corFaixa = cor;
  }

  override cabecalho(): string {
    return `[${this.corFaixa}] ${this.interna.cabecalho()}`;
  }

  override cor(): string {
    return this.corFaixa;
  }

  override descrever(): string {
    return `${this.interna.descrever()} → cor ${this.corFaixa}`;
  }
}
