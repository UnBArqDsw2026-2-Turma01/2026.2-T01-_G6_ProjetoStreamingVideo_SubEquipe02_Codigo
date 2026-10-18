import { GeradorId, RepositorioEmMemoria } from "../compartilhado";
import { Usuario } from "../dominio";
import { ServicoFinanceiro } from "../financeiro";
import {
  AdaptadorProcessadorSimulado,
  ErroMeioPagamentoIndisponivel,
  MetodoRecarga,
  ProcessadorSimulado,
  assinarNotificacao,
  montarRecarga,
  type NotificacaoPagamento,
  type Recarga,
  type RecargaController,
} from "../f1-recarga";
import { FaixaDestaque, montarDoacao, type DoacaoController } from "../f2-doacao";
import { Chat } from "../f3-chat";

/** Mensagem como a página exibe no chat: comum (escrita no chat) ou destacada (vinda de uma doação). */
export type MensagemNoChat =
  | { readonly tipo: "comum"; readonly autor: string; readonly texto: string }
  | {
      readonly tipo: "destacada";
      readonly cor: string;
      readonly cabecalho: string;
      readonly texto: string;
      readonly fixacaoMin: number;
    };

/** Tamanho máximo de uma mensagem comum do chat. */
const LIMITE_MENSAGEM_COMUM = 200;

/** Erro de regra de negócio ou de meio de pagamento que a página mostra ao usuário. */
export class ErroDaAcao extends Error {}

interface MeioSimulado {
  readonly processador: ProcessadorSimulado;
  readonly segredo: string;
}

/**
 * Estado da demonstração web: as três frentes montadas com o mesmo código das
 * demos de terminal, ligadas entre si, em memória.
 *
 * O pagamento usa processadores simulados da F1, porque os reais precisam de
 * credenciais e de uma URL pública para receber o aviso de pagamento.
 */
export class SessaoDemo {
  private espectador!: Usuario;
  private criador!: Usuario;
  private iniciante!: Usuario;
  private recargas!: RecargaController;
  private doacoes!: DoacaoController;
  private chat!: Chat;
  private meios!: Map<string, MeioSimulado>;
  private pedidos!: Map<string, Recarga>;
  private mensagens!: MensagemNoChat[];
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

    this.meios = new Map([
      ["Simulado-A", { processador: new ProcessadorSimulado(), segredo: "segredo-a" }],
      ["Simulado-B", { processador: new ProcessadorSimulado(), segredo: "segredo-b" }],
    ]);
    const gateways = [...this.meios].map(
      ([nome, meio]) => new AdaptadorProcessadorSimulado(meio.processador, meio.segredo, nome),
    );

    this.recargas = montarRecarga({ gateways, financeiro, usuarios, geradorId }).controller;

    // A saída de texto do chat não é usada aqui: a página lê as mensagens exibidas.
    this.chat = new Chat(() => {});
    this.doacoes = montarDoacao({ financeiro, notificadorChat: this.chat, usuarios, geradorId }).controller;

    this.pedidos = new Map();
    this.ultimoAviso = new Map();
    this.mensagens = [];
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
      meios: [...this.meios].map(([nome, meio]) => ({ nome, online: meio.processador.online })),
      pedidos: [...this.pedidos.values()].reverse().map((r) => ({
        id: r.id,
        moedas: r.quantidadeMoedaVirtual,
        valor: r.valor.formatar(),
        meio: r.gatewayUtilizado ?? "",
        status: r.status,
        aviso: this.ultimoAviso.get(r.id) ?? "",
      })),
      faixas: [FaixaDestaque.FAIXA_1, FaixaDestaque.FAIXA_2, FaixaDestaque.FAIXA_3, FaixaDestaque.FAIXA_4, FaixaDestaque.FAIXA_5],
      mensagens: this.mensagens,
    };
  }

  ofertas() {
    return this.recargas.consultarOfertas(this.espectador.id).map((oferta) => ({
      id: oferta.pacote.id,
      moedas: oferta.pacote.quantidadeMoedaVirtual,
      precoOriginal: oferta.precoOriginal.formatar(),
      precoPromocional: oferta.precoPromocional.formatar(),
      composicao: oferta.composicao,
    }));
  }

  alternarMeio(nome: string): void {
    const meio = this.meios.get(nome);
    if (!meio) throw new ErroDaAcao(`Meio de pagamento desconhecido: ${nome}`);
    meio.processador.online = !meio.processador.online;
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

  /** Simula o espectador pagando no processador; o aviso de pagamento passa pelo Proxy. */
  async pagar(recargaId: string): Promise<void> {
    const { recarga, meio } = this.pedido(recargaId);
    meio.processador.aprovar(recarga.idCheckout!);
    await this.avisar(recarga, meio.segredo, "Aviso de pagamento");
  }

  /** Reenvia um aviso legítimo do mesmo pagamento, como o processador faz quando não recebe resposta (O11). */
  async reenviarAviso(recargaId: string): Promise<void> {
    const { recarga, meio } = this.pedido(recargaId);
    await this.avisar(recarga, meio.segredo, "Reenvio do aviso");
  }

  /** Envia um aviso com assinatura falsa, como faria alguém tentando creditar moedas sem pagar (O14). */
  async avisoFalso(recargaId: string): Promise<void> {
    const { recarga } = this.pedido(recargaId);
    await this.avisar(recarga, "segredo-de-quem-tenta-fraudar", "Aviso falsificado");
  }

  /** Doação com mensagem pela Facade da F2, que notifica o chat da F3 e faz o repasse. */
  doar(canalId: string, quantidade: number, mensagem: string): void {
    let resultado;
    try {
      resultado = this.doacoes.doarComMensagem(this.espectador.id, canalId, quantidade, mensagem);
    } catch (erro) {
      throw new ErroDaAcao(erro instanceof Error ? erro.message : String(erro));
    }

    const exibida = this.chat.mensagensExibidas().at(-1);
    if (resultado.notificacaoChatEnviada && exibida) {
      this.mensagens.push({
        tipo: "destacada",
        cor: resultado.doacao.faixa.cor,
        cabecalho: exibida.cabecalho(),
        texto: exibida.texto(),
        fixacaoMin: exibida.tempoFixacaoMin(),
      });
    }
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

  private async avisar(recarga: Recarga, segredo: string, descricao: string): Promise<void> {
    const dados = {
      idEvento: `ev-${++this.sequenciaAviso}`,
      idPagamento: recarga.idCheckout!,
      recargaId: recarga.id,
    };
    const aviso: NotificacaoPagamento = { ...dados, assinatura: assinarNotificacao(segredo, dados) };
    const resultado = await this.recargas.receberWebhook(recarga.gatewayUtilizado!, aviso);
    this.ultimoAviso.set(recarga.id, `${descricao}: ${resultado.efeito} (${resultado.motivo})`);
  }

  private pedido(recargaId: string): { recarga: Recarga; meio: MeioSimulado } {
    const recarga = this.pedidos.get(recargaId);
    const meio = recarga?.gatewayUtilizado ? this.meios.get(recarga.gatewayUtilizado) : undefined;
    if (!recarga || !meio || !recarga.idCheckout) throw new ErroDaAcao(`Pedido de recarga inexistente: ${recargaId}`);
    return { recarga, meio };
  }
}
