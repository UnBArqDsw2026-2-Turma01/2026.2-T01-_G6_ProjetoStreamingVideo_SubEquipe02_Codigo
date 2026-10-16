import type { RepositorioEmMemoria } from "../compartilhado";
import { ErroDominio, type Usuario } from "../dominio";
import type { OpcoesDoacao, ResultadoDoacao, ServicoDoacao } from "./ServicoDoacao";

/**
 * Porta de entrada do fluxo de doação (Entrega 2: DoacaoController).
 * Cliente da Facade: comunica-se exclusivamente com o `ServicoDoacao`,
 * buscando os usuários no repositório e exibindo o resultado no terminal (Ata S2_03, D04).
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

  /** Realiza a doação entre dois usuários, delegando o processamento à Facade. */
  doar(
    doadorId: string,
    criadorId: string,
    quantidadeMoedaVirtual: number,
    mensagem: string,
  ): ResultadoDoacao {
    const doador = this.obterUsuarioOuFalhar(doadorId, "Espectador");
    const criador = this.obterUsuarioOuFalhar(criadorId, "Criador");

    const resultado = this.servicoDoacao.processarDoacao(
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
