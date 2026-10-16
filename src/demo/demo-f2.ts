/**
 * Demonstração da F2 — Doação com mensagem destacada e repasse (Facade).
 *
 * Cenários demonstrados:
 * 1. Doação válida na FAIXA_3, com débito e crédito atômicos de repasse;
 * 2. Resiliência do chat: falha na notificação mantém a doação e o repasse concluídos (Ata S2_02, D05);
 * 3. Bloqueio de doação para criador não monetizado (SQ02, SQ05).
 *
 * Executar sozinha: npx tsx src/demo/demo-f2.ts
 */
import { GeradorId, RepositorioEmMemoria } from "../compartilhado";
import { NotificadorChatProvisorio, type NotificadorChat } from "../contratos";
import { Usuario } from "../dominio";
import { ServicoFinanceiro } from "../financeiro";
import { Doacao, DoacaoController, ServicoDoacao } from "../f2-doacao";

/** Executa os cenários de doação e repasse narrando o comportamento da Facade. */
export function demonstrarDoacao(): void {
  const repositorioUsuarios = new RepositorioEmMemoria<Usuario>();
  const repositorioDoacoes = new RepositorioEmMemoria<Doacao>();
  const geradorId = new GeradorId();
  const financeiro = new ServicoFinanceiro();

  const espectador = new Usuario("usuario-1", "Espectador", "espectador@exemplo.com");
  const criador = new Usuario("usuario-2", "Criador", "criador@exemplo.com");
  const iniciante = new Usuario("usuario-3", "Canal Iniciante", "iniciante@exemplo.com");
  criador.perfil.habilitarMonetizacao();

  // Saldo prévio proveniente da recarga da F1.
  financeiro.creditarMoedaVirtual(espectador, 3000);

  repositorioUsuarios.salvar(espectador);
  repositorioUsuarios.salvar(criador);
  repositorioUsuarios.salvar(iniciante);

  const controller = new DoacaoController(
    new ServicoDoacao(financeiro, new NotificadorChatProvisorio(), repositorioDoacoes, geradorId),
    repositorioUsuarios,
  );

  console.log("=== F2 — Doação com mensagem destacada e repasse ===\n");

  console.log("  [Facade] Doação válida de 2000 moedas na FAIXA_3 (laranja, 10 min):");
  console.log(`    Antes: ${espectador.carteira.saldoMoedaVirtual} de moeda virtual | criador com ${criador.carteira.saldoDinheiro.formatar()}`);
  controller.doar(espectador.id, criador.id, 2000, "Excelente transmissão! Apoio enviado com mensagem destacada.");
  console.log(`    Depois: ${espectador.carteira.saldoMoedaVirtual} de moeda virtual | criador com ${criador.carteira.saldoDinheiro.formatar()}\n`);

  console.log("  [Resiliência] Falha no chat não invalida a doação nem o repasse (D05):");
  const chatComFalha: NotificadorChat = {
    exibirMensagemDestacada: () => {
      throw new Error("serviço de mensageria do chat temporariamente indisponível.");
    },
  };
  const controllerComChatFalho = new DoacaoController(
    new ServicoDoacao(financeiro, chatComFalha, repositorioDoacoes, geradorId),
    repositorioUsuarios,
  );
  controllerComChatFalho.doar(espectador.id, criador.id, 500, "Doação na faixa verde, mesmo com o chat fora do ar!");
  console.log(`    Criador com saldo atualizado: ${criador.carteira.saldoDinheiro.formatar()}\n`);

  console.log("  [Bloqueio] Canal não monetizado não pode receber doações (SQ02, SQ05):");
  try {
    controller.doar(espectador.id, iniciante.id, 200, "Tentativa de apoio");
  } catch (erro) {
    console.log(`    Doação recusada: ${(erro as Error).message}`);
  }
}

if (require.main === module) {
  demonstrarDoacao();
}
