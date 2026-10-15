/**
 * Demonstração da F1 com a API real do Mercado Pago (Checkout Pro), em conta de TESTE.
 *
 * Cria uma preferência, imprime o link de pagamento e monitora até a confirmação
 * e o crédito das moedas virtuais. Recusa rodar com o token da sua conta real,
 * a menos que MERCADO_PAGO_PERMITIR_PRODUCAO=1.
 *
 * Executar: npx tsx src/demo/f1-mercadopago-real.ts
 */
import { MercadoPagoConfig, User } from "mercadopago";
import { existsSync } from "node:fs";
import { RepositorioEmMemoria } from "../compartilhado";
import { Usuario } from "../dominio";
import { ServicoFinanceiro } from "../financeiro";
import {
  AdaptadorMercadoPago,
  CONFIGURACAO_PRECO,
  MetodoRecarga,
  StatusPagamento,
  montarRecarga,
} from "../f1-recarga";

// Carrega automaticamente o arquivo .env se existir
if (existsSync(".env") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

const TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const WEBHOOK_SECRET = process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "segredo-local-mp";


async function executar(): Promise<void> {
  console.log("=========================================================");
  console.log("=== F1 · Recarga Real com Mercado Pago (Checkout Pro) ===");
  console.log("=========================================================\n");

  if (!TOKEN || TOKEN.includes("TEST-xxxxxxxx") || TOKEN.trim() === "") {
    console.error("❌ ERRO: MERCADO_PAGO_ACCESS_TOKEN não configurado!");
    console.error("Abra o .env e coloque o access token do VENDEDOR DE TESTE:\n");
    console.error("  MERCADO_PAGO_ACCESS_TOKEN=APP_USR-... (ou TEST-...)\n");
    console.error("Contas de teste: https://www.mercadopago.com.br/developers/panel/test-users");
    process.exit(1);
  }

  // Quem decide teste x produção é a conta dona do token: usuários de teste têm apelido TESTUSER...
  const conta = await new User(new MercadoPagoConfig({ accessToken: TOKEN })).get();
  const contaDeTeste = TOKEN.startsWith("TEST-") || (conta.nickname ?? "").toUpperCase().startsWith("TESTUSER");
  console.log(`Conta do token: ${conta.nickname} (id ${conta.id})`);
  if (!contaDeTeste && process.env.MERCADO_PAGO_PERMITIR_PRODUCAO !== "1") {
    console.error("\n❌ Este token é da sua conta REAL: o link geraria cobrança de verdade.");
    console.error("Para testar, entre no painel com o usuário VENDEDOR de teste, crie a aplicação nele");
    console.error("e use as credenciais de produção DELE no .env. Pague com o usuário COMPRADOR de teste.");
    console.error("(Para rodar em produção mesmo assim: MERCADO_PAGO_PERMITIR_PRODUCAO=1)");
    process.exit(1);
  }
  console.log(contaDeTeste ? "🧪 Modo teste: nenhum dinheiro real envolvido.\n" : "⚠️  PRODUÇÃO: cobrança real!\n");

  const espectador = new Usuario("usuario-real", "Daví (Espectador)", "davi@exemplo.com");
  const usuarios = new RepositorioEmMemoria<Usuario>();
  usuarios.salvar(espectador);

  const financeiro = new ServicoFinanceiro();
  const gatewayMP = AdaptadorMercadoPago.conectar(TOKEN, WEBHOOK_SECRET);

  const { controller } = montarRecarga({
    gateways: [gatewayMP],
    financeiro,
    usuarios,
  });

  console.log(
    `1. [Decorator] Consultando ofertas com desconto (${CONFIGURACAO_PRECO.descontoPercentual}%) e imposto (${CONFIGURACAO_PRECO.aliquotaImposto}%):`,
  );
  for (const oferta of controller.consultarOfertas(espectador.id)) {
    console.log(
      `   • Pacote de ${oferta.pacote.quantidadeMoedaVirtual} moedas: de ${oferta.precoOriginal.formatar()} por ${oferta.precoPromocional.formatar()}`,
    );
    console.log(`     Composição: ${oferta.composicao}`);
  }

  console.log("\n2. [Adapter] Criando sessão no Checkout Pro do Mercado Pago...");
  const recarga = await controller.recarregar(espectador.id, "p10", MetodoRecarga.PROCESSADOR_EXTERNO);

  console.log(`   ✅ Sessão de checkout gerada com sucesso!`);
  console.log(`   • ID da Recarga (sistema): ${recarga.id}`);
  console.log(`   • ID da Preferência (Mercado Pago): ${recarga.idCheckout}`);
  console.log(`   • Valor total: ${recarga.valor.formatar()}`);
  console.log(`   • Status: ${recarga.status}`);

  const idCheckout = recarga.idCheckout!;
  console.log(`\n---------------------------------------------------------`);
  console.log(`🔗 LINK DE PAGAMENTO (abra em aba anônima e entre com o comprador de teste):`);
  console.log(`---------------------------------------------------------`);
  console.log(recarga.instrucoesPagamento);
  console.log(`---------------------------------------------------------\n`);

  console.log("⏳ Aguardando confirmação do pagamento pelo Mercado Pago...");
  console.log("   (Verificando a cada 4 segundos... Pressione Ctrl+C para encerrar)\n");

  const MAX_TENTATIVAS = 30; // 2 minutos
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    await new Promise((resolve) => setTimeout(resolve, 4000));

    const consulta = await gatewayMP.consultarPagamento(idCheckout);
    process.stdout.write(`   [${tentativa}/${MAX_TENTATIVAS}] Status no Mercado Pago: ${consulta.status}...\r`);

    if (consulta.status === StatusPagamento.APROVADO) {
      console.log(`\n\n🎉 [Proxy] Pagamento APROVADO detectado!`);

      // Simula a recepção do webhook com assinatura válida para passar pelo Proxy
      const dados = { idEvento: `ev-${Date.now()}`, idPagamento: idCheckout, recargaId: recarga.id };
      const { assinarNotificacao } = await import("../f1-recarga");
      const notificacao = { ...dados, assinatura: assinarNotificacao(WEBHOOK_SECRET, dados) };

      const resultado = await controller.receberWebhook("MercadoPago", notificacao);
      console.log(`   • Resultado do Proxy: ${resultado.efeito} (${resultado.motivo})`);
      console.log(`   • Saldo final de moeda virtual: ${espectador.carteira.saldoMoedaVirtual}`);
      console.log(
        resultado.efeito === "CREDITADO"
          ? "\n✅ Fluxo completo com Mercado Pago real finalizado com sucesso!"
          : "\n❌ O pagamento foi aprovado, mas a confirmação não creditou a recarga.",
      );
      return;
    }

    if (consulta.status === StatusPagamento.RECUSADO) {
      console.log(`\n\n❌ Pagamento foi RECUSADO pelo Mercado Pago.`);
      return;
    }
  }

  console.log("\n\n⏰ Tempo limite de monitoramento esgotado.");
  console.log(`A recarga ${recarga.id} permanece PENDENTE até o recebimento do pagamento.`);
}

void executar();
