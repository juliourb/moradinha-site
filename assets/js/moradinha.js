// src/js/dados/pacote.js
async function carregarJSON(origem, arquivo) {
  const resposta = await fetch(`${origem}/${arquivo}`);
  if (!resposta.ok) throw new Error(`${arquivo}: HTTP ${resposta.status}`);
  return resposta.json();
}

// src/js/main.js
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
    chipEdicao.textContent = `edi\xE7\xE3o ${manifesto.edicao} \xB7 ${manifesto.data_execucao.slice(0, 10)}`;
    if (manifesto.ficticio && chipFicticio) chipFicticio.hidden = false;
  } catch (erro) {
    chipEdicao.textContent = "pacote indispon\xEDvel";
    console.error("Falha ao carregar o cat\xE1logo/manifesto:", erro);
  }
}
preencherCabecalho();
//# sourceMappingURL=moradinha.js.map
