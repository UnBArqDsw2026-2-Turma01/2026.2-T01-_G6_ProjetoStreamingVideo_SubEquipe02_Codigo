import type { Dinheiro } from "../../dominio";
import { ErroDominio } from "../../dominio";
import type { Preco } from "./Preco";
import { PrecoDecorator } from "./PrecoDecorator";

/** ConcreteDecorator: imposto percentual sobre o valor (RN01: preço com imposto incluso). */
export class ComImposto extends PrecoDecorator {
  private readonly aliquota: number;

  constructor(interno: Preco, aliquota: number) {
    super(interno);
    if (aliquota <= 0) {
      throw new ErroDominio(`Alíquota deve ser positiva: ${aliquota}`);
    }
    this.aliquota = aliquota;
  }

  override calcular(): Dinheiro {
    const valor = this.interno.calcular();
    return valor.somar(valor.percentual(this.aliquota));
  }

  override descrever(): string {
    return `${this.interno.descrever()} → imposto de ${this.aliquota}%`;
  }
}
