/** Estados possíveis de uma transação (Entrega 2: PENDENTE, CONCLUIDA, CANCELADA). */
export const StatusTransacao = {
  PENDENTE: "PENDENTE",
  CONCLUIDA: "CONCLUIDA",
  CANCELADA: "CANCELADA",
} as const;

export type StatusTransacao = (typeof StatusTransacao)[keyof typeof StatusTransacao];
