// Regra geral de gráficos do site (SPEC F6.4): todo gráfico tem (1) um ícone (?)
// no cabeçalho com a dica "o que mede / como ler" e (2) uma caixa que segue o
// mouse com o período, o valor e, quando o pacote tem, a faixa de 95% e a base.
let flutuante = null;
let popAjuda = null;

function criarFlutuante(classe) {
  const el = document.createElement("div");
  el.className = classe;
  el.setAttribute("role", "tooltip");
  el.hidden = true;
  document.body.appendChild(el);
  return el;
}

function posicionar(el, x, y) {
  const margem = 12;
  el.style.left = "0px";
  el.style.top = "0px";
  const { width, height } = el.getBoundingClientRect();
  let px = x + margem;
  let py = y + margem;
  if (px + width > window.innerWidth - 4) px = Math.max(4, x - width - margem);
  if (py + height > window.innerHeight - 4) py = Math.max(4, y - height - margem);
  el.style.left = `${px}px`;
  el.style.top = `${py}px`;
}

/** Mostra a caixa de valor junto ao ponteiro. `html` já deve estar escapado/seguro. */
export function mostrarDica(evento, html) {
  flutuante ??= criarFlutuante("dica-flutuante");
  flutuante.innerHTML = html;
  flutuante.hidden = false;
  posicionar(flutuante, evento.clientX, evento.clientY);
}

export function esconderDica() {
  if (flutuante) flutuante.hidden = true;
}

/**
 * Liga a caixa de valor a um conjunto de elementos. `alvos`: seleção d3, NodeList
 * ou elemento. `texto(d, el)` devolve o HTML da caixa (ou vazio para não mostrar).
 */
export function ligarDica(alvos, texto) {
  const lista = alvos?.nodes ? alvos.nodes() : alvos instanceof Element ? [alvos] : [...(alvos ?? [])];
  for (const el of lista) {
    if (el.classList.contains("dica-alvo")) continue; // já ligado
    el.classList.add("dica-alvo");
    const dado = () => el.__data__;
    const mostrar = (e) => {
      const html = texto(dado(), el);
      if (html) mostrarDica(e, html);
      else esconderDica();
    };
    el.addEventListener("mouseenter", mostrar);
    el.addEventListener("mousemove", mostrar);
    el.addEventListener("mouseleave", esconderDica);
  }
}

/** Marca o contêiner como gráfico (contado pelo teste "gráficos = ícones (?) = caixas"). */
export function marcarGrafico(el, nome) {
  el.setAttribute("data-grafico", nome);
  return el;
}

function fecharAjuda() {
  if (popAjuda) popAjuda.hidden = true;
}

function abrirAjuda(botao) {
  popAjuda ??= criarFlutuante("ajuda-pop");
  popAjuda.textContent = botao.dataset.texto;
  popAjuda.hidden = false;
  const r = botao.getBoundingClientRect();
  posicionar(popAjuda, r.left, r.bottom);
}

export function criarAjuda(texto) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ajuda";
  b.textContent = "?";
  b.dataset.texto = texto;
  b.setAttribute("aria-label", "O que mede e como ler este gráfico");
  b.addEventListener("mouseenter", () => abrirAjuda(b));
  b.addEventListener("focus", () => abrirAjuda(b));
  b.addEventListener("mouseleave", fecharAjuda);
  b.addEventListener("blur", fecharAjuda);
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    if (popAjuda && !popAjuda.hidden && popAjuda.textContent === texto) fecharAjuda();
    else abrirAjuda(b);
  });
  b.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharAjuda();
  });
  return b;
}

/**
 * Troca cada `.grafico-dica` (a frase "o que mede / como ler") por um ícone (?)
 * no cabeçalho que a precede (um <header> ou um <h2>–<h4>). Idempotente.
 */
export function instalarAjudas(raiz = document) {
  for (const dica of raiz.querySelectorAll(".grafico-dica")) {
    const alvo = dica.previousElementSibling;
    const texto = dica.textContent.trim();
    if (!alvo || !texto) continue;
    if (/^(HEADER|H[1-6])$/.test(alvo.tagName)) {
      alvo.appendChild(criarAjuda(texto));
      dica.remove();
    }
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** HTML padrão da caixa: período/rótulo, valor, faixa de 95% e base (quando existirem). */
export function htmlDica({ titulo, valor, faixa, base }) {
  return `<b>${esc(titulo)}</b>${valor != null ? `<span class="d-v">${esc(valor)}</span>` : ""}${
    faixa ? `<span class="d-sub">faixa de 95%: ${esc(faixa)}</span>` : ""
  }${base ? `<span class="d-sub">${esc(base)}</span>` : ""}`;
}

/** Liga a caixa de valor a todo `[data-dica-titulo]` de `raiz` (título, valor, faixa e base em data-*). */
export function ligarDicaPorAtributos(raiz) {
  ligarDica(raiz.querySelectorAll("[data-dica-titulo]"), (_d, el) =>
    htmlDica({ titulo: el.dataset.dicaTitulo, valor: el.dataset.dicaValor, faixa: el.dataset.dicaFaixa, base: el.dataset.dicaBase })
  );
}

/** Escapa texto para uso em atributo HTML. */
export function attr(v) {
  return String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
