import type { Usuario } from "../dominio";

/**
 * Dados da doação entregues ao chat para exibição da mensagem destacada.
 * É o único dado que atravessa a fronteira entre a F2 (Doação) e a F3 (Chat).
 */
export interface DoacaoNotificada {
  readonly doacaoId: string;
  readonly doador: Usuario;
  readonly criador: Usuario;
  readonly quantidadeMoedaVirtual: number;
  readonly mensagem: string;
}

/**
 * Contrato de integração entre a F2 e a F3.
 *
 * - A **F2** depende apenas desta interface: ao concluir a doação, chama
 *   `exibirMensagemDestacada`, sem conhecer como o chat funciona por dentro.
 * - A **F3** fornece a implementação real, com o Decorator da mensagem destacada.
 *
 * A exibição é assíncrona e não condiciona o repasse ao criador
 * (Ata S2_02, D05): uma falha aqui não invalida a doação.
 */
export interface NotificadorChat {
  exibirMensagemDestacada(doacao: DoacaoNotificada): void;
}
