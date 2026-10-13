import { Usuario } from "../../src/dominio";

describe("Usuario", () => {
  test("nasce com carteira e perfil próprios", () => {
    const usuario = new Usuario("u1", "Usuário", "u@exemplo.com");
    expect(usuario.carteira.saldoMoedaVirtual).toBe(0);
    expect(usuario.perfil.monetizado).toBe(false);
  });

  test("só recebe doações depois de habilitar a monetização", () => {
    const criador = new Usuario("u2", "Criador", "c@exemplo.com");
    expect(criador.perfil.estaHabilitadoAReceber()).toBe(false);
    criador.perfil.habilitarMonetizacao();
    expect(criador.perfil.estaHabilitadoAReceber()).toBe(true);
  });
});
