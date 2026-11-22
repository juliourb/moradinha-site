// Ponto de entrada do bundle (assets/js/moradinha.js). As células do Quarto só
// importam e chamam estes módulos; nenhuma lógica de mapa ou gráfico fica
// presa numa célula (SPEC_00 §2).
import { carregarJSON, escolherDominioEEdicao } from "./dados/pacote.js";
import { iniciarExplorador } from "./explorador.js";
import { iniciarVisaoGeral } from "./visaoGeral.js";
import { iniciarConfiabilidade } from "./confiabilidade.js";

async function preencherCabecalho() {
  const chipDominio = document.getElementById("chip-dominio");
  const chipEdicao = document.getElementById("chip-edicao");
  const chipFicticio = document.getElementById("chip-ficticio");
  if (!chipDominio || !chipEdicao) return;

  try {
    const catalogo = await (await fetch("catalogo.json")).json();
    const { dominio, edicao } = escolherDominioEEdicao(catalogo);
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
