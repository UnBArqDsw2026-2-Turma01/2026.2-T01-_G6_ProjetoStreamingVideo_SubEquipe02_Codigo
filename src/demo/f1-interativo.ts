/**
 * F1 interativa: você faz o papel do espectador no modal de recarga.
 *
 * Escolhe o pacote, a forma de pagamento e o meio de pagamento; paga no link
 * (processadores reais em modo de teste) ou simula o pagamento (processador
 * simulado), e acompanha o aviso passando pelo Proxy até o crédito.
 *
 * Meios oferecidos: Mercado Pago e Stripe (se houver credenciais de teste no .env),
 * "Simulado" (paga com a tecla p) e "Simulado-ForaDoAr" (para ver o erro de meio
 * indisponível e escolher outro).
 *
 * Executar: npm run demo:interativo
 */
import { createInterface } from "node:readline/promises";
import { RepositorioEmMemoria } from "../compartilhado";
import { Dinheiro, Usuario } from "../dominio";
import { ServicoFinanceiro } from "../financeiro";
import {
  AdaptadorProcessadorSimulado,
  ErroMeioPagamentoIndisponivel,
  MetodoRecarga,
  ProcessadorSimulado,
  StatusPagamento,
  assinarNotificacao,
  montarRecarga,
  type GatewayPagamento,
  type OfertaPacote,
  type Recarga,
} from "../f1-recarga";
import { PROCESSADORES_REAIS } from "./processadoresReais";

/** O que o demo precisa saber de cada meio para conduzir o pagamento. */
interface MeioPagamento {
  readonly gateway: GatewayPagamento;
  readonly segredoWebhook: string;
  readonly comoPagar: string;
  /** Só nos simulados: permite "pagar" pelo terminal. */
  readonly simulador?: ProcessadorSimulado;
}

const SALDO_INICIAL = Dinheiro.deReais(50);

const rl = createInterface({ input: process.stdin, output: process.stdout });
// O iterador guarda as linhas que chegam antes da pergunta (ex.: entrada colada ou por pipe).
const linhas = rl[Symbol.asyncIterator]();

/** A entrada acabou (Ctrl+D ou fim do pipe): encerra o demo. */
class FimDaEntrada extends Error {}

async function perguntar(texto: string): Promise<string> {
  process.stdout.write(texto);
  const { value, done } = await linhas.next();
  if (done) throw new FimDaEntrada();
  if (!process.stdin.isTTY) process.stdout.write(`${value}\n`); // ecoa a resposta quando não há terminal
  return String(value).trim().toLowerCase();
}

/** Pergunta até receber um número de 1 a `maximo`; 0 volta (devolve undefined). */
async function escolherNumero(texto: string, maximo: number): Promise<number | undefined> {
  for (;;) {
    const resposta = await perguntar(texto);
    const numero = Number(resposta);
    if (resposta === "0") return undefined;
    if (Number.isInteger(numero) && numero >= 1 && numero <= maximo) return numero;
    console.log(`  Digite um número de 1 a ${maximo} (ou 0 para voltar).`);
  }
}

async function conectarMeios(): Promise<Map<string, MeioPagamento>> {
  const meios = new Map<string, MeioPagamento>();
  console.log("Conectando aos processadores...");
  for (const real of Object.values(PROCESSADORES_REAIS)) {
    const conexao = await real.conectar().catch((erro: Error) => ({ erro: erro.message }));
    if ("erro" in conexao) {
      console.log(`  ⚠️  ${real.titulo}: fora do modal (${conexao.erro})`);
      continue;
    }
    console.log(`  ✅ ${real.titulo}: ${conexao.descricao}${conexao.teste ? " · modo teste" : " · ⚠️ PRODUÇÃO"}`);
    meios.set(conexao.gateway.nome, conexao);
  }

  const simulado = new ProcessadorSimulado();
  meios.set("Simulado", {
    gateway: new AdaptadorProcessadorSimulado(simulado, "segredo-simulado", "Simulado"),
    segredoWebhook: "segredo-simulado",
    comoPagar: "digite p para simular o pagamento",
    simulador: simulado,
  });
  const foraDoAr = new ProcessadorSimulado();
  foraDoAr.online = false;
  meios.set("Simulado-ForaDoAr", {
    gateway: new AdaptadorProcessadorSimulado(foraDoAr, "segredo-fora", "Simulado-ForaDoAr"),
    segredoWebhook: "segredo-fora",
    comoPagar: "nunca chega aqui: está fora do ar",
    simulador: foraDoAr,
  });
  console.log("  ✅ Simulado e Simulado-ForaDoAr (sem internet)\n");
  return meios;
}

async function main(): Promise<void> {
  console.log("=== F1 · Recarga de moeda virtual — você é o espectador ===\n");
  const meios = await conectarMeios();

  const espectador = new Usuario("espectador", "Você", "voce@exemplo.com");
  espectador.carteira.adicionarDinheiro(SALDO_INICIAL);
  const usuarios = new RepositorioEmMemoria<Usuario>();
  usuarios.salvar(espectador);

  const { controller } = montarRecarga({
    gateways: [...meios.values()].map((m) => m.gateway),
    financeiro: new ServicoFinanceiro(),
    usuarios,
  });

  for (;;) {
    const carteira = espectador.carteira;
    console.log("─".repeat(60));
    console.log(`Sua carteira: ${carteira.saldoMoedaVirtual} de moeda virtual · ${carteira.saldoDinheiro.formatar()} em dinheiro`);

    // ① Decorator: o modal com os preços em camadas
    const ofertas = controller.consultarOfertas(espectador.id);
    console.log("\n[Decorator] Pacotes:");
    ofertas.forEach((o, i) => console.log(`  ${i + 1}. ${descreverOferta(o)}`));
    const numeroPacote = await escolherNumero("\nEscolha o pacote (0 para sair): ", ofertas.length);
    if (numeroPacote === undefined) break;
    const oferta = ofertas[numeroPacote - 1]!;
    console.log(`  Composição do preço: ${oferta.composicao}`);

    console.log("\nForma de pagamento:");
    console.log("  1. Meio de pagamento externo");
    console.log(`  2. Saldo em dinheiro da carteira (${carteira.saldoDinheiro.formatar()})`);
    const forma = await escolherNumero("Escolha (0 para voltar): ", 2);
    if (forma === undefined) continue;

    if (forma === 2) {
      const recarga = await controller.recarregar(espectador.id, oferta.pacote.id, MetodoRecarga.SALDO_DO_CRIADOR);
      console.log(
        recarga.motivoCancelamento
          ? `\n❌ ${recarga.id} ${recarga.status}: ${recarga.motivoCancelamento}`
          : `\n✅ ${recarga.id} ${recarga.status}: ${recarga.quantidadeMoedaVirtual} de moeda virtual creditadas`,
      );
      continue;
    }

    const recarga = await escolherMeioECriarCheckout(controller, espectador.id, oferta);
    if (!recarga) continue;
    await pagar(controller, recarga, meios.get(recarga.gatewayUtilizado!)!);
  }

  console.log("\nAté a próxima! 👋");
  rl.close();
}

function descreverOferta(oferta: OfertaPacote): string {
  return `${oferta.pacote.quantidadeMoedaVirtual} de moeda virtual — de ${oferta.precoSemDesconto.formatar()} por ${oferta.precoPromocional.formatar()}`;
}

/** ② Adapter: o espectador escolhe o meio; se ele cair, vê as alternativas e escolhe de novo. */
async function escolherMeioECriarCheckout(
  controller: ReturnType<typeof montarRecarga>["controller"],
  usuarioId: string,
  oferta: OfertaPacote,
): Promise<Recarga | undefined> {
  let opcoes = controller.consultarMeiosPagamento();
  for (;;) {
    console.log("\n[Adapter] Meios de pagamento:");
    opcoes.forEach((nome, i) => console.log(`  ${i + 1}. ${nome}`));
    const numero = await escolherNumero("Escolha o meio (0 para voltar): ", opcoes.length);
    if (numero === undefined) return undefined;
    const escolhido = opcoes[numero - 1]!;

    try {
      const recarga = await controller.recarregar(usuarioId, oferta.pacote.id, MetodoRecarga.PROCESSADOR_EXTERNO, escolhido);
      if (recarga.gatewayUtilizado !== escolhido) {
        console.log(`\n⚠️  ${escolhido} indisponível; ${recarga.gatewayUtilizado} é o único meio disponível agora.`);
      }
      console.log(`\n✅ Checkout criado no ${recarga.gatewayUtilizado}: ${recarga.id} ${recarga.status}, ${recarga.valor.formatar()}`);
      return recarga;
    } catch (erro) {
      if (!(erro instanceof ErroMeioPagamentoIndisponivel)) throw erro;
      console.log(`\n❌ ${erro.message}`);
      if (erro.alternativas.length === 0) return undefined;
      opcoes = [...erro.alternativas];
    }
  }
}

/** Pagamento e ③ Proxy: consulta quando você pedir e, aprovado, manda o aviso assinado pelo Proxy. */
async function pagar(
  controller: ReturnType<typeof montarRecarga>["controller"],
  recarga: Recarga,
  meio: MeioPagamento,
): Promise<void> {
  const idCheckout = recarga.idCheckout!;
  console.log(`\n🔗 Pague aqui (${meio.comoPagar}):`);
  console.log(`   ${recarga.instrucoesPagamento}\n`);

  const opcaoSimular = meio.simulador ? " · [p] simular pagamento · [r] simular recusa" : "";
  for (;;) {
    const acao = await perguntar(`[Enter] verificar pagamento${opcaoSimular} · [c] desistir: `);
    if (acao === "c") {
      console.log(`  Você desistiu; ${recarga.id} segue ${recarga.status} até o checkout expirar.`);
      return;
    }
    if (meio.simulador && acao === "p") meio.simulador.aprovar(idCheckout);
    if (meio.simulador && acao === "r") meio.simulador.negar(idCheckout);

    const situacao = await meio.gateway.consultarPagamento(idCheckout);
    console.log(`  Status no ${meio.gateway.nome}: ${situacao.status}`);

    if (situacao.status === StatusPagamento.RECUSADO) {
      console.log(`  ❌ Pagamento recusado pelo ${meio.gateway.nome}.`);
      return;
    }
    if (situacao.status === StatusPagamento.APROVADO) {
      // Em produção o processador chamaria o webhook; aqui o aviso é montado e assinado localmente.
      const dados = { idEvento: `ev-${Date.now()}`, idPagamento: idCheckout, recargaId: recarga.id };
      const aviso = { ...dados, assinatura: assinarNotificacao(meio.segredoWebhook, dados) };
      const resultado = await controller.receberWebhook(meio.gateway.nome, aviso);
      console.log(`\n[Proxy] Aviso de pagamento: ${resultado.efeito} (${resultado.motivo})`);

      // O processador costuma reenviar o aviso: mesmo pagamento, novo evento, assinatura válida.
      const reenvio = { ...dados, idEvento: `${dados.idEvento}-reenvio` };
      const repetido = await controller.receberWebhook(meio.gateway.nome, {
        ...reenvio,
        assinatura: assinarNotificacao(meio.segredoWebhook, reenvio),
      });
      console.log(`[Proxy] Reenvio do mesmo aviso: ${repetido.efeito} (${repetido.motivo})`);
      return;
    }
  }
}

main().catch((erro) => {
  rl.close();
  if (erro instanceof FimDaEntrada) {
    console.log("\n\nAté a próxima! 👋");
    return;
  }
  console.error(erro);
  process.exitCode = 1;
});
