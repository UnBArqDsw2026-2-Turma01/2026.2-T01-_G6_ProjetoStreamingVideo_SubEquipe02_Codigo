import type { Dinheiro, Usuario } from "../dominio";

/**
 * Serviço financeiro compartilhado (Entrega 2, pacote "Financeiro").
 *
 * Única porta de entrada para movimentar saldos de carteiras. Não conhece regras
 * de negócio de nenhuma frente: apenas garante que cada operação seja atômica —
 * ou acontece por inteiro, ou não acontece.
 *
 * - F1 (Recarga) usa `creditarMoedaVirtual` após a confirmação do pagamento e
 *   `recarregarComSaldo` quando o criador paga a recarga com o próprio saldo em dinheiro.
 * - F2 (Doação) usa `transferirDoacao` para debitar o doador e repassar ao criador.
 */
export class ServicoFinanceiro {
  creditarMoedaVirtual(usuario: Usuario, quantidade: number): void {
    usuario.carteira.adicionarMoedaVirtual(quantidade);
  }

  /**
   * Recarga paga com o saldo em dinheiro do próprio usuário (Entrega 2, SQ08).
   * Debita o dinheiro e credita a moeda virtual na mesma operação.
   * Retorna `false`, sem alterar nenhum saldo, se o saldo em dinheiro for insuficiente.
   * Se o crédito da moeda virtual falhar, o débito é desfeito (rollback).
   */
  recarregarComSaldo(usuario: Usuario, valor: Dinheiro, quantidadeMoedaVirtual: number): boolean {
    if (!usuario.carteira.deduzirDinheiro(valor)) {
      return false;
    }
    try {
      usuario.carteira.adicionarMoedaVirtual(quantidadeMoedaVirtual);
    } catch (erro) {
      usuario.carteira.adicionarDinheiro(valor);
      throw erro;
    }
    return true;
  }

  /**
   * Debita moeda virtual da origem e credita o valor de repasse em dinheiro no destino.
   * Retorna `false`, sem alterar nenhum saldo, se a origem não tiver saldo suficiente.
   * Se o crédito no destino falhar, o débito na origem é desfeito (rollback).
   */
  transferirDoacao(
    origem: Usuario,
    destino: Usuario,
    quantidadeMoedaVirtual: number,
    valorRepasse: Dinheiro,
  ): boolean {
    if (!origem.carteira.deduzirMoedaVirtual(quantidadeMoedaVirtual)) {
      return false;
    }
    try {
      destino.carteira.adicionarDinheiro(valorRepasse);
    } catch (erro) {
      origem.carteira.adicionarMoedaVirtual(quantidadeMoedaVirtual);
      throw erro;
    }
    return true;
  }

  consultarSaldos(usuario: Usuario): { moedaVirtual: number; dinheiro: Dinheiro } {
    return {
      moedaVirtual: usuario.carteira.saldoMoedaVirtual,
      dinheiro: usuario.carteira.saldoDinheiro,
    };
  }
}
