import { GeradorId, RepositorioEmMemoria } from "../compartilhado";
import { Usuario } from "../dominio";
import { ServicoFinanceiro } from "../financeiro";
import {
  AdaptadorProcessadorSimulado,
  CONFIGURACAO_PRECO,
  EfeitoConfirmacao,
  ErroMeioPagamentoIndisponivel,
  MetodoRecarga,
  ProcessadorSimulado,
  StatusPagamento,
  assinarNotificacao,
  montarRecarga,
  type GatewayPagamento,
  type NotificacaoPagamento,
  type Recarga,
  type RecargaController,
} from "../f1-recarga";
import { FaixaDestaque, montarDoacao, type Doacao, type DoacaoController } from "../f2-doacao";
import { Chat } from "../f3-chat";
import { PROCESSADORES_REAIS } from "../demo/processadoresReais";

/** Mensagem como a página exibe no chat: comum (escrita no chat) ou destacada (vinda de uma doação). */
export type MensagemNoChat =
  | { readonly tipo: "comum"; readonly autor: string; readonly texto: string }
  | {
      readonly tipo: "destacada";
      readonly id: string;
      readonly autor: string;
      readonly quantidade: number;
      readonly texto: string;
      /** Cor dada pelo decorador ComFaixaCor (null = sem cor). */
      readonly cor: string | null;
      readonly exibidaEm: number;
      /** Até quando a mensagem fica fixada no topo, pelo decorador ComFixacao (epoch ms; null = não fixa). */
      readonly fixadaAte: number | null;
    };

/** Doação recebida com sucesso, como aparece no painel de notificações do criador. */
export interface NotificacaoCriador {
  readonly autor: string;
  readonly canal: string;
  readonly quantidade: number;
  readonly repasse: string;
  readonly em: number;
}

/** Tamanho máximo de uma mensagem comum do chat. */
const LIMITE_MENSAGEM_COMUM = 200;

/** Erro de regra de negócio ou de meio de pagamento que a página mostra ao usuário. */
export class ErroDaAcao extends Error {}

/** Meio de pagamento da página: um gateway da F1 e o segredo com que os avisos dele são assinados. */
interface MeioPagamento {
  readonly gateway: GatewayPagamento;
  readonly segredo: string;
  /** Só nos simulados: o processador em memória, para tirar do ar e simular o pagamento. */
  readonly simulador?: ProcessadorSimulado;
  /** Só nos reais: como pagar no checkout de teste. */
  readonly comoPagar?: string;
}

/**
 * Estado da demonstração web: as três frentes montadas com o mesmo código das
 * demos de terminal, ligadas entre si, em memória.
 *
 * Meios de pagamento: Mercado Pago e Stripe reais (modo de teste), quando o .env
 * tem as credenciais, e dois processadores simulados, que funcionam em qualquer máquina.
 */
export class SessaoDemo {
  private espectador!: Usuario;
  private criador!: Usuario;
  private iniciante!: Usuario;
  private recargas!: RecargaController;
  private doacoes!: DoacaoController;
  private chat!: Chat;
  private meios!: Map<string, MeioPagamento>;
  /** Gateways reais conectados na subida do servidor; continuam valendo depois de reiniciar. */
  private reais: MeioPagamento[] = [];
  private pedidos!: Map<string, Recarga>;
  private mensagens!: MensagemNoChat[];
  private notificacoes!: NotificacaoCriador[];
  private ultimoAviso!: Map<string, string>;
  private sequenciaAviso = 0;

  constructor() {
    this.reiniciar();
  }

  reiniciar(): void {
    this.espectador = new Usuario("espectador", "Espectador", "espectador@exemplo.com");
    this.criador = new Usuario("criador", "Criador", "criador@exemplo.com");
    this.iniciante = new Usuario("iniciante", "Canal Iniciante", "iniciante@exemplo.com");
    this.criador.perfil.habilitarMonetizacao();

    const usuarios = new RepositorioEmMemoria<Usuario>();
    [this.espectador, this.criador, this.iniciante].forEach((u) => usuarios.salvar(u));

    const financeiro = new ServicoFinanceiro();
    const geradorId = new GeradorId();

    const simulados = ["Simulado-A", "Simulado-B"].map((nome, i): MeioPagamento => {
      const simulador = new ProcessadorSimulado();
      const segredo = `segredo-simulado-${i + 1}`;
      return { gateway: new AdaptadorProcessadorSimulado(simulador, segredo, nome), segredo, simulador };
    });
    this.meios = new Map([...this.reais, ...simulados].map((meio) => [meio.gateway.nome, meio]));
    const gateways = [...this.meios.values()].map((meio) => meio.gateway);

    this.recargas = montarRecarga({ gateways, financeiro, usuarios, geradorId }).controller;

    // A saída de texto do chat não é usada aqui: a página lê as mensagens exibidas.
    this.chat = new Chat(() => {});
    this.doacoes = montarDoacao({ financeiro, notificadorChat: this.chat, usuarios, geradorId }).controller;

    this.pedidos = new Map();
    this.ultimoAviso = new Map();
    this.mensagens = [];
    this.notificacoes = [];
  }

  /**
   * Conecta o Mercado Pago e o Stripe reais, se o .env tiver credenciais de teste.
   * Devolve uma linha por processador, para o servidor mostrar no terminal.
   */
  async conectarProcessadoresReais(): Promise<string[]> {
    const linhas: string[] = [];
    this.reais = [];
    for (const processador of Object.values(PROCESSADORES_REAIS)) {
      try {
        const conexao = await processador.conectar();
        if ("erro" in conexao) {
          linhas.push(`${processador.titulo}: não usado (${conexao.erro})`);
          continue;
        }
        this.reais.push({ gateway: conexao.gateway, segredo: conexao.segredoWebhook, comoPagar: conexao.comoPagar });
        linhas.push(`${processador.titulo}: conectado (${conexao.descricao})`);
      } catch (erro) {
        linhas.push(`${processador.titulo}: não foi possível conectar (${erro instanceof Error ? erro.message : erro})`);
      }
    }
    this.reiniciar();
    return linhas;
  }

  estado() {
    return {
      espectador: { nome: this.espectador.nome, moedas: this.espectador.carteira.saldoMoedaVirtual },
      canais: [this.criador, this.iniciante].map((canal) => ({
        id: canal.id,
        nome: canal.nome,
        monetizado: canal.perfil.estaHabilitadoAReceber(),
        saldo: canal.carteira.saldoDinheiro.formatar(),
      })),
      meios: [...this.meios].map(([nome, meio]) => ({
        nome,
        real: !meio.simulador,
        online: meio.simulador?.online ?? true,
      })),
      pedido: this.pedidoAtual(),
      faixas: [FaixaDestaque.FAIXA_1, FaixaDestaque.FAIXA_2, FaixaDestaque.FAIXA_3, FaixaDestaque.FAIXA_4, FaixaDestaque.FAIXA_5],
      mensagens: this.mensagens,
      notificacoes: [...this.notificacoes].reverse(),
      agora: Date.now(),
    };
  }

  /** Pacotes com o preço calculado pela cadeia de decoradores da F1, e o desconto e o imposto aplicados. */
  ofertas() {
    return {
      descontoPercentual: CONFIGURACAO_PRECO.descontoPercentual,
      aliquotaImposto: CONFIGURACAO_PRECO.aliquotaImposto,
      pacotes: this.recargas.consultarOfertas(this.espectador.id).map((oferta) => ({
        id: oferta.pacote.id,
        moedas: oferta.pacote.quantidadeMoedaVirtual,
        precoOriginal: oferta.precoOriginal.formatar(),
        precoPromocional: oferta.precoPromocional.formatar(),
      })),
    };
  }

  /** Tira do ar (ou volta) um processador simulado, para mostrar o Adapter avisando que o meio caiu. */
  alternarMeio(nome: string): void {
    const simulador = this.meios.get(nome)?.simulador;
    if (!simulador) throw new ErroDaAcao(`Só os meios simulados podem ser tirados do ar: ${nome}`);
    simulador.online = !simulador.online;
  }

  /** Cria o pedido de recarga: preço pela cadeia de decoradores e checkout pelo adaptador do meio escolhido. */
  async comprar(pacoteId: string, meio: string): Promise<void> {
    try {
      const recarga = await this.recargas.recarregar(
        this.espectador.id,
        pacoteId,
        MetodoRecarga.PROCESSADOR_EXTERNO,
        meio,
      );
      this.pedidos.set(recarga.id, recarga);
    } catch (erro) {
      if (erro instanceof ErroMeioPagamentoIndisponivel) throw new ErroDaAcao(erro.message);
      throw erro;
    }
  }

  /**
   * Consulta o pagamento no processador e, se aprovado, envia o aviso assinado pelo Proxy.
   * Nos simulados, antes aprova o pagamento, como se o espectador tivesse pago.
   * Nos reais, o espectador paga no link do checkout; como o processador não alcança
   * o localhost para chamar o webhook, o aviso é montado aqui, igual ao demo interativo da F1.
   */
  async verificarPagamento(recargaId: string): Promise<void> {
    const { recarga, meio } = this.pedido(recargaId);
    meio.simulador?.aprovar(recarga.idCheckout!);
    let situacao;
    try {
      situacao = await meio.gateway.consultarPagamento(recarga.idCheckout!);
    } catch (erro) {
      throw new ErroDaAcao(`Não foi possível consultar o ${meio.gateway.nome}: ${erro instanceof Error ? erro.message : erro}`);
    }
    if (situacao.status === StatusPagamento.APROVADO) {
      await this.avisar(recarga, meio.segredo);
      return;
    }
    this.ultimoAviso.set(
      recarga.id,
      situacao.status === StatusPagamento.RECUSADO
        ? `Pagamento recusado pelo ${meio.gateway.nome}.`
        : `Pagamento ainda não feito no ${meio.gateway.nome}.`,
    );
  }

  /**
   * Doação pela Facade da F2. Com mensagem, usa a doação com mensagem destacada, que
   * notifica o chat da F3 (mínimo de 200 moedas, pela faixa). Sem mensagem, usa a doação
   * simples, que não passa pelo chat e aceita qualquer quantidade.
   */
  doar(canalId: string, quantidade: number, mensagem: string): void {
    if (mensagem.trim() === "") {
      const { doacao } = this.executarDoacao(() => this.doacoes.doar(this.espectador.id, canalId, quantidade));
      this.notificarCriador(doacao);
      return;
    }

    const resultado = this.executarDoacao(() =>
      this.doacoes.doarComMensagem(this.espectador.id, canalId, quantidade, mensagem),
    );

    // A página aplica o que a pilha de decoradores da F3 devolveu: a cor e o tempo de fixação.
    const exibida = this.chat.mensagensExibidas().at(-1);
    if (resultado.notificacaoChatEnviada && exibida) {
      const minutos = exibida.tempoFixacaoMin();
      const agora = Date.now();
      this.mensagens.push({
        tipo: "destacada",
        id: resultado.doacao.id,
        autor: resultado.doacao.doador.nome,
        quantidade: resultado.doacao.quantidadeMoedaVirtual,
        texto: exibida.texto(),
        cor: exibida.cor(),
        exibidaEm: agora,
        fixadaAte: minutos > 0 ? agora + minutos * 60_000 : null,
      });
    }

    this.notificarCriador(resultado.doacao);
  }

  /** Executa a doação na F2, trazendo as recusas de regra de negócio para a página. */
  private executarDoacao<T>(doacao: () => T): T {
    try {
      return doacao();
    } catch (erro) {
      throw new ErroDaAcao(erro instanceof Error ? erro.message : String(erro));
    }
  }

  /** Registra a doação concluída no painel de notificações do criador. */
  private notificarCriador(doacao: Doacao): void {
    this.notificacoes.push({
      autor: doacao.doador.nome,
      canal: doacao.criador.nome,
      quantidade: doacao.quantidadeMoedaVirtual,
      repasse: doacao.valorRepasse.formatar(),
      em: Date.now(),
    });
  }

  /** Mensagem comum, escrita direto no chat, sem doação. */
  escrever(texto: string): void {
    const limpo = texto.trim();
    if (limpo === "") throw new ErroDaAcao("Escreva uma mensagem.");
    if (Array.from(limpo).length > LIMITE_MENSAGEM_COMUM) {
      throw new ErroDaAcao(`A mensagem passa de ${LIMITE_MENSAGEM_COMUM} caracteres.`);
    }
    this.mensagens.push({ tipo: "comum", autor: this.espectador.nome, texto: limpo });
  }

  /** Último pedido de recarga, que é o único que a página mostra. */
  private pedidoAtual() {
    const recarga = [...this.pedidos.values()].at(-1);
    if (!recarga) return null;
    const meio = recarga.gatewayUtilizado ? this.meios.get(recarga.gatewayUtilizado) : undefined;
    const real = Boolean(meio && !meio.simulador);
    return {
      id: recarga.id,
      moedas: recarga.quantidadeMoedaVirtual,
      valor: recarga.valor.formatar(),
      meio: recarga.gatewayUtilizado ?? "",
      status: recarga.status,
      real,
      link: real ? (recarga.instrucoesPagamento ?? "") : "",
      comoPagar: meio?.comoPagar ?? "",
      aviso: this.ultimoAviso.get(recarga.id) ?? "",
    };
  }

  /** Envia o aviso de pagamento assinado, que passa pelo Proxy da F1 antes de creditar. */
  private async avisar(recarga: Recarga, segredo: string): Promise<void> {
    const dados = {
      idEvento: `ev-${++this.sequenciaAviso}`,
      idPagamento: recarga.idCheckout!,
      recargaId: recarga.id,
    };
    const aviso: NotificacaoPagamento = { ...dados, assinatura: assinarNotificacao(segredo, dados) };
    const resultado = await this.recargas.receberWebhook(recarga.gatewayUtilizado!, aviso);
    if (resultado.efeito === EfeitoConfirmacao.CREDITADO) this.ultimoAviso.delete(recarga.id);
    else this.ultimoAviso.set(recarga.id, `O pagamento não foi confirmado (${resultado.motivo}).`);
  }

  private pedido(recargaId: string): { recarga: Recarga; meio: MeioPagamento } {
    const recarga = this.pedidos.get(recargaId);
    const meio = recarga?.gatewayUtilizado ? this.meios.get(recarga.gatewayUtilizado) : undefined;
    if (!recarga || !meio || !recarga.idCheckout) throw new ErroDaAcao(`Pedido de recarga inexistente: ${recargaId}`);
    return { recarga, meio };
  }
}
