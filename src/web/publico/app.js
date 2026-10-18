// A regra de negócio fica toda no servidor; aqui só se monta a tela e se enviam as ações.

const $ = (id) => document.getElementById(id);
let ofertas = [];
let faixas = [];

function el(tag, props = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props)) {
    if (chave === "class") no.className = valor;
    else if (chave.startsWith("on")) no.addEventListener(chave.slice(2), valor);
    else if (valor !== false && valor !== undefined) no.setAttribute(chave, valor === true ? "" : valor);
  }
  no.append(...filhos.filter((f) => f !== null && f !== undefined));
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

// Recarga (F1)

function renderizarPacotes() {
  $("pacote").replaceChildren(
    ...ofertas.map((o) =>
      el("option", { value: o.id }, `${o.moedas} moedas - ${o.precoPromocional} (de ${o.precoOriginal})`),
    ),
  );
  $("pacote").value = "p10";
  mostrarComposicao();
}

function mostrarComposicao() {
  const oferta = ofertas.find((o) => o.id === $("pacote").value);
  $("composicao").textContent = oferta ? oferta.composicao : "";
}

function renderizarMeios(meios) {
  const escolhido = $("meio").value || meios[0].nome;
  $("meio").replaceChildren(...meios.map((m) => el("option", { value: m.nome, selected: m.nome === escolhido }, m.nome)));
  $("fora-do-ar").replaceChildren(
    ...meios.filter((m) => !m.real).map((m) =>
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

function renderizarPedidos(pedidos) {
  $("pedidos").replaceChildren(
    ...pedidos.map((p) => {
      const corpo = { recargaId: p.id };
      const botao = (rotulo, caminho) =>
        el("button", { type: "button", onclick: () => agir("erro-recarga", "POST", caminho, corpo) }, rotulo);
      const pendente = p.status === "PENDENTE";
      return el(
        "div",
        { class: "pedido" },
        el("p", {}, `${p.id}: ${p.moedas} moedas por ${p.valor} no ${p.meio} (${p.status})`),
        pendente && p.link
          ? el("p", {}, el("a", { href: p.link, target: "_blank", rel: "noopener" }, "Abrir checkout"), ` (${p.comoPagar})`)
          : null,
        pendente && !p.real ? botao("Pagar", "/api/recargas/verificar") : null,
        pendente && p.real ? botao("Verificar pagamento", "/api/recargas/verificar") : null,
        p.status === "CONCLUIDA" ? botao("Reenviar aviso", "/api/recargas/reenviar-aviso") : null,
        p.aviso ? el("p", { class: "nota" }, p.aviso) : null,
      );
    }),
  );
}

// Doação (F2)

function atualizarFaixa() {
  const quantidade = Number($("quantidade").value);
  const faixa = [...faixas].reverse().find((f) => quantidade >= f.quantidadeMinima);
  const tamanho = Array.from($("mensagem").value).length;
  if (!faixa) {
    $("faixa").textContent = `Mínimo de ${faixas[0]?.quantidadeMinima ?? 200} moedas.`;
    $("contador").textContent = `${tamanho} caracteres`;
    return;
  }
  const fixacao = faixa.tempoFixacaoMin ? `fixada por ${faixa.tempoFixacaoMin} min` : "sem fixação";
  $("faixa").textContent = `${faixa.codigo}: ${faixa.cor}, ${fixacao}, até ${faixa.limiteCaracteres} caracteres`;
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

// Chat (F3)

let mensagens = [];
let diferencaRelogio = 0; // relógio do servidor menos o do navegador

const agoraNoServidor = () => Date.now() + diferencaRelogio;

function itemDoChat(m) {
  if (m.tipo === "comum") return el("li", {}, el("b", {}, `${m.autor}: `), m.texto);
  return el(
    "li",
    { class: `destacada ${m.cor ?? ""}` },
    el("div", { class: "autor" }, el("b", {}, m.autor), ` ${m.quantidade} moedas`),
    el("div", {}, m.texto),
  );
}

/** Mensagens com fixação ainda valendo ficam no topo; ao acabar o tempo, saem de lá. */
function renderizarFixadas() {
  const agora = agoraNoServidor();
  const ativas = mensagens.filter((m) => m.tipo === "destacada" && m.fixadaAte && m.fixadaAte > agora).reverse();
  $("fixadas").replaceChildren(
    ...ativas.map((m) => {
      const item = itemDoChat(m);
      const restante = (m.fixadaAte - agora) / (m.fixadaAte - m.exibidaEm);
      item.append(el("div", { class: "tempo", style: `width: ${Math.max(0, restante) * 100}%` }));
      return item;
    }),
  );
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
  $("saldo-espectador").textContent = estado.espectador.moedas;
  $("saldo-criador").textContent = estado.canais.find((c) => c.id === "criador").saldo;
  renderizarMeios(estado.meios);
  renderizarPedidos(estado.pedidos);
  renderizarCanais(estado.canais);
  renderizarChat(estado.mensagens, estado.agora);
  atualizarFaixa();
}

$("pacote").addEventListener("change", mostrarComposicao);
$("quantidade").addEventListener("input", atualizarFaixa);
$("mensagem").addEventListener("input", atualizarFaixa);

$("comprar").addEventListener("click", () =>
  agir("erro-recarga", "POST", "/api/recargas", { pacoteId: $("pacote").value, meio: $("meio").value }),
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
  ofertas = await chamar("GET", "/api/ofertas");
  renderizarPacotes();
  renderizar(await chamar("GET", "/api/estado"));
})();
