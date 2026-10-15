import { createHmac, timingSafeEqual } from "node:crypto";
import type { NotificacaoPagamento } from "./GatewayPagamento";

/**
 * Assinatura HMAC-SHA256 dos avisos de pagamento.
 *
 * Esquema simplificado e comum aos adaptadores nesta entrega: assina
 * "idEvento:idPagamento:recargaId" com o segredo do processador.
 * Na integração real, cada adaptador passa a seguir o formato do seu
 * processador (cabeçalhos próprios, carimbo de tempo); o Proxy não muda,
 * porque só chama `gateway.validarWebhook`.
 */
export function assinarNotificacao(
  segredo: string,
  dados: Omit<NotificacaoPagamento, "assinatura">,
): string {
  return createHmac("sha256", segredo)
    .update(`${dados.idEvento}:${dados.idPagamento}:${dados.recargaId}`)
    .digest("hex");
}

/** Compara em tempo constante, para não vazar informação pelo tempo de resposta. */
export function assinaturaConfere(segredo: string, notificacao: NotificacaoPagamento): boolean {
  const esperada = Buffer.from(assinarNotificacao(segredo, notificacao), "hex");
  const recebida = Buffer.from(notificacao.assinatura, "hex");
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}
