// Автотесты расчётного ядра. Запуск: node lab-core.test.cjs
const nodeFs = require('fs');
const vm = require('vm');
vm.runInThisContext(nodeFs.readFileSync('./lab-core.js', 'utf8'));
const L = globalThis.LabCore;
let fails = 0;
const ok = (name, cond, info) => { console.log((cond ? 'OK   ' : 'FAIL ') + name + (info !== undefined ? '  → ' + info : '')); if (!cond) fails++; };
const near = (a, b, eps) => Math.abs(a - b) <= eps;

const DEMO = [1.0, 2.5, 7.0, 16.5, 34.0, 56.0, 77.5, 86.0, 73.0, 51.5, 29.0, 14.0, 5.5, 2.0, 0.5];

// 1. Биномиальный закон
const pmf = L.binomPmf(14, 0.5);
ok('Σ pmf = 1', near(pmf.reduce((a, b) => a + b, 0), 1, 1e-12));
ok('центральная ячейка C(14,7)/2^14', near(pmf[7], 3432 / 16384, 1e-12), pmf[7].toFixed(5));

// 2. Идеальные данные: высоты ∝ биномиальные вероятности → ⟨x⟩ = 8, D = 3.5
const ideal = pmf.map(p => p * 500);
const si = L.computeStats(ideal, { N: 1000 });
ok('идеал: ⟨x⟩ = 8', near(si.mean, 8, 1e-9), si.mean);
ok('идеал: D = 3.5', near(si.variance, 3.5, 1e-9), si.variance);
ok('идеал: σ = √3.5', near(si.sd, Math.sqrt(3.5), 1e-9));
ok('идеал: χ² к биномиальному закону = 0', near(si.chiBinom.chi2, 0, 1e-9), si.chiBinom.chi2);
ok('идеал: гипотеза принята', si.chiBinom.ok === true);

// 3. χ² не зависит от единиц измерения при фиксированном N (главная ошибка прежней версии)
const a = L.computeStats(DEMO, { N: 1000 });
const b = L.computeStats(DEMO.map(v => v / 10), { N: 1000 });   // «в сантиметрах»
const c = L.computeStats(DEMO.map(v => v * 3), { N: 1000 });
ok('χ² одинаков для мм и см', near(a.chiGauss.chi2, b.chiGauss.chi2, 1e-9), a.chiGauss.chi2.toFixed(4));
ok('χ² одинаков при масштабе ×3', near(a.chiGauss.chi2, c.chiGauss.chi2, 1e-9));
ok('режим k даёт то же, что и N', near(L.computeStats(DEMO, { k: 1000 / 456 }).chiGauss.chi2, a.chiGauss.chi2, 1e-9));

// 4. χ² растёт с N (одно и то же распределение — больше шариков — строже проверка)
const n100 = L.computeStats(DEMO, { N: 100 }).chiBinom.chi2;
const n1000 = L.computeStats(DEMO, { N: 1000 }).chiBinom.chi2;
ok('χ² растёт с числом шариков N (N=1000 vs N=100)', n1000 > n100 * 8, n100.toFixed(2) + ' → ' + n1000.toFixed(2));

// 5. Без калибровки χ² не считается (а не выдаётся бессмысленное число)
const nc = L.computeStats(DEMO, {});
ok('без N и k: χ² = null', nc.chiGauss === null && nc.chiBinom === null);
ok('без N и k: нет погрешности ⟨x⟩', nc.sdMean === null);

// 6. Демо с реальной доски: шире идеального закона
ok('демо: D > 3.5 (доска «шире» идеала)', a.variance > 3.5, a.variance.toFixed(3));
ok('демо: n_эфф > 14', a.nEff > 14, a.nEff.toFixed(1));
ok('демо: σ⟨x⟩ = σ/√N', near(a.sdMean, a.sd / Math.sqrt(1000), 1e-12), a.sdMean.toFixed(4));
ok('демо: Гаусс с параметрами опыта согласуется', a.chiGauss.ok === true, 'χ²=' + a.chiGauss.chi2.toFixed(2) + ', df=' + a.chiGauss.df + ', p=' + a.chiGauss.p.toFixed(3));
ok('демо: идеальный биномиальный закон отвергается', a.chiBinom.ok === false, 'χ²=' + a.chiBinom.chi2.toFixed(2) + ', df=' + a.chiBinom.df + ', p=' + a.chiBinom.p.toFixed(5));

// 7. p-значения и критические точки
ok('p(χ²=3.841, df=1) ≈ 0.05', near(L.chi2Sf(3.841, 1), 0.05, 0.0005), L.chi2Sf(3.841, 1).toFixed(4));
ok('p(χ²=21.026, df=12) ≈ 0.05', near(L.chi2Sf(21.026, 12), 0.05, 0.0005), L.chi2Sf(21.026, 12).toFixed(4));
ok('p(χ²=0) = 1', near(L.chi2Sf(0, 5), 1, 1e-9));

// 8. Объединение ячеек с малым ожидаемым числом шариков
const chiM = L.chiSquare(pmf.map(p => p * 100), pmf, 100, 0);
ok('при N=100 ячейки объединяются (меньше 15 групп)', chiM.groups < 15, 'групп: ' + chiM.groups);

// 9. Доли в интервалах ±kσ
ok('сумма долей по всем ячейкам = 1', near(a.rows.reduce((s, r) => s + r.w, 0), 1, 1e-12));
ok('гауссов эталон ±1σ = 68.3 %', near(a.intervals[0].gauss, 0.6827, 5e-4));

// 10. Закон 1/√N: наклон в log-log ≈ −0.5
const fs = L.fluctSeries(undefined, 40, L.mulberry32(12345));
ok('наклон δ(N) ≈ −0.5', near(fs.slope, -0.5, 0.06), fs.slope.toFixed(3));
ok('опыт согласуется с теорией δ(N) (±15 %)', fs.points.every(p => near(p.rmse / p.theory, 1, 0.15)),
  fs.points.map(p => (p.rmse / p.theory).toFixed(2)).join(' '));

// 11. Форматирование результата с погрешностью
ok('formatPm(7.885, 0.0691) = 7.89 ± 0.07', L.formatPm(7.885, 0.0691) === '7.89 ± 0.07', L.formatPm(7.885, 0.0691));
ok('formatPm(1234.5, 12) → целые', L.formatPm(1234.5, 12) === '1235 ± 12', L.formatPm(1234.5, 12));

// 12. Генератор вариантов, мультисерии и парсер вставки из Excel/CSV
const v5 = L.generateVariant(5);
ok('вариант №5 содержит 15 высот и N>0', v5.heights.length === 15 && v5.N > 0, 'N=' + v5.N + ', H=' + v5.heights.reduce((x, y) => x + y, 0).toFixed(1));
const ms = L.computeMultiSeries([DEMO, v5.heights], { N: 1000 });
ok('мультисерия из 2 опытов считает межсерийное СКО', ms.M === 2 && ms.sMean >= 0, 'sMean=' + ms.sMean.toFixed(4));
const parsed = L.parseHeightsText('1;1,0\n2;2,5\n3;7,0\n4;16,5\n5;34\n6;56\n7;77,5\n8;86\n9;73\n10;51,5\n11;29\n12;14\n13;5,5\n14;2\n15;0,5');
ok('парсер CSV/Excel извлекает 15 высот (игнорируя номера строк 1..15)', parsed && parsed[7] === 86 && parsed[0] === 1.0);

console.log(fails ? '\nПровалено тестов: ' + fails : '\nВсе тесты пройдены');
process.exit(fails ? 1 : 0);
