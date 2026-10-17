import { Dinheiro } from "../dominio";
import type { Pacote } from "./Pacote";
import type { ConfiguracaoPreco } from "./ServicoRecarga";

/**
 * Catálogo de recarga da plataforma: mesmos pacotes e mesma promoção para
 * qualquer meio de pagamento (Mercado Pago, Stripe, saldo em carteira...).
 * Os gateways só recebem o valor final; nunca conhecem pacotes nem moedas.
 */

/** Taxa base: 20 de moeda virtual por R$ 1 (R$ 0,05 cada). Pacotes maiores ganham bônus progressivo. */
export const MOEDAS_POR_REAL = 20;

const pacote = (reais: number, bonusPercentual: number): Pacote => ({
  id: `p${reais}`,
  quantidadeMoedaVirtual: Math.round(reais * MOEDAS_POR_REAL * (1 + bonusPercentual / 100)),
  valorBase: Dinheiro.deReais(reais),
});

export const PACOTES: readonly Pacote[] = [
  pacote(5, 0), //       100 · R$ 0,0500 cada
  pacote(10, 5), //      210 · R$ 0,0476 cada
  pacote(30, 10), //     660 · R$ 0,0455 cada
  pacote(50, 15), //   1.150 · R$ 0,0435 cada
  pacote(100, 20), //  2.400 · R$ 0,0417 cada
  pacote(300, 25), //  7.500 · R$ 0,0400 cada
  pacote(500, 30), // 13.000 · R$ 0,0385 cada
  pacote(1000, 40), // 28.000 · R$ 0,0357 cada
];

/** Promoção vigente, aplicada pela cadeia de decoradores de preço. */
export const CONFIGURACAO_PRECO: ConfiguracaoPreco = { descontoPercentual: 29, aliquotaImposto: 5 };
