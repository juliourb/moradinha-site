// Ponto de entrada do bundle (assets/js/moradinha.js). As células do Quarto só
// importam e chamam estes módulos; nenhuma lógica de mapa ou gráfico fica
// presa numa célula (SPEC_00 §2).
import { carregarJSON } from "./dados/pacote.js";

async function preencherCabecalho() {
  const chipDominio = document.getElementById("chip-dominio");
  const chipEdicao = document.getElementById("chip-edicao");
  const chipFicticio = document.getElementById("chip-ficticio");
  if (!chipDominio || !chipEdicao) return;

  try {
    const catalogo = await (await fetch("catalogo.json")).json();
    const dominio = catalogo.dominios[0];
    const edicao = dominio.edicoes.find((e) => e.padrao) ?? dominio.edicoes[0];
    const manifesto = await carregarJSON(edicao.origem, "manifesto.json");

    chipDominio.textContent = dominio.nome;
    chipEdicao.textContent = `edição ${manifesto.edicao} · ${manifesto.data_execucao.slice(0, 10)}`;
    if (manifesto.ficticio && chipFicticio) chipFicticio.hidden = false;
  } catch (erro) {
    chipEdicao.textContent = "pacote indisponível";
    // eslint-disable-next-line no-console
    console.error("Falha ao carregar o catálogo/manifesto:", erro);
  }
}

preencherCabecalho();
