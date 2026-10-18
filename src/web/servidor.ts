/**
 * Front-end da Entrega 3: servidor HTTP mínimo (só módulos do Node) que expõe a
 * história integrada (F1 + F2 + F3) para a página em `src/web/publico`.
 *
 * Executar: npm run web  →  http://localhost:3000
 */
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { ErroDominio } from "../dominio";
import { ErroDaAcao, SessaoDemo } from "./sessao";

const PORTA = Number(process.env.PORT ?? 3000);
const PUBLICO = join(__dirname, "publico");
const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const sessao = new SessaoDemo();

type Corpo = Record<string, unknown>;
type Rota = (corpo: Corpo) => Promise<unknown> | unknown;

const texto = (valor: unknown, campo: string): string => {
  if (typeof valor !== "string" || valor.trim() === "") throw new ErroDaAcao(`Informe ${campo}.`);
  return valor;
};

const rotas: Record<string, Rota> = {
  "GET /api/estado": () => sessao.estado(),
  "GET /api/ofertas": () => sessao.ofertas(),
  "POST /api/meios/alternar": (c) => sessao.alternarMeio(texto(c.nome, "o meio de pagamento")),
  "POST /api/recargas": (c) => sessao.comprar(texto(c.pacoteId, "o pacote"), texto(c.meio, "o meio de pagamento")),
  "POST /api/recargas/verificar": (c) => sessao.verificarPagamento(texto(c.recargaId, "o pedido")),
  "POST /api/doacoes": (c) =>
    sessao.doar(texto(c.canalId, "o canal"), Number(c.quantidade), typeof c.mensagem === "string" ? c.mensagem : ""),
  "POST /api/chat": (c) => sessao.escrever(typeof c.texto === "string" ? c.texto : ""),
  "POST /api/reiniciar": () => sessao.reiniciar(),
};

function responderJson(res: ServerResponse, status: number, dados: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(dados ?? {}));
}

async function lerCorpo(req: IncomingMessage): Promise<Corpo> {
  const partes: Buffer[] = [];
  for await (const parte of req) partes.push(parte as Buffer);
  if (partes.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(partes).toString("utf-8")) as Corpo;
  } catch {
    throw new ErroDaAcao("Requisição com JSON inválido.");
  }
}

async function servirArquivo(caminho: string, res: ServerResponse): Promise<void> {
  const relativo = normalize(caminho === "/" ? "/index.html" : caminho).replace(/^(\.\.[/\\])+/, "");
  try {
    const conteudo = await readFile(join(PUBLICO, relativo));
    res.writeHead(200, { "Content-Type": TIPOS[extname(relativo)] ?? "application/octet-stream" });
    res.end(conteudo);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Página não encontrada.");
  }
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const rota = rotas[`${req.method} ${url.pathname}`];

  if (!url.pathname.startsWith("/api/")) {
    await servirArquivo(url.pathname, res);
    return;
  }
  if (!rota) {
    responderJson(res, 404, { erro: "Rota inexistente." });
    return;
  }

  try {
    // Consultas devolvem o próprio resultado; ações devolvem o estado atualizado.
    const resultado = await rota(await lerCorpo(req));
    responderJson(res, 200, resultado ?? sessao.estado());
  } catch (erro) {
    if (erro instanceof ErroDaAcao || erro instanceof ErroDominio) {
      responderJson(res, 422, { erro: erro.message, estado: sessao.estado() });
      return;
    }
    console.error(erro);
    responderJson(res, 500, { erro: "Erro inesperado no servidor. Veja o terminal." });
  }
});

void sessao.conectarProcessadoresReais().then((linhas) => {
  linhas.forEach((linha) => console.log(linha));
  servidor.listen(PORTA, () => {
    console.log(`Front-end da SubEquipe_02 rodando em http://localhost:${PORTA}`);
  });
});
