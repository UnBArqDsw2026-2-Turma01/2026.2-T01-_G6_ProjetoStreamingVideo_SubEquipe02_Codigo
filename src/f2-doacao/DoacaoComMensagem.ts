import { ErroDominio, type Usuario } from "../dominio";
import { Doacao } from "./Doacao";
import { FaixaDestaque, type PropriedadesFaixa } from "./FaixaDestaque";

/**
 * Doação com mensagem destacada no chat (SC01, SC02).
 * Especializa Doacao acrescentando mensagem e faixa visual.
 */
export class DoacaoComMensagem extends Doacao {
  readonly mensagem: string;
  readonly faixa: PropriedadesFaixa;

  constructor(
    id: string,
    doador: Usuario,
    criador: Usuario,
    quantidadeMoedaVirtual: number,
    mensagem: string,
    taxaRepasse = Doacao.TAXA_REPASSE_PADRAO,
    moeda = "BRL",
  ) {
    const faixa = FaixaDestaque.paraQuantidade(quantidadeMoedaVirtual);

    if (mensagem.trim().length === 0) {
      throw new ErroDominio("A mensagem da doação não pode estar vazia.");
    }
    if (mensagem.length > faixa.limiteCaracteres) {
      throw new ErroDominio(
        `A mensagem excede o limite de ${faixa.limiteCaracteres} caracteres da ${faixa.codigo} (SC02).`,
      );
    }

    super(id, doador, criador, quantidadeMoedaVirtual, taxaRepasse, moeda);
    this.mensagem = mensagem;
    this.faixa = faixa;
  }
}
