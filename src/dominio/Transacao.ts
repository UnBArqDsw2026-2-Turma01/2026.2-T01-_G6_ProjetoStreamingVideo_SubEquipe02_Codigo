import { ErroDominio } from "./ErroDominio";
import { StatusTransacao } from "./StatusTransacao";
import type { Usuario } from "./Usuario";

/**
 * Base abstrata das transações financeiras (Recarga, Doação e Saque).
 * Cada frente cria a sua especialização a partir desta classe.
 *
 * Toda transação nasce PENDENTE e só pode ser concluída ou cancelada uma vez.
 */
export abstract class Transacao {
  readonly id: string;
  readonly usuario: Usuario;
  readonly dataHora: Date;
  private _status: StatusTransacao = StatusTransacao.PENDENTE;

  protected constructor(id: string, usuario: Usuario, dataHora: Date = new Date()) {
    this.id = id;
    this.usuario = usuario;
    this.dataHora = dataHora;
  }

  get status(): StatusTransacao {
    return this._status;
  }

  estaPendente(): boolean {
    return this._status === StatusTransacao.PENDENTE;
  }

  concluir(): void {
    this.exigirPendente("concluir");
    this._status = StatusTransacao.CONCLUIDA;
  }

  cancelar(): void {
    this.exigirPendente("cancelar");
    this._status = StatusTransacao.CANCELADA;
  }

  private exigirPendente(acao: string): void {
    if (!this.estaPendente()) {
      throw new ErroDominio(`Não é possível ${acao} a transação ${this.id}: status atual ${this._status}`);
    }
  }
}
