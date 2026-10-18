import { ErroDominio, Transacao, type Dinheiro, type Usuario } from "../dominio";
import { REPASSE_POR_MOEDA } from "../f1-recarga";

/**
 * Doação de moeda virtual (Entrega 2: Doacao especializa Transacao).
 *
 * O usuário herdado de Transacao é o doador. Ao nascer PENDENTE, calcula o valor
 * repassado ao criador. Mensagem e faixa ficam em DoacaoComMensagem.
 */
export class Doacao extends Transacao {
  /** Repasse por moeda vindo do catálogo da plataforma, que fica abaixo do preço de venda. */
  static readonly REPASSE_POR_MOEDA_PADRAO = REPASSE_POR_MOEDA;

  readonly criador: Usuario;
  readonly quantidadeMoedaVirtual: number;
  readonly valorRepasse: Dinheiro;

  constructor(
    id: string,
    doador: Usuario,
    criador: Usuario,
    quantidadeMoedaVirtual: number,
    repassePorMoeda: Dinheiro = Doacao.REPASSE_POR_MOEDA_PADRAO,
  ) {
    super(id, doador);

    if (!Number.isInteger(quantidadeMoedaVirtual) || quantidadeMoedaVirtual <= 0) {
      throw new ErroDominio(
        `A quantidade de moeda virtual deve ser um inteiro positivo: ${quantidadeMoedaVirtual}`,
      );
    }

    this.criador = criador;
    this.quantidadeMoedaVirtual = quantidadeMoedaVirtual;
    this.valorRepasse = this.calcularValorRepasse(repassePorMoeda);
  }

  /** Doador da transação (alias legível para a propriedade herdada `usuario`). */
  get doador(): Usuario {
    return this.usuario;
  }

  /** Valor que o criador recebe: o repasse por moeda vezes a quantidade doada (sem arredondamento). */
  calcularValorRepasse(repassePorMoeda: Dinheiro): Dinheiro {
    if (repassePorMoeda.centavos <= 0) {
      throw new ErroDominio(`O repasse por moeda deve ser positivo: ${repassePorMoeda.formatar()}`);
    }
    return repassePorMoeda.multiplicar(this.quantidadeMoedaVirtual);
  }
}
