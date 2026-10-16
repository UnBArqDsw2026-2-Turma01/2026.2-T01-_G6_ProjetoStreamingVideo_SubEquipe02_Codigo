/** Montagem comum aos testes da F2: usuários, repositórios, financeiro, chat provisório e controller. */
import { GeradorId, RepositorioEmMemoria } from "../../src/compartilhado";
import { NotificadorChatProvisorio, type NotificadorChat } from "../../src/contratos";
import { Usuario } from "../../src/dominio";
import { ServicoFinanceiro } from "../../src/financeiro";
import { Doacao, DoacaoController, ServicoDoacao } from "../../src/f2-doacao";

export function criarCenario(opcoes: { chat?: NotificadorChat; saldoDoador?: number } = {}) {
  const doador = new Usuario("usuario-doador", "Espectador", "doador@exemplo.com");
  const criador = new Usuario("usuario-criador", "Criador", "criador@exemplo.com");
  const criadorNaoMonetizado = new Usuario("usuario-iniciante", "Iniciante", "iniciante@exemplo.com");

  criador.perfil.habilitarMonetizacao();

  if (opcoes.saldoDoador !== undefined && opcoes.saldoDoador > 0) {
    doador.carteira.adicionarMoedaVirtual(opcoes.saldoDoador);
  }

  const usuarios = new RepositorioEmMemoria<Usuario>();
  usuarios.salvar(doador);
  usuarios.salvar(criador);
  usuarios.salvar(criadorNaoMonetizado);

  const repositorioDoacoes = new RepositorioEmMemoria<Doacao>();
  const financeiro = new ServicoFinanceiro();
  const geradorId = new GeradorId();
  const chat = opcoes.chat ?? new NotificadorChatProvisorio(true);

  const servico = new ServicoDoacao(financeiro, chat, repositorioDoacoes, geradorId);
  const controller = new DoacaoController(servico, usuarios);

  return {
    doador,
    criador,
    criadorNaoMonetizado,
    usuarios,
    repositorioDoacoes,
    financeiro,
    geradorId,
    chat,
    servico,
    controller,
  };
}
