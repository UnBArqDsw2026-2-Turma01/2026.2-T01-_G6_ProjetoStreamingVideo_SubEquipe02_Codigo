/**
 * Gerador de identificadores sequenciais e legíveis (ex.: "recarga-1", "doacao-2").
 * Sequencial em vez de aleatório para que demonstrações e testes sejam previsíveis.
 */
export class GeradorId {
  private readonly contadores = new Map<string, number>();

  proximo(prefixo: string): string {
    const atual = (this.contadores.get(prefixo) ?? 0) + 1;
    this.contadores.set(prefixo, atual);
    return `${prefixo}-${atual}`;
  }
}
