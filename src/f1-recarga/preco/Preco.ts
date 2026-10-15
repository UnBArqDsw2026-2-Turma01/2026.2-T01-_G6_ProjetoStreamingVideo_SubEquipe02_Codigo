import type { Dinheiro } from "../../dominio";

/**
 * Component do Decorator: qualquer coisa que saiba dizer quanto custa.
 * Tanto o preço base do pacote quanto cada camada (desconto, taxa, imposto,
 * conversão) implementam esta mesma interface.
 */
export interface Preco {
  calcular(): Dinheiro;
  /** Descreve a composição do preço, da camada mais interna para a mais externa. */
  descrever(): string;
}
