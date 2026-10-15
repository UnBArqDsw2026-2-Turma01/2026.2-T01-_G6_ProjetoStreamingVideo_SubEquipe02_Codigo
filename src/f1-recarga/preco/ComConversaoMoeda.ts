import { Dinheiro, ErroDominio } from "../../dominio";
import type { Preco } from "./Preco";
import { PrecoDecorator } from "./PrecoDecorator";

/**
 * ConcreteDecorator: converte o valor para a moeda local do espectador.
 * Deve ser a última camada: depois dela, decoradores em reais (taxa fixa)
 * falhariam por moedas incompatíveis. Quem garante a ordem é `ServicoRecarga.montarPreco`.
 */
export class ComConversaoMoeda extends PrecoDecorator {
  private readonly taxaCambio: number;
  private readonly moedaDestino: string;

  constructor(interno: Preco, taxaCambio: number, moedaDestino: string) {
    super(interno);
    if (taxaCambio <= 0) {
      throw new ErroDominio(`Taxa de câmbio deve ser positiva: ${taxaCambio}`);
    }
    this.taxaCambio = taxaCambio;
    this.moedaDestino = moedaDestino;
  }

  override calcular(): Dinheiro {
    const valor = this.interno.calcular();
    return Dinheiro.deCentavos(Math.round(valor.centavos * this.taxaCambio), this.moedaDestino);
  }

  override descrever(): string {
    return `${this.interno.descrever()} → conversão para ${this.moedaDestino} (câmbio ${this.taxaCambio})`;
  }
}
