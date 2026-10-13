import { ErroDominio } from "./ErroDominio";

const SIMBOLOS: Record<string, string> = { BRL: "R$", USD: "US$" };

/**
 * Objeto de valor imutável para quantias monetárias.
 *
 * Armazena o valor em **centavos inteiros**, evitando erros de ponto flutuante
 * (decisão de projeto da Entrega 2). Toda operação devolve uma nova instância.
 */
export class Dinheiro {
  readonly centavos: number;
  readonly moeda: string;

  private constructor(centavos: number, moeda: string) {
    if (!Number.isInteger(centavos)) {
      throw new ErroDominio(`Valor em centavos deve ser inteiro: ${centavos}`);
    }
    if (centavos < 0) {
      throw new ErroDominio(`Valor monetário não pode ser negativo: ${centavos}`);
    }
    this.centavos = centavos;
    this.moeda = moeda;
  }

  static deCentavos(centavos: number, moeda = "BRL"): Dinheiro {
    return new Dinheiro(centavos, moeda);
  }

  static deReais(valor: number, moeda = "BRL"): Dinheiro {
    return new Dinheiro(Math.round(valor * 100), moeda);
  }

  static zero(moeda = "BRL"): Dinheiro {
    return new Dinheiro(0, moeda);
  }

  somar(outro: Dinheiro): Dinheiro {
    this.exigirMesmaMoeda(outro);
    return new Dinheiro(this.centavos + outro.centavos, this.moeda);
  }

  /** Lança `ErroDominio` se o resultado for negativo. */
  subtrair(outro: Dinheiro): Dinheiro {
    this.exigirMesmaMoeda(outro);
    return new Dinheiro(this.centavos - outro.centavos, this.moeda);
  }

  /** Multiplica por um fator, arredondando para o centavo mais próximo. */
  multiplicar(fator: number): Dinheiro {
    return new Dinheiro(Math.round(this.centavos * fator), this.moeda);
  }

  /** Devolve a porcentagem indicada deste valor. Ex.: `percentual(29)` → 29% do valor. */
  percentual(porcento: number): Dinheiro {
    return this.multiplicar(porcento / 100);
  }

  ehMaiorOuIgual(outro: Dinheiro): boolean {
    this.exigirMesmaMoeda(outro);
    return this.centavos >= outro.centavos;
  }

  ehZero(): boolean {
    return this.centavos === 0;
  }

  igual(outro: Dinheiro): boolean {
    return this.moeda === outro.moeda && this.centavos === outro.centavos;
  }

  /** Representação legível, usada nas demonstrações. Ex.: "R$ 16,80". */
  formatar(): string {
    const simbolo = SIMBOLOS[this.moeda] ?? this.moeda;
    const valor = (this.centavos / 100).toFixed(2).replace(".", ",");
    return `${simbolo} ${valor}`;
  }

  toString(): string {
    return this.formatar();
  }

  private exigirMesmaMoeda(outro: Dinheiro): void {
    if (this.moeda !== outro.moeda) {
      throw new ErroDominio(`Moedas incompatíveis: ${this.moeda} e ${outro.moeda}`);
    }
  }
}
