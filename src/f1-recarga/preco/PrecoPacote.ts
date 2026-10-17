import type { Dinheiro } from "../../dominio";
import type { Pacote } from "../Pacote";
import type { Preco } from "./Preco";

/** ConcreteComponent: o preço de tabela do pacote, sem nenhuma regra aplicada. */
export class PrecoPacote implements Preco {
  private readonly pacote: Pacote;

  constructor(pacote: Pacote) {
    this.pacote = pacote;
  }

  calcular(): Dinheiro {
    return this.pacote.valorBase;
  }

  descrever(): string {
    return `pacote de ${this.pacote.quantidadeMoedaVirtual} (${this.pacote.valorBase.formatar()})`;
  }
}
