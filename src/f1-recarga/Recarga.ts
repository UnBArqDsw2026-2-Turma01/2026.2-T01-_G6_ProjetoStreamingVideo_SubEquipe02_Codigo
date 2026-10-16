import { Dinheiro, ErroDominio, Transacao, Usuario } from "../dominio";

/** Como o espectador paga a recarga (Entrega 2: saldo do criador ou processador externo). */
export const MetodoRecarga = {
  SALDO_DO_CRIADOR: "SALDO_DO_CRIADOR",
  PROCESSADOR_EXTERNO: "PROCESSADOR_EXTERNO",
} as const;

export type MetodoRecarga = (typeof MetodoRecarga)[keyof typeof MetodoRecarga];

/**
 * Compra de moeda virtual (Entrega 2: Recarga especializa Transacao).
 *
 * Nasce PENDENTE com o valor já calculado pela cadeia de preço (Decorator).
 * No pagamento por processador externo, guarda qual gateway criou o checkout,
 * para que a confirmação consulte o mesmo processador.
 */
export class Recarga extends Transacao {
  readonly quantidadeMoedaVirtual: number;
  readonly valor: Dinheiro;
  readonly composicaoPreco: string;
  readonly metodo: MetodoRecarga;
  private _gatewayUtilizado?: string;
  private _idCheckout?: string;
  private _instrucoesPagamento?: string;
  private _motivoCancelamento?: string;

  constructor(
    id: string,
    usuario: Usuario,
    quantidadeMoedaVirtual: number,
    valor: Dinheiro,
    composicaoPreco: string,
    metodo: MetodoRecarga,
  ) {
    super(id, usuario);
    if (!Number.isInteger(quantidadeMoedaVirtual) || quantidadeMoedaVirtual <= 0) {
      throw new ErroDominio(`Quantidade de moeda virtual inválida: ${quantidadeMoedaVirtual}`);
    }
    this.quantidadeMoedaVirtual = quantidadeMoedaVirtual;
    this.valor = valor;
    this.composicaoPreco = composicaoPreco;
    this.metodo = metodo;
  }

  get gatewayUtilizado(): string | undefined {
    return this._gatewayUtilizado;
  }

  get idCheckout(): string | undefined {
    return this._idCheckout;
  }

  /** Link do checkout que o cliente mostra ao espectador para pagar. */
  get instrucoesPagamento(): string | undefined {
    return this._instrucoesPagamento;
  }

  get motivoCancelamento(): string | undefined {
    return this._motivoCancelamento;
  }

  /** Registra o checkout criado no processador. Só uma vez, e só enquanto PENDENTE. */
  registrarCheckout(gateway: string, idCheckout: string, instrucoesPagamento?: string): void {
    if (!this.estaPendente()) {
      throw new ErroDominio(`Recarga ${this.id} não está pendente: status ${this.status}`);
    }
    if (this._idCheckout !== undefined) {
      throw new ErroDominio(`Recarga ${this.id} já tem checkout no gateway ${this._gatewayUtilizado}`);
    }
    this._gatewayUtilizado = gateway;
    this._idCheckout = idCheckout;
    this._instrucoesPagamento = instrucoesPagamento;
  }

  cancelarComMotivo(motivo: string): void {
    this.cancelar();
    this._motivoCancelamento = motivo;
  }
}
