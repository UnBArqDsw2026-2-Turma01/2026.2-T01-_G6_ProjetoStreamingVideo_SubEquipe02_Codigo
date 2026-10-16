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
import { RepositorioEmMemoria } from "../compartilhado";
import { Usuario } from "../dominio";
import { ServicoFinanceiro } from "../financeiro";
import { CONFIGURACAO_PRECO, MetodoRecarga, StatusPagamento, assinarNotificacao, montarRecarga } from "../f1-recarga";
import { PROCESSADORES_REAIS } from "./processadoresReais";

function falhar(...linhas: string[]): never {
  for (const linha of linhas) console.error(linha);
  process.exit(1);
}

async function executar(): Promise<void> {
  const nome = process.argv[2] ?? "";
  const real = PROCESSADORES_REAIS[nome];
  if (!real) {
    falhar(`Uso: npx tsx src/demo/f1-pagamento-real.ts <${Object.keys(PROCESSADORES_REAIS).join("|")}>`);
  }

  console.log("=========================================================");
  console.log(`=== F1 · Recarga real com ${real.titulo}`);
  console.log("=========================================================\n");

  const processador = await real.conectar();
  if ("erro" in processador) falhar(`❌ ${processador.erro}`);
  const { gateway } = processador;
  console.log(`Credencial: ${processador.descricao}`);
  console.log(processador.teste ? "🧪 Modo teste: nenhum dinheiro real envolvido.\n" : "⚠️  PRODUÇÃO: cobrança real!\n");

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
  // O espectador escolhe o meio de pagamento no modal.
  const recarga = await controller.recarregar(espectador.id, "p10", MetodoRecarga.PROCESSADOR_EXTERNO, gateway.nome);
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
