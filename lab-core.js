// Общее расчётное ядро лабораторной работы «Доска Гальтона» (xᵢ = 1..15, n = 14 рядов).
// Подключается и в 3D-приложение (lab.js), и в автономный бланк (lab_work.html), и в node-тесты.
// Здесь только математика: никакого DOM.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LabCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const N_BINS = 15;
  const N_ROWS = 14;
  const THEO_MEAN = 8.0;                 // M[X] = n·p + 1
  const THEO_VAR = N_ROWS * 0.25;        // D = n·p·(1−p) = 3.5
  const THEO_SD = Math.sqrt(THEO_VAR);   // 1.8708
  const SQRT2PI = Math.sqrt(2 * Math.PI);

  // Критические значения χ² при уровне значимости 0.05, число степеней свободы 1..30
  const CHI2_CRIT_05 = [3.841, 5.991, 7.815, 9.488, 11.070, 12.592, 14.067, 15.507, 16.919, 18.307,
    19.675, 21.026, 22.362, 23.685, 24.996, 26.296, 27.587, 28.869, 30.144, 31.410,
    32.671, 33.924, 35.172, 36.415, 37.652, 38.885, 40.113, 41.337, 42.557, 43.773];

  // ---------- Специальные функции ----------
  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  const normCdf = z => 0.5 * (1 + erf(z / Math.SQRT2));

  function lgamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, t = x + 5.5;
    t -= (x + 0.5) * Math.log(t);
    let s = 1.000000000190015;
    for (let j = 0; j < 6; j++) { y += 1; s += c[j] / y; }
    return -t + Math.log(2.5066282746310005 * s / x);
  }

  // Регуляризованная нижняя неполная гамма-функция P(a, x)
  function gammaP(a, x) {
    if (x <= 0) return 0;
    if (x < a + 1) {
      let ap = a, sum = 1 / a, del = sum;
      for (let n = 0; n < 300; n++) {
        ap++; del *= x / ap; sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-13) break;
      }
      return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
    }
    let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
    for (let i = 1; i < 300; i++) {
      const an = -i * (i - a);
      b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-13) break;
    }
    return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }
  // p-значение критерия χ² (вероятность получить такое или большее отклонение случайно)
  const chi2Sf = (chi2, df) => Math.min(1, Math.max(0, 1 - gammaP(df / 2, chi2 / 2)));

  // ---------- Распределения ----------
  function binomPmf(n, p) {
    const C = [];
    for (let i = 0; i <= n; i++) {
      C[i] = [];
      for (let k = 0; k <= i; k++) C[i][k] = (k === 0 || k === i) ? 1 : C[i - 1][k - 1] + C[i - 1][k];
    }
    const out = [];
    for (let k = 0; k <= n; k++) out.push(C[n][k] * Math.pow(p, k) * Math.pow(1 - p, n - k));
    return out;
  }
  const BINOM_IDEAL = binomPmf(N_ROWS, 0.5);

  function gaussPdf(x, mean, sd) {
    if (sd <= 1e-9) return 0;
    const z = (x - mean) / sd;
    return Math.exp(-0.5 * z * z) / (sd * SQRT2PI);
  }

  // Вероятности попадания в ячейки 1..15 для нормального закона (крайние ячейки забирают «хвосты»)
  function gaussBinProbs(mean, sd) {
    const P = [];
    for (let i = 1; i <= N_BINS; i++) {
      const lo = i === 1 ? 0 : normCdf((i - 0.5 - mean) / sd);
      const hi = i === N_BINS ? 1 : normCdf((i + 0.5 - mean) / sd);
      P.push(hi - lo);
    }
    return P;
  }

  // ---------- Критерий Пирсона ----------
  // O — наблюдаемые числа шариков, P — вероятности ячеек по гипотезе, fitted — число параметров, оцененных по опыту.
  // Ячейки с ожидаемым числом шариков < 5 объединяются (стандартное требование применимости χ²).
  function chiSquare(O, P, N, fitted) {
    const groups = [];
    let cur = { o: 0, e: 0, from: 1, to: 0 };
    for (let i = 0; i < O.length; i++) {
      cur.o += O[i]; cur.e += N * P[i]; cur.to = i + 1;
      if (cur.e >= 5) { groups.push(cur); cur = { o: 0, e: 0, from: i + 2, to: 0 }; }
    }
    if (cur.e > 0) {
      if (groups.length) { const g = groups[groups.length - 1]; g.o += cur.o; g.e += cur.e; g.to = O.length; }
      else groups.push(cur);
    }
    let chi2 = 0;
    for (const g of groups) chi2 += (g.o - g.e) * (g.o - g.e) / g.e;
    const df = groups.length - 1 - fitted;
    if (df < 1) return { chi2, df, p: null, crit: null, ok: null, groups: groups.length };
    const crit = CHI2_CRIT_05[Math.min(df, 30) - 1];
    const p = chi2Sf(chi2, df);
    return { chi2, df, p, crit, ok: chi2 <= crit, groups: groups.length };
  }

  // ---------- Калибровка: от миллиметров к числу шариков ----------
  // opts.N — общее число шариков, либо opts.k — число шариков на 1 мм высоты столбика
  function resolveCalibration(H, opts) {
    if (!(H > 0)) return { N: null, k: null, mode: 'none' };
    if (opts && opts.N > 0) return { N: opts.N, k: opts.N / H, mode: 'N' };
    if (opts && opts.k > 0) return { N: opts.k * H, k: opts.k, mode: 'k' };
    return { N: null, k: null, mode: 'none' };
  }

  // ---------- Основной расчёт ----------
  function computeStats(heights, opts) {
    opts = opts || {};
    const deltaH = opts.deltaH > 0 ? opts.deltaH : 1;
    const m = N_BINS;
    const h = [];
    for (let i = 0; i < m; i++) h.push(Math.max(0, +heights[i] || 0));
    const H = h.reduce((a, b) => a + b, 0);

    if (H <= 1e-9) {
      const rows = h.map((v, i) => ({
        idx: i + 1, x: i + 1, h: v, w: 0, dw: 0, dwInstr: 0, dwStat: 0, xw: 0, dev: 0, dev2w: 0,
        wGaussExp: 0, wGaussTheo: gaussPdf(i + 1, THEO_MEAN, THEO_SD), wBinom: BINOM_IDEAL[i], diff: 0, resid: 0
      }));
      return {
        H: 0, N: null, k: null, calibMode: 'none', mean: 0, variance: 0, sd: 0, sdMean: null, sdSd: null, tMean: null,
        wMax: 0, fwhm: 0, theoMean: THEO_MEAN, theoVar: THEO_VAR, theoSd: THEO_SD,
        pEff: 0.5, nEff: N_ROWS, tiltEffDeg: 0, rmse: 0, intervals: [], chiGauss: null, chiBinom: null,
        chi2: null, in1Sigma: 0, in2Sigma: 0, in3Sigma: 0, rows
      };
    }

    const cal = resolveCalibration(H, opts);
    const N = cal.N;
    const w = h.map(v => v / H);

    let mean = 0;
    for (let i = 0; i < m; i++) mean += (i + 1) * w[i];
    let variance = 0;
    for (let i = 0; i < m; i++) variance += ((i + 1) - mean) * ((i + 1) - mean) * w[i];
    const sd = Math.sqrt(Math.max(0, variance));
    const wMax = sd > 1e-9 ? 1 / (sd * SQRT2PI) : 0;
    const fwhm = 2 * Math.sqrt(2 * Math.log(2)) * sd;

    const sdMean = N ? sd / Math.sqrt(N) : null;       // погрешность среднего ⟨x⟩
    const sdSd = N ? sd / Math.sqrt(2 * N) : null;     // погрешность СКО σ
    const tMean = (N && sdMean > 0) ? (mean - THEO_MEAN) / sdMean : null;

    const pEff = Math.max(0.05, Math.min(0.95, (mean - 1) / N_ROWS));
    const nEff = variance / (pEff * (1 - pEff));       // эффективное число независимых «подбрасываний»
    const sinTilt = Math.max(-1, Math.min(1, (pEff - 0.5) / 1.5));
    const tiltEffDeg = Math.asin(sinTilt) * 180 / Math.PI; // только в рамках модели 3D-сцены p = ½ + 1.5·sin α

    let sumSq = 0;
    const rows = [];
    for (let i = 0; i < m; i++) {
      const x = i + 1;
      const wi = w[i];
      const dev = x - mean;
      const wGaussExp = gaussPdf(x, mean, sd);
      const diff = Math.abs(wi - wGaussExp);
      sumSq += diff * diff;
      // Приборная погрешность линейки Δh, перенесённая на w_i = h_i / H
      const dwInstr = (deltaH / H) * Math.sqrt(Math.pow(1 - wi, 2) + (m - 1) * wi * wi);
      // Статистическая погрешность: флуктуация числа шариков в ячейке (требует знания N)
      const dwStat = N ? Math.sqrt(wi * (1 - wi) / N) : 0;
      const dw = Math.sqrt(dwInstr * dwInstr + dwStat * dwStat);
      rows.push({
        idx: x, x, h: h[i], w: wi, dw, dwInstr, dwStat, xw: x * wi, dev, dev2w: dev * dev * wi,
        wGaussExp, wGaussTheo: gaussPdf(x, THEO_MEAN, THEO_SD), wBinom: BINOM_IDEAL[i], diff,
        resid: dw > 0 ? (wi - wGaussExp) / dw : 0
      });
    }
    const rmse = Math.sqrt(sumSq / m);

    // Доля шариков в интервале ⟨x⟩ ± kσ: опыт, тот же набор ячеек по точному биномиальному закону, гауссов эталон
    const intervals = [1, 2, 3].map(kk => {
      let exp = 0, bin = 0;
      for (const r of rows) if (Math.abs(r.x - mean) <= kk * sd + 1e-9) { exp += r.w; bin += r.wBinom; }
      return { k: kk, exp, binom: bin, gauss: erf(kk / Math.SQRT2) };
    });

    let chiGauss = null, chiBinom = null;
    if (N && sd > 1e-6) {
      const O = w.map(v => v * N);
      chiGauss = chiSquare(O, gaussBinProbs(mean, sd), N, 2);
      chiBinom = chiSquare(O, BINOM_IDEAL, N, 0);
    }

    return {
      H, N, k: cal.k, calibMode: cal.mode, mean, variance, sd, sdMean, sdSd, tMean, wMax, fwhm,
      theoMean: THEO_MEAN, theoVar: THEO_VAR, theoSd: THEO_SD,
      pEff, nEff, tiltEffDeg, rmse, intervals, chiGauss, chiBinom,
      chi2: chiGauss ? chiGauss.chi2 : null,
      in1Sigma: intervals[0].exp, in2Sigma: intervals[1].exp, in3Sigma: intervals[2].exp,
      rows
    };
  }

  // ---------- Закон больших чисел: δ(N) ∝ 1/√N ----------
  // Ожидаемая среднеквадратичная невязка частот wᵢ от точного биномиального закона при N шариках
  function fluctTheory(N) {
    const s = BINOM_IDEAL.reduce((a, p) => a + p * (1 - p), 0);
    return Math.sqrt(s / (N_BINS * N));
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fluctSeries(Ns, repeats, rnd) {
    Ns = Ns || [25, 50, 100, 200, 400, 800, 1600, 3200];
    repeats = repeats || 24;
    rnd = rnd || Math.random;
    const cdf = [];
    BINOM_IDEAL.reduce((acc, p, i) => (cdf[i] = acc + p), 0);
    const points = Ns.map(N => {
      let acc = 0;
      for (let r = 0; r < repeats; r++) {
        const cnt = new Array(N_BINS).fill(0);
        for (let b = 0; b < N; b++) {
          const u = rnd();
          let k = 0;
          while (k < N_BINS - 1 && u > cdf[k]) k++;
          cnt[k]++;
        }
        let s = 0;
        for (let i = 0; i < N_BINS; i++) { const d = cnt[i] / N - BINOM_IDEAL[i]; s += d * d; }
        acc += s / N_BINS;
      }
      return { N, rmse: Math.sqrt(acc / repeats), theory: fluctTheory(N) };
    });
    // Наклон в двойном логарифмическом масштабе (теория: −0.5)
    const xs = points.map(p => Math.log(p.N)), ys = points.map(p => Math.log(p.rmse));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) * (xs[i] - mx); }
    return { points, slope: den > 0 ? num / den : NaN };
  }

  // ---------- Форматирование ----------
  // Результат с погрешностью по правилу округления: 7.89 ± 0.07
  function formatPm(val, err) {
    if (err == null || !isFinite(err) || err <= 0) return val.toFixed(3);
    const e = Math.floor(Math.log10(err));
    const lead = err / Math.pow(10, e);
    const sig = lead < 3 ? 2 : 1;
    const dec = Math.max(0, sig - 1 - e);
    const k = Math.pow(10, dec);
    const rVal = (Math.round((val + 1e-12) * k) / k).toFixed(dec);
    const rErr = (Math.round((err + 1e-12) * k) / k).toFixed(dec);
    return rVal + ' ± ' + rErr;
  }

  // ---------- Серия из нескольких опытов (B5) ----------
  function computeMultiSeries(seriesList, opts) {
    const valid = (seriesList || []).filter(arr => Array.isArray(arr) && arr.reduce((a, b) => a + (+b || 0), 0) > 0);
    if (!valid.length) return null;
    const perSeries = valid.map(arr => computeStats(arr, opts));
    const M = perSeries.length;
    const avgMean = perSeries.reduce((a, s) => a + s.mean, 0) / M;
    const avgVar = perSeries.reduce((a, s) => a + s.variance, 0) / M;
    const avgSd = perSeries.reduce((a, s) => a + s.sd, 0) / M;
    const avgH = perSeries.reduce((a, s) => a + s.H, 0) / M;
    // Межсерийный разброс средних ⟨x⟩
    const sMean = M > 1
      ? Math.sqrt(perSeries.reduce((a, s) => a + Math.pow(s.mean - avgMean, 2), 0) / (M - 1))
      : 0;
    const seMean = M > 1 ? sMean / Math.sqrt(M) : (perSeries[0].sdMean || 0);
    const theoSpreadMean = perSeries[0].sdMean || null;
    // Усреднённый профиль высот по всем сериям
    const avgHeights = [];
    for (let i = 0; i < N_BINS; i++) {
      avgHeights.push(+(valid.reduce((a, arr) => a + (+arr[i] || 0), 0) / M).toFixed(2));
    }
    return { M, perSeries, avgMean, avgVar, avgSd, avgH, sMean, seMean, theoSpreadMean, avgHeights };
  }

  // ---------- Генератор индивидуальных вариантов для бригад (B6) ----------
  function generateVariant(variantNum) {
    const v = Math.max(1, Math.min(99, Math.round(+variantNum || 1)));
    const rnd = mulberry32(v * 2654435761);
    const N = 800 + (v % 5) * 100; // 800..1200 шариков
    const tiltChoices = [0, 0, -1.5, 1.5, -2.5, 2.5, 0, -1.0, 1.0, 2.0];
    const tiltDeg = tiltChoices[v % tiltChoices.length];
    const p = Math.max(0.25, Math.min(0.75, 0.5 + 0.018 * tiltDeg + (rnd() - 0.5) * 0.015));
    // Реальные доски имеют эффективное число рядов чуть отлично от 14 из-за упругих перескоков
    const pmf = binomPmf(N_ROWS, p);
    const cdf = [];
    pmf.reduce((acc, pr, i) => (cdf[i] = acc + pr), 0);
    const counts = new Array(N_BINS).fill(0);
    for (let b = 0; b < N; b++) {
      const u = rnd();
      let idx = 0;
      while (idx < N_BINS - 1 && u > cdf[idx]) idx++;
      counts[idx]++;
    }
    const kMm = +(2.1 + (v % 4) * 0.15).toFixed(2); // шариков на 1 мм (≈ 2.1..2.55 шт/мм)
    const heights = counts.map(c => +(c / kMm).toFixed(1));
    return { variant: v, N, k: kMm, tiltDeg, p: +p.toFixed(4), heights, counts };
  }

  // ---------- Парсер вставки из Excel / CSV / текста (D3) ----------
  function parseHeightsText(text) {
    if (!text || typeof text !== 'string') return null;
    const lines = text.trim().split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
    const nums = [];
    if (lines.length >= N_BINS) {
      for (const line of lines) {
        const parts = line.split(/[;\t ]+/).map(s => s.replace(',', '.')).filter(Boolean);
        // Если в строке 2+ колонок (например "x_i ; h_i"), берём 2-ю колонку, иначе 1-ю
        const cand = parts.length >= 2 && /^[0-9]+$/.test(parts[0]) && +parts[0] >= 1 && +parts[0] <= 15
          ? parseFloat(parts[1])
          : parseFloat(parts[0]);
        if (!isNaN(cand) && isFinite(cand) && cand >= 0) nums.push(cand);
        if (nums.length === N_BINS) break;
      }
    }
    if (nums.length < N_BINS) {
      nums.length = 0;
      const tokens = text.replace(/,/g, '.').match(/\d+(?:\.\d+)?/g) || [];
      for (const t of tokens) {
        const v = parseFloat(t);
        if (!isNaN(v)) nums.push(v);
        if (nums.length === N_BINS) break;
      }
    }
    return nums.length === N_BINS ? nums : null;
  }

  return {
    N_BINS, N_ROWS, THEO_MEAN, THEO_VAR, THEO_SD, BINOM_IDEAL, CHI2_CRIT_05,
    erf, normCdf, gammaP, chi2Sf, binomPmf, gaussPdf, gaussBinProbs, chiSquare,
    resolveCalibration, computeStats, fluctTheory, fluctSeries, mulberry32, formatPm,
    computeMultiSeries, generateVariant, parseHeightsText
  };
});
