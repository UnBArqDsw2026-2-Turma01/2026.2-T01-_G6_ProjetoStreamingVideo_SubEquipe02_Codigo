import { GeradorId, RepositorioEmMemoria } from "../../src/compartilhado";

describe("GeradorId", () => {
  test("gera identificadores sequenciais por prefixo", () => {
    const gerador = new GeradorId();
    expect(gerador.proximo("recarga")).toBe("recarga-1");
    expect(gerador.proximo("recarga")).toBe("recarga-2");
    expect(gerador.proximo("doacao")).toBe("doacao-1");
  });
});

describe("RepositorioEmMemoria", () => {
  test("salva, busca e lista itens", () => {
    const repo = new RepositorioEmMemoria<{ id: string; valor: number }>();
    repo.salvar({ id: "a", valor: 1 });
    expect(repo.existe("a")).toBe(true);
    expect(repo.buscarPorId("a")?.valor).toBe(1);
    expect(repo.buscarPorId("b")).toBeUndefined();
    expect(repo.listar()).toHaveLength(1);
  });
});
