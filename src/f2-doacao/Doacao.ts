import { Dinheiro, ErroDominio, Transacao, type Usuario } from "../dominio";

/**
 * Doação de moeda virtual (Entrega 2: Doacao especializa Transacao).
 *
 * O usuário herdado de Transacao é o doador. Ao nascer PENDENTE, calcula o valor
 * líquido repassado ao criador. Mensagem e faixa ficam em DoacaoComMensagem.
 */
export class Doacao extends Transacao {
  /**
   * Percentual padrão repassado ao criador (70% do valor convertido).
   * Cada unidade de moeda virtual equivale a 1 centavo antes da retenção da plataforma.
   */
  static readonly TAXA_REPASSE_PADRAO = 0.7;

  readonly criador: Usuario;
  readonly quantidadeMoedaVirtual: number;
  readonly valorRepasse: Dinheiro;

  constructor(
    id: string,
    doador: Usuario,
    criador: Usuario,
    quantidadeMoedaVirtual: number,
    taxaRepasse = Doacao.TAXA_REPASSE_PADRAO,
    moeda = "BRL",
  ) {
    super(id, doador);

    if (!Number.isInteger(quantidadeMoedaVirtual) || quantidadeMoedaVirtual <= 0) {
      throw new ErroDominio(
        `A quantidade de moeda virtual deve ser um inteiro positivo: ${quantidadeMoedaVirtual}`,
      );
    }

    this.criador = criador;
    this.quantidadeMoedaVirtual = quantidadeMoedaVirtual;
    this.valorRepasse = this.calcularValorRepasse(taxaRepasse, moeda);
  }

  /** Doador da transação (alias legível para a propriedade herdada `usuario`). */
  get doador(): Usuario {
    return this.usuario;
  }

  /** Valor líquido que o criador recebe: taxa aplicada sobre a quantidade em centavos. */
  calcularValorRepasse(taxa: number, moeda = "BRL"): Dinheiro {
    if (taxa <= 0 || taxa > 1) {
      throw new ErroDominio(`A taxa de repasse deve estar entre 0 e 1: ${taxa}`);
    }
    return Dinheiro.deCentavos(this.quantidadeMoedaVirtual, moeda).multiplicar(taxa);
  }
}
