"""Gera pacotes FICTÍCIOS no contrato v1 (SPEC_00 §5), a partir da lógica de
referencia/prototipo/gerar_dados.py. A distribuição por hexágono é fictícia;
os totais do domínio e as faixas do pacote `al_rm_maceio` são os reais do
piloto (SPEC_F0 anexos A e B). Todo pacote gerado tem manifesto.ficticio = true.

Uso: ./.venv-ficticio/Scripts/python.exe ferramentas/gerar_ficticio.py
"""
import hashlib
import json
import math
import random
from pathlib import Path

import h3
import pyarrow as pa
import pyarrow.parquet as pq

RAIZ = Path(__file__).resolve().parent.parent
COMPONENTES = ["coabitacao", "onus", "precariedade"]

PERIODOS = [
    {"id": "2022", "rotulo": "2022", "tipo": "ano", "anos": [2022], "fonte_estoque": "censo", "marcas": []},
    {"id": "2023", "rotulo": "2023", "tipo": "ano", "anos": [2023], "fonte_estoque": "open_buildings", "marcas": ["fonte_estoque_diferente"]},
    {"id": "2024", "rotulo": "2024", "tipo": "ano", "anos": [2024], "fonte_estoque": "mapbiomas", "marcas": []},
    {"id": "2025", "rotulo": "2025", "tipo": "ano", "anos": [2025], "fonte_estoque": "mapbiomas", "marcas": []},
    {"id": "m2024", "rotulo": "Média 2022–24", "tipo": "media", "anos": [2022, 2023, 2024], "fonte_estoque": "mista", "marcas": ["media_inclui_fonte_diferente"]},
    {"id": "m2025", "rotulo": "Média 2023–25", "tipo": "media", "anos": [2023, 2024, 2025], "fonte_estoque": "mista", "marcas": ["media_inclui_fonte_diferente"]},
]
PIDS = [p["id"] for p in PERIODOS]

# Anexo A — totais reais do piloto (regime c)
TOTAIS_REAIS = {
    "coabitacao": {"v": [8391.73, 6890.99, 6746.24, 7707.19, 7342.99, 7114.81], "ep": [1593.9, 1408.8, 1289.8, 1497.0, 816.7, 852.2]},
    "onus": {"v": [27770.24, 34444.48, 29827.39, 35356.44, 30680.70, 33209.44], "ep": [3258.2, 2989.7, 3525.3, 3073.5, 1907.5, 2013.7]},
    "precariedade": {"v": [5081.73, 5454.27, 5322.92, 5573.96, 5286.31, 5450.38], "ep": [263.3, None, None, None, None, None]},
}
DOM_REAIS = [427204.0, 444688.6, 446574.5, 466575.0, 439489.0, 452612.7]
LARG_REAIS = {
    "coabitacao": [0.705, 0.7556, 0.6887, 0.7719, 0.415, 0.485],
    "onus": [0.466, 0.3578, 0.4295, 0.3367, 0.236, 0.219],
    "precariedade": [0.203, None, None, None, None, None],
}
MUDANCAS_Z_REAIS = {
    "coabitacao": [0.705, 0.076, 0.486],
    "onus": [1.509, 0.999, 1.182],
}

# Anexo D — FJP, Déficit habitacional no Brasil 2023 (FJP, 2025), RM de Maceió.
# fjp_publicado: valor real publicado pela FJP (indicador: anexo A, componente correspondente).
# mapa/reconstrucao_pnadc/reconstrucao_ep: do anexo A, período 2023 (mesma grandeza do mapa).
FJP_FONTE = (
    "FUNDAÇÃO JOÃO PINHEIRO. Déficit habitacional no Brasil 2023. Belo Horizonte: "
    "FJP, 2025 (relatório completo, versão de 25/09/2025). "
    "Dados básicos: PNADc 2023 (IBGE, 2024) e CadÚnico 2023."
)
REFERENCIA_FJP_REAL = [
    {
        "indicador": "total", "ano_ref": 2023, "fjp_publicado": 50099.0,
        "fjp_fonte": FJP_FONTE, "fjp_tabela": "Tabela 1", "fjp_pagina": "16",
        "explicacao": "A FJP soma os improvisados do CadÚnico, que a PNADc não capta.",
    },
    {
        "indicador": "habitacao_precaria", "ano_ref": 2023, "fjp_publicado": 11936.0,
        "fjp_subcomponentes": [{"nome": "improvisados", "valor": 5812.0}, {"nome": "rústicos", "valor": 6124.0}],
        "fjp_fonte": FJP_FONTE, "fjp_tabela": "Tabelas 1 e 13", "fjp_pagina": "16 e 46",
        "explicacao": "Comparar com os rústicos (6.124): mesmo conceito; improvisados vêm do CadÚnico.",
    },
    {
        "indicador": "coabitacao", "ano_ref": 2023, "fjp_publicado": 5666.0,
        "fjp_fonte": FJP_FONTE, "fjp_tabela": "Tabelas 1 e 15", "fjp_pagina": "16 e 52",
        "explicacao": "Núcleos reconstruídos pela descrição secundária (E19); FJP dentro da faixa de 95%.",
    },
    {
        "indicador": "onus", "ano_ref": 2023, "fjp_publicado": 32498.0,
        "fjp_fonte": FJP_FONTE, "fjp_tabela": "Tabela 1", "fjp_pagina": "16",
        "explicacao": "FJP dentro da faixa de 95%.",
    },
    {
        "indicador": "domicilios", "ano_ref": 2023, "fjp_publicado": 462956.0,
        "fjp_subcomponentes": [{"nome": "PNADc", "valor": 457144.0}, {"nome": "improvisados", "valor": 5812.0}],
        "fjp_fonte": FJP_FONTE, "fjp_tabela": "Apêndice A", "fjp_pagina": "72",
        "explicacao": "A FJP soma os improvisados; diferença de visita da PNADc a conferir.",
    },
]

POLIGONO_MACEIO = [
    (-9.45, -35.81), (-9.45, -35.64), (-9.50, -35.625), (-9.55, -35.64), (-9.60, -35.67),
    (-9.655, -35.695), (-9.672, -35.715), (-9.682, -35.735), (-9.705, -35.765),
    (-9.695, -35.775), (-9.67, -35.77), (-9.65, -35.78), (-9.62, -35.79), (-9.58, -35.80), (-9.52, -35.81),
]


def dist_km(a, b):
    return math.hypot((a[0] - b[0]) * 110.6, (a[1] - b[1]) * 109.7)


def sha256_arquivo(caminho: Path) -> str:
    return hashlib.sha256(caminho.read_bytes()).hexdigest()


def commit_ficticio(semente: str) -> str:
    return hashlib.sha1(semente.encode()).hexdigest()


def r(v, n=3):
    return None if v is None else round(v, n)


def gerar_hexagonos(cells, semente):
    """Atributos fictícios por hexágono: densidade, taxas por componente, AP, FCU, Braskem."""
    random.seed(semente)
    centro = (-9.655, -35.725)
    norte = (-9.545, -35.725)
    lagoa = (-9.665, -35.755)
    braskem_p = (-9.625, -35.752)
    H = []
    for c in cells:
        lat, lng = h3.cell_to_latlng(c)
        p = (lat, lng)
        dc, dn, dl, db = dist_km(p, centro), dist_km(p, norte), dist_km(p, lagoa), dist_km(p, braskem_p)
        dens = 420 * math.exp(-dc / 5.5) + 260 * math.exp(-dn / 3.0) + 120 * math.exp(-dl / 2.0) + random.lognormvariate(3.0, 0.9)
        if random.random() < 0.13 or (lat > -9.47 and random.random() < 0.5):
            dens = 0
        braskem = db < 1.1
        if braskem:
            dens *= 0.08
        coab = max(0.012 + 0.022 * math.exp(-dn / 3.5) + 0.010 * math.exp(-dl / 1.8) + random.gauss(0, 0.003), 0.002)
        onus = max(0.040 + 0.050 * math.exp(-dc / 3.0) + 0.020 * math.exp(-dn / 4) + random.gauss(0, 0.008), 0.005)
        fap = max(0.11, min(7.7, 0.3 + 3.0 * math.exp(-dl / 1.3) + 1.4 * math.exp(-dn / 2.2) + random.lognormvariate(-1.2, 0.6)))
        fcu = (dl < 2.0 and random.random() < 0.6) or (dn < 3.0 and random.random() < 0.3)
        H.append(dict(h=c, dens=dens, coab=coab, onus=onus, fap=fap, braskem=braskem, fcu=fcu, ap=h3.cell_to_parent(c, 7)))
    for x in H:
        g23 = (1 + random.gauss(0, 0.06)) if x["dens"] > 0 else 1.0
        if x["braskem"]:
            g23 *= 0.9
        g24 = 1.0 if random.random() < 0.62 else 1 + abs(random.gauss(0, 0.04))
        g25 = g24 if random.random() < 0.75 else g24 + abs(random.gauss(0, 0.05))
        x["g"] = {"2022": 1.0, "2023": g23, "2024": g24, "2025": g25}
    return H


def escalar_para_total(valores, total_real):
    s = sum(valores)
    if s <= 0 or total_real is None:
        return [0.0 for _ in valores]
    return [v * total_real / s for v in valores]


def montar_pacote(nome_pasta, cells, conjunto_id, nome_dominio, totais_reais, dom_reais, larg_reais,
                   mudancas_z, n_setores_base, incluir_consistencia_real):
    H = gerar_hexagonos(cells, semente=7 if "maceio" in conjunto_id else 11)
    n_hex = len(H)

    # Sigilo: um punhado de hexágonos sem dado (todo período) e outro punhado parcial.
    # Escolhido ANTES de distribuir os totais: os hexágonos "sem_dado" entram com
    # contribuição zero na distribuição (ver abaixo), para que a soma dos hexágonos
    # com dado bata exatamente com totais.json (V5/V6, tolerância 1e-6) — "não
    # medido" aqui não retira massa do total do domínio, só não aparece por hexágono.
    candidatos = [j for j, x in enumerate(H) if x["dens"] > 0]
    random.seed(101)
    n_sem_dado = min(6, len(candidatos) // 20 + 1) if len(candidatos) > 10 else 0
    sem_dado = set(random.sample(candidatos, n_sem_dado)) if n_sem_dado else set()
    restantes = [j for j in candidatos if j not in sem_dado]
    n_parcial = min(10, len(restantes) // 15 + 1) if len(restantes) > 10 else 0
    parcial = set(random.sample(restantes, n_parcial)) if n_parcial else set()

    # Domicílios por período, escalados para os totais reais do domínio.
    dom_por_periodo = {}
    for i, pid in enumerate(["2022", "2023", "2024", "2025"]):
        brutos = [0.0 if j in sem_dado else x["dens"] * x["g"][pid] for j, x in enumerate(H)]
        dom_por_periodo[pid] = escalar_para_total(brutos, dom_reais[i])
    dom_por_periodo["m2024"] = [(dom_por_periodo["2022"][j] + dom_por_periodo["2023"][j] + dom_por_periodo["2024"][j]) / 3 for j in range(n_hex)]
    dom_por_periodo["m2025"] = [(dom_por_periodo["2023"][j] + dom_por_periodo["2024"][j] + dom_por_periodo["2025"][j]) / 3 for j in range(n_hex)]

    # Valor absoluto por componente × período × hexágono, escalado para os totais reais.
    # Como dom_por_periodo já é 0 nos hexágonos sem_dado, a taxa×domicílios também
    # sai 0 para eles e a escala não perde massa ao anulá-los na saída.
    valores = {c: {} for c in COMPONENTES}
    taxa_chave = {"coabitacao": "coab", "onus": "onus", "precariedade": "fap"}
    for comp in COMPONENTES:
        chave = taxa_chave[comp]
        for i, pid in enumerate(["2022", "2023", "2024", "2025"]):
            brutos = []
            for j, x in enumerate(H):
                if comp == "precariedade":
                    taxa = 0.0119 * x["fap"]
                elif comp == "onus" and i >= 2:
                    taxa = x["onus"] * (1 + random.gauss(0, 0.05))
                else:
                    taxa = x[chave]
                brutos.append(taxa * dom_por_periodo[pid][j])
            valores[comp][pid] = escalar_para_total(brutos, totais_reais[comp]["v"][i])
        valores[comp]["m2024"] = [(valores[comp]["2022"][j] + valores[comp]["2023"][j] + valores[comp]["2024"][j]) / 3 for j in range(n_hex)]
        valores[comp]["m2025"] = [(valores[comp]["2023"][j] + valores[comp]["2024"][j] + valores[comp]["2025"][j]) / 3 for j in range(n_hex)]
        for i in [4, 5]:
            pid = PIDS[i]
            valores[comp][pid] = escalar_para_total(valores[comp][pid], totais_reais[comp]["v"][i])

    # AP: agrupar hexágonos, calcular direta/cv fictícios (só coabitação tem amostra direta).
    aps_idx = {}
    for j, x in enumerate(H):
        aps_idx.setdefault(x["ap"], []).append(j)
    ap_rows = []
    ap_ressalva_coab = {}
    random.seed(202)
    for ap_cod, idx in sorted(aps_idx.items()):
        motor = sum(valores["coabitacao"]["2022"][j] for j in idx)
        dom_ap = sum(dom_por_periodo["2022"][j] for j in idx)
        if motor > 0:
            cv = min(0.9, 3.317899 * max(motor, 1) ** -0.487441)
            direta = motor * random.lognormvariate(0, cv * 0.8)
        else:
            cv = None
            direta = 0.0
        ressalva = bool(cv is not None and cv > 0.30) or (direta == 0)
        ap_ressalva_coab[ap_cod] = ressalva
        ap_nome = f"AP {ap_cod[-4:]}"
        ap_rows.append(dict(ap_cod=ap_cod, ap_nome=ap_nome, municipio_cod="270030", tipo="capital",
                             componente="coabitacao", direta=r(direta, 1) if direta else 0.0,
                             direta_cv=r(cv * 100, 1) if cv else None,
                             direta_ic_inf=r(direta - 1.96 * direta * (cv or 0), 1) if cv else None,
                             direta_ic_sup=r(direta + 1.96 * direta * (cv or 0), 1) if cv else None,
                             motor_2022=r(motor, 1), ressalva=ressalva, sem_direta=False))
        for comp in ["onus", "precariedade"]:
            motor_c = sum(valores[comp]["2022"][j] for j in idx)
            ap_rows.append(dict(ap_cod=ap_cod, ap_nome=ap_nome, municipio_cod="270030", tipo="capital",
                                 componente=comp, direta=None, direta_cv=None, direta_ic_inf=None,
                                 direta_ic_sup=None, motor_2022=r(motor_c, 1), ressalva=False, sem_direta=True))

    # hex_base: domicílios + qualidade.
    # domicilios NÃO é arredondado: a soma por período precisa bater com
    # totais.domicilios com erro relativo <= 1e-6 (V6); arredondar cada hexágono
    # acumularia erro acima da tolerância. A formatação pt-BR para exibição é
    # feita pela camada JS (formato.js), não aqui.
    hex_base_rows = []
    for pid in PIDS:
        for j, x in enumerate(H):
            if j in sem_dado:
                qualidade = "sem_dado"
                dom_val = None
            elif j in parcial:
                qualidade = "parcial_sigilo"
                dom_val = dom_por_periodo[pid][j]
            else:
                qualidade = "ok"
                dom_val = dom_por_periodo[pid][j]
            hex_base_rows.append(dict(h3=H[j]["h"], periodo=pid, domicilios=dom_val, qualidade=qualidade))

    # hex_qualidade: fração imputada/sigilo, n_setores, fonte do estoque, g_estoque, hex_novo, cnefe
    periodo_fonte = {p["id"]: p["fonte_estoque"] for p in PERIODOS}
    hex_qualidade_rows = []
    random.seed(303)
    for pid in PIDS:
        for j, x in enumerate(H):
            ap_dist_borda = 1.0 if ap_ressalva_coab.get(x["ap"]) else 0.4
            fracao_imputada = r(min(0.9, 0.05 + 0.25 * ap_dist_borda * random.random()), 3)
            fracao_sigilo = r(0.5 + 0.4 * random.random(), 3) if j in parcial else (1.0 if j in sem_dado else 0.0)
            if pid == "2022":
                g_estoque = 1.0
            elif pid in ("2023",):
                g_estoque = r(x["g"]["2023"], 4)
            elif pid in ("2024", "2025"):
                g_estoque = r(x["g"][pid], 4)
            else:
                g_estoque = None
            hex_qualidade_rows.append(dict(
                h3=x["h"], periodo=pid,
                fracao_imputada=fracao_imputada, fracao_sigilo=fracao_sigilo,
                n_setores=max(1, n_setores_base + (j % 3)),
                fonte_estoque=periodo_fonte[pid] if pid in periodo_fonte else "mista",
                g_estoque=g_estoque, hex_novo=False,
                enderecos_cnefe=r(dom_por_periodo["2022"][j] * 1.02, 1) if pid == "2022" else None,
            ))

    # hex.parquet: absoluto/minimo/maximo/relativo/marcas
    def marcas_hex(comp, pid, j):
        ms = []
        if j in sem_dado:
            ms.append("sem_dado")
        elif j in parcial:
            ms.append("parcial_sigilo")
        if pid == "2023":
            ms.append("fonte_estoque_diferente")
        if pid in ("m2024", "m2025"):
            ms.append("media_inclui_fonte_diferente")
        if comp in ("coabitacao", "onus") and pid in ("2023", "2024", "2025"):
            ms.append("mudanca_no_ruido")
        if comp == "precariedade" and pid != "2022":
            ms.append("precariedade_provisoria_sem_faixa")
        idx_periodo = PIDS.index(pid)
        total_v = totais_reais[comp]["v"][idx_periodo]
        ep_v = totais_reais[comp]["ep"][idx_periodo]
        if ep_v is not None and total_v and (ep_v / total_v) > 0.15:
            ms.append("total_fragil")
        if ap_ressalva_coab.get(H[j]["ap"]):
            ms.append("ap_ressalva")
        vistos = []
        for m in ms:
            if m not in vistos:
                vistos.append(m)
        return ";".join(vistos)

    # absoluto NÃO é arredondado aqui pelo mesmo motivo de domicilios (V5: soma
    # por período×componente precisa bater com totais com erro relativo <= 1e-6).
    hex_rows = []
    for comp in COMPONENTES:
        for pid in PIDS:
            idx_periodo = PIDS.index(pid)
            largura = larg_reais[comp][idx_periodo]
            for j, x in enumerate(H):
                sem_dado_hex = j in sem_dado
                absoluto = None if sem_dado_hex else valores[comp][pid][j]
                if absoluto is not None and largura is not None:
                    minimo = absoluto * (1 - largura / 2)
                    maximo = absoluto * (1 + largura / 2)
                else:
                    minimo = maximo = None
                dom_val = hex_base_rows[PIDS.index(pid) * n_hex + j]["domicilios"]
                # Sem arredondar: V8 exige relativo = 100*absoluto/domicilios com tolerância 1e-9,
                # recomputado pelo validador a partir dos mesmos absoluto/domicilios já arredondados acima.
                relativo = (100 * absoluto / dom_val) if (absoluto is not None and dom_val and dom_val > 0) else None
                hex_rows.append(dict(
                    h3=x["h"], periodo=pid, componente=comp,
                    absoluto=absoluto, minimo=minimo, maximo=maximo, relativo=relativo,
                    marcas=marcas_hex(comp, pid, j),
                ))

    # hex_atributos
    # município e AP dominantes por domicílios 2022: no recorte fictício, cada
    # hexágono só tem um pai H3 res-7 (AP) e um município (Maceió), então
    # n_aps=n_municipios=1 sempre — ainda assim exigido ≥ 1 pela V9.
    hex_atributos_rows = [
        dict(h3=x["h"], municipio_cod="270030", municipio_nome="Maceió", n_municipios=1,
             ap_cod=x["ap"], n_aps=1,
             fcu_fracao=1.0 if x["fcu"] else 0.0, recortes="braskem" if x["braskem"] else "")
        for x in H
    ]

    # totais.json
    totais_json = {"totais": [], "domicilios": [], "mudancas": []}
    for comp in COMPONENTES:
        for i, pid in enumerate(PIDS):
            total_v = totais_reais[comp]["v"][i]
            ep_v = totais_reais[comp]["ep"][i]
            marcas = []
            if ep_v is not None and total_v and (ep_v / total_v) > 0.15:
                marcas.append("total_fragil")
            if comp in ("coabitacao", "onus") and pid in ("2023", "2024", "2025"):
                marcas.append("mudanca_no_ruido")
            if comp == "precariedade" and pid != "2022":
                marcas.append("precariedade_provisoria_sem_faixa")
            if pid == "2023":
                marcas.append("fonte_estoque_diferente")
            if pid in ("m2024", "m2025"):
                marcas.append("media_inclui_fonte_diferente")
            if comp == "precariedade":
                regime = "amostra" if pid == "2022" else "provisoria"
            else:
                regime = "c"
            totais_json["totais"].append({
                "componente": comp, "periodo": pid, "regime": regime,
                "total": total_v,
                "ep": ep_v, "cv": r(100 * ep_v / total_v, 2) if ep_v else None,
                "ic_inf": r(total_v - 1.96 * ep_v, 2) if ep_v else None,
                "ic_sup": r(total_v + 1.96 * ep_v, 2) if ep_v else None,
                "marcas": marcas,
                # Único regime calculado por componente×período neste piloto fictício:
                # é sempre a linha que o mapa usa (SPEC_00 §5.1).
                "no_mapa": True,
            })
    for i, pid in enumerate(PIDS):
        totais_json["domicilios"].append({"periodo": pid, "total": dom_reais[i]})
    for comp, zs in mudancas_z.items():
        pares = [("2022", "2023"), ("2023", "2024"), ("2024", "2025")]
        for (de, para), z in zip(pares, zs):
            v_de = totais_reais[comp]["v"][PIDS.index(de)]
            v_para = totais_reais[comp]["v"][PIDS.index(para)]
            totais_json["mudancas"].append({
                "componente": comp, "de": de, "para": para, "delta": r(v_para - v_de, 2),
                "z": z, "marcas": ["mudanca_no_ruido"],
            })

    # modelo.json
    modelo_json = {}
    for comp in COMPONENTES:
        usado = comp != "precariedade"
        modelo_json[comp] = {
            "configuracao": "e3",
            "usado": usado,
            "motivo": "" if usado else "Nesta área, o modelo não superou a repartição pela taxa média; o mapa usa a repartição simples.",
            "treino": {"n_domicilios": 12000, "peso_total": 440000.0, "n_aps": len(ap_rows) // 3, "dobras": 5, "motor": "EBM", "versao": "e3-ficticio", "semente": 7},
            "ganho": {"erro_modelo": 0.42, "erro_base": 0.72, "razao": 0.58, "ic": [0.49, 0.67]},
            "ordem": {"spearman_modelo": 0.83, "spearman_base": 0.55, "top20_modelo": 0.61, "top20_base": 0.20, "ic_spearman": [0.74, 0.89]},
            "calibracao": {
                "decis": [{"decil": d, "previsto": r(0.02 + 0.01 * d, 4), "observado": r(0.019 + 0.0105 * d, 4)} for d in range(1, 11)],
                "inclinacao": 0.91, "intercepto": 0.002, "ic_inclinacao": [0.84, 0.98],
            },
            "vies": [
                {"grupo_tipo": "tipo de AP", "grupo": "capital", "razao_somas": 1.02},
                {"grupo_tipo": "tipo de AP", "grupo": "resto", "razao_somas": 0.95},
                {"grupo_tipo": "município", "grupo": "Maceió", "razao_somas": 1.01},
            ],
            "curvas": [
                {"variavel": "renda_domiciliar", "rotulo": "Renda domiciliar", "nivel": "até 1 SM", "escore": 0.42, "desvio": 0.05},
                {"variavel": "densidade_cnefe", "rotulo": "Densidade de endereços", "nivel": "alta", "escore": -0.18, "desvio": 0.04},
            ],
            "importancia": [
                {"variavel": "renda_domiciliar", "rotulo": "Renda domiciliar", "valor": 0.31},
                {"variavel": "densidade_cnefe", "rotulo": "Densidade de endereços", "valor": 0.18},
            ],
            "confianca": {
                "dobras": [{"dobra": d, "razao_erro": r(0.55 + 0.03 * d, 2), "spearman": r(0.80 + 0.01 * d, 2)} for d in range(1, 6)],
                "moran_residuos": {"I": 0.04, "p": 0.21},
                "cobertura_d": {"modelo": 0.91, "base": 0.80},
            },
        }

    # qualidade.json
    qualidade_json = {
        "fontes": [{
            "variavel": "estoque de domicílios", "fonte": "Censo 2022 / Open Buildings / MapBiomas",
            "anos_disponiveis": [2022, 2023, 2024, 2025],
            "uso_por_periodo": {p["id"]: ("fixa do Censo" if p["id"] == "2022" else f"do ano ({p['fonte_estoque']})") for p in PERIODOS},
            "marcas": ["fonte_estoque_diferente", "media_inclui_fonte_diferente"],
        }],
        "sigilo": {"hex_sem_dado": len(sem_dado), "hex_parcial": len(parcial)},
        "aps": [{"componente": comp, "n_aps": len(ap_rows) // 3,
                  "n_ressalva": sum(1 for v in ap_ressalva_coab.values() if v) if comp == "coabitacao" else 0,
                  "n_sem_direta": 0 if comp == "coabitacao" else len(ap_rows) // 3} for comp in COMPONENTES],
        "ponte": [{
            "indicador": "coabitação 2022", "pnadc": totais_reais["coabitacao"]["v"][0],
            "pnadc_ep": totais_reais["coabitacao"]["ep"][0], "censo": r(totais_reais["coabitacao"]["v"][0] * 0.97, 1),
            "censo_ep": None, "razao": 0.97,
            "leitura": "A reconstrução na PNADc fica próxima da base do Censo 2022, dentro do esperado para o ano âncora.",
        }],
        "cnefe": {"enderecos": sum(dom_por_periodo["2022"]) * 1.02, "hex_sem_endereco": 0,
                   "domicilios_nesses_hex": 0.0, "correlacao_hex": 0.93},
        "lacunas": [
            {"item": "IVCAD 2025 (MDS)", "efeito": "Ainda não incorporado; entra quando sair o 2º retrato do MDS."},
            {"item": "Precariedade sem faixa fora de 2022", "efeito": "Estimativa provisória; mostrar sem intervalo."},
        ],
    }

    # consistencia.json
    if incluir_consistencia_real:
        periodos_spearman = ["2022", "2023", "2024", "2025"]
        pares_reais = {
            "coabitacao": {"22-23": 0.861, "22-24": 0.970, "22-25": 0.966, "23-24": 0.860, "23-25": 0.859, "24-25": 0.996},
            "onus": {"22-23": 0.854, "22-24": 0.960, "22-25": 0.952, "23-24": 0.855, "23-25": 0.857, "24-25": 0.975},
            "precariedade": {"22-23": 0.855, "22-24": 0.967, "22-25": 0.963, "23-24": 0.851, "23-25": 0.849, "24-25": 0.996},
        }
        spearman = {}
        for comp, pares in pares_reais.items():
            m = [[1.0, pares["22-23"], pares["22-24"], pares["22-25"]],
                 [pares["22-23"], 1.0, pares["23-24"], pares["23-25"]],
                 [pares["22-24"], pares["23-24"], 1.0, pares["24-25"]],
                 [pares["22-25"], pares["23-25"], pares["24-25"], 1.0]]
            spearman[comp] = {"periodos": periodos_spearman, "matriz": m}
        razoes_reais = {
            "coabitacao": [(0.821, 0.824, 0.689, 1.037, 1285), (0.804, 0.787, 0.787, 0.919, 1285), (0.918, 0.888, 0.888, 1.126, 1285)],
            "onus": [(1.240, 1.259, 0.593, 3.198, 1241), (1.074, 1.089, 0.290, 1.459, 1239), (1.273, 1.300, 0.561, 1.780, 1223)],
            "precariedade": [(1.073, 1.045, 0.870, 1.328, 1253), (1.047, 1.023, 1.023, 1.193, 1253), (1.097, 1.057, 1.057, 1.340, 1253)],
        }
        razoes = []
        for comp, linhas in razoes_reais.items():
            for pid, (razao_total, mediana, p5, p95, n) in zip(["2023", "2024", "2025"], linhas):
                razoes.append({"componente": comp, "periodo": pid, "razao_total": razao_total, "mediana": mediana, "p5": p5, "p95": p95, "n_hexagonos": n})
        consistencia_json = {"spearman": spearman, "razoes": razoes}
    else:
        periodos_spearman = ["2022", "2023", "2024", "2025"]
        spearman = {comp: {"periodos": periodos_spearman, "matriz": [[1.0, 0.9, 0.85, 0.8], [0.9, 1.0, 0.9, 0.85], [0.85, 0.9, 1.0, 0.9], [0.8, 0.85, 0.9, 1.0]]} for comp in COMPONENTES}
        razoes = [{"componente": comp, "periodo": pid, "razao_total": 1.0, "mediana": 1.0, "p5": 0.8, "p95": 1.2, "n_hexagonos": n_hex} for comp in COMPONENTES for pid in ["2023", "2024", "2025"]]
        consistencia_json = {"spearman": spearman, "razoes": razoes}

    # referencia_fjp.json
    if incluir_consistencia_real:
        # Valores reais da FJP 2023 (anexo D, públicos); mapa/reconstrucao_pnadc/
        # reconstrucao_ep do anexo A, período 2023 (mesma grandeza do mapa).
        idx_2023 = PIDS.index("2023")
        comp_por_indicador = {"coabitacao": "coabitacao", "onus": "onus", "habitacao_precaria": "precariedade"}
        referencia_fjp_json = []
        for base in REFERENCIA_FJP_REAL:
            item = dict(base)
            if item["indicador"] == "total":
                item["mapa"] = sum(totais_reais[c]["v"][idx_2023] for c in COMPONENTES)
                item["reconstrucao_pnadc"] = item["mapa"]
                item["reconstrucao_ep"] = None  # precariedade não tem EP em 2023; não dá para combinar
            elif item["indicador"] == "domicilios":
                item["mapa"] = dom_reais[idx_2023]
                item["reconstrucao_pnadc"] = dom_reais[idx_2023]
                item["reconstrucao_ep"] = None
            else:
                comp = comp_por_indicador[item["indicador"]]
                item["mapa"] = totais_reais[comp]["v"][idx_2023]
                item["reconstrucao_pnadc"] = totais_reais[comp]["v"][idx_2023]
                item["reconstrucao_ep"] = totais_reais[comp]["ep"][idx_2023]
            referencia_fjp_json.append(item)
    else:
        referencia_fjp_json = [
            {"indicador": indicador, "ano_ref": 2023, "fjp_publicado": None,
             "fjp_fonte": "a preencher", "fjp_tabela": "a preencher", "fjp_pagina": "a preencher",
             "reconstrucao_pnadc": None, "mapa": None,
             "explicacao": "Pacote de teste; sem referência da FJP."}
            for indicador in ["total", "habitacao_precaria", "coabitacao", "onus", "domicilios"]
        ]

    # achados.json
    achados_json = [
        {"id": "E36", "data": "2026-11-20", "texto": "Ônus excessivo com aluguel tem razão de totais acima de 1 em todos os anos t, exceto no esperado por 2023 ter excesso de detecção.", "efeito": "Leitura dos totais de ônus deve considerar a faixa de incerteza, não só o ponto.", "situacao": "registrado", "publico": True},
        {"id": "E40", "data": "2026-11-20", "texto": "2023 fica a 0,85–0,86 de Spearman com todos os outros anos, nos três componentes; 2022, 2024 e 2025 ficam a 0,95–0,996 entre si.", "efeito": "Não comparar 2023 por hexágono; usar a marca fonte_estoque_diferente.", "situacao": "registrado", "publico": True},
        {"id": "E41", "data": "2026-11-20", "texto": "Arquivo de jornal do SQLite (.gpkg-journal) ficou ao lado do GeoPackage de 2022 no Volume depois da execução.", "efeito": "Sem efeito nos números; item de limpeza operacional do moradinha.", "situacao": "registrado", "publico": False},
    ]

    # pipeline.json
    commit_fake = commit_ficticio(conjunto_id)[:40]
    etapas_nomes = [
        ("coleta", "Coleta", "Censo, CNEFE, PNADc, luz, Open Buildings, MapBiomas, FCU, MDS."),
        ("grade", "Grade", "Pedaços setor × hexágono."),
        ("classificacao", "Classificação", "Regra da FJP na amostra e na PNADc."),
        ("treino", "Treino", "EBM, validação por AP fora da dobra."),
        ("montagem2022", "Montagem 2022", "Composição, taxa, fator da AP, calibração, faixa."),
        ("anost", "Anos t", "Estoque, estimativa, faixa, médias."),
        ("exportacao", "Exportação", "Pacote de publicação."),
    ]
    etapas = [{"id": eid, "nome": nome, "descricao": desc, "commit": commit_fake, "data": "2026-11-20", "saidas": [f"{eid}.parquet"]} for eid, nome, desc in etapas_nomes]
    ligacoes = [{"de": etapas_nomes[i][0], "para": etapas_nomes[i + 1][0]} for i in range(len(etapas_nomes) - 1)]
    pipeline_json = {"etapas": etapas, "ligacoes": ligacoes}

    # Escrever os arquivos (tudo menos manifesto.json, que entra por último).
    pasta = RAIZ / "pacotes" / conjunto_id / "ficticio"
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / "contornos").mkdir(exist_ok=True)

    pq.write_table(pa.table({
        "h3": pa.array([r_["h3"] for r_ in hex_rows], type=pa.string()),
        "periodo": pa.array([r_["periodo"] for r_ in hex_rows], type=pa.string()),
        "componente": pa.array([r_["componente"] for r_ in hex_rows], type=pa.string()),
        "absoluto": pa.array([r_["absoluto"] for r_ in hex_rows], type=pa.float64()),
        "minimo": pa.array([r_["minimo"] for r_ in hex_rows], type=pa.float64()),
        "maximo": pa.array([r_["maximo"] for r_ in hex_rows], type=pa.float64()),
        "relativo": pa.array([r_["relativo"] for r_ in hex_rows], type=pa.float64()),
        "marcas": pa.array([r_["marcas"] for r_ in hex_rows], type=pa.string()),
    }), pasta / "hex.parquet")

    pq.write_table(pa.table({
        "h3": pa.array([r_["h3"] for r_ in hex_base_rows], type=pa.string()),
        "periodo": pa.array([r_["periodo"] for r_ in hex_base_rows], type=pa.string()),
        "domicilios": pa.array([r_["domicilios"] for r_ in hex_base_rows], type=pa.float64()),
        "qualidade": pa.array([r_["qualidade"] for r_ in hex_base_rows], type=pa.string()),
    }), pasta / "hex_base.parquet")

    pq.write_table(pa.table({
        "h3": pa.array([r_["h3"] for r_ in hex_qualidade_rows], type=pa.string()),
        "periodo": pa.array([r_["periodo"] for r_ in hex_qualidade_rows], type=pa.string()),
        "fracao_imputada": pa.array([r_["fracao_imputada"] for r_ in hex_qualidade_rows], type=pa.float64()),
        "fracao_sigilo": pa.array([r_["fracao_sigilo"] for r_ in hex_qualidade_rows], type=pa.float64()),
        "n_setores": pa.array([r_["n_setores"] for r_ in hex_qualidade_rows], type=pa.int32()),
        "fonte_estoque": pa.array([r_["fonte_estoque"] for r_ in hex_qualidade_rows], type=pa.string()),
        "g_estoque": pa.array([r_["g_estoque"] for r_ in hex_qualidade_rows], type=pa.float64()),
        "hex_novo": pa.array([r_["hex_novo"] for r_ in hex_qualidade_rows], type=pa.bool_()),
        "enderecos_cnefe": pa.array([r_["enderecos_cnefe"] for r_ in hex_qualidade_rows], type=pa.float64()),
    }), pasta / "hex_qualidade.parquet")

    pq.write_table(pa.table({
        "h3": pa.array([r_["h3"] for r_ in hex_atributos_rows], type=pa.string()),
        "municipio_cod": pa.array([r_["municipio_cod"] for r_ in hex_atributos_rows], type=pa.string()),
        "municipio_nome": pa.array([r_["municipio_nome"] for r_ in hex_atributos_rows], type=pa.string()),
        "n_municipios": pa.array([r_["n_municipios"] for r_ in hex_atributos_rows], type=pa.int32()),
        "ap_cod": pa.array([r_["ap_cod"] for r_ in hex_atributos_rows], type=pa.string()),
        "n_aps": pa.array([r_["n_aps"] for r_ in hex_atributos_rows], type=pa.int32()),
        "fcu_fracao": pa.array([r_["fcu_fracao"] for r_ in hex_atributos_rows], type=pa.float64()),
        "recortes": pa.array([r_["recortes"] for r_ in hex_atributos_rows], type=pa.string()),
    }), pasta / "hex_atributos.parquet")

    pq.write_table(pa.table({
        "ap_cod": pa.array([r_["ap_cod"] for r_ in ap_rows], type=pa.string()),
        "ap_nome": pa.array([r_["ap_nome"] for r_ in ap_rows], type=pa.string()),
        "municipio_cod": pa.array([r_["municipio_cod"] for r_ in ap_rows], type=pa.string()),
        "tipo": pa.array([r_["tipo"] for r_ in ap_rows], type=pa.string()),
        "componente": pa.array([r_["componente"] for r_ in ap_rows], type=pa.string()),
        "direta": pa.array([r_["direta"] for r_ in ap_rows], type=pa.float64()),
        "direta_cv": pa.array([r_["direta_cv"] for r_ in ap_rows], type=pa.float64()),
        "direta_ic_inf": pa.array([r_["direta_ic_inf"] for r_ in ap_rows], type=pa.float64()),
        "direta_ic_sup": pa.array([r_["direta_ic_sup"] for r_ in ap_rows], type=pa.float64()),
        "motor_2022": pa.array([r_["motor_2022"] for r_ in ap_rows], type=pa.float64()),
        "ressalva": pa.array([r_["ressalva"] for r_ in ap_rows], type=pa.bool_()),
        "sem_direta": pa.array([r_["sem_direta"] for r_ in ap_rows], type=pa.bool_()),
    }), pasta / "ap.parquet")

    (pasta / "totais.json").write_text(json.dumps(totais_json, ensure_ascii=False, indent=2), encoding="utf-8")
    (pasta / "modelo.json").write_text(json.dumps(modelo_json, ensure_ascii=False, indent=2), encoding="utf-8")
    (pasta / "qualidade.json").write_text(json.dumps(qualidade_json, ensure_ascii=False, indent=2), encoding="utf-8")
    (pasta / "consistencia.json").write_text(json.dumps(consistencia_json, ensure_ascii=False, indent=2), encoding="utf-8")
    (pasta / "referencia_fjp.json").write_text(json.dumps(referencia_fjp_json, ensure_ascii=False, indent=2), encoding="utf-8")
    (pasta / "achados.json").write_text(json.dumps(achados_json, ensure_ascii=False, indent=2), encoding="utf-8")
    (pasta / "pipeline.json").write_text(json.dumps(pipeline_json, ensure_ascii=False, indent=2), encoding="utf-8")

    # Contornos fictícios: AP = limite do pai H3 resolução 7; município = casca convexa simples das APs; FCU = casca dos hexágonos marcados.
    def boundary_geojson(cell):
        return [[lng, lat] for lat, lng in h3.cell_to_boundary(cell)] + [[h3.cell_to_boundary(cell)[0][1], h3.cell_to_boundary(cell)[0][0]]]

    ap_features = [
        {"type": "Feature", "properties": {"cod": ap_cod, "nome": f"AP {ap_cod[-4:]}"},
         "geometry": {"type": "Polygon", "coordinates": [boundary_geojson(ap_cod)]}}
        for ap_cod in sorted(aps_idx.keys())
    ]
    (pasta / "contornos" / "ap.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": ap_features}, ensure_ascii=False), encoding="utf-8")

    def casca_convexa(pontos):
        pontos = sorted(set(pontos))
        if len(pontos) <= 2:
            return pontos

        def metade(pts):
            casca = []
            for p in pts:
                while len(casca) >= 2 and cruz(casca[-2], casca[-1], p) <= 0:
                    casca.pop()
                casca.append(p)
            return casca

        def cruz(o, a, b):
            return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

        inferior = metade(pontos)
        superior = metade(list(reversed(pontos)))
        return inferior[:-1] + superior[:-1]

    todos_pontos = [(lng, lat) for x in H for lat, lng in [h3.cell_to_latlng(x["h"])]]
    casca = casca_convexa(todos_pontos)
    if casca and casca[0] != casca[-1]:
        casca = casca + [casca[0]]
    (pasta / "contornos" / "municipios.geojson").write_text(json.dumps({
        "type": "FeatureCollection",
        "features": [{"type": "Feature", "properties": {"cod": "270030", "nome": "Maceió"},
                      "geometry": {"type": "Polygon", "coordinates": [casca]}}],
    }, ensure_ascii=False), encoding="utf-8")

    fcu_pontos = [(lng, lat) for x in H if x["fcu"] for lat, lng in [h3.cell_to_latlng(x["h"])]]
    fcu_features = []
    if len(fcu_pontos) >= 3:
        casca_fcu = casca_convexa(fcu_pontos)
        if casca_fcu[0] != casca_fcu[-1]:
            casca_fcu = casca_fcu + [casca_fcu[0]]
        fcu_features = [{"type": "Feature", "properties": {"cod": "fcu_01", "nome": "Comunidade fictícia 1"},
                          "geometry": {"type": "Polygon", "coordinates": [casca_fcu]}}]
    (pasta / "contornos" / "fcu.geojson").write_text(json.dumps({
        "type": "FeatureCollection", "features": fcu_features,
    }, ensure_ascii=False), encoding="utf-8")

    # manifesto.json por último, com sha256 de todo o resto.
    arquivos = {}
    for caminho in sorted(pasta.rglob("*")):
        if caminho.is_file() and caminho.name != "manifesto.json":
            arquivos[str(caminho.relative_to(pasta)).replace("\\", "/")] = sha256_arquivo(caminho)

    manifesto = {
        "contrato": "1.0",
        "conjunto_id": conjunto_id,
        "nome": nome_dominio,
        "edicao": commit_fake[:7],
        "commit_completo": commit_fake,
        "data_execucao": "2026-11-22T00:00:00Z",
        "publico": True,
        "ficticio": True,
        "h3_resolucao": 8,
        "centro": [-35.715, -9.585],
        "zoom_inicial": 11.1,
        "contornos_tolerancia_m": 10,
        "d17_conferido": True,
        "periodos": PERIODOS,
        "componentes": COMPONENTES,
        "regime_mapa": "c",
        "recortes": [
            {
                "id": "braskem",
                "nome": "Área da Braskem",
                "motivo": "Área de subsidência por mineração (reassentamento desde 2018); 99 setores no piloto",
                "fonte": "Perímetro de risco da Defesa Civil de Maceió / Braskem (fictício neste pacote)",
            },
        ],
        "arquivos": arquivos,
    }
    (pasta / "manifesto.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{conjunto_id}: {n_hex} hexágonos, {len(ap_rows) // 3} APs, {len(sem_dado)} sem dado, {len(parcial)} sigilo parcial -> {pasta}")


def main():
    cells_maceio = sorted(h3.polygon_to_cells(h3.LatLngPoly(POLIGONO_MACEIO), 8))
    montar_pacote(
        "al_rm_maceio", cells_maceio, "al_rm_maceio", "RM de Maceió",
        TOTAIS_REAIS, DOM_REAIS, LARG_REAIS, MUDANCAS_Z_REAIS,
        n_setores_base=3, incluir_consistencia_real=True,
    )

    cells_pequeno = cells_maceio[:20]
    totais_pequeno = {c: {"v": [v / 20 for v in TOTAIS_REAIS[c]["v"]], "ep": [e / 20 if e is not None else None for e in TOTAIS_REAIS[c]["ep"]]} for c in COMPONENTES}
    dom_pequeno = [d / 20 for d in DOM_REAIS]
    montar_pacote(
        "teste_pequeno", cells_pequeno, "teste_pequeno", "Teste pequeno (20 hexágonos)",
        totais_pequeno, dom_pequeno, LARG_REAIS, MUDANCAS_Z_REAIS,
        n_setores_base=1, incluir_consistencia_real=False,
    )


if __name__ == "__main__":
    main()
