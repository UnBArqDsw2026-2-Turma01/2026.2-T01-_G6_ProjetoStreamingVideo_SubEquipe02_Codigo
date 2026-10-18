// A regra de negócio fica toda no servidor; aqui só se monta a tela e se enviam as ações.

const $ = (id) => document.getElementById(id);
let pacotes = [];
let pacoteEscolhido = "p100";
let faixas = [];

function el(tag, props = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props)) {
    if (chave === "class") no.className = valor;
    else if (chave.startsWith("on")) no.addEventListener(chave.slice(2), valor);
    else if (valor !== false && valor !== undefined) no.setAttribute(chave, valor === true ? "" : valor);
  }
  no.append(...filhos.filter((f) => f !== null && f !== undefined && f !== false));
  return no;
}

async function chamar(metodo, caminho, corpo) {
  const resposta = await fetch(caminho, {
    method: metodo,
    headers: corpo ? { "Content-Type": "application/json" } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    if (dados.estado) renderizar(dados.estado);
    throw new Error(dados.erro ?? "Não foi possível concluir a ação.");
  }
  return dados;
}

/** Executa uma ação e mostra o erro, se houver, no lugar indicado. */
async function agir(erroId, metodo, caminho, corpo) {
  const erro = erroId && $(erroId);
  if (erro) erro.hidden = true;
  try {
    renderizar(await chamar(metodo, caminho, corpo));
    return true;
  } catch (falha) {
    if (erro) {
      erro.textContent = falha.message;
      erro.hidden = false;
    }
    return false;
  }
}

const numero = (n) => n.toLocaleString("pt-BR");
const hora = (epoch) => new Date(epoch).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// Recarga (F1)

function renderizarPacotes() {
  $("pacotes").replaceChildren(
    ...pacotes.map((p) =>
      el(
        "button",
        {
          type: "button",
          class: "pacote",
          "aria-pressed": p.id === pacoteEscolhido ? "true" : "false",
          onclick: () => {
            pacoteEscolhido = p.id;
            renderizarPacotes();
          },
        },
        el("span", { class: "moedas" }, numero(p.moedas)),
        el("span", { class: "unidade" }, "moedas"),
        el("span", {}, p.precoPromocional),
        p.precoOriginal !== p.precoPromocional ? el("s", {}, p.precoOriginal) : null,
      ),
    ),
  );
  const escolhido = pacotes.find((p) => p.id === pacoteEscolhido);
  $("comprar").textContent = escolhido ? `Comprar por ${escolhido.precoPromocional}` : "Comprar";
}

function renderizarMeios(meios) {
  const escolhido = $("meio").value || meios[0].nome;
  $("meio").replaceChildren(...meios.map((m) => el("option", { value: m.nome, selected: m.nome === escolhido }, m.nome)));
  $("fora-do-ar").replaceChildren(
    ...meios
      .filter((m) => !m.real)
      .map((m) =>
        el(
          "label",
          {},
          el("input", {
            type: "checkbox",
            checked: !m.online,
            onchange: () => agir("erro-recarga", "POST", "/api/meios/alternar", { nome: m.nome }),
          }),
          m.nome,
        ),
      ),
  );
}

/** Só o último pedido aparece: aguardando pagamento ou já creditado. */
function renderizarPedido(p) {
  if (!p) {
    $("pedido").replaceChildren();
    return;
  }
  if (p.status === "CONCLUIDA") {
    $("pedido").replaceChildren(el("div", { class: "pedido concluido" }, el("p", {}, `${numero(p.moedas)} moedas creditadas.`)));
    return;
  }
  const verificar = el(
    "button",
    { type: "button", onclick: () => agir("erro-recarga", "POST", "/api/recargas/verificar", { recargaId: p.id }) },
    p.real ? "Verificar pagamento" : "Pagar",
  );
  $("pedido").replaceChildren(
    el(
      "div",
      { class: "pedido" },
      el("p", {}, `Aguardando o pagamento de ${p.valor} no ${p.meio}.`),
      p.link
        ? el(
            "p",
            {},
            el("a", { href: p.link, target: "_blank", rel: "noopener" }, "Abrir checkout"),
            el("span", { class: "nota" }, ` (${p.comoPagar})`),
          )
        : null,
      el("p", {}, verificar),
      p.aviso ? el("p", { class: "nota" }, p.aviso) : null,
    ),
  );
}

// Doação (F2)

function faixaDe(quantidade) {
  return [...faixas].reverse().find((f) => quantidade >= f.quantidadeMinima);
}

/** Atalhos com o mínimo de cada faixa; o campo abaixo aceita qualquer outro valor. */
function renderizarValores() {
  const atual = faixaDe(Number($("quantidade").value));
  $("valores").replaceChildren(
    ...faixas.map((f) =>
      el(
        "button",
        {
          type: "button",
          class: `valor ${f.cor}`,
          "aria-pressed": atual?.codigo === f.codigo ? "true" : "false",
          onclick: () => {
            $("quantidade").value = f.quantidadeMinima;
            atualizarFaixa();
          },
        },
        numero(f.quantidadeMinima),
      ),
    ),
  );
}

function atualizarFaixa() {
  const faixa = faixaDe(Number($("quantidade").value));
  const tamanho = Array.from($("mensagem").value).length;
  renderizarValores();
  if (!faixa) {
    $("faixa").textContent = `O mínimo é ${faixas[0]?.quantidadeMinima ?? 200} moedas.`;
    $("contador").textContent = `${tamanho} caracteres`;
    return;
  }
  const minutos = faixa.tempoFixacaoMin;
  const fixacao = minutos
    ? `Fica fixada no chat por ${minutos >= 60 ? `${minutos / 60} h` : `${minutos} min`}.`
    : "Não fica fixada no chat.";
  $("faixa").textContent = `${fixacao} Até ${faixa.limiteCaracteres} caracteres.`;
  $("contador").textContent = `${tamanho}/${faixa.limiteCaracteres} caracteres`;
}

function renderizarCanais(canais) {
  const atual = $("canal").value || canais[0].id;
  $("canal").replaceChildren(
    ...canais.map((c) =>
      el("option", { value: c.id, selected: c.id === atual }, c.monetizado ? c.nome : `${c.nome} (não monetizado)`),
    ),
  );
}

// Notificações do criador: só as doações que deram certo.

function renderizarNotificacoes(notificacoes) {
  $("notificacoes").replaceChildren(
    ...(notificacoes.length
      ? notificacoes.map((n) =>
          el(
            "li",
            {},
            el("div", {}, el("b", {}, n.autor), ` doou ${numero(n.quantidade)} moedas para ${n.canal}`),
            el("p", { class: "nota" }, `Repasse de ${n.repasse}, às ${hora(n.em)}`),
          ),
        )
      : [el("li", { class: "nota" }, "Nenhuma doação recebida ainda.")]),
  );
}

// Chat (F3)

let mensagens = [];
let diferencaRelogio = 0; // relógio do servidor menos o do navegador
let chaveFixadas = "";

const agoraNoServidor = () => Date.now() + diferencaRelogio;

function itemDoChat(m) {
  if (m.tipo === "comum") return el("li", {}, el("b", {}, `${m.autor}: `), m.texto);
  return el(
    "li",
    { class: `destacada ${m.cor ?? ""}` },
    el("div", { class: "autor" }, el("b", {}, m.autor), ` ${numero(m.quantidade)} moedas`),
    el("div", {}, m.texto),
  );
}

/** Versão compacta da mensagem fixada; a mensagem inteira aparece ao passar o mouse. */
function itemFixado(m) {
  return el(
    "li",
    { class: `fixada ${m.cor ?? ""}`, "data-id": m.id },
    el("b", {}, m.autor),
    el("span", {}, numero(m.quantidade)),
    el("span", { class: "trecho" }, m.texto),
    el(
      "div",
      { class: "completa" },
      el("div", { class: "autor" }, el("b", {}, m.autor), ` ${numero(m.quantidade)} moedas`),
      el("div", {}, m.texto),
    ),
  );
}

/**
 * Mensagens com fixação valendo ficam no topo e saem quando o tempo acaba.
 * Só recria a lista quando ela muda, para não desfazer o hover a cada segundo.
 */
function renderizarFixadas() {
  const agora = agoraNoServidor();
  const ativas = mensagens.filter((m) => m.tipo === "destacada" && m.fixadaAte && m.fixadaAte > agora).reverse();
  const chave = ativas.map((m) => m.id).join(",");
  if (chave !== chaveFixadas) {
    chaveFixadas = chave;
    $("fixadas").replaceChildren(...ativas.map(itemFixado));
  }
  for (const m of ativas) {
    const restante = Math.max(0, (m.fixadaAte - agora) / (m.fixadaAte - m.exibidaEm));
    $("fixadas").querySelector(`[data-id="${m.id}"]`)?.style.setProperty("--restante", `${restante * 100}%`);
  }
}

function renderizarChat(lista, agora) {
  mensagens = lista;
  diferencaRelogio = agora - Date.now();
  renderizarFixadas();
  const ul = $("mensagens");
  const noFim = ul.scrollHeight - ul.scrollTop - ul.clientHeight < 30;
  ul.replaceChildren(...mensagens.map(itemDoChat));
  if (noFim) ul.scrollTop = ul.scrollHeight;
}

setInterval(renderizarFixadas, 1000);

// Tela

function renderizar(estado) {
  faixas = estado.faixas;
  $("saldo-espectador").textContent = numero(estado.espectador.moedas);
  $("saldo-criador").textContent = estado.canais.find((c) => c.id === "criador").saldo;
  renderizarMeios(estado.meios);
  renderizarPedido(estado.pedido);
  renderizarCanais(estado.canais);
  renderizarNotificacoes(estado.notificacoes);
  renderizarChat(estado.mensagens, estado.agora);
  atualizarFaixa();
}

$("quantidade").addEventListener("input", atualizarFaixa);
$("mensagem").addEventListener("input", atualizarFaixa);

$("comprar").addEventListener("click", () =>
  agir("erro-recarga", "POST", "/api/recargas", { pacoteId: pacoteEscolhido, meio: $("meio").value }),
);

$("doar").addEventListener("click", () =>
  agir("erro-doacao", "POST", "/api/doacoes", {
    canalId: $("canal").value,
    quantidade: Number($("quantidade").value),
    mensagem: $("mensagem").value,
  }),
);

$("form-chat").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (await agir("erro-chat", "POST", "/api/chat", { texto: $("texto-chat").value })) $("texto-chat").value = "";
});

$("reiniciar").addEventListener("click", () => {
  ["erro-recarga", "erro-doacao", "erro-chat"].forEach((id) => ($(id).hidden = true));
  agir(null, "POST", "/api/reiniciar");
});

(async () => {
  const ofertas = await chamar("GET", "/api/ofertas");
  pacotes = ofertas.pacotes;
  if (ofertas.descontoPercentual > 0) $("desconto").textContent = `${ofertas.descontoPercentual}% OFF`;
  if (ofertas.aliquotaImposto > 0) $("imposto").textContent = `(imposto de ${ofertas.aliquotaImposto}%)`;
  renderizarPacotes();
  renderizar(await chamar("GET", "/api/estado"));
})();
