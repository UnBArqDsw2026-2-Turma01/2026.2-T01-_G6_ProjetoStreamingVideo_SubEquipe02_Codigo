import { Dinheiro, ErroDominio, Transacao, type Usuario } from "../dominio";
import { FaixaDestaque, type PropriedadesFaixa } from "./FaixaDestaque";

/**
 * Doação de moeda virtual com mensagem destacada (Entrega 2: Doacao especializa Transacao).
 *
 * O usuário herdado de Transacao é o doador. Ao nascer PENDENTE, classifica a doação
 * na faixa correspondente (SC01, SC02) e calcula o valor líquido repassado ao criador.
 */
export class Doacao extends Transacao {
  /**
   * Percentual padrão repassado ao criador (70% do valor convertido).
   * Cada unidade de moeda virtual equivale a 1 centavo antes da retenção da plataforma.
   */
  static readonly TAXA_REPASSE_PADRAO = 0.7;

  readonly criador: Usuario;
  readonly quantidadeMoedaVirtual: number;
  readonly mensagem: string;
  readonly faixa: PropriedadesFaixa;
  readonly valorRepasse: Dinheiro;

  constructor(
    id: string,
    doador: Usuario,
    criador: Usuario,
    quantidadeMoedaVirtual: number,
    mensagem: string,
    taxaRepasse = Doacao.TAXA_REPASSE_PADRAO,
    moeda = "BRL",
  ) {
    super(id, doador);

    const faixa = FaixaDestaque.paraQuantidade(quantidadeMoedaVirtual);

    if (mensagem.trim().length === 0) {
      throw new ErroDominio("A mensagem da doação não pode estar vazia.");
    }
    if (mensagem.length > faixa.limiteCaracteres) {
      throw new ErroDominio(
        `A mensagem excede o limite de ${faixa.limiteCaracteres} caracteres da ${faixa.codigo} (SC02).`,
      );
    }

    this.criador = criador;
    this.quantidadeMoedaVirtual = quantidadeMoedaVirtual;
    this.mensagem = mensagem;
    this.faixa = faixa;
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
