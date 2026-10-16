import { Dinheiro, ErroDominio } from "../../dominio";
import type { Preco } from "./Preco";
import { PrecoDecorator } from "./PrecoDecorator";

/** ConcreteDecorator: desconto promocional percentual (RN01: 5%, 8%, 10%, 12% e 29%). */
export class ComDesconto extends PrecoDecorator {
  private readonly percentual: number;

  constructor(interno: Preco, percentual: number) {
    super(interno);
    if (percentual <= 0 || percentual >= 100) {
      throw new ErroDominio(`Desconto deve estar entre 0% e 100% (exclusivos): ${percentual}`);
    }
    this.percentual = percentual;
  }

  override calcular(): Dinheiro {
    const valor = this.interno.calcular();
    return valor.subtrair(valor.percentual(this.percentual));
  }

  override descrever(): string {
    return `${this.interno.descrever()} → desconto de ${this.percentual}%`;
  }
}
