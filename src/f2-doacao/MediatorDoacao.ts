import type { GeradorId, RepositorioEmMemoria } from "../compartilhado";
import { ErroDominio, type Usuario } from "../dominio";
import type { ServicoFinanceiro } from "../financeiro";
import { Doacao } from "./Doacao";

/** Resultado da doação simples (sem mensagem no chat). */
export interface ResultadoDoacaoSimples {
  readonly doacao: Doacao;
}

/**
 * Mediator da doação simples (Padrão GoF: Mediator).
 * Orquestra validação, criação de Doacao e transferência via ServicoFinanceiro.
 */
export class MediatorDoacao {
  constructor(
    private readonly servicoFinanceiro: ServicoFinanceiro,
    private readonly repositorioDoacoes: RepositorioEmMemoria<Doacao>,
    private readonly geradorId: GeradorId,
  ) {}

  processar(
    doador: Usuario,
    criador: Usuario,
    quantidadeMoedaVirtual: number,
  ): ResultadoDoacaoSimples {
    this.validarPartes(doador, criador);

    const doacao = new Doacao(
      this.geradorId.proximo("doacao"),
      doador,
      criador,
      quantidadeMoedaVirtual,
    );

    this.transferirOuFalhar(doador, criador, doacao);

    doacao.concluir();
    doador.carteira.registrarTransacao(doacao);
    criador.carteira.registrarTransacao(doacao);
    this.repositorioDoacoes.salvar(doacao);

    return { doacao };
  }

  private validarPartes(doador: Usuario, criador: Usuario): void {
    if (!criador.perfil.estaHabilitadoAReceber()) {
      throw new ErroDominio(`O criador "${criador.nome}" não está habilitado a receber doações.`);
    }
    if (doador.id === criador.id) {
      throw new ErroDominio("Um usuário não pode doar para o próprio canal.");
    }
  }

  private transferirOuFalhar(doador: Usuario, criador: Usuario, doacao: Doacao): void {
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
