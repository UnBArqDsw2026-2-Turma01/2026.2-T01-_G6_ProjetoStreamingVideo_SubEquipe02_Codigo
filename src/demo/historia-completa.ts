/**
 * Demonstração da história completa da SubEquipe_02.
 *
 * Por enquanto, exercita apenas a base compartilhada. Cada frente substitui
 * o trecho marcado pelo seu fluxo real, com os padrões aplicados:
 *   1. Recarga de moeda virtual   → F1 (Adapter, Proxy, Decorator)
 *   2. Doação com mensagem        → F2 (Facade, Proxy)
 *   3. Mensagem destacada no chat → F3 (Decorator)
 *   4. Repasse ao criador         → F2
 */
import { Dinheiro, Usuario } from "../dominio";
import { ServicoFinanceiro } from "../financeiro";
import { NotificadorChatProvisorio } from "../contratos";

const espectador = new Usuario("usuario-1", "Espectador", "espectador@exemplo.com");
const criador = new Usuario("usuario-2", "Criador", "criador@exemplo.com");
criador.perfil.habilitarMonetizacao();

const financeiro = new ServicoFinanceiro();
const chat = new NotificadorChatProvisorio();

console.log("=== História da SubEquipe_02 — base compartilhada ===\n");

// 1. Recarga — provisório: crédito direto. A F1 substitui pelo fluxo com Adapter, Proxy e Decorator.
financeiro.creditarMoedaVirtual(espectador, 300);
console.log(`1. Recarga: ${espectador.nome} agora tem ${espectador.carteira.saldoMoedaVirtual} de moeda virtual`);

// 2 e 4. Doação e repasse — provisório: transferência direta. A F2 substitui pela Facade.
const quantidade = 100;
const valorRepasse = Dinheiro.deCentavos(quantidade); // provisório: 1 centavo por unidade
const ok = financeiro.transferirDoacao(espectador, criador, quantidade, valorRepasse);
console.log(`2. Doação de ${quantidade}: ${ok ? "concluída" : "recusada"}`);

// 3. Mensagem destacada — provisório: chat simples. A F3 substitui pelo Decorator.
chat.exibirMensagemDestacada({
  doacaoId: "doacao-1",
  doador: espectador,
  criador,
  quantidadeMoedaVirtual: quantidade,
  mensagem: "Bora que a live tá boa!",
});

console.log(`4. Repasse: ${criador.nome} recebeu ${criador.carteira.saldoDinheiro.formatar()}`);
console.log(`\nSaldo final do espectador: ${espectador.carteira.saldoMoedaVirtual} de moeda virtual`);
