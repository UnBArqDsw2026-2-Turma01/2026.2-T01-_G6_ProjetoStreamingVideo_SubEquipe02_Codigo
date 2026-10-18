// A regra de negócio fica toda no servidor; aqui só se monta a tela e se enviam as ações.

const $ = (id) => document.getElementById(id);
let pacotes = [];
let pacoteEscolhido = "p100";
let aliquotaImposto = 0;
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
const horaComSegundos = (epoch) => new Date(epoch).toLocaleTimeString("pt-BR");

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
        p.descontoPercentual > 0 ? el("span", { class: "desconto-pacote" }, `-${p.descontoPercentual}%`) : null,
        el("span", { class: "moedas" }, numero(p.moedas)),
        el("span", { class: "unidade" }, "moedas"),
        el("span", {}, p.precoPromocional),
        p.precoSemDesconto !== p.precoPromocional ? el("s", {}, p.precoSemDesconto) : null,
      ),
    ),
  );
  const escolhido = pacotes.find((p) => p.id === pacoteEscolhido);
  $("comprar").textContent = escolhido ? `Comprar por ${escolhido.precoPromocional}` : "Comprar";
  renderizarResumo(escolhido);
}

/**
 * Conta do pacote escolhido, toda em preço final (com imposto): o desconto do pacote
 * vale sobre o preço sem desconto, e o imposto aparece como valor incluído no total.
 */
function renderizarResumo(p) {
  if (!p) {
    $("resumo").replaceChildren();
    return;
  }
  const linha = (rotulo, valor, classe = "") => el("div", { class: `linha ${classe}` }, el("span", {}, rotulo), el("span", {}, valor));
  $("resumo").replaceChildren(
    linha(`${numero(p.moedas)} moedas`, p.precoSemDesconto),
    p.descontoPercentual > 0 ? linha(`Desconto do pacote (${p.descontoPercentual}%)`, `− ${p.valorDesconto}`, "desconto") : null,
    linha("Total", p.precoPromocional, "total"),
    aliquotaImposto > 0 ? el("p", { class: "nota imposto" }, `Inclui ${p.valorImposto} de imposto (${aliquotaImposto}%).`) : null,
  );
}

function renderizarMeios(meios) {
  const escolhido = $("meio").value || meios[0].nome;
  $("meio").replaceChildren(...meios.map((m) => el("option", { value: m.nome, selected: m.nome === escolhido }, m.nome)));
  $("fora-do-ar").replaceChildren(
    ...meios.map((m) =>
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

/**
 * Acompanhamento automático do pedido num meio real: enquanto estiver PENDENTE, a página
 * consulta o processador sozinha (o mesmo que o botão "Verificar" fazia) e para quando
 * o pagamento é creditado, a recarga é cancelada ou o tempo limite acaba.
 */
const INTERVALO_VERIFICACAO_MS = 5000;
const LIMITE_VERIFICACAO_MS = 30 * 60 * 1000; // validade da sessão do Stripe
const acompanhamento = { id: null, timer: null, inicio: 0, emAndamento: false, ultima: 0, esgotado: false };

function pararAcompanhamento() {
  clearInterval(acompanhamento.timer);
  Object.assign(acompanhamento, { id: null, timer: null, emAndamento: false, ultima: 0, esgotado: false });
}

function acompanharPedido(p) {
  if (!p || !p.real || p.status !== "PENDENTE") {
    pararAcompanhamento();
    return;
  }
  if (acompanhamento.id === p.id) return;
  pararAcompanhamento();
  Object.assign(acompanhamento, {
    id: p.id,
    inicio: Date.now(),
    timer: setInterval(verificarAutomaticamente, INTERVALO_VERIFICACAO_MS),
  });
}

/** Uma consulta por vez, e só com a aba visível; a volta à aba dispara uma consulta na hora. */
async function verificarAutomaticamente() {
  const { id } = acompanhamento;
  if (!id || acompanhamento.emAndamento || document.hidden) return;
  if (Date.now() - acompanhamento.inicio > LIMITE_VERIFICACAO_MS) {
    clearInterval(acompanhamento.timer);
    acompanhamento.esgotado = true;
    renderizar(await chamar("GET", "/api/estado"));
    return;
  }
  acompanhamento.emAndamento = true;
  try {
    await agir("erro-recarga", "POST", "/api/recargas/verificar", { recargaId: id });
  } finally {
    if (acompanhamento.id === id) {
      acompanhamento.emAndamento = false;
      acompanhamento.ultima = Date.now();
      $("ultima-verificacao")?.replaceChildren(`Última verificação às ${horaComSegundos(acompanhamento.ultima)}.`);
    }
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) verificarAutomaticamente();
});

/** Recomeça o acompanhamento depois do tempo limite, a pedido do espectador. */
function retomarAcompanhamento() {
  const id = acompanhamento.id;
  pararAcompanhamento();
  acompanharPedido({ id, real: true, status: "PENDENTE" });
  verificarAutomaticamente();
}

/** Só o último pedido aparece: aguardando pagamento ou já creditado. */
function renderizarPedido(p) {
  acompanharPedido(p);
  if (!p) {
    $("pedido").replaceChildren();
    return;
  }
  const troca = p.troca ? el("p", { class: "nota troca" }, p.troca) : null;
  if (p.status === "CONCLUIDA") {
    $("pedido").replaceChildren(
      el("div", { class: "pedido concluido" }, el("p", {}, `${numero(p.moedas)} moedas creditadas no ${p.meio}.`), troca),
    );
    return;
  }
  if (p.status === "CANCELADA") {
    $("pedido").replaceChildren(el("div", { class: "pedido" }, el("p", {}, `Pedido de ${p.valor} no ${p.meio} cancelado.`)));
    return;
  }

  // Simulado: o espectador "paga" pelo botão. Real: paga no checkout e a página acompanha sozinha.
  const acao = p.real
    ? acompanhamento.esgotado
      ? el(
          "p",
          {},
          el("span", { class: "nota" }, "Parei de verificar automaticamente. "),
          el("button", { type: "button", onclick: retomarAcompanhamento }, "Verificar de novo"),
        )
      : el(
          "p",
          { class: "nota", id: "ultima-verificacao" },
          acompanhamento.ultima
            ? `Última verificação às ${horaComSegundos(acompanhamento.ultima)}.`
            : "Verificando automaticamente a cada 5 segundos.",
        )
    : el(
        "p",
        {},
        el(
          "button",
          { type: "button", onclick: () => agir("erro-recarga", "POST", "/api/recargas/verificar", { recargaId: p.id }) },
          "Pagar",
        ),
      );

  $("pedido").replaceChildren(
    el(
      "div",
      { class: `pedido${p.real ? " pendente" : ""}` },
      troca,
      el(
        "p",
        {},
        p.real ? el("span", { class: "selo" }, "Pendente") : null,
        p.real ? ` Aguardando a confirmação do pagamento de ${p.valor} no ${p.meio}.` : `Aguardando o pagamento de ${p.valor} no ${p.meio}.`,
      ),
      p.link
        ? el(
            "div",
            { class: "checkout" },
            el(
              "a",
              { class: "botao-pagar", href: p.link, target: "_blank", rel: "noopener" },
              `Pagar no ${p.meio}`,
              el("span", { "aria-hidden": "true" }, " ↗"),
            ),
            el("p", { class: "nota" }, `Abre em outra aba. ${p.comoPagar.charAt(0).toUpperCase()}${p.comoPagar.slice(1)}.`),
          )
        : null,
      acao,
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

/**
 * Com mensagem, a doação segue a faixa (mínimo de 200 moedas). Abaixo disso, ou com a
 * mensagem em branco, vai como doação simples, sem passar pelo chat.
 */
function atualizarFaixa() {
  const faixa = faixaDe(Number($("quantidade").value));
  const tamanho = Array.from($("mensagem").value).length;
  renderizarValores();
  $("mensagem").disabled = !faixa;
  if (!faixa) {
    $("faixa").textContent = `Abaixo de ${faixas[0]?.quantidadeMinima ?? 200} moedas, a doação vai sem mensagem.`;
    $("contador").textContent = "";
    return;
  }
  const minutos = faixa.tempoFixacaoMin;
  const fixacao = minutos
    ? `Fica fixada no chat por ${minutos >= 60 ? `${minutos / 60} h` : `${minutos} min`}.`
    : "Não fica fixada no chat.";
  $("faixa").textContent = `${fixacao} Até ${faixa.limiteCaracteres} caracteres.`;
  $("contador").textContent = tamanho
    ? `${tamanho}/${faixa.limiteCaracteres} caracteres`
    : "Opcional. Sem mensagem, a doação não aparece no chat.";
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
let chaveFixadas = "";
// Relógio da demonstração no servidor (acelerável): hora recebida, quando chegou e a velocidade.
const relogio = { agora: Date.now(), recebidoEm: Date.now(), velocidade: 1 };

const agoraNoServidor = () => relogio.agora + (Date.now() - relogio.recebidoEm) * relogio.velocidade;

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

function renderizarChat(lista, agora, velocidade) {
  mensagens = lista;
  Object.assign(relogio, { agora, recebidoEm: Date.now(), velocidade });
  renderizarFixadas();
  const ul = $("mensagens");
  const noFim = ul.scrollHeight - ul.scrollTop - ul.clientHeight < 30;
  ul.replaceChildren(...mensagens.map(itemDoChat));
  if (noFim) ul.scrollTop = ul.scrollHeight;
}

setInterval(renderizarFixadas, 200);

function renderizarVelocidades(atual) {
  $("velocidades").replaceChildren(
    ...[1, 10, 100, 1000].map((v) =>
      el(
        "button",
        {
          type: "button",
          "aria-pressed": v === atual ? "true" : "false",
          onclick: () => agir(null, "POST", "/api/velocidade", { velocidade: v }),
        },
        `${v}x`,
      ),
    ),
  );
}

// Tela

function renderizar(estado) {
  faixas = estado.faixas;
  $("saldo-espectador").textContent = numero(estado.espectador.moedas);
  $("saldo-criador").textContent = estado.canais.find((c) => c.id === "criador").saldo;
  renderizarMeios(estado.meios);
  renderizarPedido(estado.pedido);
  renderizarCanais(estado.canais);
  renderizarNotificacoes(estado.notificacoes);
  renderizarChat(estado.mensagens, estado.agora, estado.velocidade);
  renderizarVelocidades(estado.velocidade);
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
    mensagem: $("mensagem").disabled ? "" : $("mensagem").value,
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
  aliquotaImposto = ofertas.aliquotaImposto;
  renderizarPacotes();
  renderizar(await chamar("GET", "/api/estado"));
})();
