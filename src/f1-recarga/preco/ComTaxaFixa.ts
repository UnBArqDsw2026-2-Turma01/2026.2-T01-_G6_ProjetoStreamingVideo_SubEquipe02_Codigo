import type { Dinheiro } from "../../dominio";
import { ErroDominio } from "../../dominio";
import type { Preco } from "./Preco";
import { PrecoDecorator } from "./PrecoDecorator";

/**
 * ConcreteDecorator: soma um valor fixo (ex.: taxa de processamento).
 * Por ser fixo, a posição na cadeia muda o resultado: antes do desconto,
 * a taxa também é descontada; antes do imposto, também é tributada.
 */
export class ComTaxaFixa extends PrecoDecorator {
  private readonly taxa: Dinheiro;

  constructor(interno: Preco, taxa: Dinheiro) {
    super(interno);
    if (taxa.ehZero()) {
      throw new ErroDominio("Taxa fixa deve ser maior que zero");
    }
    this.taxa = taxa;
  }

  override calcular(): Dinheiro {
    return this.interno.calcular().somar(this.taxa);
  }

  override descrever(): string {
    return `${this.interno.descrever()} → taxa de ${this.taxa.formatar()}`;
  }
}
