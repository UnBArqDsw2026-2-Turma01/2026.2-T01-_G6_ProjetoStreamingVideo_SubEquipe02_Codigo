import type { GeradorId, RepositorioEmMemoria } from "../compartilhado";
import type { NotificadorChat } from "../contratos";
import { ErroDominio, type Usuario } from "../dominio";
import type { ServicoFinanceiro } from "../financeiro";
import { Doacao } from "./Doacao";
import { DoacaoComMensagem } from "./DoacaoComMensagem";

/** Resultado da doação com mensagem e estado da notificação ao chat. */
export interface ResultadoDoacaoComMensagem {
  readonly doacao: DoacaoComMensagem;
  readonly notificacaoChatEnviada: boolean;
  readonly avisoChat?: string;
}

/**
 * Mediator da doação com mensagem destacada (Padrão GoF: Mediator).
 * Orquestra Financeiro e NotificadorChat; falha no chat não invalida a doação (D05).
 */
export class MediatorDoacaoComMensagem {
  constructor(
    private readonly servicoFinanceiro: ServicoFinanceiro,
    private readonly notificadorChat: NotificadorChat,
    private readonly repositorioDoacoes: RepositorioEmMemoria<Doacao>,
    private readonly geradorId: GeradorId,
  ) {}

  processar(
    doador: Usuario,
    criador: Usuario,
    quantidadeMoedaVirtual: number,
    mensagem: string,
  ): ResultadoDoacaoComMensagem {
    this.validarPartes(doador, criador);

    const doacao = new DoacaoComMensagem(
      this.geradorId.proximo("doacao"),
      doador,
      criador,
      quantidadeMoedaVirtual,
      mensagem,
    );

    this.transferirOuFalhar(doador, criador, doacao);

    doacao.concluir();
    doador.carteira.registrarTransacao(doacao);
    criador.carteira.registrarTransacao(doacao);
    this.repositorioDoacoes.salvar(doacao);

    let notificacaoChatEnviada = false;
    let avisoChat: string | undefined;

    try {
      this.notificadorChat.exibirMensagemDestacada({
        doacaoId: doacao.id,
        doador,
        criador,
        quantidadeMoedaVirtual: doacao.quantidadeMoedaVirtual,
        mensagem: doacao.mensagem,
      });
      notificacaoChatEnviada = true;
    } catch (erro) {
      avisoChat =
        erro instanceof Error
          ? `Doação e repasse concluídos, mas o chat falhou ao exibir o destaque: ${erro.message}`
          : "Doação e repasse concluídos, mas o chat falhou ao exibir o destaque.";
    }

    return { doacao, notificacaoChatEnviada, avisoChat };
  }

  private validarPartes(doador: Usuario, criador: Usuario): void {
    if (!criador.perfil.estaHabilitadoAReceber()) {
      throw new ErroDominio(`O criador "${criador.nome}" não está habilitado a receber doações.`);
    }
    if (doador.id === criador.id) {
      throw new ErroDominio("Um usuário não pode doar para o próprio canal.");
    }
  }

  private transferirOuFalhar(doador: Usuario, criador: Usuario, doacao: DoacaoComMensagem): void {
    let transferido: boolean;
    try {
      transferido = this.servicoFinanceiro.transferirDoacao(
        doador,
        criador,
        doacao.quantidadeMoedaVirtual,
        doacao.valorRepasse,
      );
    } catch (erro) {
      doacao.cancelar();
      this.repositorioDoacoes.salvar(doacao);
      throw erro;
    }

    if (!transferido) {
      doacao.cancelar();
      this.repositorioDoacoes.salvar(doacao);
      throw new ErroDominio(
        `Saldo de moeda virtual insuficiente na carteira de "${doador.nome}" para doar ${doacao.quantidadeMoedaVirtual}.`,
      );
    }
  }
}
