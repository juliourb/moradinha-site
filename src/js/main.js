// Ponto de entrada do bundle (assets/js/moradinha.js). As células do Quarto só
// importam e chamam estes módulos; nenhuma lógica de mapa ou gráfico fica
// presa numa célula (SPEC_00 §2).
import { carregarJSON, escolherDominioEEdicao } from "./dados/pacote.js";
import { opcoesDominio, opcoesEdicao } from "./dados/catalogo.js";
import { iniciarExplorador } from "./explorador.js";
import { iniciarVisaoGeral } from "./visaoGeral.js";
import { iniciarConfiabilidade } from "./confiabilidade.js";
import { iniciarMetodologia } from "./metodologia.js";

/** Troca `dominio`/`edicao` na URL atual e recarrega — o seletor do cabeçalho (SPEC_F5). */
function navegarPara(dominioId, edicaoId) {
  const params = new URLSearchParams(window.location.search);
  params.set("dominio", dominioId);
  if (edicaoId) params.set("edicao", edicaoId);
  else params.delete("edicao");
  window.location.search = params.toString();
}

async function preencherCabecalho() {
  const selDominio = document.getElementById("sel-dominio");
  const selEdicao = document.getElementById("sel-edicao");
  const chipFicticio = document.getElementById("chip-ficticio");
  const chipData = document.getElementById("chip-data");
  if (!selDominio || !selEdicao) return;

  try {
    const catalogo = await (await fetch("catalogo.json")).json();
    const { dominio, edicao } = escolherDominioEEdicao(catalogo);
    const manifesto = await carregarJSON(edicao.origem, "manifesto.json");

    selDominio.innerHTML = opcoesDominio(catalogo, dominio)
      .map((d) => `<option value="${d.conjunto_id}" ${d.conjunto_id === dominio.conjunto_id ? "selected" : ""}>${d.nome}</option>`)
      .join("");
    selEdicao.innerHTML = opcoesEdicao(dominio, edicao)
      .map((e) => `<option value="${e.edicao}" ${e.edicao === edicao.edicao ? "selected" : ""}>edição ${e.edicao}</option>`)
      .join("");
    if (chipData) chipData.textContent = manifesto.data_execucao.slice(0, 10);
    if (manifesto.ficticio && chipFicticio) chipFicticio.hidden = false;

    selDominio.addEventListener("change", () => navegarPara(selDominio.value, null));
    selEdicao.addEventListener("change", () => navegarPara(dominio.conjunto_id, selEdicao.value));
  } catch (erro) {
    if (chipData) chipData.textContent = "pacote indisponível";
    // eslint-disable-next-line no-console
    console.error("Falha ao carregar o catálogo/manifesto:", erro);
  }
}

preencherCabecalho();
iniciarExplorador().catch((erro) => {
  // eslint-disable-next-line no-console
  console.error("Falha ao iniciar o explorador:", erro);
});
iniciarVisaoGeral().catch((erro) => {
  // eslint-disable-next-line no-console
  console.error("Falha ao iniciar a visão geral:", erro);
});
iniciarConfiabilidade().catch((erro) => {
  // eslint-disable-next-line no-console
  console.error("Falha ao iniciar a confiabilidade:", erro);
});
iniciarMetodologia().catch((erro) => {
  // eslint-disable-next-line no-console
  console.error("Falha ao iniciar a metodologia:", erro);
});
