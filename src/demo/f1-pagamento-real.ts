/**
 * Demonstração da F1 com um processador REAL, em modo de TESTE:
 * Mercado Pago (Checkout Pro) ou Stripe (Checkout Session).
 *
 * Cria o checkout, imprime o link de pagamento e monitora até a confirmação
 * e o crédito das moedas virtuais. Recusa credenciais de produção, a menos
 * que PERMITIR_PRODUCAO=1.
 *
 * Executar: npx tsx src/demo/f1-pagamento-real.ts mercadopago|stripe
 */
import { MercadoPagoConfig, User } from "mercadopago";
import { existsSync } from "node:fs";
import { RepositorioEmMemoria } from "../compartilhado";
import { Usuario } from "../dominio";
import { ServicoFinanceiro } from "../financeiro";
import {
  AdaptadorMercadoPago,
  AdaptadorStripe,
  CONFIGURACAO_PRECO,
  MetodoRecarga,
  StatusPagamento,
  assinarNotificacao,
  montarRecarga,
  type GatewayPagamento,
} from "../f1-recarga";

// Carrega automaticamente o arquivo .env se existir
if (existsSync(".env") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

const PERMITIR_PRODUCAO = process.env.PERMITIR_PRODUCAO === "1";

/** O que muda de um processador para outro; o resto do fluxo é igual para todos. */
interface ProcessadorReal {
  readonly titulo: string;
  readonly comoPagar: string;
  readonly segredoWebhook: string;
  /** Confere as credenciais e devolve o gateway, ou encerra explicando o que falta. */
  conectar(): Promise<GatewayPagamento>;
}

function falhar(...linhas: string[]): never {
  for (const linha of linhas) console.error(linha);
  process.exit(1);
}

function avisarModo(teste: boolean, descricaoProducao: string): void {
  if (!teste && !PERMITIR_PRODUCAO) {
    falhar(
      `\n❌ ${descricaoProducao}: o link geraria cobrança de verdade.`,
      "(Para rodar em produção mesmo assim: PERMITIR_PRODUCAO=1)",
    );
  }
  console.log(teste ? "🧪 Modo teste: nenhum dinheiro real envolvido.\n" : "⚠️  PRODUÇÃO: cobrança real!\n");
}

const PROCESSADORES: Record<string, ProcessadorReal> = {
  mercadopago: {
    titulo: "Mercado Pago (Checkout Pro)",
    comoPagar: "abra em aba anônima e entre com o COMPRADOR de teste",
    segredoWebhook: process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "segredo-local-mp",
    async conectar() {
      const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
      if (!token) {
        falhar(
          "❌ MERCADO_PAGO_ACCESS_TOKEN não configurado no .env.",
          "Use o access token do VENDEDOR de teste: https://www.mercadopago.com.br/developers/panel/test-users",
        );
      }
      // Quem decide teste x produção é a conta dona do token: usuários de teste têm apelido TESTUSER...
      const conta = await new User(new MercadoPagoConfig({ accessToken: token })).get();
      console.log(`Conta do token: ${conta.nickname} (id ${conta.id})`);
      const teste = token.startsWith("TEST-") || (conta.nickname ?? "").toUpperCase().startsWith("TESTUSER");
      avisarModo(teste, "Este token é da sua conta REAL do Mercado Pago (use o do vendedor de teste)");
      return AdaptadorMercadoPago.conectar(token, this.segredoWebhook);
    },
  },
  stripe: {
    titulo: "Stripe (Checkout Session)",
    comoPagar: "cartão 4242 4242 4242 4242, qualquer validade futura e qualquer CVC",
    segredoWebhook: process.env.STRIPE_WEBHOOK_SECRET ?? "segredo-local-stripe",
    async conectar() {
      const chave = process.env.STRIPE_SECRET_KEY?.trim();
      if (!chave) {
        falhar(
          "❌ STRIPE_SECRET_KEY não configurada no .env.",
          "Use a chave secreta de TESTE (sk_test_...): https://dashboard.stripe.com/test/apikeys",
        );
      }
      // No Stripe, o modo vem na própria chave: sk_test_/rk_test_ são de teste.
      const teste = /^(sk|rk)_test_/.test(chave);
      console.log(`Chave do Stripe: ${chave.slice(0, 8)}...`);
      avisarModo(teste, "Esta é uma chave LIVE do Stripe (use a sk_test_)");
      return AdaptadorStripe.conectar(chave, this.segredoWebhook);
    },
  },
};

async function executar(): Promise<void> {
  const nome = process.argv[2] ?? "";
  const processador = PROCESSADORES[nome];
  if (!processador) {
    falhar(`Uso: npx tsx src/demo/f1-pagamento-real.ts <${Object.keys(PROCESSADORES).join("|")}>`);
  }

  console.log("=========================================================");
  console.log(`=== F1 · Recarga real com ${processador.titulo}`);
  console.log("=========================================================\n");

  const gateway = await processador.conectar();

  const espectador = new Usuario("usuario-real", "Daví (Espectador)", "davi@exemplo.com");
  const usuarios = new RepositorioEmMemoria<Usuario>();
  usuarios.salvar(espectador);

  const { controller } = montarRecarga({ gateways: [gateway], financeiro: new ServicoFinanceiro(), usuarios });

  console.log(
    `1. [Decorator] Consultando ofertas com desconto (${CONFIGURACAO_PRECO.descontoPercentual}%) e imposto (${CONFIGURACAO_PRECO.aliquotaImposto}%):`,
  );
  for (const oferta of controller.consultarOfertas(espectador.id)) {
    console.log(
      `   • Pacote de ${oferta.pacote.quantidadeMoedaVirtual} moedas: de ${oferta.precoOriginal.formatar()} por ${oferta.precoPromocional.formatar()}`,
    );
    console.log(`     Composição: ${oferta.composicao}`);
  }

  console.log(`\n2. [Adapter] Criando checkout no ${gateway.nome}...`);
  const recarga = await controller.recarregar(espectador.id, "p10", MetodoRecarga.PROCESSADOR_EXTERNO);
  const idCheckout = recarga.idCheckout!;

  console.log(`   ✅ Checkout criado!`);
  console.log(`   • ID da Recarga (sistema): ${recarga.id}`);
  console.log(`   • ID do checkout (${gateway.nome}): ${idCheckout}`);
  console.log(`   • Valor total: ${recarga.valor.formatar()}`);
  console.log(`   • Status: ${recarga.status}`);

  console.log(`\n---------------------------------------------------------`);
  console.log(`🔗 LINK DE PAGAMENTO (${processador.comoPagar}):`);
  console.log(`---------------------------------------------------------`);
  console.log(recarga.instrucoesPagamento);
  console.log(`---------------------------------------------------------\n`);

  console.log(`⏳ Aguardando confirmação do pagamento pelo ${gateway.nome}...`);
  console.log("   (Por até 5 minutos. Pressione Ctrl+C para encerrar)\n");

  // Só para o demo: em produção quem avisa é o webhook, sem ninguém consultando em laço.
  const INTERVALO_MS = 5000;
  const LIMITE_MS = 5 * 60 * 1000;
  const inicio = Date.now();
  while (Date.now() - inicio < LIMITE_MS) {
    await new Promise((resolve) => setTimeout(resolve, INTERVALO_MS));

    const consulta = await gateway.consultarPagamento(idCheckout);
    const decorrido = Math.round((Date.now() - inicio) / 1000);
    process.stdout.write(`\r   Status no ${gateway.nome}: ${consulta.status} (${decorrido}s)   `);

    if (consulta.status === StatusPagamento.APROVADO) {
      console.log(`\n\n🎉 [Proxy] Pagamento APROVADO detectado!`);

      // Simula a recepção do webhook com assinatura válida para passar pelo Proxy
      const dados = { idEvento: `ev-${Date.now()}`, idPagamento: idCheckout, recargaId: recarga.id };
      const notificacao = { ...dados, assinatura: assinarNotificacao(processador.segredoWebhook, dados) };

      const resultado = await controller.receberWebhook(gateway.nome, notificacao);
      console.log(`   • Resultado do Proxy: ${resultado.efeito} (${resultado.motivo})`);
      console.log(`   • Saldo final de moeda virtual: ${espectador.carteira.saldoMoedaVirtual}`);
      console.log(
        resultado.efeito === "CREDITADO"
          ? `\n✅ Fluxo completo com ${gateway.nome} real finalizado com sucesso!`
          : "\n❌ O pagamento foi aprovado, mas a confirmação não creditou a recarga.",
      );
      return;
    }

    if (consulta.status === StatusPagamento.RECUSADO) {
      console.log(`\n\n❌ Pagamento foi RECUSADO pelo ${gateway.nome}.`);
      return;
    }
  }

  console.log("\n\n⏰ Parei de consultar depois de 5 minutos.");
  console.log(`A recarga ${recarga.id} segue PENDENTE: o link continua válido até o checkout expirar.`);
}

void executar();
