# -*- coding: utf-8 -*-
import re
import os

print("Building standalone offline Galton Board & Lab Worksheet with KaTeX...")

index_html = open("index.html", "r", encoding="utf-8").read()
three_code = open("three-0.183.2.js", "r", encoding="utf-8").read()
galton_code = open("galton.js", "r", encoding="utf-8").read()
lab_core_code = open("lab-core.js", "r", encoding="utf-8").read()
lab_code = open("lab.js", "r", encoding="utf-8").read()

katex_css = open("katex/katex-embedded.min.css", "r", encoding="utf-8").read()
katex_js = open("katex/katex.min.js", "r", encoding="utf-8").read()
auto_render_js = open("katex/auto-render.min.js", "r", encoding="utf-8").read()

# 0. Обновляем автономный журнал lab_work.html (встраиваем lab-core.js и KaTeX)
if os.path.exists("lab_work.html"):
    lab_work_html = open("lab_work.html", "r", encoding="utf-8").read()
    
    # Встраиваем lab-core.js
    inlined_tag_re = re.compile(r'<script id="inlined-lab-core">[\s\S]*?</script>')
    if inlined_tag_re.search(lab_work_html):
        lab_work_html = inlined_tag_re.sub(
            lambda _m: f'<script id="inlined-lab-core">\n{lab_core_code}\n</script>',
            lab_work_html,
            count=1
        )
    
    # Встраиваем KaTeX CSS
    katex_link_re = re.compile(r'<link rel="stylesheet" href="\./katex/katex\.min\.css">')
    if katex_link_re.search(lab_work_html):
        lab_work_html = katex_link_re.sub(
            lambda _m: f'<style id="inlined-katex-css">\n{katex_css}\n</style>',
            lab_work_html,
            count=1
        )
    
    # Встраиваем KaTeX JS
    katex_scripts_re = re.compile(r'<script src="\./katex/katex\.min\.js"></script>\s*<script src="\./katex/auto-render\.min\.js"></script>')
    if katex_scripts_re.search(lab_work_html):
        lab_work_html = katex_scripts_re.sub(
            lambda _m: f'<script id="inlined-katex-js">\n{katex_js}\n</script>\n<script id="inlined-katex-autorender">\n{auto_render_js}\n</script>',
            lab_work_html,
            count=1
        )
    
    with open("lab_work.html", "w", encoding="utf-8") as f:
        f.write(lab_work_html)
    print("Updated lab_work.html with inlined lab-core.js and inlined KaTeX, size:", os.path.getsize("lab_work.html"), "bytes")

# 1. Адаптация galton.js: убираем ES import и связываем с window.__THREE_LIB
import_regex = re.compile(
    r'import\*as r from"three";import\{EffectComposer as ci\}from"three/addons/postprocessing/EffectComposer\.js";import\{Pass as En,FullScreenQuad as pt\}from"three/addons/postprocessing/Pass\.js";import\{GTAOPass as _a\}from"three/addons/postprocessing/GTAOPass\.js";import\{UnrealBloomPass as fi\}from"three/addons/postprocessing/UnrealBloomPass\.js";import\{OutputPass as di\}from"three/addons/postprocessing/OutputPass\.js";import\{SMAAPass as ui\}from"three/addons/postprocessing/SMAAPass\.js";import\{RoundedBoxGeometry as hi\}from"three/addons/geometries/RoundedBoxGeometry\.js";import\{mergeGeometries as Ln\}from"three/addons/utils/BufferGeometryUtils\.js";'
)

replacement_bindings = """
const r = window.__THREE_LIB["three"];
const ci = window.__THREE_LIB["three/addons/postprocessing/EffectComposer.js"].EffectComposer;
const { Pass: En, FullScreenQuad: pt } = window.__THREE_LIB["three/addons/postprocessing/Pass.js"];
const _a = window.__THREE_LIB["three/addons/postprocessing/GTAOPass.js"].GTAOPass;
const fi = window.__THREE_LIB["three/addons/postprocessing/UnrealBloomPass.js"].UnrealBloomPass;
const di = window.__THREE_LIB["three/addons/postprocessing/OutputPass.js"].OutputPass;
const ui = window.__THREE_LIB["three/addons/postprocessing/SMAAPass.js"].SMAAPass;
const hi = window.__THREE_LIB["three/addons/geometries/RoundedBoxGeometry.js"].RoundedBoxGeometry;
const Ln = window.__THREE_LIB["three/addons/utils/BufferGeometryUtils.js"].mergeGeometries;
"""

if not import_regex.search(galton_code):
    raise RuntimeError("Could not find import statement in galton.js")

galton_standalone_code = import_regex.sub(lambda _m: replacement_bindings, galton_code, count=1)

# 2. Находим место подключения скриптов в index.html
script_marker = "<!-- Three.js Bundle and Add-ons -->"
marker_pos = index_html.find(script_marker)
if marker_pos == -1:
    raise RuntimeError(f"Marker '{script_marker}' not found in index.html")

html_head = index_html[:marker_pos]

# В html_head заменяем внешние ссылки KaTeX на встроенные
html_head = html_head.replace(
    '<link rel="stylesheet" href="./katex/katex.min.css">',
    f'<style id="inlined-katex-css">\n{katex_css}\n</style>'
)
html_head = html_head.replace(
    '<script src="./katex/katex.min.js"></script>',
    ''
)
html_head = html_head.replace(
    '<script src="./katex/auto-render.min.js"></script>',
    ''
)

# 3. Формируем единый HTML-файл (Three.js + KaTeX + galton.js + lab-core.js + lab.js)
standalone_html = f"""{html_head}<!-- ======================================================================= -->
<!-- THREE.JS BUNDLE (OFFLINE STANDALONE)                                   -->
<!-- ======================================================================= -->
<script>
{three_code}
</script>

<!-- ======================================================================= -->
<!-- KATEX MATH ENGINE (OFFLINE EMBEDDED)                                   -->
<!-- ======================================================================= -->
<script>
{katex_js}
</script>
<script>
{auto_render_js}
</script>

<!-- ======================================================================= -->
<!-- GALTON BOARD 3D ENGINE (STANDALONE NON-MODULE)                         -->
<!-- ======================================================================= -->
<script>
(function() {{
{galton_standalone_code}
}})();
</script>

<!-- ======================================================================= -->
<!-- STATISTICAL PHYSICS CORE ENGINE (LabCore)                              -->
<!-- ======================================================================= -->
<script>
{lab_core_code}
</script>

<!-- ======================================================================= -->
<!-- STATISTICAL PHYSICS LABORATORY UI MODULE (x_i = 1..15)                 -->
<!-- ======================================================================= -->
<script>
{lab_code}
</script>
</body>
</html>
"""

# Сохраняем galton_standalone.html
with open("galton_standalone.html", "w", encoding="utf-8") as f:
    f.write(standalone_html)

# Также сохраняем доска_гальтона_автономная.html
with open("доска_гальтона_автономная.html", "w", encoding="utf-8") as f:
    f.write(standalone_html)

print("Created galton_standalone.html, size:", os.path.getsize("galton_standalone.html"), "bytes")
print("Created доска_гальтона_автономная.html, size:", os.path.getsize("доска_гальтона_автономная.html"), "bytes")
