/**
 * Demonstração da F3 — Mensagem destacada no chat (Decorator).
 *
 * Cenários demonstrados:
 * 1. Uma doação em cada faixa: a pilha de camadas muda conforme o valor (SC01, SC02);
 * 2. Limite de caracteres aplicado só ao corpo da mensagem (SC02);
 * 3. Integração com a F2: a doação feita pela Facade aparece destacada no chat,
 *    pelo contrato NotificadorChat, no lugar do chat provisório.
 *
 * Executar sozinha: npm run demo:f3
 */
import { GeradorId, RepositorioEmMemoria } from "../compartilhado";
import type { DoacaoNotificada } from "../contratos";
import { Usuario } from "../dominio";
import { ServicoFinanceiro } from "../financeiro";
import { Doacao, DoacaoController, ServicoDoacao } from "../f2-doacao";
import { Chat, ComLimiteCaracteres, MensagemBase } from "../f3-chat";

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

  console.log("  [Limite] O corpo é cortado no limite da faixa; o cabeçalho fica intacto (SC02):");
  const longa = new ComLimiteCaracteres(
    new MensagemBase("Espectador", "Esta mensagem tem bem mais do que vinte caracteres", 200),
    20,
  );
  console.log(`    antes:  "Esta mensagem tem bem mais do que vinte caracteres"`);
  console.log(`    depois: "${longa.texto()}"\n`);

  console.log("  [Integração] Doação pela Facade da F2, exibida pelo chat da F3:");
  const usuarios = new RepositorioEmMemoria<Usuario>();
  const doador = new Usuario("usuario-3", "Espectadora", "espectadora@exemplo.com");
  const canal = new Usuario("usuario-4", "Canal", "canal@exemplo.com");
  canal.perfil.habilitarMonetizacao();
  usuarios.salvar(doador);
  usuarios.salvar(canal);

  const financeiro = new ServicoFinanceiro();
  financeiro.creditarMoedaVirtual(doador, 6000);

  const controller = new DoacaoController(
    new ServicoDoacao(financeiro, chat, new RepositorioEmMemoria<Doacao>(), new GeradorId()),
    usuarios,
  );
  controller.doar(doador.id, canal.id, 5000, "Que jogada! Mandando apoio pro canal.");
}

if (require.main === module) {
  demonstrarMensagemDestacada();
}
