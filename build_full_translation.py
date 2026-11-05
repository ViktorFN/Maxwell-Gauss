import sys, re

with open('module_script.js', 'r', encoding='utf-8') as f:
    js = f.read()

print("Original js length:", len(js))

def replace_exact(content, target, replacement, desc):
    if target not in content:
        print(f"FAILED to find target for: {desc}")
        sys.exit(1)
    count = content.count(target)
    if count > 1:
        print(f"WARNING: target for '{desc}' appears {count} times! Replacing all.")
    print(f"SUCCESS: Replaced '{desc}' ({count} occurrences)")
    return content.replace(target, replacement)

# 1. Fonts: add Inter and JetBrains Mono fallback
js = replace_exact(js,
    "Y='Outfit, \"Noto Sans Math\", sans-serif',de='\"DM Mono\", \"Noto Sans Math\", monospace'",
    "Y='Inter, Outfit, \"Noto Sans Math\", sans-serif',de='\"JetBrains Mono\", \"DM Mono\", \"Noto Sans Math\", monospace'",
    "Canvas font definitions"
)

# 2. Plaque text and removing link
js = replace_exact(js,
    'pi="https://x.com/ryansael"',
    'pi=""',
    "Remove external URL in pi"
)
js = replace_exact(js,
    'const l="@RYANSAEL ON X"',
    'const l="ДОСКА ГАЛЬТОНА"',
    "Plaque text"
)
js = replace_exact(js,
    'e.font=`${n?700:600} ${i}px Outfit, sans-serif`',
    'e.font=`${n?700:600} ${i}px Inter, Outfit, sans-serif`',
    "Plaque font"
)
# Plaque hit registration: remove link action
js = replace_exact(js,
    'ts.forEach(e=>me(e.hit,"link",{L:e}));',
    '0;',
    "Disable 3D plaque link hit registration"
)
js = replace_exact(js,
    'case"link":window.open(pi,"_blank","noopener");break}',
    'case"link":break}',
    "Disable open(pi) on link click"
)

# 3. Tooltips `qs`
old_qs = '''qs={lever:()=>"Pull: a tap drops 1, half 10, all the way 1,000",pegs:()=>"Drag up or down for fewer or more rows \\xB7 click for the routes",case:()=>"Drag sideways to tilt the board",base:()=>E.cur==="exploded"?"Put the board back together":"Take the board apart",speed:()=>"Drag to set the speed",play:()=>h.playing?"Pause":"Play",reset:()=>"Empty the bins",drop:e=>`Drop ${O(e.c)} bead${e.c>1?"s":""}`,tiltKey:e=>e.d<0?"Tilt left":"Tilt right",knob:()=>"Rows: left half fewer, right half more",paths:()=>y.paths?"Hide the paths":"Show the paths and Pascal's triangle",learn:()=>"How it works",town:()=>y.crowdT?"Let the crowd mill about":"Line the crowd up by height",link:()=>"@RYANSAEL on X"}'''

new_qs = '''qs={lever:()=>"Потянуть: лёгкое касание — 1, наполовину — 10, до упора — 1 000",pegs:()=>"Тяните вверх/вниз для изменения рядов · клик для путей",case:()=>"Тяните корпус вбок, чтобы наклонить доску",base:()=>E.cur==="exploded"?"Собрать доску обратно":"Разобрать доску по слоям",speed:()=>"Тяните для настройки скорости",play:()=>h.playing?"Пауза":"Старт",reset:()=>"Очистить накопители",drop:e=>`Бросить ${O(e.c)} ${e.c===1?"шарик":e.c<5?"шарика":"шариков"}`,tiltKey:e=>e.d<0?"Наклон влево":"Наклон вправо",knob:()=>"Ряды: левее — меньше, правее — больше",paths:()=>y.paths?"Скрыть пути":"Показать пути и треугольник Паскаля",learn:()=>"Как это устроено",town:()=>y.crowdT?"Распустить толпу":"Выстроить толпу по росту",link:()=>""}'''

js = replace_exact(js, old_qs, new_qs, "qs tooltips definition")

# 4. ol() function (why text)
old_ol = '''function ol(){const e=h.n,t=h.p,o=P.settled,n=h.P;if(B-z.at<1.6&&h.NB<2)return`The floor opens and the bins empty. <b>${e} rows</b>, ${t===.5?"level":`p = ${t.toFixed(2)}`}, so each bead will flip <b>${e} coins</b>.`;const a=be.i;if(a>=0&&a<h.NB&&!be.auto&&Fe[a]<=h.T&&h.T<fn(a)+5){const c=h.T-Fe[a],d=c>=Eo()+Kt[a],u=Ht[a];return d?`This bead went right <b>${u}</b> times in ${e}, so it landed in <b>bin ${u}</b>. <span class="c">${O(et[e][u])}</span> of the ${O(2**e)} routes end there`+(t===.5?`, so that bin gets <b>${(n[u]*100).toFixed(1)} %</b> of the beads.`:`. With p = ${t.toFixed(2)}, that bin gets ${(n[u]*100).toFixed(1)} %.`):`One bead, ${e} coin flips. At each peg it goes <span class="a">left or right</span>, and its bin is the number of times it went right.`}if(o<20)return`Each bead flips a coin at every one of the <b>${e} rows</b>, so you can't tell where one will land. Drop <b>a thousand</b> and the bins make a bell.`;let i=0;for(let c=1;c<=e;c++)n[c]>n[i]&&(i=c);const l=t===.5&&e%2===1;let s=`<b>${O(o)} beads</b> through <b>${e} rows</b>, ${e} coin flips each. `;if(l){const c=(e-1)/2;s+=`The two middle bins hold <b>${O(P.count[c])}</b> and <b>${O(P.count[c+1])}</b>, where the binomial predicts <span class="c">${(o*n[c]).toFixed(1)}</span> each.`}else s+=`<b>${O(P.count[i])}</b> landed in ${t===.5?"the middle bin":`bin ${i}, the likeliest`}, where the binomial predicts <span class="c">${(o*n[i]).toFixed(1)}</span>.`;return P.tv>=.03?s+=` With ${e<8?`only ${e} rows`:`p = ${t.toFixed(2)}`} the bell doesn\\u2019t fit well and would misplace <span class="r">${(P.tv*100).toFixed(0)} %</span> of the beads.`:P.worst>=3.5&&(s+=` Bin ${P.worstK} is <span class="r">${P.worst.toFixed(1)} \\u03C3</span> off its prediction, which is rare.`),s}'''

new_ol = '''function ol(){const e=h.n,t=h.p,o=P.settled,n=h.P;if(B-z.at<1.6&&h.NB<2)return`Дно открывается, и накопители очищаются. <b>${e} рядов</b>, ${t===.5?"горизонтально":`p = ${t.toFixed(2)}`}, каждый шарик сделает <b>${e} случайных выборов</b>.`;const a=be.i;if(a>=0&&a<h.NB&&!be.auto&&Fe[a]<=h.T&&h.T<fn(a)+5){const c=h.T-Fe[a],d=c>=Eo()+Kt[a],u=Ht[a];return d?`Этот шарик повернул вправо <b>${u}</b> раз из ${e}, поэтому попал в <b>ячейку ${u}</b>. В неё ведут <span class="c">${O(et[e][u])}</span> из ${O(2**e)} путей`+(t===.5?`, так что эта ячейка получает <b>${(n[u]*100).toFixed(1)} %</b> шариков.`:`. При p = ${t.toFixed(2)} эта ячейка получает ${(n[u]*100).toFixed(1)} %.`):`Один шарик — ${e} бросков монеты. На каждом штырьке он отскакивает <span class="a">влево или вправо</span>, а его ячейка — число поворотов вправо.`}if(o<20)return`На каждом из <b>${e} рядов</b> шарик бросает монетку, поэтому предсказать путь одного невозможно. Сбросьте <b>тысячу</b> — и ячейки образуют колокол.`;let i=0;for(let c=1;c<=e;c++)n[c]>n[i]&&(i=c);const l=t===.5&&e%2===1;let s=`<b>${O(o)} шариков</b> через <b>${e} рядов</b>, по ${e} бросков монеты каждый. `;if(l){const c=(e-1)/2;s+=`Две средние ячейки содержат <b>${O(P.count[c])}</b> и <b>${O(P.count[c+1])}</b>, где теория предсказывает по <span class="c">${(o*n[c]).toFixed(1)}</span>.`}else s+=`<b>${O(P.count[i])}</b> попали в ${t===.5?"среднюю ячейку":`ячейку ${i} (наиболее вероятную)`}, где теория предсказывает <span class="c">${(o*n[i]).toFixed(1)}</span>.`;return P.tv>=.03?s+=` При ${e<8?`всего ${e} рядах`:`p = ${t.toFixed(2)}`} колокол не идеально описывает результат и ошибся бы на <span class="r">${(P.tv*100).toFixed(0)} %</span> шариков.`:P.worst>=3.5&&(s+=` Ячейка ${P.worstK} отклоняется от предсказания на <span class="r">${P.worst.toFixed(1)} \\u03C3</span>, что бывает редко.`),s}'''

js = replace_exact(js, old_ol, new_ol, "ol() why function")

# 5. Se stats function
old_se_text = '''R("#s-n2").textContent=P.flying+P.queued?`+${O(P.flying+P.queued)} coming`:"in the bins",R("#s-m").textContent=a?P.mean.toFixed(2):"\\u2013",R("#s-m2").textContent=`theory ${(t*o).toFixed(2)}`,R("#s-s").textContent=a?P.sd.toFixed(2):"\\u2013",R("#s-s2").textContent=`theory ${Math.sqrt(t*o*(1-o)).toFixed(2)}`,R("#s-g").textContent=a?P.worst.toFixed(1)+" \\u03C3":"\\u2013",R("#s-g2").textContent=a?`bin ${P.worstK}, ${P.worst<2.5?"luck":P.worst<3.5?"unusual":"rare"}`:"from theory"'''

new_se_text = '''R("#s-n2").textContent=P.flying+P.queued?`+${O(P.flying+P.queued)} летят`:"в ячейках",R("#s-m").textContent=a?P.mean.toFixed(2):"\\u2013",R("#s-m2").textContent=`теория ${(t*o).toFixed(2)}`,R("#s-s").textContent=a?P.sd.toFixed(2):"\\u2013",R("#s-s2").textContent=`теория ${Math.sqrt(t*o*(1-o)).toFixed(2)}`,R("#s-g").textContent=a?P.worst.toFixed(1)+" \\u03C3":"\\u2013",R("#s-g2").textContent=a?`ячейка ${P.worstK}, ${P.worst<2.5?"норма":P.worst<3.5?"необычно":"редко"}`:"от теории"'''

js = replace_exact(js, old_se_text, new_se_text, "Se() stats labels")

# 6. Render Tuning table Pt
old_pt = '''const Pt=[["pixelRatio","Pixel ratio",1,2,.05,e=>e.toFixed(2)],["msaa","MSAA",0,4,2,e=>e?e+"\\xD7":"off"],["smaa","SMAA",0,1,1,e=>e?"on":"off"],["shadow","Shadow map",512,4096,512,e=>e+"px"],["exposure","Exposure",.6,1.8,.02,e=>e.toFixed(2)],["fov","Field of view",18,55,1,e=>e+"\\xB0"],["sun","Key light",0,3,.05,e=>e.toFixed(2)],["fill","Fill light",0,2,.05,e=>e.toFixed(2)],["rim","Rim light",0,3,.05,e=>e.toFixed(2)],["fog","Haze",0,2.5,.05,e=>e.toFixed(2)],["sat","Saturation",.6,1.8,.02,e=>e.toFixed(2)],["env","Environment",0,2,.05,e=>e.toFixed(2)],["reflect","Floor mirror",0,2,.05,e=>e.toFixed(2)],["dof","Depth of field",0,1,1,e=>e?"on":"off"],["focalBand","focal band",.3,5,.05,e=>e.toFixed(2)+"\\xD7",1],["aperture","far blur",.05,3,.05,e=>e.toFixed(2),1],["apertureNear","near blur",.05,3,.05,e=>e.toFixed(2),1],["maxCoc","max bokeh",3,24,1,e=>e+"px",1],["bloom","Bloom",0,1,1,e=>e?"on":"off"],["bloomStrength","strength",0,3,.02,e=>e.toFixed(2)+"\\xD7",1],["bloomRadius","radius",0,1.5,.02,e=>e.toFixed(2),1],["bloomThreshold","threshold",0,3,.05,e=>e.toFixed(2)+"\\xD7",1],["ao","Ambient occlusion",0,1,1,e=>e?"on":"off"],["aoIntensity","intensity",0,1.5,.02,e=>e.toFixed(2),1],["aoRadius","radius",.1,4,.05,e=>e.toFixed(2),1],["aoSamples","samples",2,16,1,e=>e,1],["auto","Auto quality",0,1,1,e=>e?"on":"off"]];'''

new_pt = '''const Pt=[["pixelRatio","Разрешение",1,2,.05,e=>e.toFixed(2)],["msaa","MSAA",0,4,2,e=>e?e+"\\xD7":"выкл"],["smaa","SMAA",0,1,1,e=>e?"вкл":"выкл"],["shadow","Карта теней",512,4096,512,e=>e+"px"],["exposure","Экспозиция",.6,1.8,.02,e=>e.toFixed(2)],["fov","Поле зрения",18,55,1,e=>e+"\\xB0"],["sun","Основной свет",0,3,.05,e=>e.toFixed(2)],["fill","Заполняющий свет",0,2,.05,e=>e.toFixed(2)],["rim","Контровой свет",0,3,.05,e=>e.toFixed(2)],["fog","Дымка / туман",0,2.5,.05,e=>e.toFixed(2)],["sat","Насыщенность",.6,1.8,.02,e=>e.toFixed(2)],["env","Окружение",0,2,.05,e=>e.toFixed(2)],["reflect","Отражение пола",0,2,.05,e=>e.toFixed(2)],["dof","Глубина резкости",0,1,1,e=>e?"вкл":"выкл"],["focalBand","фокусная полоса",.3,5,.05,e=>e.toFixed(2)+"\\xD7",1],["aperture","размытие вдали",.05,3,.05,e=>e.toFixed(2),1],["apertureNear","размытие вблизи",.05,3,.05,e=>e.toFixed(2),1],["maxCoc","макс. боке",3,24,1,e=>e+"px",1],["bloom","Свечение (Bloom)",0,1,1,e=>e?"вкл":"выкл"],["bloomStrength","интенсивность",0,3,.02,e=>e.toFixed(2)+"\\xD7",1],["bloomRadius","радиус",0,1.5,.02,e=>e.toFixed(2),1],["bloomThreshold","порог",0,3,.05,e=>e.toFixed(2)+"\\xD7",1],["ao","Затенение (AO)",0,1,1,e=>e?"вкл":"выкл"],["aoIntensity","интенсивность",0,1.5,.02,e=>e.toFixed(2),1],["aoRadius","радиус",.1,4,.05,e=>e.toFixed(2),1],["aoSamples","выборки",2,16,1,e=>e,1],["auto","Авто-качество",0,1,1,e=>e?"вкл":"выкл"]];'''

js = replace_exact(js, old_pt, new_pt, "Pt tuning table")

# 7. Toasts we(...)
js = replace_exact(js,
    'we("The bins are full: \\u232B empties them")',
    'we("Накопители заполнены: ⌫ очищает их")',
    "Toast bins full"
)
js = replace_exact(js,
    'we(`Only ${O(n)} more fit. The bins hold about ${O(h.cap)}.`)',
    'we(`Поместится ещё только ${O(n)}. Вместимость ячеек около ${O(h.cap)}.`)',
    "Toast only n more fit"
)
js = replace_exact(js,
    'we(`Emptied the bins to make room for ${O(e)}`)',
    'we(`Накопители очищены, чтобы освободить место для ${O(e)}`)',
    "Toast emptied bins for n"
)
js = replace_exact(js,
    'we("Bins emptied")',
    'we("Накопители очищены")',
    "Toast bins emptied"
)
js = replace_exact(js,
    'we(e+" rows of pegs")',
    'we(e+" рядов штырьков")',
    "Toast rows of pegs"
)
js = replace_exact(js,
    'we(y.crowdT?`Lined up by height: mean ${D.mean.toFixed(1)} cm, \\u03C3 ${D.sd.toFixed(1)} cm`:"Back to the square")',
    'we(y.crowdT?`Построение по росту: средний ${D.mean.toFixed(1)} см, σ ${D.sd.toFixed(1)} см`:"Назад на площадь")',
    "Toast lined up crowd"
)
js = replace_exact(js,
    'we(y.paths?"The numbers count the routes to each peg":"Paths hidden")',
    'we(y.paths?"Числа показывают количество путей к каждому штырьку":"Пути скрыты")',
    "Toast peg routes"
)
js = replace_exact(js,
    'we("Drag the case sideways to tilt the board")',
    'we("Тяните корпус вбок, чтобы наклонить доску")',
    "Toast drag case"
)
js = replace_exact(js,
    'we(`Dropped ${O(o)} bead${o>1?"s":""}`)',
    'we(`Брошено ${O(o)} ${o===1?"шарик":o<5?"шарика":"шариков"}`)',
    "Toast dropped beads"
)
js = replace_exact(js,
    'we("Level")',
    'we("Горизонтально")',
    "Toast level"
)
js = replace_exact(js,
    'we(h.playing?"Playing":"Paused")',
    'we(h.playing?"Воспроизведение":"Пауза")',
    "Toast playing paused"
)
js = replace_exact(js,
    'we("Speed "+h.speed+"\\xD7")',
    'we("Скорость "+h.speed+"×")',
    "Toast speed"
)
js = replace_exact(js,
    'we(y.paths?"Paths shown":"Paths hidden")',
    'we(y.paths?"Пути показаны":"Пути скрыты")',
    "Toast paths shown hidden"
)
js = replace_exact(js,
    'we(o[0].toUpperCase()+o.slice(1))',
    'we(o==="lab"?"Лаборатория":o==="exploded"?"По слоям":"Студия")',
    "Toast view name"
)
js = replace_exact(js,
    'we(jt?"Labels on":"Labels off")',
    'we(jt?"Подписи включены":"Подписи отключены")',
    "Toast labels on off"
)
js = replace_exact(js,
    'we(Bn.classList.contains("ui-off")?"Interface hidden \\xB7 \\u21E7/ to show":"Interface shown")',
    'we(Bn.classList.contains("ui-off")?"Интерфейс скрыт · ⇧/ для показа":"Интерфейс показан")',
    "Toast interface shown hidden"
)
js = replace_exact(js,
    'we("Link copied")',
    'we("Ссылка скопирована")',
    "Toast link copied"
)

# 8. WebGL error message
js = replace_exact(js,
    'throw R("#loading").textContent="This needs WebGL. Try turning on graphics acceleration, or another browser.",e',
    'throw R("#loading").textContent="Для работы требуется WebGL. Включите аппаратное ускорение в настройках браузера.",e',
    "WebGL error"
)

# 9. Exploded layers array
old_layers = 'const i=[["FRONT GLASS PANE","keeps the beads in"],["PEG GRID LAYER","staggered pegs"],["GLOWING BEADS","falling now"],["BIN ROW","the distribution"]];'
new_layers = 'const i=[["ПЕРЕДНЕЕ СТЕКЛО","удерживает шарики внутри"],["СЕТКА ШТЫРЬКОВ","шахматный порядок"],["СВЕТЯЩИЕСЯ ШАРИКИ","падают прямо сейчас"],["РЯД НАКОПИТЕЛЕЙ","распределение"]];'
js = replace_exact(js, old_layers, new_layers, "Exploded layers array")

old_gap = 'const l=h.n,s=[`${(2*Z*10).toFixed(1)} cm gap for the beads`,`${O(l*(l+1)/2)} pegs in ${l} rows`,`${O(P.flying)} falling, ${O(P.queued)} waiting`,`${l+1} bins, ${O(P.settled)} beads`][t];'
new_gap = 'const l=h.n,s=[`зазор для шариков: ${(2*Z*10).toFixed(1)} см`,`${O(l*(l+1)/2)} штырьков в ${l} рядах`,`${O(P.flying)} летят, ${O(P.queued)} ждут`,`${l+1} ячеек, ${O(P.settled)} шариков`][t];'
js = replace_exact(js, old_gap, new_gap, "Exploded layer captions")

# 10. Callouts X
js = replace_exact(js,
    'm?`\\u2192 bin ${g} \\xB7 ${O(et[o][g])} of ${O(2**o)} routes`:v===o?`\\u2192 bin ${g}`:""',
    'm?`→ ячейка ${g} · ${O(et[o][g])} из ${O(2**o)} путей`:v===o?`→ ячейка ${g}`:""',
    "X.feat route description"
)
js = replace_exact(js,
    'e>>a&1?"R":"L"',
    'e>>a&1?"П":"Л"',
    "Fr direction R/L to П/Л"
)
js = replace_exact(js,
    'X.funnel.userData.set("Funnel",`${O(P.queued)} waiting`,"#7fe3ff")',
    'X.funnel.userData.set("Воронка",`${O(P.queued)} в очереди`,"#7fe3ff")',
    "X.funnel label"
)
js = replace_exact(js,
    'X.rows.userData.set(`${o} rows`,Nt?`${O(o*(o+1)/2)} pegs`:`${O(o*(o+1)/2)} pegs, ${o} flips a bead`,"#ffb454",p?1:-1)',
    'X.rows.userData.set(`${o} ${o===1?"ряд":o<5?"ряда":"рядов"}`,Nt?`${O(o*(o+1)/2)} штырьков`:`${O(o*(o+1)/2)} штырьков, ${o} отскоков на шарик`,"#ffb454",p?1:-1)',
    "X.rows label"
)
js = replace_exact(js,
    'X.tilt.userData.set(y.tiltT?`Tilted ${Math.abs(y.tiltT)}\\xB0 ${y.tiltT>0?"right":"left"}`:"Level",`p = ${w.toFixed(2)}`,"#ffb454",-1)',
    'X.tilt.userData.set(y.tiltT?`Наклон ${Math.abs(y.tiltT)}° ${y.tiltT>0?"вправо":"влево"}`:"Горизонтально",`p = ${w.toFixed(2)}`,"#ffb454",-1)',
    "X.tilt label"
)
js = replace_exact(js,
    'X.miss.userData.set("The bell misplaces",`${(x*100).toFixed(x<.1?1:0)} % of the beads`,"#ff6b86",p<0?-1:1)',
    'X.miss.userData.set("Погрешность колокола",`${(x*100).toFixed(x<.1?1:0)} % шариков`,"#ff6b86",p<0?-1:1)',
    "X.miss label"
)
js = replace_exact(js,
    'X.crowd.userData.set(`${D.N} heights`,`mean ${D.mean.toFixed(1)} cm \\xB7 \\u03C3 ${D.sd.toFixed(1)} cm`,"#ffb454")',
    'X.crowd.userData.set(`${D.N} человек`,`ср. ${D.mean.toFixed(1)} см · σ ${D.sd.toFixed(1)} см`,"#ffb454")',
    "X.crowd label"
)
js = replace_exact(js,
    'X.lever.userData.set(ue.pull<.4?"1 bead":ue.pull<.85?"10 beads":"1,000 beads","release to drop","#ffb454",-1)',
    'X.lever.userData.set(ue.pull<.4?"1 шарик":ue.pull<.85?"10 шариков":"1 000 шариков","отпустите для сброса","#ffb454",-1)',
    "X.lever label"
)

# 11. 3D Panels
# Panel 1: Explainer
js = replace_exact(js,
    'zo(e,t,"GALTON BOARD","EXPLAINER",.1)',
    'zo(e,t,"ДОСКА ГАЛЬТОНА","ОПИСАНИЕ",.1)',
    "zo Explainer header"
)
js = replace_exact(js,
    'da(e,"A classic way to show the binomial distribution and the central limit theorem.",t*.07,t*.235,t*.6,t*.048)',
    'da(e,"Классический способ наглядно показать биномиальное распределение и центральную предельную теорему.",t*.07,t*.235,t*.6,t*.048)',
    "Explainer subtitle"
)
js = replace_exact(js,
    'e.fillText("Frequency",0,0)',
    'e.fillText("Частота",0,0)',
    "Explainer Frequency"
)
js = replace_exact(js,
    'e.fillText("Outcome (\\u03C3 from the mean)",n+i/2,a+l+t*.075)',
    'e.fillText("Результат (σ от среднего)",n+i/2,a+l+t*.075)',
    "Explainer Outcome"
)
js = replace_exact(js,
    'e.fillText("LEARN MORE",t/2,f+x/2+1)',
    'e.fillText("ПОДРОБНЕЕ",t/2,f+x/2+1)',
    "Explainer Learn More"
)

# Panel 2: Today's topic / Normal distribution
js = replace_exact(js,
    'zo(e,t,"TODAY\'S TOPIC",null,.1)',
    'zo(e,t,"ТЕМА ДНЯ",null,.1)',
    "Today's topic header"
)
js = replace_exact(js,
    'e.fillText("The normal distribution",t*.07,t*.19)',
    'e.fillText("Нормальное распределение",t*.07,t*.19)',
    "The normal distribution title"
)
js = replace_exact(js,
    'da(e,"Lots of small random effects added up make a bell curve, from coin flips to people\'s heights.",t*.07,t*.255,t*.86,t*.048)',
    'da(e,"Сумма множества малых случайных величин образует форму колокола — от бросков монеты до роста людей.",t*.07,t*.255,t*.86,t*.048)',
    "The normal distribution subtitle"
)

# Panel 3: Bead path / Pascal
js = replace_exact(js,
    'zo(e,t,"BEAD PATH: LEFT OR RIGHT",null,.085)',
    'zo(e,t,"ТРАЕКТОРИЯ ШАРИКА: ВЛЕВО ИЛИ ВПРАВО",null,.085)',
    "Bead path header"
)
js = replace_exact(js,
    'e.fillText(`Pascal\'s triangle: each number is the sum of the two above. ${n} rows, ${O(2**n)} routes.`,t*.07,o*.95)',
    'e.fillText(`Треугольник Паскаля: каждое число — сумма двух над ним. Рядов: ${n}, путей: ${O(2**n)}.`,t*.07,o*.95)',
    "Pascal triangle footer"
)

# Panel 4: Distribution
js = replace_exact(js,
    'zo(e,t,"DISTRIBUTION (BIN COUNTS)",null,.085)',
    'zo(e,t,"РАСПРЕДЕЛЕНИЕ (ПО ЯЧЕЙКАМ)",null,.085)',
    "Distribution header"
)
js = replace_exact(js,
    'e.fillText("BIN (number of rights)",n+i/2,o*.93)',
    'e.fillText("ЯЧЕЙКА (число поворотов вправо)",n+i/2,o*.93)',
    "Bin number of rights"
)
js = replace_exact(js,
    'e.fillText("COUNT",0,0)',
    'e.fillText("КОЛИЧЕСТВО",0,0)',
    "Count y-axis"
)

# Panel 5: Emergent order
js = replace_exact(js,
    'zo(e,t,"EMERGENT ORDER",null,.08)',
    'zo(e,t,"ПОРЯДОК ИЗ ХАОСА",null,.08)',
    "Emergent order header"
)
js = replace_exact(js,
    'e.fillText("FROM RANDOM EVENTS",t*.07,t*.15,t*.86)',
    'e.fillText("ИЗ СЛУЧАЙНЫХ СОБЫТИЙ",t*.07,t*.15,t*.86)',
    "From random events"
)
js = replace_exact(js,
    'e.fillText("Many individual choices \\u2192 predictable patterns.",t*.07,t*.235,t*.86)',
    'e.fillText("Множество частных выборов → предсказуемый закон.",t*.07,t*.235,t*.86)',
    "Many individual choices"
)
js = replace_exact(js,
    'e.fillText(`${O(n)} beads \\xD7 ${a} flips = ${O(n*a)} coin flips`,t*.07,t*.33,t*.86)',
    'e.fillText(`${O(n)} шариков × ${a} отскоков = ${O(n*a)} бросков монеты`,t*.07,t*.33,t*.86)',
    "Flips total"
)
js = replace_exact(js,
    'e.fillText(`mean ${n?P.mean.toFixed(2):"\\u2013"}  \\xB7  np = ${(a*i).toFixed(2)}`,t*.07,t*.4,t*.86)',
    'e.fillText(`ср. ${n?P.mean.toFixed(2):"–"}  ·  np = ${(a*i).toFixed(2)}`,t*.07,t*.4,t*.86)',
    "Mean np"
)
js = replace_exact(js,
    'e.fillText(`\\u03C3 ${n>1?P.sd.toFixed(2):"\\u2013"}  \\xB7  \\u221A(np(1\\u2212p)) = ${Math.sqrt(a*i*(1-i)).toFixed(2)}`,t*.07,t*.47,t*.86)',
    'e.fillText(`σ ${n>1?P.sd.toFixed(2):"–"}  ·  √(np(1−p)) = ${Math.sqrt(a*i*(1-i)).toFixed(2)}`,t*.07,t*.47,t*.86)',
    "Sigma theoretical"
)

# 12. 3D Console markings
js = replace_exact(js,
    'vr(t,"DROP")',
    'vr(t,"БРОСОК")',
    "Console DROP button"
)
js = replace_exact(js,
    'la(-3.65,se*.48,"PATHS",.7)',
    'la(-3.65,se*.48,"ПУТИ",.7)',
    "Console PATHS switch"
)
js = replace_exact(js,
    '()=>e<0?"TILT L":"TILT R"',
    '()=>e<0?"ВЛЕВО":"ВПРАВО"',
    "Console Tilt buttons"
)
js = replace_exact(js,
    'e.fillText("BEAD COUNT",t/2,o*.2)',
    'e.fillText("СЧЁТЧИК ШАРИКОВ",t/2,o*.2)',
    "Console BEAD COUNT"
)
js = replace_exact(js,
    'e.fillText(P.queued?`${O(P.queued)} in the funnel`:`room for ${O(Math.max(0,h.cap-h.NB))}`,t/2,o*.86)',
    'e.fillText(P.queued?`${O(P.queued)} в воронке`:`места для ${O(Math.max(0,h.cap-h.NB))}`,t/2,o*.86)',
    "Console in the funnel"
)
js = replace_exact(js,
    's.fillText("GALTON BOARD",c/2+3,u+5)',
    's.fillText("ДОСКА ГАЛЬТОНА",c/2+3,u+5)',
    "Case GALTON BOARD 1"
)
js = replace_exact(js,
    's.fillText("GALTON BOARD",c/2,u)',
    's.fillText("ДОСКА ГАЛЬТОНА",c/2,u)',
    "Case GALTON BOARD 2"
)
js = replace_exact(js,
    'b.fillText("Galton Board",m/2,v/2+5)',
    'b.fillText("Доска Гальтона",m/2,v/2+5)',
    "Studio Galton Board 1"
)
js = replace_exact(js,
    'b.fillText("Galton Board",m/2,v/2+2)',
    'b.fillText("Доска Гальтона",m/2,v/2+2)',
    "Studio Galton Board 2"
)
js = replace_exact(js,
    'e.fillText("GALTON BOARD",t/2,o*.4)',
    'e.fillText("ДОСКА ГАЛЬТОНА",t/2,o*.4)',
    "Base GALTON BOARD"
)
js = replace_exact(js,
    '`${O(P.settled)} beads in the bins \\xB7 ${h.n} rows \\xB7 p = ${h.p.toFixed(2)} \\xB7 t = ${h.T.toFixed(1)} s`',
    '`${O(P.settled)} шариков в ячейках · ${h.n} рядов · p = ${h.p.toFixed(2)} · t = ${h.T.toFixed(1)} с`',
    "Base stats line"
)

# 13. Russian Keyboard support
old_key_handler = '''const t=e.key.toLowerCase();if(["w","a","s","d","q","e","=","+","-","_","arrowleft","arrowright","arrowup","arrowdown","shift"].includes(t)){'''
new_key_handler = '''const _kMap={KeyW:"w",KeyA:"a",KeyS:"s",KeyD:"d",KeyQ:"q",KeyE:"e",KeyP:"p",KeyF:"f",KeyL:"l",KeyV:"v",KeyX:"x",KeyC:"c",KeyR:"r",KeyN:"n",KeyM:"m",BracketLeft:"[",BracketRight:"]",Comma:",",Period:".",Semicolon:";",Quote:"'",Digit1:"1",Digit2:"2",Digit3:"3",Digit0:"0",Space:" "};let t=e.key.toLowerCase();if(_kMap[e.code])t=_kMap[e.code];if(["w","a","s","d","q","e","=","+","-","_","arrowleft","arrowright","arrowup","arrowdown","shift"].includes(t)){'''
js = replace_exact(js, old_key_handler, new_key_handler, "Russian keyboard mapping")

with open('galton.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("SUCCESS: Wrote galton.js. Length:", len(js))
