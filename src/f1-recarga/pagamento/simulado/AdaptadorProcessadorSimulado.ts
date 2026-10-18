import { Dinheiro } from "../../../dominio";
import { assinaturaConfere } from "../AssinaturaWebhook";
import { ErroGatewayIndisponivel } from "../ErroGatewayIndisponivel";
import {
  StatusPagamento,
  type GatewayPagamento,
  type NotificacaoPagamento,
  type SessaoCheckout,
  type SituacaoPagamento,
} from "../GatewayPagamento";
import type { ProcessadorSimulado } from "./ProcessadorSimulado";

const TRADUCAO_STATUS: Record<string, StatusPagamento> = {
  PAGO: StatusPagamento.APROVADO,
  AGUARDANDO: StatusPagamento.PENDENTE,
  NEGADO: StatusPagamento.RECUSADO,
};

/**
 * Adapter: faz o `ProcessadorSimulado` parecer um `GatewayPagamento`.
 * Traduz códigos numéricos em exceções e a consulta em texto em `SituacaoPagamento`.
 * O nome é configurável para a demonstração usar dois simulados (fallback O07).
 */
export class AdaptadorProcessadorSimulado implements GatewayPagamento {
  readonly nome: string;
  private readonly processador: ProcessadorSimulado;
  private readonly segredoWebhook: string;

  constructor(processador: ProcessadorSimulado, segredoWebhook: string, nome = "Simulado") {
    this.processador = processador;
    this.segredoWebhook = segredoWebhook;
    this.nome = nome;
  }

  async iniciarCheckout(valor: Dinheiro, recargaId: string): Promise<SessaoCheckout> {
    if (valor.moeda !== "BRL") {
      throw new ErroGatewayIndisponivel(this.nome, `só aceita BRL, recebido ${valor.moeda}`);
    }
    const resposta = this.processador.criarCobranca(valor.centavos, recargaId);
    if (resposta.codigo === 503) {
      throw new ErroGatewayIndisponivel(this.nome, "processador fora do ar");
    }
    if (resposta.codigo !== 0 || resposta.protocolo === undefined) {
      throw new Error(`Processador simulado recusou a cobrança: código ${resposta.codigo}`);
    }
    return { idCheckout: resposta.protocolo, instrucoes: `pague o protocolo ${resposta.protocolo}` };
  }

  async estaDisponivel(): Promise<boolean> {
    return this.processador.online;
  }

  async consultarPagamento(idPagamento: string): Promise<SituacaoPagamento> {
    const texto = this.processador.consultarStatus(idPagamento);
    if (texto === "FORA_DO_AR") {
      throw new ErroGatewayIndisponivel(this.nome, "processador fora do ar");
    }
    if (texto === "INEXISTENTE") {
      throw new Error(`Pagamento ${idPagamento} inexistente no ${this.nome}`);
    }
    const [situacao = "", referencia = "", centavos = "0"] = texto.split(";");
    const status = TRADUCAO_STATUS[situacao];
    if (status === undefined) {
      throw new Error(`Situação desconhecida do ${this.nome}: ${situacao}`);
    }
    return {
      idPagamento,
      referencia,
      status,
      valorPago: Dinheiro.deCentavos(Number(centavos)),
    };
  }

  validarWebhook(notificacao: NotificacaoPagamento): boolean {
    return assinaturaConfere(this.segredoWebhook, notificacao);
  }
}
