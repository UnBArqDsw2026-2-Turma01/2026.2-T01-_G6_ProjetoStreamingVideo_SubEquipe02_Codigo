import type { RepositorioEmMemoria } from "../compartilhado";
import { ErroDominio, type Usuario } from "../dominio";
import type { ResultadoDoacaoSimples } from "./MediatorDoacao";
import type { ResultadoDoacaoComMensagem } from "./MediatorDoacaoComMensagem";
import type { OpcoesDoacao, ServicoDoacao } from "./ServicoDoacao";

/**
 * Porta de entrada do fluxo de doação (Entrega 2: DoacaoController).
 * Cliente da Facade: comunica-se exclusivamente com o ServicoDoacao.
 */
export class DoacaoController {
  constructor(
    private readonly servicoDoacao: ServicoDoacao,
    private readonly repositorioUsuarios: RepositorioEmMemoria<Usuario>,
  ) {}

  /** Consulta opções e faixas disponíveis para o canal antes do envio. */
  consultarOpcoesDoacao(canalId: string, doadorId: string): OpcoesDoacao {
    const canal = this.obterUsuarioOuFalhar(canalId, "Criador");
    const doador = this.obterUsuarioOuFalhar(doadorId, "Espectador");

    return this.servicoDoacao.consultarOpcoesDoacao(canal, doador);
  }

  /** Doação simples (sem mensagem destacada). */
  doar(
    doadorId: string,
    criadorId: string,
    quantidadeMoedaVirtual: number,
  ): ResultadoDoacaoSimples {
    const doador = this.obterUsuarioOuFalhar(doadorId, "Espectador");
    const criador = this.obterUsuarioOuFalhar(criadorId, "Criador");

    const resultado = this.servicoDoacao.doar(doador, criador, quantidadeMoedaVirtual);
    const { doacao } = resultado;

    console.log(
      `[F2 Facade] ${doacao.id} (${doacao.status}): ${doador.nome} doou ${quantidadeMoedaVirtual} de moeda virtual para ${criador.nome} ` +
        `· repasse de ${doacao.valorRepasse.formatar()}`,
    );

    return resultado;
  }

  /** Doação com mensagem destacada no chat. */
  doarComMensagem(
    doadorId: string,
    criadorId: string,
    quantidadeMoedaVirtual: number,
    mensagem: string,
  ): ResultadoDoacaoComMensagem {
    const doador = this.obterUsuarioOuFalhar(doadorId, "Espectador");
    const criador = this.obterUsuarioOuFalhar(criadorId, "Criador");

    const resultado = this.servicoDoacao.doarComMensagem(
      doador,
      criador,
      quantidadeMoedaVirtual,
      mensagem,
    );
    const { doacao } = resultado;

    console.log(
      `[F2 Facade] ${doacao.id} (${doacao.status}): ${doador.nome} doou ${quantidadeMoedaVirtual} de moeda virtual para ${criador.nome} ` +
        `[${doacao.faixa.codigo}: ${doacao.faixa.cor}, fixação de ${doacao.faixa.tempoFixacaoMin} min] ` +
        `· repasse de ${doacao.valorRepasse.formatar()}`,
    );

    if (resultado.avisoChat) {
      console.warn(`[F2 Facade] Aviso: ${resultado.avisoChat}`);
    }

    return resultado;
  }

  private obterUsuarioOuFalhar(id: string, papel: string): Usuario {
    const usuario = this.repositorioUsuarios.buscarPorId(id);
    if (!usuario) {
      throw new ErroDominio(`${papel} não encontrado: ${id}`);
    }
    return usuario;
  }
}
