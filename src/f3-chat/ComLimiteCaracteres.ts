import { ErroDominio } from "../dominio";
import type { MensagemDestacada } from "./MensagemDestacada";
import { MensagemDecorator } from "./MensagemDecorator";

/**
 * ConcreteDecorator: garante, na exibição, o limite de caracteres da faixa (SC02).
 *
 * A F2 já recusa doações com mensagem acima do limite; esta camada é a defesa do
 * próprio chat, que não depende de quem o chama para exibir dentro do limite.
 * Corta apenas o corpo da mensagem, nunca o cabeçalho.
 */
export class ComLimiteCaracteres extends MensagemDecorator {
  private readonly limite: number;

  constructor(interna: MensagemDestacada, limite: number) {
    super(interna);
    if (!Number.isInteger(limite) || limite <= 0) {
      throw new ErroDominio(`O limite de caracteres deve ser um número inteiro positivo: ${limite}`);
    }
    this.limite = limite;
  }

  override texto(): string {
    // Array.from conta caracteres reais, inclusive emojis, e não unidades UTF-16.
    const caracteres = Array.from(this.interna.texto());
    if (caracteres.length <= this.limite) {
      return caracteres.join("");
    }
    return `${caracteres.slice(0, this.limite - 1).join("")}…`;
  }

  override descrever(): string {
    return `${this.interna.descrever()} → limite de ${this.limite} caracteres`;
  }
}
