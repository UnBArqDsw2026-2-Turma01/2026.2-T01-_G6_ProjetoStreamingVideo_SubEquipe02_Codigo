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

const aPartirDe = (reais: number, percentual: number) => ({ aPartirDe: Dinheiro.deReais(reais), percentual });

/**
 * Promoção vigente, aplicada pela cadeia de decoradores de preço: desconto
 * progressivo (pacotes maiores, desconto maior) e 5% de imposto.
 */
export const CONFIGURACAO_PRECO: ConfiguracaoPreco = {
  descontosProgressivos: [
    aPartirDe(5, 5), //       R$ 5 →   R$ 4,99 com imposto
    aPartirDe(10, 8), //     R$ 10 →   R$ 9,66
    aPartirDe(30, 12), //    R$ 30 →  R$ 27,72
    aPartirDe(50, 16), //    R$ 50 →  R$ 44,10
    aPartirDe(100, 20), //  R$ 100 →  R$ 84,00
    aPartirDe(300, 25), //  R$ 300 → R$ 236,25
    aPartirDe(500, 29), //  R$ 500 → R$ 372,75
    aPartirDe(1000, 33), // R$ 1000 → R$ 703,50
  ],
  aliquotaImposto: 5,
};

/**
 * Quanto o criador recebe em dinheiro por moeda doada (F2): R$ 0,02, fixo.
 * Fica abaixo do menor preço efetivo de venda (R$ 0,0251 no pacote de R$ 1000,
 * com bônus e promoção), para a plataforma nunca repassar mais do que recebeu.
 * Um teste do catálogo garante isso sempre que pacotes ou promoção mudarem.
 */
export const REPASSE_POR_MOEDA = Dinheiro.deCentavos(2);
