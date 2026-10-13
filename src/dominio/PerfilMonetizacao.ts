/**
 * Perfil de monetização do criador.
 *
 * A plataforma da equipe adota dois perfis: monetizado e não monetizado.
 * Somente criadores monetizados podem receber doações
 * (Engenharia Reversa complementar, Entrega 2: SQ02 e SQ09).
 */
export class PerfilMonetizacao {
  private _monetizado = false;

  get monetizado(): boolean {
    return this._monetizado;
  }

  habilitarMonetizacao(): void {
    this._monetizado = true;
  }

  estaHabilitadoAReceber(): boolean {
    return this._monetizado;
  }
}
