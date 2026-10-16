import { ErroDominio } from "../dominio";

/** Propriedades de cada faixa de destaque: cor, tempo de fixação no topo e limite de caracteres. */
export interface PropriedadesFaixa {
  readonly codigo: string;
  readonly quantidadeMinima: number;
  readonly cor: string;
  readonly tempoFixacaoMin: number;
  readonly limiteCaracteres: number;
}

/**
 * Faixas visuais da mensagem paga destacada no chat (Entrega 2: SC01 e SC02).
 *
 * Quanto maior a quantidade de moeda virtual doada, maior a faixa atingida:
 * altera a cor do destaque, o tempo de fixação no topo do chat e o limite
 * de caracteres permitido para a mensagem.
 */
export class FaixaDestaque {
  static readonly FAIXA_1: PropriedadesFaixa = {
    codigo: "FAIXA_1",
    quantidadeMinima: 200, // azul, sem fixação no topo (SC01)
    cor: "AZUL",
    tempoFixacaoMin: 0,
    limiteCaracteres: 50,
  };

  static readonly FAIXA_2: PropriedadesFaixa = {
    codigo: "FAIXA_2",
    quantidadeMinima: 500, // verde, fixada por 2 min (SC01)
    cor: "VERDE",
    tempoFixacaoMin: 2,
    limiteCaracteres: 150,
  };

  static readonly FAIXA_3: PropriedadesFaixa = {
    codigo: "FAIXA_3",
    quantidadeMinima: 2000, // laranja, fixada por 10 min (SC01)
    cor: "LARANJA",
    tempoFixacaoMin: 10,
    limiteCaracteres: 225,
  };

  static readonly FAIXA_4: PropriedadesFaixa = {
    codigo: "FAIXA_4",
    quantidadeMinima: 5000, // rosa, fixada por 30 min (SC01)
    cor: "ROSA",
    tempoFixacaoMin: 30,
    limiteCaracteres: 250,
  };

  static readonly FAIXA_5: PropriedadesFaixa = {
    codigo: "FAIXA_5",
    quantidadeMinima: 50000, // vermelho, fixada por 5 horas (300 min) (SC01)
    cor: "VERMELHO",
    tempoFixacaoMin: 300,
    limiteCaracteres: 350,
  };

  // Ordenadas da maior para a menor, garantindo que a busca encontre a faixa mais alta atingida.
  private static readonly TODAS_AS_FAIXAS: readonly PropriedadesFaixa[] = [
    FaixaDestaque.FAIXA_5,
    FaixaDestaque.FAIXA_4,
    FaixaDestaque.FAIXA_3,
    FaixaDestaque.FAIXA_2,
    FaixaDestaque.FAIXA_1,
  ];

  static readonly QUANTIDADE_MINIMA_GLOBAL = FaixaDestaque.FAIXA_1.quantidadeMinima;

  /** Classifica a quantidade de moeda virtual doada na faixa correspondente (SC01). */
  static paraQuantidade(quantidadeMoedaVirtual: number): PropriedadesFaixa {
    if (
      !Number.isInteger(quantidadeMoedaVirtual) ||
      quantidadeMoedaVirtual < FaixaDestaque.QUANTIDADE_MINIMA_GLOBAL
    ) {
      throw new ErroDominio(
        `A quantidade mínima para enviar mensagem paga destacada é de ${FaixaDestaque.QUANTIDADE_MINIMA_GLOBAL} de moeda virtual.`,
      );
    }

    const faixaEncontrada = FaixaDestaque.TODAS_AS_FAIXAS.find(
      (faixa) => quantidadeMoedaVirtual >= faixa.quantidadeMinima,
    );

    return faixaEncontrada ?? FaixaDestaque.FAIXA_1;
  }
}
