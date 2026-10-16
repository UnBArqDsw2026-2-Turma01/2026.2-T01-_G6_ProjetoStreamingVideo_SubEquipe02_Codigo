/**
 * Conexão dos demos com processadores REAIS em modo de teste (Mercado Pago e Stripe).
 * Lê as credenciais do .env e recusa credenciais de produção, a menos que
 * PERMITIR_PRODUCAO=1. Compartilhado por f1-pagamento-real.ts e f1-interativo.ts.
 */
import { MercadoPagoConfig, User } from "mercadopago";
import { existsSync } from "node:fs";
import { AdaptadorMercadoPago, AdaptadorStripe, type GatewayPagamento } from "../f1-recarga";

// Carrega automaticamente o arquivo .env se existir
if (existsSync(".env") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

const PERMITIR_PRODUCAO = process.env.PERMITIR_PRODUCAO === "1";

export interface ProcessadorConectado {
  readonly gateway: GatewayPagamento;
  /** Segredo usado para assinar o aviso simulado que passa pelo Proxy. */
  readonly segredoWebhook: string;
  readonly comoPagar: string;
  /** Descrição da conta ou da chave usada. */
  readonly descricao: string;
  /** Credencial de teste: nenhum dinheiro real envolvido. */
  readonly teste: boolean;
}

/** Resultado da conexão: o processador pronto, ou o motivo de não poder usá-lo. */
export type Conexao = ProcessadorConectado | { readonly erro: string };

export interface ProcessadorReal {
  readonly titulo: string;
  conectar(): Promise<Conexao>;
}

function verificarModo(teste: boolean, descricaoProducao: string): string | undefined {
  if (teste || PERMITIR_PRODUCAO) return undefined;
  return `${descricaoProducao}: o link geraria cobrança de verdade. (Para forçar: PERMITIR_PRODUCAO=1)`;
}

export const PROCESSADORES_REAIS: Record<string, ProcessadorReal> = {
  mercadopago: {
    titulo: "Mercado Pago (Checkout Pro)",
    async conectar() {
      const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
      if (!token) {
        return {
          erro:
            "MERCADO_PAGO_ACCESS_TOKEN não configurado no .env. Use o access token do VENDEDOR de teste: " +
            "https://www.mercadopago.com.br/developers/panel/test-users",
        };
      }
      // Quem decide teste x produção é a conta dona do token: usuários de teste têm apelido TESTUSER...
      const conta = await new User(new MercadoPagoConfig({ accessToken: token })).get();
      const teste = token.startsWith("TEST-") || (conta.nickname ?? "").toUpperCase().startsWith("TESTUSER");
      const erro = verificarModo(teste, "Este token é da sua conta REAL do Mercado Pago (use o do vendedor de teste)");
      if (erro) return { erro };
      const segredoWebhook = process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "segredo-local-mp";
      return {
        gateway: AdaptadorMercadoPago.conectar(token, segredoWebhook),
        segredoWebhook,
        comoPagar: "abra em aba anônima e entre com o COMPRADOR de teste",
        descricao: `conta ${conta.nickname}`,
        teste,
      };
    },
  },
  stripe: {
    titulo: "Stripe (Checkout Session)",
    async conectar() {
      const chave = process.env.STRIPE_SECRET_KEY?.trim();
      if (!chave) {
        return {
          erro:
            "STRIPE_SECRET_KEY não configurada no .env. Use a chave secreta de TESTE (sk_test_...): " +
            "https://dashboard.stripe.com/test/apikeys",
        };
      }
      // No Stripe, o modo vem na própria chave: sk_test_/rk_test_ são de teste.
      const teste = /^(sk|rk)_test_/.test(chave);
      const erro = verificarModo(teste, "Esta é uma chave LIVE do Stripe (use a sk_test_)");
      if (erro) return { erro };
      const segredoWebhook = process.env.STRIPE_WEBHOOK_SECRET ?? "segredo-local-stripe";
      return {
        gateway: AdaptadorStripe.conectar(chave, segredoWebhook),
        segredoWebhook,
        comoPagar: "cartão 4242 4242 4242 4242, qualquer validade futura e qualquer CVC (ou Pix de teste)",
        descricao: `chave ${chave.slice(0, 8)}...`,
        teste,
      };
    },
  },
};
