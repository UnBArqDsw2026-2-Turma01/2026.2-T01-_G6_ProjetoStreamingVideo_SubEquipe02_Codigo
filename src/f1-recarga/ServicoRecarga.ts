import type { GeradorId, RepositorioEmMemoria } from "../compartilhado";
import { ErroDominio, type Dinheiro, type Usuario } from "../dominio";
import type { ServicoFinanceiro } from "../financeiro";
import type { OfertaPacote, Pacote } from "./Pacote";
import {
  ErroGatewayIndisponivel,
  ErroMeioPagamentoIndisponivel,
  type GatewayPagamento,
  type SessaoCheckout,
} from "./pagamento";
import { ComDesconto, ComImposto, ComTaxaFixa, PrecoPacote, type Preco } from "./preco";
import { MetodoRecarga, Recarga } from "./Recarga";

/** Regras de preço ativas (parâmetros de configuração, Entrega 2). Todas opcionais; tudo em reais. */
export interface ConfiguracaoPreco {
  readonly descontoPercentual?: number;
  readonly taxaFixa?: Dinheiro;
  readonly aliquotaImposto?: number;
}

/**
 * Serviço de aplicação da recarga. Cliente do Decorator (monta o preço)
 * e do Adapter (cria o checkout no meio escolhido pelo espectador ou,
 * sem escolha, no primeiro gateway disponível).
 */
export class ServicoRecarga {
  private readonly pacotes: readonly Pacote[];
  private readonly configuracaoPreco: ConfiguracaoPreco;
  private readonly gateways: readonly GatewayPagamento[];
  private readonly financeiro: ServicoFinanceiro;
  private readonly recargas: RepositorioEmMemoria<Recarga>;
  private readonly geradorId: GeradorId;

  constructor(dependencias: {
    pacotes: readonly Pacote[];
    configuracaoPreco: ConfiguracaoPreco;
    gateways: readonly GatewayPagamento[];
    financeiro: ServicoFinanceiro;
    recargas: RepositorioEmMemoria<Recarga>;
    geradorId: GeradorId;
  }) {
    this.pacotes = dependencias.pacotes;
    this.configuracaoPreco = dependencias.configuracaoPreco;
    this.gateways = dependencias.gateways;
    this.financeiro = dependencias.financeiro;
    this.recargas = dependencias.recargas;
    this.geradorId = dependencias.geradorId;
  }

  buscarPacote(pacoteId: string): Pacote {
    const pacote = this.pacotes.find((p) => p.id === pacoteId);
    if (!pacote) throw new ErroDominio(`Pacote inexistente: ${pacoteId}`);
    return pacote;
  }

  /**
   * Ofertas do modal de recarga: preço original (componente base) e
   * promocional (cadeia completa). O usuário fica no contrato para regras
   * futuras por espectador; hoje as regras são globais.
   */
  consultarOfertas(_usuario: Usuario): OfertaPacote[] {
    return this.pacotes.map((pacote) => {
      const preco = this.montarPreco(pacote);
      return {
        pacote,
        precoOriginal: new PrecoPacote(pacote).calcular(),
        precoPromocional: preco.calcular(),
        composicao: preco.descrever(),
      };
    });
  }

  /**
   * Monta a cadeia de decoradores em ordem fixa:
   * desconto → taxa fixa → imposto.
   * O tipo `Preco` não impede ordens inválidas; quem garante a ordem é este método.
   */
  montarPreco(pacote: Pacote): Preco {
    const { descontoPercentual, taxaFixa, aliquotaImposto } = this.configuracaoPreco;
    let preco: Preco = new PrecoPacote(pacote);
    if (descontoPercentual !== undefined) preco = new ComDesconto(preco, descontoPercentual);
    if (taxaFixa !== undefined) preco = new ComTaxaFixa(preco, taxaFixa);
    if (aliquotaImposto !== undefined) preco = new ComImposto(preco, aliquotaImposto);
    return preco;
  }

  /** Nomes dos meios de pagamento externos, na ordem de preferência do sistema, para o modal oferecer. */
  consultarMeiosPagamento(): string[] {
    return this.gateways.map((g) => g.nome);
  }

  /**
   * Cria a recarga com o preço recalculado no servidor (o valor exibido no
   * cliente não é confiável) e a encaminha pelo método escolhido.
   *
   * Com `gatewayEscolhido`, usa só o meio que o espectador escolheu; se ele estiver
   * indisponível, cancela a recarga e lança `ErroMeioPagamentoIndisponivel` com as
   * alternativas (O07). Sem escolha, o sistema tenta os gateways em ordem.
   *
   * Quando não lança, devolve a recarga em um destes estados:
   * - CONCLUIDA: paga com saldo do criador;
   * - PENDENTE: checkout criado, aguardando o aviso do processador;
   * - CANCELADA: saldo insuficiente ou nenhum gateway disponível (ver `motivoCancelamento`).
   */
  async processarRecarga(
    usuario: Usuario,
    pacote: Pacote,
    metodo: MetodoRecarga,
    gatewayEscolhido?: string,
  ): Promise<Recarga> {
    const escolhido = gatewayEscolhido === undefined ? undefined : this.buscarGateway(gatewayEscolhido);
    const preco = this.montarPreco(pacote);
    const recarga = new Recarga(
      this.geradorId.proximo("recarga"),
      usuario,
      pacote.quantidadeMoedaVirtual,
      preco.calcular(),
      preco.descrever(),
      metodo,
    );
    this.recargas.salvar(recarga);

    if (metodo === MetodoRecarga.SALDO_DO_CRIADOR) {
      this.pagarComSaldo(recarga);
    } else if (escolhido) {
      await this.iniciarCheckoutNoEscolhido(recarga, escolhido);
    } else {
      await this.iniciarCheckoutComFallback(recarga);
    }
    return recarga;
  }

  private buscarGateway(nome: string): GatewayPagamento {
    const gateway = this.gateways.find((g) => g.nome === nome);
    if (!gateway) throw new ErroDominio(`Meio de pagamento inexistente: ${nome}`);
    return gateway;
  }

  private pagarComSaldo(recarga: Recarga): void {
    const ok = this.financeiro.recarregarComSaldo(recarga.usuario, recarga.valor, recarga.quantidadeMoedaVirtual);
    if (!ok) {
      recarga.cancelarComMotivo("saldo em dinheiro insuficiente");
      return;
    }
    recarga.concluir();
    recarga.usuario.carteira.registrarTransacao(recarga);
  }

  /** Escolha do espectador: não troca de processador sem perguntar; devolve as alternativas. */
  private async iniciarCheckoutNoEscolhido(recarga: Recarga, gateway: GatewayPagamento): Promise<void> {
    try {
      const sessao = await gateway.iniciarCheckout(recarga.valor, recarga.id);
      recarga.registrarCheckout(gateway.nome, sessao.idCheckout, sessao.instrucoes);
    } catch (erro) {
      if (!(erro instanceof ErroGatewayIndisponivel)) {
        recarga.cancelarComMotivo(`falha no gateway ${gateway.nome}`);
        throw erro;
      }
      recarga.cancelarComMotivo(`${gateway.nome} indisponível`);
      const alternativas = this.gateways.filter((g) => g !== gateway).map((g) => g.nome);
      throw new ErroMeioPagamentoIndisponivel(gateway.nome, alternativas);
    }
  }

  /** Fallback (O07): tenta cada gateway em ordem; só indisponibilidade passa para o próximo. */
  private async iniciarCheckoutComFallback(recarga: Recarga): Promise<void> {
    const indisponiveis: string[] = [];
    for (const gateway of this.gateways) {
      let sessao: SessaoCheckout;
      try {
        sessao = await gateway.iniciarCheckout(recarga.valor, recarga.id);
      } catch (erro) {
        if (!(erro instanceof ErroGatewayIndisponivel)) {
          recarga.cancelarComMotivo(`falha no gateway ${gateway.nome}`);
          throw erro;
        }
        indisponiveis.push(gateway.nome);
        continue;
      }
      recarga.registrarCheckout(gateway.nome, sessao.idCheckout, sessao.instrucoes);
      return;
    }
    recarga.cancelarComMotivo(`nenhum gateway disponível (${indisponiveis.join(", ")})`);
  }
}
