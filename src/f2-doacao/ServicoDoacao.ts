import type { NotificadorChat } from "../contratos";
import type { Usuario } from "../dominio";
import type { ServicoFinanceiro } from "../financeiro";
import { FaixaDestaque, type PropriedadesFaixa } from "./FaixaDestaque";
import { MediatorDoacao, type ResultadoDoacaoSimples } from "./MediatorDoacao";
import {
  MediatorDoacaoComMensagem,
  type ResultadoDoacaoComMensagem,
} from "./MediatorDoacaoComMensagem";

/** Opções e faixas de destaque disponíveis para exibição no modal de doação. */
export interface OpcoesDoacao {
  readonly canalId: string;
  readonly habilitadoAReceber: boolean;
  readonly saldoMoedaVirtualDoador: number;
  readonly faixasDisponiveis: readonly PropriedadesFaixa[];
}

/** @deprecated Use ResultadoDoacaoComMensagem — mantido para compatibilidade de tipo. */
export type ResultadoDoacao = ResultadoDoacaoComMensagem;

/**
 * Fachada da operação de doação e repasse (Padrão GoF: Facade).
 *
 * Client do Mediator: encaminha doar / doarComMensagem sem regra própria.
 * Mantém referência aos colleagues (Financeiro e Chat) conforme a modelagem.
 */
export class ServicoDoacao {
  constructor(
    private readonly mediadorSimples: MediatorDoacao,
    private readonly mediadorComMensagem: MediatorDoacaoComMensagem,
    private readonly servicoFinanceiro: ServicoFinanceiro,
    private readonly notificadorChat: NotificadorChat,
  ) {}

  /** Exposição do colleague financeiro (wiring / inspeção). */
  get financeiro(): ServicoFinanceiro {
    return this.servicoFinanceiro;
  }

  /** Exposição do colleague de chat (wiring / inspeção). */
  get chat(): NotificadorChat {
    return this.notificadorChat;
  }

  /** Consulta prévia para o modal de doação: elegibilidade do canal e faixas disponíveis. */
  consultarOpcoesDoacao(canal: Usuario, doador: Usuario): OpcoesDoacao {
    return {
      canalId: canal.id,
      habilitadoAReceber: canal.perfil.estaHabilitadoAReceber(),
      saldoMoedaVirtualDoador: doador.carteira.saldoMoedaVirtual,
      faixasDisponiveis: [
        FaixaDestaque.FAIXA_1,
        FaixaDestaque.FAIXA_2,
        FaixaDestaque.FAIXA_3,
        FaixaDestaque.FAIXA_4,
        FaixaDestaque.FAIXA_5,
      ],
    };
  }

  /** Encaminha doação simples ao MediatorDoacao. */
  doar(
    doador: Usuario,
    criador: Usuario,
    quantidadeMoedaVirtual: number,
  ): ResultadoDoacaoSimples {
    return this.mediadorSimples.processar(doador, criador, quantidadeMoedaVirtual);
  }

  /** Encaminha doação com mensagem ao MediatorDoacaoComMensagem. */
  doarComMensagem(
    doador: Usuario,
    criador: Usuario,
    quantidadeMoedaVirtual: number,
    mensagem: string,
  ): ResultadoDoacaoComMensagem {
    return this.mediadorComMensagem.processar(
      doador,
      criador,
      quantidadeMoedaVirtual,
      mensagem,
    );
  }

  /**
   * Compatibilidade com callers anteriores (demo/testes).
   * Equivale a doarComMensagem.
   */
  processarDoacao(
    doador: Usuario,
    criador: Usuario,
    quantidadeMoedaVirtual: number,
    mensagem: string,
  ): ResultadoDoacaoComMensagem {
    return this.doarComMensagem(doador, criador, quantidadeMoedaVirtual, mensagem);
  }
}
