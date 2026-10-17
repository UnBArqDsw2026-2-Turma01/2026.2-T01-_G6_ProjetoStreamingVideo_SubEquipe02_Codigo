import { GeradorId, RepositorioEmMemoria } from "../compartilhado";
import type { NotificadorChat } from "../contratos";
import type { Usuario } from "../dominio";
import type { ServicoFinanceiro } from "../financeiro";
import { Doacao } from "./Doacao";
import { DoacaoController } from "./DoacaoController";
import { MediatorDoacao } from "./MediatorDoacao";
import { MediatorDoacaoComMensagem } from "./MediatorDoacaoComMensagem";
import { ServicoDoacao } from "./ServicoDoacao";

/**
 * Composição da F2: liga controller, facade, mediators, financeiro e chat.
 * Usado pela demonstração e pelos testes.
 */
export function montarDoacao(dependencias: {
  financeiro: ServicoFinanceiro;
  notificadorChat: NotificadorChat;
  usuarios: RepositorioEmMemoria<Usuario>;
  geradorId?: GeradorId;
  repositorioDoacoes?: RepositorioEmMemoria<Doacao>;
}) {
  const geradorId = dependencias.geradorId ?? new GeradorId();
  const repositorioDoacoes =
    dependencias.repositorioDoacoes ?? new RepositorioEmMemoria<Doacao>();

  const mediadorSimples = new MediatorDoacao(
    dependencias.financeiro,
    repositorioDoacoes,
    geradorId,
  );
  const mediadorComMensagem = new MediatorDoacaoComMensagem(
    dependencias.financeiro,
    dependencias.notificadorChat,
    repositorioDoacoes,
    geradorId,
  );

  const servico = new ServicoDoacao(
    mediadorSimples,
    mediadorComMensagem,
    dependencias.financeiro,
    dependencias.notificadorChat,
  );
  const controller = new DoacaoController(servico, dependencias.usuarios);

  return {
    controller,
    servico,
    mediadorSimples,
    mediadorComMensagem,
    repositorioDoacoes,
  };
}
