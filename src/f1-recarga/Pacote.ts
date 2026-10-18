import type { Dinheiro } from "../dominio";

/** Pacote de moeda virtual vendido na plataforma (parâmetro de configuração, Entrega 2). */
export interface Pacote {
  readonly id: string;
  readonly quantidadeMoedaVirtual: number;
  readonly valorBase: Dinheiro;
}

/** O que o modal de recarga mostra para cada pacote. */
export interface OfertaPacote {
  readonly pacote: Pacote;
  /** Preço de tabela do componente base (`PrecoPacote`), sem taxa nem imposto. */
  readonly precoOriginal: Dinheiro;
  /**
   * Preço final fora da promoção: a cadeia sem a camada de desconto (com taxa e imposto).
   * É o valor riscado no modal, para o percentual de desconto valer sobre ele.
   */
  readonly precoSemDesconto: Dinheiro;
  /** Preço da cadeia completa de decoradores. */
  readonly precoPromocional: Dinheiro;
  /** Desconto aplicado a este pacote (progressivo ou geral), para o selo do modal. */
  readonly descontoPercentual?: number;
  /** Descrição das camadas aplicadas, para transparência ao espectador. */
  readonly composicao: string;
}
