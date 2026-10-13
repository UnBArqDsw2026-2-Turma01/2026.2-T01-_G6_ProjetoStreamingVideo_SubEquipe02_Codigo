import { NotificadorChatProvisorio } from "../../src/contratos";
import { Usuario } from "../../src/dominio";

describe("NotificadorChatProvisorio", () => {
  test("registra as doações recebidas", () => {
    const chat = new NotificadorChatProvisorio(true);
    const doador = new Usuario("u1", "Doador", "d@exemplo.com");
    const criador = new Usuario("u2", "Criador", "c@exemplo.com");

    chat.exibirMensagemDestacada({
      doacaoId: "doacao-1",
      doador,
      criador,
      quantidadeMoedaVirtual: 100,
      mensagem: "Olá!",
    });

    expect(chat.recebidas).toHaveLength(1);
    expect(chat.recebidas[0].mensagem).toBe("Olá!");
  });
});
