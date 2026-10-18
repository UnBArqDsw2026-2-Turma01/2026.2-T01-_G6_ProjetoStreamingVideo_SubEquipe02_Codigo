/**
 * Demonstração da história completa da SubEquipe_02, com as três frentes integradas:
 *   1. Recarga de moeda virtual   → F1 (Decorator, Adapter, Proxy)
 *   2. Doação com mensagem        → F2 (Facade, com Mediator como extra)
 *   3. Mensagem destacada no chat → F3 (Decorator), pelo contrato NotificadorChat
 *   4. Repasse ao criador         → F2, independente da exibição no chat (Ata S2_02, D05)
 *
 * Executar: npm run demo
 */
import { GeradorId, RepositorioEmMemoria } from "../compartilhado";
import { Usuario } from "../dominio";
import { ServicoFinanceiro } from "../financeiro";
import { montarDoacao } from "../f2-doacao";
import { Chat } from "../f3-chat";
import { demonstrarRecarga } from "./f1-recarga";

const espectador = new Usuario("usuario-1", "Espectador", "espectador@exemplo.com");
const criador = new Usuario("usuario-2", "Criador", "criador@exemplo.com");
criador.perfil.habilitarMonetizacao();

const usuarios = new RepositorioEmMemoria<Usuario>();
usuarios.salvar(espectador);
usuarios.salvar(criador);

const financeiro = new ServicoFinanceiro();
const chat = new Chat((linha) => console.log(`   ${linha}`));
const { controller: doacoes } = montarDoacao({
  financeiro,
  notificadorChat: chat,
  usuarios,
  geradorId: new GeradorId(),
});

async function main(): Promise<void> {
  console.log("=== História da SubEquipe_02 — F1 + F2 + F3 integradas ===\n");

  // 1. Recarga — F1: preço em camadas (Decorator), checkout no meio escolhido (Adapter) e confirmação segura (Proxy).
  console.log("1. Recarga de moeda virtual (F1)");
  await demonstrarRecarga(espectador, financeiro);
  console.log(`   ${espectador.nome} agora tem ${espectador.carteira.saldoMoedaVirtual} de moeda virtual\n`);

  // 2, 3 e 4. Doação com mensagem — F2 (Facade + Mediator) notifica o chat da F3 (Decorator) e faz o repasse.
  const quantidade = 200;
  console.log(`2. Doação de ${quantidade} com mensagem (F2) e 3. mensagem destacada no chat (F3)`);
  doacoes.doarComMensagem(espectador.id, criador.id, quantidade, "Bora que a live tá boa!");

  console.log(`\n4. Repasse (F2): ${criador.nome} recebeu ${criador.carteira.saldoDinheiro.formatar()}`);
  console.log(`\nSaldo final do espectador: ${espectador.carteira.saldoMoedaVirtual} de moeda virtual`);
}

void main();
