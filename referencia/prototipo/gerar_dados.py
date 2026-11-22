# Dados FICTÍCIOS por hexágono para o protótipo do explorador; totais do domínio reais (REGISTRO_RESULTADOS, regime c).
import h3, json, math, random
random.seed(7)
poly=[(-9.45,-35.81),(-9.45,-35.64),(-9.50,-35.625),(-9.55,-35.64),(-9.60,-35.67),(-9.655,-35.695),(-9.672,-35.715),
      (-9.682,-35.735),(-9.705,-35.765),(-9.695,-35.775),(-9.67,-35.77),(-9.65,-35.78),(-9.62,-35.79),(-9.58,-35.80),(-9.52,-35.81)]
cells=sorted(h3.polygon_to_cells(h3.LatLngPoly(poly),8))
def d(a,b): return math.hypot((a[0]-b[0])*110.6,(a[1]-b[1])*109.7)
centro=(-9.655,-35.725); norte=(-9.545,-35.725); lagoa=(-9.665,-35.755); braskem=(-9.625,-35.752)
anos=['2022','2023','2024','2025']
tot={'coabitacao':[8391.73,6890.99,6746.24,7707.19],'onus':[27770.24,34444.48,29827.39,35356.44],'precariedade':[5081.73,5454.27,5322.92,5573.96]}
dom_tot=[427204.0,444688.6,446574.5,466575.0]
larg={'coabitacao':[0.705,0.7556,0.6887,0.7719,0.415,0.485],'onus':[0.466,0.3578,0.4295,0.3367,0.236,0.219],'precariedade':[0.203,None,None,None,None,None]}
H=[]
for c in cells:
    lat,lng=h3.cell_to_latlng(c); p=(lat,lng)
    dc,dn,dl,db=d(p,centro),d(p,norte),d(p,lagoa),d(p,braskem)
    dens=420*math.exp(-dc/5.5)+260*math.exp(-dn/3.0)+120*math.exp(-dl/2.0)+random.lognormvariate(3.0,0.9)
    if random.random()<0.13 or lat>-9.47 and random.random()<0.5: dens=0
    if db<1.1: dens*=0.08
    coab=0.012+0.022*math.exp(-dn/3.5)+0.010*math.exp(-dl/1.8)+random.gauss(0,0.003)
    onus=0.040+0.050*math.exp(-dc/3.0)+0.020*math.exp(-dn/4)+random.gauss(0,0.008)
    fap=max(0.11,min(7.7,0.3+3.0*math.exp(-dl/1.3)+1.4*math.exp(-dn/2.2)+random.lognormvariate(-1.2,0.6)))
    H.append(dict(h=c,lat=lat,lng=lng,dens=dens,coab=max(coab,0.002),onus=max(onus,0.005),fap=fap,
                  ap=h3.cell_to_parent(c,7),braskem=db<1.1,
                  fcu=(dl<2.0 and random.random()<0.6) or (dn<3.0 and random.random()<0.3)))
# estoque por ano: 2023 com ruído de detecção (Open Buildings); 2024/25 com g=1 na maioria (MapBiomas)
for x in H:
    g23=1+random.gauss(0,0.06) if x['dens']>0 else 1
    if x['braskem']: g23*=0.9
    g24=1 if random.random()<0.62 else 1+abs(random.gauss(0,0.04))
    g25=g24 if random.random()<0.75 else g24+abs(random.gauss(0,0.05))
    x['g']=[1,g23,g24,g25]
dom=[[x['dens']*x['g'][i] for x in H] for i in range(4)]
for i in range(4):
    s=sum(dom[i]); dom[i]=[v*dom_tot[i]/s for v in dom[i]]
sig=set(random.sample([i for i,x in enumerate(H) if x['dens']>0],6))
val={}
for comp,key in [('coabitacao','coab'),('onus','onus'),('precariedade','fap')]:
    serie=[]
    for i in range(4):
        r=[]
        for j,x in enumerate(H):
            if comp=='onus' and i>=2: taxa=x['onus']*(1+random.gauss(0,0.05))
            elif comp=='precariedade': taxa=0.0119*x['fap']
            else: taxa=x[key]
            r.append(taxa*dom[i][j])
        s=sum(r); r=[v*tot[comp][i]/s for v in r]
        serie.append(r)
    serie.append([(serie[0][j]+serie[1][j]+serie[2][j])/3 for j in range(len(H))])
    serie.append([(serie[1][j]+serie[2][j]+serie[3][j])/3 for j in range(len(H))])
    val[comp]=serie
domm=dom+[[ (dom[0][j]+dom[1][j]+dom[2][j])/3 for j in range(len(H))],[(dom[1][j]+dom[2][j]+dom[3][j])/3 for j in range(len(H))]]
# APs fictícias
aps={}
for j,x in enumerate(H): aps.setdefault(x['ap'],[]).append(j)
apinfo={}
for k,(ap,idx) in enumerate(sorted(aps.items())):
    motor=sum(val['coabitacao'][0][j] for j in idx); dd=sum(dom[0][j] for j in idx)
    cv=min(0.9,3.317899*max(motor,1)**-0.487441) if motor>0 else None
    direta=motor*random.lognormvariate(0,cv*0.8) if cv else 0
    apinfo[ap]=dict(nome=f"AP {k+1:02d}",motor=round(motor,1),direta=round(direta,1),cv=round(cv*100,1) if cv else None,ressalva=bool(cv and cv>0.30),dom=round(dd))
def R(v,n=3): return None if v is None else round(v,n)
out=[]
for j,x in enumerate(H):
    nulo=j in sig
    row=dict(h=x['h'],ap=x['ap'],fcu=x['fcu'],bk=x['braskem'],
             dom=[None if nulo else R(domm[i][j],1) for i in range(6)])
    for comp in val:
        row[comp]=[None if nulo else R(val[comp][i][j]) for i in range(6)]
    out.append(row)
json.dump(dict(hex=out,ap=apinfo,larg=larg,
  totais=dict(coabitacao=dict(v=[8391.73,6890.99,6746.24,7707.19,7342.99,7114.81],ep=[1593.9,1408.8,1289.8,1497.0,816.7,852.2]),
              onus=dict(v=[27770.24,34444.48,29827.39,35356.44,30680.70,33209.44],ep=[3258.2,2989.7,3525.3,3073.5,1907.5,2013.7]),
              precariedade=dict(v=[5081.73,5454.27,5322.92,5573.96,5286.31,5450.38],ep=[263.3,None,None,None,None,None])),
  dom=[427204.0,444688.6,446574.5,466575.0,439489.0,452612.7]),open('dados.json','w'),separators=(',',':'))
print(len(out),'hex',len(apinfo),'APs', sum(1 for r in out if r['fcu']),'fcu', sum(1 for r in out if r['bk']),'braskem')
