import { Dinheiro } from "./Dinheiro";
import { ErroDominio } from "./ErroDominio";
import type { Transacao } from "./Transacao";

/**
 * Carteira do usuário, com dois saldos: moeda virtual e dinheiro.
 *
 * Os métodos de dedução **verificam e debitam na mesma operação**, retornando
 * `false` quando o saldo é insuficiente (decisão de projeto da Entrega 2,
 * necessária para consistência sob concorrência).
 */
export class Carteira {
  private _saldoMoedaVirtual = 0;
  private _saldoDinheiro: Dinheiro;
  private readonly _historico: Transacao[] = [];

  constructor(moeda = "BRL") {
    this._saldoDinheiro = Dinheiro.zero(moeda);
  }

  get saldoMoedaVirtual(): number {
    return this._saldoMoedaVirtual;
  }

  get saldoDinheiro(): Dinheiro {
    return this._saldoDinheiro;
  }

  get historico(): readonly Transacao[] {
    return this._historico;
  }

  adicionarMoedaVirtual(quantidade: number): void {
    this.exigirQuantidadeValida(quantidade);
    this._saldoMoedaVirtual += quantidade;
  }

  deduzirMoedaVirtual(quantidade: number): boolean {
    this.exigirQuantidadeValida(quantidade);
    if (this._saldoMoedaVirtual < quantidade) return false;
    this._saldoMoedaVirtual -= quantidade;
    return true;
  }

  adicionarDinheiro(valor: Dinheiro): void {
    this._saldoDinheiro = this._saldoDinheiro.somar(valor);
  }

  deduzirDinheiro(valor: Dinheiro): boolean {
    if (!this._saldoDinheiro.ehMaiorOuIgual(valor)) return false;
    this._saldoDinheiro = this._saldoDinheiro.subtrair(valor);
    return true;
  }

  registrarTransacao(transacao: Transacao): void {
    this._historico.push(transacao);
  }

  private exigirQuantidadeValida(quantidade: number): void {
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw new ErroDominio(`Quantidade de moeda virtual deve ser um inteiro positivo: ${quantidade}`);
    }
  }
}
