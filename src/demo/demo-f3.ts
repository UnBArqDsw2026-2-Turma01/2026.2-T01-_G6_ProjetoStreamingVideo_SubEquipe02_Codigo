/**
 * Demonstração da F3 — Mensagem destacada no chat (Decorator).
 *
 * Cenários demonstrados:
 * 1. Uma doação em cada faixa: a pilha de camadas muda conforme o valor (SC01, SC02);
 * 2. Mensagem acima do limite de caracteres da faixa é recusada pelo chat (SC02);
 * 3. Integração com a F2: a doação feita pela Facade aparece destacada no chat,
 *    pelo contrato NotificadorChat, no lugar do chat provisório.
 *
 * Executar sozinha: npm run demo:f3
 */
import { GeradorId, RepositorioEmMemoria } from "../compartilhado";
import type { DoacaoNotificada } from "../contratos";
import { Usuario } from "../dominio";
import { ServicoFinanceiro } from "../financeiro";
import { montarDoacao } from "../f2-doacao";
import { Chat } from "../f3-chat";

/** Executa os cenários da mensagem destacada, mostrando as camadas montadas em cada um. */
export function demonstrarMensagemDestacada(): void {
  const espectador = new Usuario("usuario-1", "Espectador", "espectador@exemplo.com");
  const criador = new Usuario("usuario-2", "Criador", "criador@exemplo.com");
  const chat = new Chat();

  const notificar = (quantidade: number, mensagem: string): DoacaoNotificada => ({
    doacaoId: `doacao-${quantidade}`,
    doador: espectador,
    criador,
    quantidadeMoedaVirtual: quantidade,
    mensagem,
  });

  console.log("=== F3 — Mensagem destacada no chat (Decorator) ===\n");

  console.log("  [Faixas] A mesma mensagem recebe camadas diferentes conforme o valor doado:\n");
  for (const quantidade of [200, 500, 2000, 5000, 50000]) {
    chat.exibirMensagemDestacada(notificar(quantidade, "Valeu pela live!"));
    const ultima = chat.mensagensExibidas().at(-1);
    console.log(`         camadas: ${ultima?.descrever()}\n`);
  }

  console.log("  [Limite] Mensagem acima do limite da faixa é recusada, sem exibir nada (SC02):");
  const longa = "Mensagem muito comprida para uma doação de 200, passa dos 50 caracteres";
  console.log(`    FAIXA_1 (limite de 50), mensagem com ${Array.from(longa).length} caracteres`);
  try {
    chat.exibirMensagemDestacada(notificar(200, longa));
  } catch (erro) {
    console.log(`    recusada: ${erro instanceof Error ? erro.message : String(erro)}\n`);
  }

  console.log("  [Integração] Doação pela Facade da F2, exibida pelo chat da F3:");
  const usuarios = new RepositorioEmMemoria<Usuario>();
  const doador = new Usuario("usuario-3", "Espectadora", "espectadora@exemplo.com");
  const canal = new Usuario("usuario-4", "Canal", "canal@exemplo.com");
  canal.perfil.habilitarMonetizacao();
  usuarios.salvar(doador);
  usuarios.salvar(canal);

  const financeiro = new ServicoFinanceiro();
  financeiro.creditarMoedaVirtual(doador, 6000);

  const { controller } = montarDoacao({
    financeiro,
    notificadorChat: chat,
    usuarios,
    geradorId: new GeradorId(),
  });
  controller.doarComMensagem(
    doador.id,
    canal.id,
    5000,
    "Que jogada! Mandando apoio pro canal.",
  );
}

if (require.main === module) {
  demonstrarMensagemDestacada();
}
