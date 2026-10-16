import type { GeradorId, RepositorioEmMemoria } from "../compartilhado";
import type { NotificadorChat } from "../contratos";
import { ErroDominio, type Usuario } from "../dominio";
import type { ServicoFinanceiro } from "../financeiro";
import { Doacao } from "./Doacao";
import { FaixaDestaque, type PropriedadesFaixa } from "./FaixaDestaque";

/** Opções e faixas de destaque disponíveis para exibição no modal de doação. */
export interface OpcoesDoacao {
  readonly canalId: string;
  readonly habilitadoAReceber: boolean;
  readonly saldoMoedaVirtualDoador: number;
  readonly faixasDisponiveis: readonly PropriedadesFaixa[];
}

/** Resultado do processamento da doação e estado da notificação ao chat. */
export interface ResultadoDoacao {
  readonly doacao: Doacao;
  readonly notificacaoChatEnviada: boolean;
  readonly avisoChat?: string;
}

/**
 * Fachada da operação de doação e repasse (Padrão GoF: Facade; Entrega 2: ServicoDoacao).
 *
 * Unifica e simplifica o fluxo para o `DoacaoController`, coordenando os subsistemas:
 * validação do perfil do criador, débito e crédito atômicos no `ServicoFinanceiro`,
 * e notificação assíncrona ao `NotificadorChat`.
 */
export class ServicoDoacao {
  constructor(
    private readonly servicoFinanceiro: ServicoFinanceiro,
    private readonly notificadorChat: NotificadorChat,
    private readonly repositorioDoacoes: RepositorioEmMemoria<Doacao>,
    private readonly geradorId: GeradorId,
  ) {}

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

  /**
   * Executa a doação com mensagem destacada e o repasse ao criador:
   * 1. Verifica se o criador está habilitado a receber (SQ02, SQ05);
   * 2. Valida se a origem não é o próprio canal destinatário;
   * 3. Cria a `Doacao` (PENDENTE), classificando a faixa e calculando o repasse (SC01, SC02);
   * 4. Transfere os valores atomicamente via `ServicoFinanceiro`;
   * 5. Conclui a doação e registra nos históricos das carteiras;
   * 6. Dispara o destaque no chat; falha no chat não invalida o repasse (Ata S2_02, D05; SC04).
   */
  processarDoacao(
    doador: Usuario,
    criador: Usuario,
    quantidadeMoedaVirtual: number,
    mensagem: string,
  ): ResultadoDoacao {
    // 1. Só criadores monetizados podem receber doações (SQ02, SQ05).
    if (!criador.perfil.estaHabilitadoAReceber()) {
      throw new ErroDominio(`O criador "${criador.nome}" não está habilitado a receber doações.`);
    }

    // 2. Validação de integridade entre as partes.
    if (doador.id === criador.id) {
      throw new ErroDominio("Um usuário não pode doar para o próprio canal.");
    }

    // 3. Criação da transação pendente com validação de faixa e caracteres (SC01, SC02).
    const doacao = new Doacao(
      this.geradorId.proximo("doacao"),
      doador,
      criador,
      quantidadeMoedaVirtual,
      mensagem,
    );

    // 4. Débito na origem e repasse no destino de forma atômica no serviço financeiro.
    let transferido: boolean;
    try {
      transferido = this.servicoFinanceiro.transferirDoacao(
        doador,
        criador,
        doacao.quantidadeMoedaVirtual,
        doacao.valorRepasse,
      );
    } catch (erro) {
      // Se o crédito falhar, o serviço financeiro faz rollback; cancela a transação local.
      doacao.cancelar();
      this.repositorioDoacoes.salvar(doacao);
      throw erro;
    }

    if (!transferido) {
      doacao.cancelar();
      this.repositorioDoacoes.salvar(doacao);
      throw new ErroDominio(
        `Saldo de moeda virtual insuficiente na carteira de "${doador.nome}" para doar ${quantidadeMoedaVirtual}.`,
      );
    }

    // 5. Conclusão da transação e registro no histórico de ambas as carteiras.
    doacao.concluir();
    doador.carteira.registrarTransacao(doacao);
    criador.carteira.registrarTransacao(doacao);
    this.repositorioDoacoes.salvar(doacao);

    // 6. Notificação assíncrona ao chat; falha na exibição não estorna a doação (Ata S2_02, D05).
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
}
