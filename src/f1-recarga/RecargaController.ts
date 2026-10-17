import type { RepositorioEmMemoria } from "../compartilhado";
import { ErroDominio, type Usuario } from "../dominio";
import { EfeitoConfirmacao, type ConfirmadorPagamento, type ResultadoConfirmacao } from "./confirmacao";
import type { OfertaPacote } from "./Pacote";
import type { NotificacaoPagamento } from "./pagamento";
import type { MetodoRecarga, Recarga } from "./Recarga";
import type { ServicoRecarga } from "./ServicoRecarga";

/**
 * Porta de entrada da recarga (Entrega 2: RecargaController).
 * Cliente do Proxy: cada gateway tem a sua cadeia Proxy → ServicoConfirmacao,
 * e o aviso é encaminhado pelo nome do gateway (a rota do webhook).
 */
export class RecargaController {
  private readonly servico: ServicoRecarga;
  private readonly usuarios: RepositorioEmMemoria<Usuario>;
  private readonly confirmadores: Map<string, ConfirmadorPagamento>;

  constructor(
    servico: ServicoRecarga,
    usuarios: RepositorioEmMemoria<Usuario>,
    confirmadores: Map<string, ConfirmadorPagamento>,
  ) {
    this.servico = servico;
    this.usuarios = usuarios;
    this.confirmadores = confirmadores;
  }

  consultarOfertas(usuarioId: string): OfertaPacote[] {
    return this.servico.consultarOfertas(this.buscarUsuario(usuarioId));
  }

  /** Meios de pagamento externos que o modal oferece ao espectador. */
  consultarMeiosPagamento(): string[] {
    return this.servico.consultarMeiosPagamento();
  }

  /** `gateway` é o meio escolhido pelo espectador; omitido, o sistema escolhe com fallback (O07). */
  recarregar(usuarioId: string, pacoteId: string, metodo: MetodoRecarga, gateway?: string): Promise<Recarga> {
    const usuario = this.buscarUsuario(usuarioId);
    const pacote = this.servico.buscarPacote(pacoteId);
    return this.servico.processarRecarga(usuario, pacote, metodo, gateway);
  }

  async receberWebhook(nomeGateway: string, notificacao: NotificacaoPagamento): Promise<ResultadoConfirmacao> {
    const confirmador = this.confirmadores.get(nomeGateway);
    if (!confirmador) {
      return { efeito: EfeitoConfirmacao.NAO_AUTENTICO, motivo: `gateway desconhecido: ${nomeGateway}` };
    }
    return confirmador.confirmar(notificacao);
  }

  private buscarUsuario(usuarioId: string): Usuario {
    const usuario = this.usuarios.buscarPorId(usuarioId);
    if (!usuario) throw new ErroDominio(`Usuário inexistente: ${usuarioId}`);
    return usuario;
  }
}
