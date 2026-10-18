// Página da demonstração integrada. Toda regra de negócio fica no servidor;
// aqui só se monta a tela a partir do estado e se enviam as ações.

const $ = (id) => document.getElementById(id);
let estado = null;
let faixas = [];

function el(tag, props = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props)) {
    if (chave === "class") no.className = valor;
    else if (chave === "style") no.style.cssText = valor;
    else if (chave.startsWith("on")) no.addEventListener(chave.slice(2), valor);
    else if (valor !== false && valor !== undefined) no.setAttribute(chave, valor === true ? "" : valor);
  }
  for (const filho of filhos.flat()) {
    if (filho !== null && filho !== undefined) no.append(filho);
  }
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

/** Executa uma ação, mostra o erro no painel certo e redesenha a tela. */
async function agir(botao, erroId, metodo, caminho, corpo) {
  const erro = erroId ? $(erroId) : null;
  if (erro) erro.hidden = true;
  if (botao) botao.disabled = true;
  try {
    renderizar(await chamar(metodo, caminho, corpo));
  } catch (falha) {
    if (erro) {
      erro.textContent = falha.message;
      erro.hidden = false;
    }
  } finally {
    if (botao) botao.disabled = false;
  }
}

// ---------- Recarga (F1) ----------

function renderizarPacotes(ofertas) {
  const lista = $("lista-pacotes");
  lista.replaceChildren(
    ...ofertas.map((oferta, i) =>
      el(
        "label",
        { class: "pacote" },
        el("input", { type: "radio", name: "pacote", value: oferta.id, checked: i === 1 }),
        el("span", { class: "moedas" }, `${oferta.moedas.toLocaleString("pt-BR")} moedas`),
        el("span", { class: "precos" }, el("s", {}, oferta.precoOriginal), el("span", {}, oferta.precoPromocional)),
      ),
    ),
  );
  lista.addEventListener("change", () => mostrarComposicao(ofertas));
  mostrarComposicao(ofertas);
}

function mostrarComposicao(ofertas) {
  const id = document.querySelector('input[name="pacote"]:checked')?.value;
  const oferta = ofertas.find((o) => o.id === id);
  let nota = $("composicao");
  if (!nota) {
    nota = el("p", { class: "composicao", id: "composicao" });
    $("lista-pacotes").after(nota);
  }
  nota.textContent = oferta ? `Como o preço é calculado: ${oferta.composicao}` : "";
}

function renderizarMeios(meios) {
  const escolhido = document.querySelector('input[name="meio"]:checked')?.value ?? meios[0]?.nome;
  $("lista-meios").replaceChildren(
    ...meios.map((meio) =>
      el(
        "div",
        { class: "meio" },
        el(
          "label",
          {},
          el("input", { type: "radio", name: "meio", value: meio.nome, checked: meio.nome === escolhido }),
          meio.nome,
          el("span", { class: `situacao${meio.online ? "" : " fora"}` }, meio.online ? "disponível" : "fora do ar"),
        ),
        el(
          "button",
          {
            type: "button",
            class: "botao-linha",
            onclick: (e) => agir(e.currentTarget, "erro-recarga", "POST", "/api/meios/alternar", { nome: meio.nome }),
          },
          meio.online ? "Tirar do ar" : "Colocar no ar",
        ),
      ),
    ),
  );
}

function renderizarPedidos(pedidos) {
  $("pedidos").replaceChildren(
    ...pedidos.map((pedido) => {
      const corpo = { recargaId: pedido.id };
      const acoes =
        pedido.status === "PENDENTE"
          ? [
              el("button", { type: "button", class: "botao-linha", onclick: (e) => agir(e.currentTarget, "erro-recarga", "POST", "/api/recargas/pagar", corpo) }, "Pagar no processador"),
              el("button", { type: "button", class: "botao-linha", onclick: (e) => agir(e.currentTarget, "erro-recarga", "POST", "/api/recargas/aviso-falso", corpo) }, "Simular aviso falso"),
            ]
          : [
              el("button", { type: "button", class: "botao-linha", onclick: (e) => agir(e.currentTarget, "erro-recarga", "POST", "/api/recargas/reenviar-aviso", corpo) }, "Reenviar o aviso"),
              el("button", { type: "button", class: "botao-linha", onclick: (e) => agir(e.currentTarget, "erro-recarga", "POST", "/api/recargas/aviso-falso", corpo) }, "Simular aviso falso"),
            ];
      return el(
        "div",
        { class: "pedido" },
        el(
          "p",
          {},
          `${pedido.moedas.toLocaleString("pt-BR")} moedas por ${pedido.valor} no ${pedido.meio}: `,
          el("span", { class: `status ${pedido.status}` }, pedido.status === "PENDENTE" ? "aguardando pagamento" : pedido.status.toLowerCase()),
        ),
        el("div", { class: "pedido-acoes" }, acoes),
      );
    }),
  );
}

// ---------- Doação (F2) ----------

function faixaPara(quantidade) {
  return [...faixas].reverse().find((f) => quantidade >= f.quantidadeMinima);
}

function atualizarPrevia() {
  const quantidade = Number($("quantidade").value);
  const faixa = faixaPara(quantidade);
  const previa = $("faixa-previa");
  const contador = $("contador");
  const tamanho = Array.from($("mensagem").value).length;

  if (!faixa) {
    previa.replaceChildren(`O mínimo para mensagem destacada é ${faixas[0]?.quantidadeMinima ?? 200} moedas.`);
    contador.textContent = `${tamanho} caracteres`;
    contador.classList.remove("passou");
    return;
  }
  const fixacao = faixa.tempoFixacaoMin === 0 ? "sem fixação" : `fixada por ${duracao(faixa.tempoFixacaoMin)}`;
  previa.replaceChildren(
    el("span", { class: "amostra", style: `background: var(--${faixa.cor})` }),
    `${faixa.codigo.replace("_", " ")}: ${faixa.cor.toLowerCase()}, ${fixacao}, até ${faixa.limiteCaracteres} caracteres`,
  );
  contador.textContent = `${tamanho} de ${faixa.limiteCaracteres} caracteres`;
  contador.classList.toggle("passou", tamanho > faixa.limiteCaracteres);
}

function duracao(minutos) {
  return minutos >= 60 && minutos % 60 === 0 ? `${minutos / 60} h` : `${minutos} min`;
}

function renderizarCanais(canais) {
  const select = $("canal");
  const atual = select.value || canais[0]?.id;
  select.replaceChildren(
    ...canais.map((canal) =>
      el("option", { value: canal.id, selected: canal.id === atual }, canal.monetizado ? canal.nome : `${canal.nome} (não monetizado)`),
    ),
  );
}

// ---------- Chat (F3) ----------

function mensagemNoChat(m, fixada) {
  return el(
    "li",
    { class: `mensagem${fixada ? " fixada" : ""}`, style: `--cor: var(--${m.cor})` },
    el("p", { class: "cabecalho" }, m.cabecalho),
    el("p", { class: "texto" }, m.texto),
    fixada ? null : el("p", { class: "camadas" }, `Camadas: ${m.camadas}`),
  );
}

function renderizarChat(mensagens) {
  const fixadas = mensagens.filter((m) => m.fixacaoMin > 0).slice(0, 2);
  $("fixadas").replaceChildren(...fixadas.map((m) => mensagemNoChat(m, true)));
  $("mensagens").replaceChildren(
    ...(mensagens.length
      ? mensagens.map((m) => mensagemNoChat(m, false))
      : [el("li", { class: "vazio" }, "Nenhuma mensagem destacada ainda. Faça uma doação com mensagem para ela aparecer aqui.")]),
  );
}

// ---------- Padrões em ação ----------

function renderizarEventos(eventos) {
  $("eventos").replaceChildren(
    ...(eventos.length
      ? eventos.map((e) =>
          el(
            "li",
            { class: `evento ${e.tipo}` },
            el("span", { class: "f" }, e.frente),
            el("span", { class: "p" }, e.padrao),
            el("span", { class: "t" }, e.texto),
          ),
        )
      : [el("li", { class: "vazio" }, "Compre um pacote para começar. Cada passo mostra aqui qual padrão agiu.")]),
  );
}

// ---------- Tela ----------

function renderizar(novo) {
  estado = novo;
  faixas = novo.faixas;
  $("saldo-espectador").textContent = novo.espectador.moedas.toLocaleString("pt-BR");
  $("saldo-criador").textContent = novo.canais.find((c) => c.id === "criador")?.saldo ?? "";
  renderizarMeios(novo.meios);
  renderizarPedidos(novo.pedidos);
  renderizarCanais(novo.canais);
  renderizarChat(novo.mensagens);
  renderizarEventos(novo.eventos);
  atualizarPrevia();
}

$("comprar").addEventListener("click", (e) => {
  const pacoteId = document.querySelector('input[name="pacote"]:checked')?.value;
  const meio = document.querySelector('input[name="meio"]:checked')?.value;
  agir(e.currentTarget, "erro-recarga", "POST", "/api/recargas", { pacoteId, meio });
});

$("doar").addEventListener("click", (e) => {
  agir(e.currentTarget, "erro-doacao", "POST", "/api/doacoes", {
    canalId: $("canal").value,
    quantidade: Number($("quantidade").value),
    mensagem: $("mensagem").value,
  });
});

$("reiniciar").addEventListener("click", (e) => {
  $("erro-recarga").hidden = true;
  $("erro-doacao").hidden = true;
  agir(e.currentTarget, null, "POST", "/api/reiniciar");
});

$("quantidade").addEventListener("input", atualizarPrevia);
$("mensagem").addEventListener("input", atualizarPrevia);

(async () => {
  const [ofertas, inicial] = await Promise.all([chamar("GET", "/api/ofertas"), chamar("GET", "/api/estado")]);
  renderizarPacotes(ofertas);
  renderizar(inicial);
})();
