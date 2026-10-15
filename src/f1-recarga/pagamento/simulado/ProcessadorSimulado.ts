/** Resposta de `criarCobranca`: código numérico no estilo de sistemas legados. */
export interface RespostaSimulada {
  /** 0 = criada; 503 = fora do ar; outros = erro na requisição. */
  readonly codigo: number;
  readonly protocolo?: string;
}

type SituacaoInterna = "AGUARDANDO" | "PAGO" | "NEGADO";

interface Cobranca {
  situacao: SituacaoInterna;
  referencia: string;
  centavos: number;
  centavosPagos: number;
}

/**
 * Adaptee: processador de pagamentos simulado, para testes e demonstração sem internet.
 *
 * A API é propositalmente diferente da do sistema: códigos numéricos em vez de
 * exceções e uma consulta que devolve texto ("SITUACAO;referencia;centavos").
 * Os métodos `aprovar` e `negar` simulam o espectador pagando na tela do processador.
 */
export class ProcessadorSimulado {
  online = true;
  private readonly cobrancas = new Map<string, Cobranca>();
  private sequencia = 0;

  criarCobranca(centavos: number, ref: string): RespostaSimulada {
    if (!this.online) return { codigo: 503 };
    if (!Number.isInteger(centavos) || centavos <= 0 || ref === "") return { codigo: 400 };
    const protocolo = `sim-${++this.sequencia}`;
    this.cobrancas.set(protocolo, { situacao: "AGUARDANDO", referencia: ref, centavos, centavosPagos: 0 });
    return { codigo: 0, protocolo };
  }

  /** Devolve "SITUACAO;referencia;centavosPagos", "INEXISTENTE" ou "FORA_DO_AR". */
  consultarStatus(id: string): string {
    if (!this.online) return "FORA_DO_AR";
    const cobranca = this.cobrancas.get(id);
    if (!cobranca) return "INEXISTENTE";
    return `${cobranca.situacao};${cobranca.referencia};${cobranca.centavosPagos}`;
  }

  /** Simula o pagamento. Por padrão paga o valor cobrado; um valor diferente simula fraude ou erro. */
  aprovar(id: string, centavosPagos?: number): void {
    const cobranca = this.exigir(id);
    cobranca.situacao = "PAGO";
    cobranca.centavosPagos = centavosPagos ?? cobranca.centavos;
  }

  negar(id: string): void {
    this.exigir(id).situacao = "NEGADO";
  }

  private exigir(id: string): Cobranca {
    const cobranca = this.cobrancas.get(id);
    if (!cobranca) throw new Error(`Cobrança simulada inexistente: ${id}`);
    return cobranca;
  }
}
