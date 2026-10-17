import { ErroDominio } from "../dominio";
import type { MensagemDestacada } from "./MensagemDestacada";
import { MensagemDecorator } from "./MensagemDecorator";

/**
 * ConcreteDecorator: garante, na exibição, o limite de caracteres da faixa (SC02).
 *
 * A F2 já recusa doações com mensagem acima do limite; esta camada é a defesa do
 * próprio chat: uma mensagem acima do limite não é exibida, e o erro sobe para quem
 * pediu a exibição. O limite vale só para o corpo da mensagem, nunca para o cabeçalho.
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
    const texto = this.interna.texto();
    // Array.from conta caracteres reais, inclusive emojis, e não unidades UTF-16.
    const tamanho = Array.from(texto).length;
    if (tamanho > this.limite) {
      throw new ErroDominio(
        `A mensagem tem ${tamanho} caracteres e excede o limite de ${this.limite} da faixa (SC02).`,
      );
    }
    return texto;
  }

  override descrever(): string {
    return `${this.interna.descrever()} → limite de ${this.limite} caracteres`;
  }
}
