const fs = require('fs');
const path = require('path');

// 1. Читаем three-0.183.2.js
const threeCode = fs.readFileSync('three-0.183.2.js', 'utf8');

// 2. Читаем исходный HTML шаблон из v2/index.html
let html = fs.readFileSync('v2/index.html', 'utf8');

// 3. Читаем все модули в порядке зависимостей
const modules = [
  'config.js',
  'math-stats.js',
  'simulation.js',
  'audio.js',
  'postfx.js',
  'scene-builder.js',
  'overlay-3d.js',
  'lab-module.js',
  'main.js'
];

let bundleCode = `
// ============================================================================
// Three.js Addons and Bindings from window.__THREE_LIB
// ============================================================================
const THREE = window.__THREE_LIB['three'];
const { RoundedBoxGeometry } = window.__THREE_LIB['three/addons/geometries/RoundedBoxGeometry.js'];
const { mergeGeometries } = window.__THREE_LIB['three/addons/utils/BufferGeometryUtils.js'];
const { EffectComposer } = window.__THREE_LIB['three/addons/postprocessing/EffectComposer.js'];
const { Pass, FullScreenQuad } = window.__THREE_LIB['three/addons/postprocessing/Pass.js'];
const { GTAOPass } = window.__THREE_LIB['three/addons/postprocessing/GTAOPass.js'];
const { UnrealBloomPass } = window.__THREE_LIB['three/addons/postprocessing/UnrealBloomPass.js'];
const { OutputPass } = window.__THREE_LIB['three/addons/postprocessing/OutputPass.js'];
const { SMAAPass } = window.__THREE_LIB['three/addons/postprocessing/SMAAPass.js'];
`;

for (const m of modules) {
  let content = fs.readFileSync(path.join('v2/src', m), 'utf8');

  // Удаляем все import выражения (включая многострочные)
  content = content.replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?/g, '');
  content = content.replace(/import\s*\*\s*as\s+\w+\s+from\s*['"][^'"]+['"];?/g, '');
  content = content.replace(/import\s+[^;]+?from\s*['"][^'"]+['"];?/g, '');

  // Удаляем export выражения
  content = content.replace(/export\s+default\s+/g, '');
  content = content.replace(/export\s+(async\s+function|function|const|let|var|class)\s+/g, '$1 ');

  bundleCode += `\n// ============================================================================\n// MODULE: ${m}\n// ============================================================================\n` + content;
}

// 4. Заменяем секцию скриптов в HTML
// Разрезаем по маркеру <!-- Three.js Bundle and Add-ons -->
const marker = '<!-- Three.js Bundle and Add-ons -->';
const markerIdx = html.indexOf(marker);
if (markerIdx === -1) {
  throw new Error('Marker <!-- Three.js Bundle and Add-ons --> not found in v2/index.html');
}

const headAndBody = html.slice(0, markerIdx);

const inlinedScriptSection = `<!-- Three.js Bundle and Add-ons (Inlined for 100% Standalone Offline Use) -->
<script>
${threeCode}
</script>

<!-- Galton Board Pro v2.0 Inlined Engine -->
<script>
(function() {
${bundleCode}
})();
</script>
</body>
</html>
`;

let singleHtml = headAndBody + inlinedScriptSection;

// Корректируем ссылку на классическую версию: если файл лежит в корне, ../index.html -> ./index.html
let singleHtmlRoot = singleHtml.replace('href="../index.html"', 'href="./index.html"');

// Сохраняем в корневой файл galton_pro_v2_standalone.html
fs.writeFileSync('galton_pro_v2_standalone.html', singleHtmlRoot, 'utf8');
console.log('Successfully created galton_pro_v2_standalone.html! File size:', fs.statSync('galton_pro_v2_standalone.html').size, 'bytes');

// Также сохраняем копию в v2/standalone.html для удобства
fs.writeFileSync('v2/standalone.html', singleHtml, 'utf8');
console.log('Successfully created v2/standalone.html! File size:', fs.statSync('v2/standalone.html').size, 'bytes');
