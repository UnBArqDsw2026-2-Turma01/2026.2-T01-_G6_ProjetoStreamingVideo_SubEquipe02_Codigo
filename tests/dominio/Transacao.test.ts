import { ErroDominio, StatusTransacao, Transacao, Usuario } from "../../src/dominio";

class TransacaoDeTeste extends Transacao {
  constructor(usuario: Usuario) {
    super("teste-1", usuario);
  }
}

describe("Transacao", () => {
  const usuario = new Usuario("u1", "Usuário", "u@exemplo.com");

  test("nasce pendente e pode ser concluída", () => {
    const t = new TransacaoDeTeste(usuario);
    expect(t.status).toBe(StatusTransacao.PENDENTE);
    t.concluir();
    expect(t.status).toBe(StatusTransacao.CONCLUIDA);
  });

  test("pode ser cancelada enquanto pendente", () => {
    const t = new TransacaoDeTeste(usuario);
    t.cancelar();
    expect(t.status).toBe(StatusTransacao.CANCELADA);
  });

  test("não muda de estado depois de finalizada", () => {
    const t = new TransacaoDeTeste(usuario);
    t.concluir();
    expect(() => t.concluir()).toThrow(ErroDominio);
    expect(() => t.cancelar()).toThrow(ErroDominio);
  });
});
