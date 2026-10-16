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
  /** Preço do componente base (`PrecoPacote`), exibido riscado quando há promoção. */
  readonly precoOriginal: Dinheiro;
  /** Preço da cadeia completa de decoradores. */
  readonly precoPromocional: Dinheiro;
  /** Descrição das camadas aplicadas, para transparência ao espectador. */
  readonly composicao: string;
}
