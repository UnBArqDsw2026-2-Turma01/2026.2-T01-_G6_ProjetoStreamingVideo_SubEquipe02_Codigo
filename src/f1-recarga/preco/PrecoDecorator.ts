import type { Dinheiro } from "../../dominio";
import type { Preco } from "./Preco";

/**
 * Decorator: é um `Preco` e tem um `Preco` (o que ele envolve).
 * Por padrão apenas delega; cada subclasse acrescenta a sua regra
 * sobre o resultado da camada interna.
 */
export abstract class PrecoDecorator implements Preco {
  protected readonly interno: Preco;

  protected constructor(interno: Preco) {
    this.interno = interno;
  }

  calcular(): Dinheiro {
    return this.interno.calcular();
  }

  descrever(): string {
    return this.interno.descrever();
  }
}
