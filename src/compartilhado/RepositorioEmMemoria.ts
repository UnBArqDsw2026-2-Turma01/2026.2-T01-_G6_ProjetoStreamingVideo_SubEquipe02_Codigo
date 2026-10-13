/**
 * Repositório genérico em memória.
 *
 * Substitui o banco de dados nesta entrega: o escopo prevê dados em memória.
 * Qualquer entidade com `id` pode ser armazenada.
 */
export class RepositorioEmMemoria<T extends { id: string }> {
  private readonly itens = new Map<string, T>();

  salvar(item: T): void {
    this.itens.set(item.id, item);
  }

  buscarPorId(id: string): T | undefined {
    return this.itens.get(id);
  }

  existe(id: string): boolean {
    return this.itens.has(id);
  }

  listar(): T[] {
    return [...this.itens.values()];
  }
}
