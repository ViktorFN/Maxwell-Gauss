// Модуль лабораторной работы по статистической физике
// «Изучение статистических закономерностей и распределения Гаусса на доске Гальтона»
// Координаты ячеек: x_i = 1 .. 15 (14 рядов штырьков). Использует общее ядро window.LabCore (lab-core.js).

(() => {
  const Core = window.LabCore;
  if (!Core) {
    console.error('LabCore (lab-core.js) не загружен!');
    return;
  }

  const N_BINS = Core.N_BINS; // 15
  const N_ROWS = Core.N_ROWS; // 14
  const STORAGE_KEY = 'galton_statphys_lab_state_v2';

  // Функция рендеринга математических формул через KaTeX
  function renderMath(el) {
    if (typeof window !== 'undefined' && window.renderMathInElement) {
      try {
        window.renderMathInElement(el || document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
          throwOnError: false,
          strict: false,
          trust: true
        });
      } catch (e) {
        console.warn('KaTeX render error:', e);
      }
    }
  }


  // Реалистичные демо-данные с реальной лабораторной доски (в мм, сумма = 456.0 мм)
  const DEMO_REAL_HEIGHTS = [1.0, 2.5, 7.0, 16.5, 34.0, 56.0, 77.5, 86.0, 73.0, 51.5, 29.0, 14.0, 5.5, 2.0, 0.5];

  // Состояние лабораторного модуля
  const state = {
    rulerOn: true,           // Миллиметровая шкала и номера x_i = 1..15 на 3D-доске
    blindMode: false,        // Слепой режим (скрывает ответы и на 3D-доске, и в таблице/сводке)
    roundMm: false,          // Округлять снятые с 3D-доски высоты до 1 мм
    deltaH: 1.0,             // Инструментальная погрешность линейки Δh, мм
    calibMode: 'N',          // 'N' (известно общее число шариков) | 'k' (шариков на 1 мм)
    calibN: 1000,            // Общее число шариков N
    calibK: 2.2,             // Коэффициент k (шт./мм)
    variant: 1,              // Номер варианта (1..30)
    source: '3d',            // '3d' | 'manual' | 'demo' | 'variant' | 'series'
    heights: new Array(N_BINS).fill(0),
    manualCalcMode: false,   // Режим самостоятельного расчёта таблицы студентом (B2)
    manualCells: {},         // Введённые студентом ячейки { "i_w": val, "i_xw": val, "i_d2w": val }
    showAllCols: false,      // Показывать все 8 колонок даже в компактном боковом режиме (C1)
    activeTab: 'table',      // 'table' | 'chart' | 'check' | 'phys' | 'guide'
    dockMode: true,          // Компактный боковой режим или широкий экран
    chartPreset: 'analysis', // 'report' (ГОСТ: только гистограмма + Гаусс) | 'analysis' (всё)
    chartLight: false,       // Светлая тема графика (для вставки в отчёт / печати)
    showGaussExp: true,
    showGaussTheo: true,
    showBinom: true,
    showSigmaZones: true,
    showFWHM: true,
    showErrorBars: true,
    showResiduals: true,     // Нижняя панель нормированных остатков (w_i - w_гаусс)/Δw_i (C4)
    showRealOn3D: true,
    fluctLogScale: true,     // Логарифмический масштаб графика 1/√N с измерением наклона −0.5
    fluctData: null,
    seriesList: [],          // Сохранённые серии измерений [{ name, heights, N }] (B5)
    studentMeta: {
      name: '',
      group: '',
      brigade: '',
      conclusion: ''
    }
  };

  // Загрузка сохранённого состояния из localStorage (D2)
  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.heights) && saved.heights.length === N_BINS) {
        state.heights = saved.heights.map(v => Math.max(0, +v || 0));
      }
      if (saved.calibMode === 'N' || saved.calibMode === 'k') state.calibMode = saved.calibMode;
      if (saved.calibN > 0) state.calibN = +saved.calibN;
      if (saved.calibK > 0) state.calibK = +saved.calibK;
      if (saved.deltaH > 0) state.deltaH = +saved.deltaH;
      if (saved.variant >= 1) state.variant = +saved.variant;
      if (saved.source) state.source = saved.source;
      if (Array.isArray(saved.seriesList)) state.seriesList = saved.seriesList.slice(0, 8);
      if (saved.studentMeta && typeof saved.studentMeta === 'object') {
        Object.assign(state.studentMeta, saved.studentMeta);
      }
      return state.heights.some(v => v > 0);
    } catch (e) {
      return false;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        heights: state.heights,
        calibMode: state.calibMode,
        calibN: state.calibN,
        calibK: state.calibK,
        deltaH: state.deltaH,
        variant: state.variant,
        source: state.source,
        seriesList: state.seriesList,
        studentMeta: state.studentMeta
      }));
      localStorage.setItem('galton_lab_heights', JSON.stringify(state.heights));
    } catch (e) {}
  }

  function getCalibOpts() {
    return state.calibMode === 'N'
      ? { N: state.calibN, deltaH: state.deltaH }
      : { k: state.calibK, deltaH: state.deltaH };
  }

  function getStats() {
    return Core.computeStats(state.heights, getCalibOpts());
  }

  // Снятие высот столбиков h_i (мм) и числа шариков N с 3D-доски
  function captureFrom3DBoard() {
    const lab = window.__lab;
    if (!lab) return;
    if (lab.RUN.n !== N_ROWS) {
      lab.rows(N_ROWS);
    }
    const rawMm = lab.getHeightsMm();
    for (let i = 0; i < N_BINS; i++) {
      const val = rawMm[i] || 0;
      state.heights[i] = state.roundMm ? Math.round(val) : +val.toFixed(1);
    }
    // Автоматически определяем число осевших шариков N из 3D-сцены
    if (lab.NOWS && lab.NOWS.settled > 0) {
      state.calibN = Math.round(lab.NOWS.settled);
      const inpN = document.getElementById('lab-inp-calib-val');
      if (inpN && state.calibMode === 'N') inpN.value = state.calibN;
    }
    state.source = '3d';
    saveState();
    renderLabUI();
  }

  // Отрисовка 3D миллиметровой линейки, номеров ячеек x_i = 1..15 и высот столбиков h_i на холсте поверх 3D-сцены
  window.__onOverlayDraw = function (ctx, dpr, width, height) {
    if (!state.rulerOn) return;
    const lab = window.__lab;
    if (!lab || !lab.RUN || !lab.RUN.g) return;
    if (lab.VIEW && lab.VIEW.cur === 'exploded' && lab.ST.ex > 0.5) return;

    const n = lab.RUN.n;
    const numBins = n + 1;
    const simHeights = lab.getHeightsMm();

    ctx.save();

    // 1. Горизонтальные линии миллиметровой шкалы на переднем стекле (0 .. 160 мм)
    for (let hm = 0; hm <= 160; hm += 5) {
      const pL = lab.glassPos(0, hm, 0.052);
      const pR = lab.glassPos(1, hm, 0.052);
      if (!pL.ok || !pR.ok) continue;

      const x1 = pL.x * dpr, y1 = pL.y * dpr;
      const x2 = pR.x * dpr, y2 = pR.y * dpr;
      const isMajor = hm % 20 === 0;
      const isMed = hm % 10 === 0;

      if (isMajor || isMed) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isMajor ? 'rgba(127, 227, 255, 0.26)' : 'rgba(127, 227, 255, 0.11)';
        ctx.lineWidth = (isMajor ? 1.3 : 0.8) * dpr;
        if (!isMajor) ctx.setLineDash([4 * dpr, 4 * dpr]);
        else ctx.setLineDash([]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const tickLen = (isMajor ? 10 : isMed ? 6.5 : 3.5) * dpr;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + ux * tickLen, y1 + uy * tickLen);
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - ux * tickLen, y2 - uy * tickLen);
      ctx.strokeStyle = isMajor ? 'rgba(255, 212, 128, 0.92)' : 'rgba(190, 235, 255, 0.65)';
      ctx.lineWidth = (isMajor ? 1.8 : 1.1) * dpr;
      ctx.stroke();

      if (isMajor) {
        const fontSize = Math.max(9, Math.min(13, len / dpr * 0.023));
        ctx.font = `600 ${Math.round(fontSize * dpr)}px "JetBrains Mono", monospace`;
        ctx.textBaseline = 'middle';

        const label = `${hm}`;
        ctx.textAlign = 'right';
        const lx = x1 - ux * 7 * dpr;
        const ly = y1 - uy * 7 * dpr;
        ctx.strokeStyle = 'rgba(6, 10, 20, 0.92)';
        ctx.lineWidth = 3 * dpr;
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = '#ffd996';
        ctx.fillText(label, lx, ly);

        ctx.textAlign = 'left';
        const rx = x2 + ux * 7 * dpr;
        const ry = y2 + uy * 7 * dpr;
        const rLabel = hm === 160 ? `${hm} мм` : `${hm}`;
        ctx.strokeText(rLabel, rx, ry);
        ctx.fillText(rLabel, rx, ry);
      }
    }

    // 2. Подписи номеров ячеек x_i = 1..15 внизу и высоты столбиков h_i (мм) сверху
    const pLeft0 = lab.binPos(0, 0, 0.055);
    const pRight0 = lab.binPos(numBins - 1, 0, 0.055);
    const spanPx = Math.hypot((pRight0.x - pLeft0.x), (pRight0.y - pLeft0.y));
    const binWidthPx = spanPx / Math.max(1, numBins - 1);

    for (let k = 0; k < numBins; k++) {
      const xi = k + 1;
      const pBot = lab.binPos(k, -9, 0.055);
      if (pBot.ok) {
        const bx = pBot.x * dpr;
        const by = pBot.y * dpr;
        const fSize = Math.max(9.5, Math.min(13.5, binWidthPx * 0.42));
        ctx.font = `700 ${Math.round(fSize * dpr)}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const txt = String(xi);
        const tw = ctx.measureText(txt).width + 7 * dpr;
        const th = fSize * 1.35 * dpr;
        ctx.fillStyle = xi === 8 && numBins === 15 ? 'rgba(255, 180, 84, 0.24)' : 'rgba(10, 16, 30, 0.82)';
        ctx.beginPath();
        ctx.roundRect(bx - tw / 2, by - th / 2, tw, th, 4 * dpr);
        ctx.fill();
        ctx.strokeStyle = xi === 8 && numBins === 15 ? 'rgba(255, 180, 84, 0.7)' : 'rgba(127, 227, 255, 0.35)';
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();

        ctx.fillStyle = xi === 8 && numBins === 15 ? '#ffd480' : '#e6f4ff';
        ctx.fillText(txt, bx, by + 0.5 * dpr);

        if (k === 0) {
          ctx.textAlign = 'right';
          ctx.font = `600 ${Math.round(fSize * 0.88 * dpr)}px "JetBrains Mono", monospace`;
          ctx.fillStyle = '#7fe3ff';
          ctx.strokeStyle = 'rgba(6, 10, 20, 0.9)';
          ctx.lineWidth = 2.5 * dpr;
          ctx.strokeText('xᵢ =', bx - tw / 2 - 5 * dpr, by);
          ctx.fillText('xᵢ =', bx - tw / 2 - 5 * dpr, by);
        }
      }

      const hSim = simHeights[k] || 0;
      if (!state.blindMode && hSim > 0.5) {
        const pTop = lab.binPos(k, Math.min(162, hSim + 4.5), 0.06);
        if (pTop.ok && binWidthPx > 15) {
          const tx = pTop.x * dpr;
          const ty = pTop.y * dpr;
          const fSize = Math.max(8, Math.min(11, binWidthPx * 0.31));
          ctx.font = `500 ${Math.round(fSize * dpr)}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const lbl = state.roundMm ? `${Math.round(hSim)}` : hSim.toFixed(0);
          ctx.strokeStyle = 'rgba(6, 10, 20, 0.92)';
          ctx.lineWidth = 2.8 * dpr;
          ctx.strokeText(lbl, tx, ty);
          ctx.fillStyle = '#9ff0ff';
          ctx.fillText(lbl, tx, ty);
        }
      }

      if (state.showRealOn3D && k < N_BINS && state.source !== '3d') {
        const hReal = state.heights[k] || 0;
        if (hReal > 0) {
          const pReal = lab.binPos(k, Math.min(160, hReal), 0.062);
          if (pReal.ok) {
            const rx = pReal.x * dpr;
            const ry = pReal.y * dpr;
            const hw = Math.max(4, binWidthPx * 0.32) * dpr;
            ctx.beginPath();
            ctx.moveTo(rx - hw, ry);
            ctx.lineTo(rx + hw, ry);
            ctx.strokeStyle = '#ff6b86';
            ctx.lineWidth = 2.5 * dpr;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(rx, ry, 2.8 * dpr, 0, Math.PI * 2);
            ctx.fillStyle = '#ffb454';
            ctx.fill();
          }
        }
      }
    }

    ctx.restore();
  };

  // Создание DOM-интерфейса лабораторного комплекса
  function initLabDOM() {
    const hasSaved = loadSavedState();

    // 1. Панель быстрого управления в левой колонке (.side)
    const side = document.querySelector('.side');
    if (side) {
      const quickBar = document.createElement('div');
      quickBar.className = 'lab-quick-bar';
      quickBar.innerHTML = `
        <button type="button" class="lab-open-btn" id="btn-open-lab" title="Открыть лабораторный практикум по статистической физике">
          <span class="lab-open-ic">🎓</span>
          <span>Лабораторная работа</span>
          <small>xᵢ = 1…15 · Гаусс · χ²</small>
        </button>
        <div class="lab-quick-toggles">
          <button type="button" class="lab-pill on" id="btn-toggle-ruler" title="Показать/скрыть миллиметровую линейку (0..160 мм) и номера ячеек xᵢ = 1..15 на 3D-доске">
            📏 Линейка
          </button>
          <button type="button" class="lab-pill" id="btn-toggle-blind" title="Слепой режим: скрыть готовые ответы на 3D-доске и в лабораторном журнале для самостоятельного измерения и расчёта">
            👁️ Слепой режим
          </button>
          <a href="./lab_work.html" target="_blank" class="lab-pill" style="text-decoration:none;" title="Открыть отдельный автономный HTML-бланк отчёта в новой вкладке">
            📄 Бланк
          </a>
        </div>
      `;
      side.appendChild(quickBar);
    }

    // 2. Основное окно лабораторной работы (#lab-panel)
    const labContainer = document.createElement('section');
    labContainer.id = 'lab-panel';
    labContainer.className = 'lab-panel docked';
    labContainer.hidden = true;
    labContainer.setAttribute('aria-label', 'Лабораторная работа по статистической физике');

    labContainer.innerHTML = `
      <header class="lab-head">
        <div class="lab-head-title">
          <span class="lab-badge">СТАТИСТИЧЕСКАЯ ФИЗИКА</span>
          <h2>Доска Гальтона: Распределение Гаусса и критерий χ² (x<sub>i</sub> = 1 … 15)</h2>
        </div>
        <div class="lab-head-actions">
          <label class="lab-variant-lbl" title="Индивидуальный вариант задания для бригады (меняет параметры опыта)">
            <span>Вариант №</span>
            <input type="number" id="lab-inp-variant" min="1" max="30" value="${state.variant}" class="lab-mini-num">
            <button type="button" class="lab-icon-btn" id="lab-btn-load-variant" title="Загрузить данные индивидуального варианта">Задать</button>
          </label>
          <button type="button" class="lab-icon-btn" id="lab-btn-dock" title="Переключить ширину панели (компактно рядом с 3D-доской / на весь экран)">⇔ Развернуть</button>
          <button type="button" class="lab-icon-btn lab-close-btn" id="lab-btn-close" title="Закрыть панель лабораторной работы">✕</button>
        </div>
      </header>

      <!-- Панель источников данных и калибровки (A1, A2, D3) -->
      <div class="lab-toolbar">
        <div class="lab-source-btns">
          <button type="button" class="lab-act-btn primary" id="lab-act-capture" title="Установить 15 ячеек (14 рядов) и снять текущие высоты столбиков hᵢ (мм) и число шариков N с 3D-доски">
            📥 Снять с 3D-доски
          </button>
          <button type="button" class="lab-act-btn" id="lab-act-drop1000" title="Очистить доску, сбросить 1000 шариков в 15 ячеек и снять высоты столбиков">
            🎲 Опыт в 3D (1000 шт.)
          </button>
          <button type="button" class="lab-act-btn amber" id="lab-act-demo" title="Загрузить пример реальных измерений высот столбиков hᵢ (мм) с учебной лабораторной установки">
            🏫 Реальная доска (демо)
          </button>
          <button type="button" class="lab-act-btn" id="lab-act-paste" title="Вставить 15 значений высот из буфера обмена (столбец из Excel / CSV)">
            📋 Вставить (Excel/CSV)
          </button>
          <button type="button" class="lab-act-btn" id="lab-act-clear" title="Очистить таблицу для ручного ввода высот столбиков hᵢ (мм)">
            ✍️ Очистить
          </button>
        </div>

        <div class="lab-toolbar-opts">
          <div class="lab-calib-group" title="Калибровка переводит миллиметры высоты столбика в число шариков Nᵢ = N·wᵢ — это необходимо для расчёта статистической погрешности и критерия Пирсона χ²">
            <select id="lab-sel-calib" class="lab-mini-sel" aria-label="Способ калибровки числа шариков">
              <option value="N" ${state.calibMode === 'N' ? 'selected' : ''}>Калибровка по числу шариков N =</option>
              <option value="k" ${state.calibMode === 'k' ? 'selected' : ''}>Калибровка по плотности k (шт./мм) =</option>
            </select>
            <input type="number" id="lab-inp-calib-val" value="${state.calibMode === 'N' ? state.calibN : state.calibK}" min="0.1" max="50000" step="${state.calibMode === 'N' ? '10' : '0.1'}" class="lab-mini-num" style="width:66px">
          </div>
          <label class="lab-chk" title="Инструментальная погрешность измерения высоты линейкой Δh (мм)">
            <span>Δh =</span>
            <input type="number" id="lab-inp-deltah" value="${state.deltaH}" min="0.1" max="5.0" step="0.5" class="lab-mini-num" style="width:48px">
            <span>мм</span>
          </label>
          <label class="lab-chk" title="Округлять высоты столбиков с 3D-доски до целых миллиметров">
            <input type="checkbox" id="lab-chk-round" ${state.roundMm ? 'checked' : ''}>
            <span>Округл. мм</span>
          </label>
        </div>
      </div>

      <!-- Пошаговый маршрут выполнения лабораторной работы (B1) -->
      <nav class="lab-tabs" role="tablist" aria-label="Этапы лабораторной работы">
        <button type="button" class="lab-tab on" data-tab="table" role="tab">
          <span class="step-num" id="step-badge-1">1</span> Таблица h<sub>i</sub> и расчёт
        </button>
        <button type="button" class="lab-tab" data-tab="chart" role="tab">
          <span class="step-num" id="step-badge-2">2</span> Гистограмма и остатки
        </button>
        <button type="button" class="lab-tab" data-tab="check" role="tab">
          <span class="step-num" id="step-badge-3">3</span> Тренажёр самопроверки
        </button>
        <button type="button" class="lab-tab" data-tab="phys" role="tab">
          <span class="step-num" id="step-badge-4">4</span> Критерий χ², серии и 1/√N
        </button>
        <button type="button" class="lab-tab" data-tab="guide" role="tab">
          <span class="step-num" id="step-badge-5">5</span> Методичка и Отчёт
        </button>
      </nav>

      <div class="lab-body">
        <!-- ВКЛАДКА 1: ТАБЛИЦА ИЗМЕРЕНИЙ И РАСЧЁТА -->
        <div class="lab-pane on" id="lab-pane-table">
          <div class="lab-summary-strip" id="lab-summary-strip"></div>

          <div class="lab-table-subbar">
            <label class="lab-chk" title="Включить режим самостоятельного расчёта: введите вручную значения wᵢ, xᵢwᵢ и (xᵢ−⟨x⟩)²wᵢ для проверки понимания формул">
              <input type="checkbox" id="lab-chk-manual-calc">
              <span>✍️ Режим ручного расчёта колонок студентом (с проверкой каждой ячейки)</span>
            </label>
            <label class="lab-chk" id="lab-wrap-allcols" title="Показать все 8 столбцов таблицы в компактном режиме">
              <input type="checkbox" id="lab-chk-allcols">
              <span>Показать все 8 столбцов</span>
            </label>
          </div>

          <div class="lab-table-wrap">
            <table class="lab-table" id="lab-data-table">
              <thead>
                <tr>
                  <th title="Номер ячейки (координата столбика) от 1 до 15">№ ячейки<br><span class="f-th">$x_i$</span></th>
                  <th title="Измеренная линейкой высота столбика шариков в i-й ячейке (мм)">Высота, мм<br><span class="f-th">$h_i$</span></th>
                  <th title="Относительная частота попадания: w_i = h_i / H ± полная погрешность Δw_i">Частота<br><span class="f-th">$w_i \\pm \\Delta w_i$</span></th>
                  <th class="col-opt" title="Слагаемое для расчёта математического ожидания">Вклад в среднее<br><span class="f-th">$x_i \\cdot w_i$</span></th>
                  <th class="col-opt" title="Отклонение координаты ячейки от математического ожидания">Отклонение<br><span class="f-th">$x_i - \\langle x \\rangle$</span></th>
                  <th class="col-opt" title="Слагаемое для расчёта дисперсии D">Вклад в $D$<br><span class="f-th">$(x_i - \\langle x \\rangle)^2 w_i$</span></th>
                  <th title="Теоретическая плотность вероятности по формуле Гаусса с параметрами опыта ⟨x⟩ и σ">Гаусс<br><span class="f-th">$f_{\\text{гаусс}}(x_i)$</span></th>
                  <th class="col-opt" title="Нормированный остаток (отклонение в единицах погрешности Δw_i)">Остаток<br><span class="f-th">$\\frac{w_i - f(x_i)}{\\Delta w_i}$</span></th>
                </tr>
              </thead>
              <tbody id="lab-table-tbody"></tbody>
              <tfoot id="lab-table-tfoot"></tfoot>
            </table>
          </div>

          <div class="lab-formulas-bar">
            <div class="lab-f-box">
              <i>Относительная частота и погрешность</i>
              <span class="f-math">$$w_i = \\frac{h_i}{H}, \\quad \\Delta w_i = \\sqrt{\\Delta w_{\\text{приб}}^2 + \\frac{w_i(1-w_i)}{N}}$$</span>
            </div>
            <div class="lab-f-box">
              <i>Математическое ожидание</i>
              <span class="f-math">$$\\langle x \\rangle = \\sum_{i=1}^{15} x_i w_i, \\quad \\sigma_{\\langle x \\rangle} = \\frac{\\sigma}{\\sqrt{N}}$$</span>
            </div>
            <div class="lab-f-box">
              <i>Дисперсия и СКО</i>
              <span class="f-math">$$D = \\sum_{i=1}^{15} (x_i - \\langle x \\rangle)^2 w_i, \\quad \\sigma = \\sqrt{D} \\pm \\frac{\\sigma}{\\sqrt{2N}}$$</span>
            </div>
            <div class="lab-f-box">
              <i>Теоретический закон Гаусса</i>
              <span class="f-math">$$f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} \\exp\\left(-\\frac{(x - \\langle x \\rangle)^2}{2\\sigma^2}\\right)$$</span>
            </div>
          </div>
        </div>

        <!-- ВКЛАДКА 2: ГИСТОГРАММА, ГАУСС И НОРМИРОВАННЫЕ ОСТАТКИ -->
        <div class="lab-pane" id="lab-pane-chart">
          <div class="lab-chart-controls">
            <div class="lab-preset-group" role="group" aria-label="Пресеты графика">
              <button type="button" class="lab-act-btn" id="btn-preset-report" title="Строгий вид для отчёта по ГОСТ: только гистограмма, кривая Гаусса и погрешности">📄 Для отчёта (ГОСТ)</button>
              <button type="button" class="lab-act-btn primary" id="btn-preset-analysis" title="Полный исследовательский вид со всеми кривыми, полушириной и графиком остатков">🔬 Полный анализ</button>
            </div>
            <label class="lab-chk"><input type="checkbox" id="chk-gauss-exp" checked><span>Гаусс (опыт)</span></label>
            <label class="lab-chk"><input type="checkbox" id="chk-gauss-theo" checked><span>Гаусс (идеал)</span></label>
            <label class="lab-chk"><input type="checkbox" id="chk-binom" checked><span>Бином P<sub>14</sub></span></label>
            <label class="lab-chk"><input type="checkbox" id="chk-fwhm" checked><span>Γ<sub>0.5</sub> = 2.355σ</span></label>
            <label class="lab-chk"><input type="checkbox" id="chk-sigma-zones" checked><span>Зоны ±σ</span></label>
            <label class="lab-chk"><input type="checkbox" id="chk-err-bars" checked><span>Планки ±Δw<sub>i</sub></span></label>
            <label class="lab-chk"><input type="checkbox" id="chk-residuals" checked><span>График остатков</span></label>
            <div class="lab-chart-btns">
              <button type="button" class="lab-act-btn" id="btn-chart-theme">☀️ Белый фон</button>
              <button type="button" class="lab-act-btn primary" id="btn-chart-save">💾 PNG</button>
            </div>
          </div>
          <div class="lab-canvas-wrap">
            <canvas id="lab-hist-canvas" width="940" height="520"></canvas>
          </div>
          <div class="lab-chart-caption" id="lab-chart-caption"></div>
        </div>

        <!-- ВКЛАДКА 3: ТРЕНАЖЁР И САМОПРОВЕРКА СТУДЕНТА -->
        <div class="lab-pane" id="lab-pane-check">
          <div class="lab-check-intro">
            <h3>Тренажёр проверки расчётов лабораторной работы</h3>
            <p>Рассчитайте статистические характеристики по вашим измерениям h<sub>1</sub> … h<sub>15</sub> и введите полученные числа. Система проверит каждую величину и подскажет, в какой формуле допущена ошибка.</p>
          </div>
          <div class="lab-check-grid">
            <div class="lab-check-item">
              <label>1. Суммарная высота столбиков H = ∑<sub>i=1..15</sub> h<sub>i</sub> (мм):</label>
              <input type="number" step="0.1" id="chk-inp-H" placeholder="Например: 456.0">
              <div class="lab-check-feedback" id="chk-fb-H"></div>
            </div>
            <div class="lab-check-item">
              <label>2. Математическое ожидание ⟨x⟩ = ∑<sub>i=1..15</sub> x<sub>i</sub> w<sub>i</sub>:</label>
              <input type="number" step="0.01" id="chk-inp-mean" placeholder="Например: 7.89">
              <div class="lab-check-feedback" id="chk-fb-mean"></div>
            </div>
            <div class="lab-check-item">
              <label>3. Дисперсия D = ∑<sub>i=1..15</sub> (x<sub>i</sub> − ⟨x⟩)<sup>2</sup> w<sub>i</sub>:</label>
              <input type="number" step="0.01" id="chk-inp-var" placeholder="Например: 4.78">
              <div class="lab-check-feedback" id="chk-fb-var"></div>
            </div>
            <div class="lab-check-item">
              <label>4. Среднеквадратичное отклонение σ = √D:</label>
              <input type="number" step="0.01" id="chk-inp-sd" placeholder="Например: 2.19">
              <div class="lab-check-feedback" id="chk-fb-sd"></div>
            </div>
            <div class="lab-check-item">
              <label>5. Стандартная ошибка среднего σ<sub>⟨x⟩</sub> = σ / √N:</label>
              <input type="number" step="0.001" id="chk-inp-sdmean" placeholder="Например: 0.069">
              <div class="lab-check-feedback" id="chk-fb-sdmean"></div>
            </div>
            <div class="lab-check-item">
              <label>6. Полуширина на полувысоте Γ<sub>0.5</sub> = 2.355 σ:</label>
              <input type="number" step="0.01" id="chk-inp-fwhm" placeholder="Например: 5.15">
              <div class="lab-check-feedback" id="chk-fb-fwhm"></div>
            </div>
          </div>
          <div class="lab-check-actions">
            <button type="button" class="lab-act-btn primary" id="btn-run-check">✔️ Проверить мои расчёты</button>
            <button type="button" class="lab-act-btn" id="btn-fill-check">💡 Сверка с эталоном (недоступно в слепом режиме)</button>
          </div>
        </div>

        <!-- ВКЛАДКА 4: АНАЛИЗ СТАТФИЗИКИ, СЕРИИ ОПЫТОВ И ЗАКОН 1/√N -->
        <div class="lab-pane" id="lab-pane-phys">
          <div class="lab-phys-grid" id="lab-phys-content"></div>

          <!-- Блок серий повторных опытов (B5) -->
          <div class="phys-card">
            <div class="lab-fluct-head">
              <div>
                <h4>3. Серия повторных опытов: сходимость среднего $\\sigma_{\\langle x \\rangle} = \\frac{\\sigma}{\\sqrt{N}}$</h4>
                <p>Сохраните 3–5 независимых измерений (или сгенерируйте серию), чтобы сравнить разброс средних между опытами с теоретической формулой $\sigma/\\sqrt{N}$.</p>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button type="button" class="lab-act-btn primary" id="btn-series-add">➕ Сохранить текущий замер в серию</button>
                <button type="button" class="lab-act-btn amber" id="btn-series-auto">🎲 Провести 4 серии по N шариков</button>
                <button type="button" class="lab-act-btn" id="btn-series-clear">🗑️ Очистить серии</button>
              </div>
            </div>
            <div id="lab-series-box"></div>
          </div>

          <!-- Численный эксперимент 1/√N (A4) -->
          <div class="lab-fluct-box">
            <div class="lab-fluct-head">
              <div>
                <h3>4. Закон больших чисел: затухание флуктуаций частот $\\delta(N) = \\sqrt{\\frac{1}{15}\\sum \\frac{P_i(1-P_i)}{N}} \\propto N^{-1/2}$</h3>
                <p>Среднеквадратичное отклонение эмпирических частот $w_i$ от точного биномиального закона $P_{14}(k)$ убывает строго по закону $1/\\sqrt{N}$ (наклон прямой в двойном логарифмическом масштабе равен $-0.50$).</p>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <label class="lab-chk"><input type="checkbox" id="chk-fluct-log" checked><span>Шкала log–log (наклон −½)</span></label>
                <button type="button" class="lab-act-btn primary" id="btn-run-fluct">🚀 Пересчитать серию (N = 25 … 3200)</button>
              </div>
            </div>
            <canvas id="lab-fluct-canvas" width="900" height="270"></canvas>
          </div>
        </div>

        <!-- ВКЛАДКА 5: МЕТОДИЧКА, ВЫВОДЫ И ОТЧЁТ -->
        <div class="lab-pane" id="lab-pane-guide">
          <div class="phys-card">
            <h4>Оформление отчёта студента (сохраняется автоматически)</h4>
            <div class="lab-meta-inputs">
              <input type="text" id="guide-inp-name" placeholder="ФИО студента" value="${state.studentMeta.name}">
              <input type="text" id="guide-inp-group" placeholder="Группа (напр. ФН-21)" value="${state.studentMeta.group}">
              <input type="text" id="guide-inp-brigade" placeholder="Бригада №" value="${state.studentMeta.brigade}">
            </div>
            <textarea id="guide-inp-conclusion" rows="3" class="lab-conclusion-inp" placeholder="Сформулируйте выводы: укажите полученные ⟨x⟩ ± σ_⟨x⟩, D, σ ± Δσ, сравните σ_табл и σ_граф, сделайте вывод о согласии с распределением Гаусса по критерию Пирсона χ² и объясните отличие D от теоретического значения 3.50...">${state.studentMeta.conclusion}</textarea>
            <div class="lab-export-bar" style="margin-top:8px">
              <button type="button" class="lab-act-btn primary" id="btn-export-csv">📥 Скачать таблицу CSV (Excel)</button>
              <button type="button" class="lab-act-btn amber" id="btn-export-report">🖨️ Сформировать протокол отчёта (Печать / PDF)</button>
              <a href="./lab_work.html" target="_blank" class="lab-act-btn" style="text-decoration:none;">📄 Открыть полный бланк отчёта (HTML)</a>
            </div>
          </div>

          <div class="lab-guide-text">
            <h3>1. Переход от высоты столбика $h_i$ к относительной частоте $w_i$ и числу шариков $N_i$</h3>
            <p>В каналах одинакового сечения при постоянной плотности укладки число попавших в $i$-й канал шариков $N_i$ пропорционально высоте столбика $h_i$: <b>$N_i = k \\cdot h_i$</b>, где $k$ — линейная плотность укладки (шариков на 1 мм). Для относительной частоты $w_i = N_i / N$ коэффициент $k$ строго сокращается:</p>
            <div class="lab-formula-block">
              $$w_i = \\frac{N_i}{N} = \\frac{k \\cdot h_i}{k \\cdot H} = \\frac{h_i}{H}, \\quad \\text{где } H = \\sum_{i=1}^{15} h_i \\text{ (мм)}$$
            </div>
            <p>Однако для расчёта <b>статистической погрешности</b> $\\Delta w_{\\text{стат}} = \\sqrt{\\frac{w_i(1-w_i)}{N}}$ и <b>критерия согласия Пирсона $\\chi^2$</b> необходимо знать полное число шариков $N = k \cdot H$.</p>

            <h3>2. Физическая природа дисперсии $D$ и эффективное число рядов $n_{\\text{эфф}}$</h3>
            <p>В идеальной схеме Бернулли на каждом из $n = 14$ рядов штырьков шарик независимо поворачивает влево или вправо с вероятностью $p = 0.5$, что даёт теоретическую дисперсию <b>$D_{\\text{теор}} = n p (1-p) = 3.50$</b>. На реальной установке шарики обладают конечной упругостью: возможны проскоки через 1–2 ряда или сохранение импульса. Эффективное число независимых каскадов рассеяния оценивается как:</p>
            <div class="lab-formula-block">
              $$n_{\\text{эфф}} = \\frac{D}{p_{\\text{эфф}}(1 - p_{\\text{эфф}})}, \\quad \\text{где } p_{\\text{эфф}} = \\frac{\\langle x \\rangle - 1}{14}$$
            </div>
            <p>Если $n_{\\text{эфф}} > 14$ ($D > 3.5$), преобладают упругие проскоки; если $n_{\\text{эфф}} < 14$ ($D < 3.5$), сказывается фокусирующее трение о штырьки.</p>

            <h3>3. Критерий согласия Пирсона $\\chi^2$ и объединение малочисленных ячеек</h3>
            <p>Критерий $\\chi^2$ рассчитывается строго по <b>абсолютным числам шариков</b> $O_m = N \cdot w_m$ и теоретическим ожиданиям $E_m = N \cdot P_m$:</p>
            <div class="lab-formula-block">
              $$\\chi^2 = \\sum_{m=1}^{M} \\frac{(O_m - E_m)^2}{E_m}, \\quad \\text{df} = M - 1 - l$$
            </div>
            <p>где $l = 2$ для нормального закона с параметрами $\\langle x \\rangle, \\sigma$ из опыта (число степеней свободы $\\text{df} = M - 3$), а $l = 0$ для теоретического бинома ($\\text{df} = M - 1$). Хвостовые ячейки объединяются до выполнения условия $E_m \ge 5$.</p>

            <h3>4. Погрешности параметров и закон больших чисел</h3>
            <p>Стандартные ошибки среднего $\sigma_{\langle x \rangle}$ и СКО $\Delta\sigma$ убывают по закону $1/\\sqrt{N}$:</p>
            <div class="lab-formula-block">
              $$\\sigma_{\\langle x \\rangle} = \\frac{\\sigma}{\\sqrt{N}}, \\quad \\Delta\\sigma = \\frac{\\sigma}{\\sqrt{2N}}, \\quad \\delta(N) = \\sqrt{\\frac{1}{15}\\sum_{i=1}^{15} \\frac{P_i(1-P_i)}{N}} \\propto N^{-1/2}$$
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app').appendChild(labContainer);
    bindLabEvents();

    if (!hasSaved) {
      setTimeout(() => captureFrom3DBoard(), 350);
    } else {
      renderLabUI();
    }
    renderMath(labContainer);
  }

  // Обновление индикаторов прогресса по этапам (B1)
  function updateStepBadges(stats) {
    const b1 = document.getElementById('step-badge-1');
    const b2 = document.getElementById('step-badge-2');
    const b3 = document.getElementById('step-badge-3');
    const b4 = document.getElementById('step-badge-4');
    const b5 = document.getElementById('step-badge-5');
    const hasData = stats.H > 0 && state.heights.filter(h => h > 0).length >= 5;
    if (b1) b1.textContent = hasData ? '✓' : '1';
    if (b2) b2.textContent = hasData ? '✓' : '2';
    if (b4) b4.textContent = (hasData && stats.chiGauss) ? '✓' : '4';
    if (b5) b5.textContent = state.studentMeta.conclusion.trim().length > 15 ? '✓' : '5';
  }

  // Отрисовка сводной полосы с учётом слепого режима (B3) и погрешностей (A3)
  function renderSummaryStrip(stats) {
    const strip = document.getElementById('lab-summary-strip');
    if (!strip) return;

    const srcLabels = {
      '3d': '<span class="src-tag c-cyan">3D-модель (15 ячеек)</span>',
      'demo': '<span class="src-tag c-amber">Реальная доска (демо)</span>',
      'manual': '<span class="src-tag c-coral">Ручной ввод / Excel</span>',
      'variant': `<span class="src-tag c-amber">Вариант №${state.variant}</span>`,
      'series': '<span class="src-tag c-cyan">Среднее по сериям</span>'
    };
    const srcBadge = srcLabels[state.source] || srcLabels.manual;

    if (state.blindMode) {
      strip.innerHTML = `
        <div class="sum-card">
          <i>Сумма высот H = ∑h<sub>i</sub></i>
          <b>${stats.H.toFixed(1)} <small>мм</small></b>
          ${srcBadge}
        </div>
        <div class="sum-card warn" style="grid-column: span 4;">
          <i>👁️ Включён «Слепой режим» для самостоятельного расчёта</i>
          <b>Готовые значения ⟨x⟩, D, σ и χ² скрыты</b>
          <u>Рассчитайте таблицу вручную или проверьте ответы во вкладке «3. Тренажёр самопроверки»</u>
        </div>
      `;
    renderMath(strip);
      return;
    }

    const nInfo = stats.N ? `N ≈ ${Math.round(stats.N)} шт. (k = ${stats.k.toFixed(2)} шт/мм)` : 'Калибровка N не задана';
    const meanStr = stats.H > 0 ? Core.formatPm(stats.mean, stats.sdMean) : '–';
    const sdStr = stats.H > 0 ? Core.formatPm(stats.sd, stats.sdSd) : '–';
    const chiInfo = stats.chiGauss
      ? `χ² = ${stats.chiGauss.chi2.toFixed(2)} (df=${stats.chiGauss.df}, p=${stats.chiGauss.p.toFixed(2)}) ${stats.chiGauss.ok ? '✓' : '✗'}`
      : 'Задайте N или k';

    strip.innerHTML = `
      <div class="sum-card">
        <i>Сумма H = ∑h<sub>i</sub> и число N</i>
        <b>${stats.H.toFixed(1)} <small>мм</small></b>
        <u>${nInfo}</u>
      </div>
      <div class="sum-card hot">
        <i>Мат. ожидание ⟨x⟩ ± σ<sub>⟨x⟩</sub></i>
        <b>${meanStr}</b>
        <u>теор. 8.000 ${stats.tMean !== null ? `(|t| = ${Math.abs(stats.tMean).toFixed(2)}σ)` : ''}</u>
      </div>
      <div class="sum-card">
        <i>Дисперсия D и n<sub>эфф</sub></i>
        <b>${stats.H > 0 ? stats.variance.toFixed(3) : '–'}</b>
        <u>теор. 3.500 · n<sub>эфф</sub> = ${stats.H > 0 ? stats.nEff.toFixed(1) : '–'}</u>
      </div>
      <div class="sum-card hot">
        <i>СКО σ ± Δσ</i>
        <b>${sdStr}</b>
        <u>теор. 1.871 · Γ<sub>0.5</sub> = ${stats.H > 0 ? stats.fwhm.toFixed(2) : '–'}</u>
      </div>
      <div class="sum-card">
        <i>Согласие с Гауссом (Пирсон)</i>
        <b class="${stats.chiGauss && !stats.chiGauss.ok ? 'c-coral' : 'c-cyan'}">${stats.chiGauss ? (stats.chiGauss.ok ? 'Принята ✓' : 'Отклонена ✗') : '–'}</b>
        <u>${chiInfo}</u>
      </div>
    `;
  }

  // Отрисовка таблицы и сводной панели
  function renderLabUI() {
    const stats = getStats();
    updateStepBadges(stats);
    renderSummaryStrip(stats);

    const tableEl = document.getElementById('lab-data-table');
    if (tableEl) {
      const compactHide = state.dockMode && !state.showAllCols && !state.manualCalcMode;
      tableEl.classList.toggle('compact-cols', compactHide);
    }

    const tbody = document.getElementById('lab-table-tbody');
    if (tbody) {
      const maxH = Math.max(1, ...stats.rows.map(r => r.h));
      tbody.innerHTML = stats.rows.map((r, idx) => {
        const barW = Math.round((r.h / maxH) * 100);
        const isCenter = r.x === 8;

        if (state.manualCalcMode) {
          const kw = `${idx}_w`, kxw = `${idx}_xw`, kd2 = `${idx}_d2w`;
          const vw = state.manualCells[kw] ?? '';
          const vxw = state.manualCells[kxw] ?? '';
          const vd2 = state.manualCells[kd2] ?? '';
          const chkCell = (valStr, target, tol) => {
            if (valStr === '' || valStr === undefined) return '';
            const num = parseFloat(String(valStr).replace(',', '.'));
            if (isNaN(num)) return 'err';
            return Math.abs(num - target) <= tol ? 'ok' : 'err';
          };
          return `
            <tr class="${isCenter ? 'row-center' : ''}">
              <td class="col-x"><b>${r.x}</b>${isCenter ? ' <span class="center-dot">●</span>' : ''}</td>
              <td class="col-h">
                <div class="h-input-wrap">
                  <span class="h-bar" style="width:${barW}%"></span>
                  <input type="number" step="0.5" min="0" max="500" data-idx="${idx}" value="${r.h}" class="inp-hi">
                </div>
              </td>
              <td><input type="number" step="0.001" placeholder="w_${r.x}" data-mkey="${kw}" data-target="${r.w.toFixed(4)}" data-tol="0.003" value="${vw}" class="inp-manual ${chkCell(vw, r.w, 0.003)}"></td>
              <td class="col-opt"><input type="number" step="0.001" placeholder="x·w" data-mkey="${kxw}" data-target="${r.xw.toFixed(4)}" data-tol="0.02" value="${vxw}" class="inp-manual ${chkCell(vxw, r.xw, 0.02)}"></td>
              <td class="mono col-opt c-mute">${state.blindMode ? '?' : (r.dev >= 0 ? '+' : '') + r.dev.toFixed(2)}</td>
              <td class="col-opt"><input type="number" step="0.001" placeholder="Δ²·w" data-mkey="${kd2}" data-target="${r.dev2w.toFixed(4)}" data-tol="0.03" value="${vd2}" class="inp-manual ${chkCell(vd2, r.dev2w, 0.03)}"></td>
              <td class="mono c-cyan">${state.blindMode ? 'скрыто' : r.wGaussExp.toFixed(4)}</td>
              <td class="mono col-opt c-mute">${state.blindMode ? '–' : (r.resid >= 0 ? '+' : '') + r.resid.toFixed(2) + 'σ'}</td>
            </tr>
          `;
        }

        if (state.blindMode) {
          return `
            <tr class="${isCenter ? 'row-center' : ''}">
              <td class="col-x"><b>${r.x}</b>${isCenter ? ' <span class="center-dot">●</span>' : ''}</td>
              <td class="col-h">
                <div class="h-input-wrap">
                  <span class="h-bar" style="width:${barW}%"></span>
                  <input type="number" step="0.5" min="0" max="500" data-idx="${idx}" value="${r.h}" class="inp-hi">
                </div>
              </td>
              <td class="mono c-mute">👁️ скрыто</td>
              <td class="mono col-opt c-mute">👁️ скрыто</td>
              <td class="mono col-opt c-mute">👁️ скрыто</td>
              <td class="mono col-opt c-mute">👁️ скрыто</td>
              <td class="mono c-mute">👁️ скрыто</td>
              <td class="mono col-opt c-mute">–</td>
            </tr>
          `;
        }

        return `
          <tr class="${isCenter ? 'row-center' : ''}">
            <td class="col-x"><b>${r.x}</b>${isCenter ? ' <span class="center-dot" title="Центральная ячейка (x = 8)">●</span>' : ''}</td>
            <td class="col-h">
              <div class="h-input-wrap">
                <span class="h-bar" style="width:${barW}%"></span>
                <input type="number" step="0.5" min="0" max="500" data-idx="${idx}" value="${r.h}" class="inp-hi" aria-label="Высота столбика в ячейке ${r.x}, мм">
              </div>
            </td>
            <td class="mono">${stats.H > 0 ? r.w.toFixed(4) : '0.0000'} <small class="pct">±${r.dw.toFixed(4)}</small></td>
            <td class="mono col-opt">${stats.H > 0 ? r.xw.toFixed(4) : '0.0000'}</td>
            <td class="mono col-opt ${r.dev < 0 ? 'c-mute' : ''}">${stats.H > 0 ? (r.dev >= 0 ? '+' : '') + r.dev.toFixed(3) : '0.000'}</td>
            <td class="mono col-opt">${stats.H > 0 ? r.dev2w.toFixed(4) : '0.0000'}</td>
            <td class="mono c-cyan">${stats.H > 0 ? r.wGaussExp.toFixed(4) : r.wGaussTheo.toFixed(4)}</td>
            <td class="mono col-opt ${Math.abs(r.resid) > 2 ? 'c-coral' : 'c-mute'}">${stats.H > 0 ? (r.resid >= 0 ? '+' : '') + r.resid.toFixed(2) + 'σ' : '–'}</td>
          </tr>
        `;
      }).join('');

      // Привязка редактирования инпутов h_i
      tbody.querySelectorAll('.inp-hi').forEach(inp => {
        inp.addEventListener('input', e => {
          const idx = +e.target.dataset.idx;
          const val = parseFloat(e.target.value);
          state.heights[idx] = isNaN(val) || val < 0 ? 0 : val;
          state.source = 'manual';
          saveState();
          updateTableTotalsAndCharts();
        });
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = tbody.querySelector(`.inp-hi[data-idx="${+e.target.dataset.idx + 1}"]`);
            if (next) { next.focus(); next.select(); }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = tbody.querySelector(`.inp-hi[data-idx="${+e.target.dataset.idx - 1}"]`);
            if (prev) { prev.focus(); prev.select(); }
          }
        });
        // Поддержка вставки столбца чисел прямо в ячейку (Ctrl+V из Excel)
        inp.addEventListener('paste', e => {
          const text = (e.clipboardData || window.clipboardData)?.getData('text');
          const parsed = Core.parseHeightsText(text);
          if (parsed) {
            e.preventDefault();
            state.heights = parsed;
            state.source = 'manual';
            saveState();
            renderLabUI();
          }
        });
      });

      // Привязка ячеек ручного расчёта (B2)
      tbody.querySelectorAll('.inp-manual').forEach(inp => {
        inp.addEventListener('input', e => {
          const key = e.target.dataset.mkey;
          const val = e.target.value;
          state.manualCells[key] = val;
          const target = parseFloat(e.target.dataset.target);
          const tol = parseFloat(e.target.dataset.tol);
          const num = parseFloat(String(val).replace(',', '.'));
          e.target.classList.remove('ok', 'err');
          if (val !== '' && !isNaN(num)) {
            const isOk = Math.abs(num - target) <= tol;
            e.target.classList.add(isOk ? 'ok' : 'err');
            e.target.title = isOk ? `Верно! Точное значение: ${target}` : `Ошибка (ожидается около ${target})`;
          }
        });
      });
    }

    updateTableTotalsAndCharts();
  }

  function updateTableTotalsAndCharts() {
    const stats = getStats();
    updateStepBadges(stats);
    renderSummaryStrip(stats);

    const tbody = document.getElementById('lab-table-tbody');
    if (tbody && !state.manualCalcMode && !state.blindMode) {
      const maxH = Math.max(1, ...stats.rows.map(r => r.h));
      const trs = tbody.querySelectorAll('tr');
      stats.rows.forEach((r, idx) => {
        const tr = trs[idx];
        if (!tr) return;
        const bar = tr.querySelector('.h-bar');
        if (bar) bar.style.width = `${Math.round((r.h / maxH) * 100)}%`;
        const tds = tr.querySelectorAll('td');
        if (tds.length >= 8) {
          tds[2].innerHTML = `${stats.H > 0 ? r.w.toFixed(4) : '0.0000'} <small class="pct">±${r.dw.toFixed(4)}</small>`;
          tds[3].textContent = stats.H > 0 ? r.xw.toFixed(4) : '0.0000';
          tds[4].textContent = stats.H > 0 ? (r.dev >= 0 ? '+' : '') + r.dev.toFixed(3) : '0.000';
          tds[5].textContent = stats.H > 0 ? r.dev2w.toFixed(4) : '0.0000';
          tds[6].textContent = stats.H > 0 ? r.wGaussExp.toFixed(4) : r.wGaussTheo.toFixed(4);
          tds[7].textContent = stats.H > 0 ? (r.resid >= 0 ? '+' : '') + r.resid.toFixed(2) + 'σ' : '–';
        }
      });
    }

    const tfoot = document.getElementById('lab-table-tfoot');
    if (tfoot) {
      if (state.blindMode) {
        tfoot.innerHTML = `
          <tr>
            <td><b>∑ (Итого)</b></td>
            <td class="mono"><b>H = ${stats.H.toFixed(1)} мм</b></td>
            <td colspan="6" class="mono c-amber" style="text-align:center">👁️ Слепой режим: рассчитайте суммы самостоятельно и проверьте во вкладке «3. Тренажёр»</td>
          </tr>
        `;
      } else {
        const sumW = stats.rows.reduce((a, r) => a + r.w, 0);
        const sumGauss = stats.rows.reduce((a, r) => a + (stats.H > 0 ? r.wGaussExp : r.wGaussTheo), 0);
        tfoot.innerHTML = `
          <tr>
            <td><b>∑ (Итого)</b></td>
            <td class="mono"><b>H = ${stats.H.toFixed(1)} мм</b></td>
            <td class="mono"><b>${stats.H > 0 ? sumW.toFixed(4) : '0.0000'} (100%)</b></td>
            <td class="mono col-opt c-cyan"><b>⟨x⟩ = ${stats.H > 0 ? stats.mean.toFixed(3) : '–'}</b></td>
            <td class="mono col-opt c-mute">∑Δ·wᵢ = 0</td>
            <td class="mono col-opt c-amber"><b>D = ${stats.H > 0 ? stats.variance.toFixed(3) : '–'} (σ = ${stats.H > 0 ? stats.sd.toFixed(3) : '–'})</b></td>
            <td class="mono c-cyan">${sumGauss.toFixed(4)}</td>
            <td class="mono col-opt">${stats.chiGauss ? `χ² = ${stats.chiGauss.chi2.toFixed(2)}` : '–'}</td>
          </tr>
        `;
      }
    }

    drawHistogramChart(stats);
    renderPhysAnalysis(stats);
  }

  // Масштабирование Canvas под Retina / High-DPI экраны (C5)
  function setupHiDPICanvas(canvas, logicalW, logicalH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const targetW = Math.round(logicalW * dpr);
    const targetH = Math.round(logicalH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  // Отрисовка научного 2D-графика: Гистограмма w_i + Кривая Гаусса + Панель нормированных остатков (C3, C4, C5)
  function drawHistogramChart(stats) {
    const canvas = document.getElementById('lab-hist-canvas');
    if (!canvas) return;
    const W = 940;
    const hasRes = state.showResiduals && !state.blindMode && stats.H > 0;
    const Hc = hasRes ? 520 : 420;
    const ctx = setupHiDPICanvas(canvas, W, Hc);
    const light = state.chartLight;

    const pal = light ? {
      bg: '#ffffff',
      grid: '#e2e8f0',
      axis: '#1e293b',
      text: '#0f172a',
      mute: '#475569',
      barFill: 'rgba(2, 132, 199, 0.22)',
      barStroke: '#0284c7',
      errBar: '#334155',
      gaussExp: '#d97706',
      gaussTheo: '#059669',
      binomDot: '#4f46e5',
      sigmaZone: 'rgba(217, 119, 6, 0.10)',
      fwhmColor: '#dc2626',
      resBand: 'rgba(5, 150, 105, 0.08)'
    } : {
      bg: '#0b101d',
      grid: 'rgba(148, 163, 184, 0.14)',
      axis: '#94a3b8',
      text: '#f1f5f9',
      mute: '#94a3b8',
      barFill: 'rgba(127, 227, 255, 0.22)',
      barStroke: '#7fe3ff',
      errBar: '#cbd5e1',
      gaussExp: '#ffb454',
      gaussTheo: '#34d399',
      binomDot: '#a78bfa',
      sigmaZone: 'rgba(255, 180, 84, 0.09)',
      fwhmColor: '#ff6b86',
      resBand: 'rgba(52, 211, 153, 0.08)'
    };

    ctx.clearRect(0, 0, W, Hc);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, Hc);

    const padL = 72, padR = 30, padT = 42;
    const mainH = hasRes ? 315 : (Hc - padT - 54);
    const plotW = W - padL - padR;

    const xMin = 0.2, xMax = 15.8;
    const xToPx = x => padL + ((x - xMin) / (xMax - xMin)) * plotW;

    const maxWData = Math.max(
      0.24,
      ...stats.rows.map(r => r.w + (state.showErrorBars ? r.dw : 0)),
      stats.wMax,
      Core.gaussPdf(8, 8, Math.sqrt(3.5))
    );
    const yMax = Math.ceil(maxWData * 1.18 * 20) / 20;
    const yToPx = y => padT + mainH - (y / yMax) * mainH;

    // 1. Зоны <x> ± σ и <x> ± 2σ
    if (state.showSigmaZones && !state.blindMode && stats.H > 0 && stats.sd > 0.05) {
      const x2L = Math.max(xMin, stats.mean - 2 * stats.sd);
      const x2R = Math.min(xMax, stats.mean + 2 * stats.sd);
      ctx.fillStyle = pal.sigmaZone;
      ctx.fillRect(xToPx(x2L), padT, xToPx(x2R) - xToPx(x2L), mainH);

      const x1L = Math.max(xMin, stats.mean - stats.sd);
      const x1R = Math.min(xMax, stats.mean + stats.sd);
      ctx.fillRect(xToPx(x1L), padT, xToPx(x1R) - xToPx(x1L), mainH);

      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = pal.gaussExp;
      ctx.globalAlpha = 0.55;
      [stats.mean - stats.sd, stats.mean + stats.sd].forEach(xv => {
        if (xv >= xMin && xv <= xMax) {
          ctx.beginPath();
          ctx.moveTo(xToPx(xv), padT);
          ctx.lineTo(xToPx(xv), padT + mainH);
          ctx.stroke();
        }
      });
      ctx.restore();
    }

    // 2. Координатная сетка
    ctx.lineWidth = 1;
    ctx.strokeStyle = pal.grid;
    ctx.fillStyle = pal.mute;
    ctx.font = '500 11.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let yv = 0; yv <= yMax + 1e-6; yv += 0.05) {
      const py = yToPx(yv);
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(padL + plotW, py);
      ctx.stroke();
      ctx.fillText(yv.toFixed(2), padL - 8, py);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 1; i <= N_BINS; i++) {
      const px = xToPx(i);
      ctx.beginPath();
      ctx.moveTo(px, padT);
      ctx.lineTo(px, padT + mainH);
      ctx.strokeStyle = pal.grid;
      ctx.stroke();

      if (!hasRes) {
        ctx.fillStyle = i === 8 ? pal.gaussExp : pal.text;
        ctx.font = i === 8 ? '700 12px "JetBrains Mono", monospace' : '500 11.5px "JetBrains Mono", monospace';
        ctx.fillText(String(i), px, padT + mainH + 8);
      }
    }

    // 3. Ступенчатая гистограмма экспериментальных частот w_i = h_i / H
    if (stats.H > 0) {
      stats.rows.forEach(r => {
        const xL = xToPx(r.x - 0.46);
        const xR = xToPx(r.x + 0.46);
        const yT = yToPx(r.w);
        const yB = yToPx(0);
        const bw = xR - xL;
        const bh = Math.max(0, yB - yT);

        ctx.fillStyle = pal.barFill;
        ctx.fillRect(xL, yT, bw, bh);
        ctx.strokeStyle = pal.barStroke;
        ctx.lineWidth = 1.7;
        ctx.strokeRect(xL, yT, bw, bh);

        if (state.showErrorBars && r.h > 0 && r.dw > 0) {
          const cx = xToPx(r.x);
          const yTopErr = yToPx(Math.min(yMax, r.w + r.dw));
          const yBotErr = yToPx(Math.max(0, r.w - r.dw));
          ctx.strokeStyle = pal.errBar;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(cx, yTopErr);
          ctx.lineTo(cx, yBotErr);
          ctx.moveTo(cx - 4, yTopErr);
          ctx.lineTo(cx + 4, yTopErr);
          ctx.moveTo(cx - 4, yBotErr);
          ctx.lineTo(cx + 4, yBotErr);
          ctx.stroke();
        }
      });
    }

    // 4. Теоретическая кривая Гаусса (μ = 8.0, σ = 1.871)
    if (state.showGaussTheo) {
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = pal.gaussTheo;
      ctx.lineWidth = 2.0;
      for (let px = 0; px <= plotW; px += 2) {
        const xv = xMin + (px / plotW) * (xMax - xMin);
        const yv = Core.gaussPdf(xv, stats.theoMean, stats.theoSd);
        const sy = yToPx(yv);
        if (px === 0) ctx.moveTo(padL + px, sy);
        else ctx.lineTo(padL + px, sy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. Точки биномиального распределения P_14(i-1)
    if (state.showBinom) {
      stats.rows.forEach(r => {
        const cx = xToPx(r.x);
        const cy = yToPx(r.wBinom);
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = pal.binomDot;
        ctx.fill();
      });
    }

    // 6. Экспериментальная кривая Гаусса (по найденным <x> и σ)
    if (state.showGaussExp && !state.blindMode && stats.H > 0 && stats.sd > 0.05) {
      ctx.beginPath();
      ctx.strokeStyle = pal.gaussExp;
      ctx.lineWidth = 2.6;
      for (let px = 0; px <= plotW; px += 2) {
        const xv = xMin + (px / plotW) * (xMax - xMin);
        const yv = Core.gaussPdf(xv, stats.mean, stats.sd);
        const sy = yToPx(yv);
        if (px === 0) ctx.moveTo(padL + px, sy);
        else ctx.lineTo(padL + px, sy);
      }
      ctx.stroke();

      const mx = xToPx(stats.mean);
      const my = yToPx(stats.wMax);
      ctx.save();
      ctx.strokeStyle = pal.gaussExp;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx, padT + mainH);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(mx, my, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = pal.gaussExp;
      ctx.fill();
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`⟨x⟩ = ${stats.mean.toFixed(2)}, w_max = ${stats.wMax.toFixed(3)}`, mx, my - 6);
    }

    // 7. Полуширина на полувысоте Γ_0.5 = 2.355 σ
    if (state.showFWHM && !state.blindMode && stats.H > 0 && stats.sd > 0.05) {
      const halfW = 0.5 * stats.wMax;
      const halfSpan = Math.sqrt(2 * Math.log(2)) * stats.sd;
      const py = yToPx(halfW);
      const pxL = xToPx(stats.mean - halfSpan);
      const pxR = xToPx(stats.mean + halfSpan);

      ctx.save();
      ctx.strokeStyle = pal.fwhmColor;
      ctx.fillStyle = pal.fwhmColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pxL, py);
      ctx.lineTo(pxR, py);
      ctx.moveTo(pxL + 6, py - 4);
      ctx.lineTo(pxL, py);
      ctx.lineTo(pxL + 6, py + 4);
      ctx.moveTo(pxR - 6, py - 4);
      ctx.lineTo(pxR, py);
      ctx.lineTo(pxR - 6, py + 4);
      ctx.stroke();

      ctx.font = '600 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`Γ₀.₅ = ${stats.fwhm.toFixed(2)} ≈ 2.355σ`, (pxL + pxR) / 2, py - 4);
      ctx.restore();
    }

    // 8. Оси верхнего графика
    ctx.strokeStyle = pal.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + mainH);
    ctx.lineTo(padL + plotW, padT + mainH);
    ctx.stroke();

    ctx.fillStyle = pal.text;
    ctx.font = '600 13px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Гистограмма относительных частот wᵢ = hᵢ / H и функция распределения Гаусса', padL, 12);

    ctx.save();
    ctx.translate(18, padT + mainH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('Частота wᵢ = hᵢ / H', 0, 0);
    ctx.restore();

    // Легенда
    const legX = W - padR - 270;
    const legY = padT + 6;
    ctx.fillStyle = light ? 'rgba(248, 250, 252, 0.92)' : 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    ctx.fillRect(legX, legY, 262, 82);
    ctx.strokeRect(legX, legY, 262, 82);

    ctx.font = '500 10.8px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = pal.barFill;
    ctx.fillRect(legX + 10, legY + 10, 15, 10);
    ctx.strokeStyle = pal.barStroke;
    ctx.strokeRect(legX + 10, legY + 10, 15, 10);
    ctx.fillStyle = pal.text;
    ctx.fillText(`Опыт wᵢ ± Δwᵢ (H=${stats.H.toFixed(0)} мм${stats.N ? ', N≈' + Math.round(stats.N) : ''})`, legX + 32, legY + 15);

    ctx.strokeStyle = pal.gaussExp;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(legX + 10, legY + 35);
    ctx.lineTo(legX + 25, legY + 35);
    ctx.stroke();
    ctx.fillStyle = pal.text;
    ctx.fillText(`Гаусс по опыту (⟨x⟩=${state.blindMode ? '?' : stats.mean.toFixed(2)}, σ=${state.blindMode ? '?' : stats.sd.toFixed(2)})`, legX + 32, legY + 35);

    ctx.save();
    ctx.strokeStyle = pal.gaussTheo;
    ctx.lineWidth = 2.0;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(legX + 10, legY + 54);
    ctx.lineTo(legX + 25, legY + 54);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = pal.text;
    ctx.fillText('Идеальная Гауссиана (μ=8.00, σ=1.871)', legX + 32, legY + 54);

    ctx.beginPath();
    ctx.arc(legX + 17.5, legY + 71, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = pal.binomDot;
    ctx.fill();
    ctx.fillStyle = pal.text;
    ctx.fillText('Биномиальное распределение P₁₄(xᵢ − 1)', legX + 32, legY + 71);

    // 9. Нижняя панель нормированных остатков z_i = (w_i - w_гаусс) / Δw_i (C4)
    if (hasRes) {
      const resTop = padT + mainH + 30;
      const resH = 98;
      const resMid = resTop + resH / 2;
      const maxZ = 3.2;
      const zToY = z => resMid - (Math.max(-maxZ, Math.min(maxZ, z)) / maxZ) * (resH / 2);

      // Полоса ±2σ
      ctx.fillStyle = pal.resBand;
      ctx.fillRect(padL, zToY(2), plotW, zToY(-2) - zToY(2));

      // Линии −2, 0, +2
      ctx.font = '500 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      [-2, 0, 2].forEach(zv => {
        const py = zToY(zv);
        ctx.save();
        ctx.strokeStyle = zv === 0 ? pal.axis : pal.grid;
        if (zv !== 0) ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = pal.mute;
        ctx.fillText((zv > 0 ? '+' : '') + zv + 'σ', padL - 8, py);
      });

      // Столбики/точки остатков
      stats.rows.forEach(r => {
        const px = xToPx(r.x);
        const py = zToY(r.resid);
        const isOut = Math.abs(r.resid) > 2;
        ctx.strokeStyle = isOut ? '#ff6b86' : pal.barStroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, resMid);
        ctx.lineTo(px, py);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isOut ? '#ff6b86' : pal.gaussExp;
        ctx.fill();

        // Подпись x_i под графиком остатков
        ctx.fillStyle = r.x === 8 ? pal.gaussExp : pal.text;
        ctx.font = r.x === 8 ? '700 12px "JetBrains Mono", monospace' : '500 11.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(String(r.x), px, resTop + resH + 6);
      });

      ctx.strokeStyle = pal.axis;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(padL, resTop, plotW, resH);

      ctx.save();
      ctx.translate(18, resMid);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = pal.text;
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillText('Остатки (wᵢ−w_г)/Δwᵢ', 0, 0);
      ctx.restore();
    }

    ctx.fillStyle = pal.text;
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Номер ячейки (координата столбика) xᵢ = 1 … 15', padL + plotW / 2, Hc - 4);

    // Подпись под графиком
    const cap = document.getElementById('lab-chart-caption');
    if (cap) {
      if (stats.H > 0 && !state.blindMode) {
        const sigGraf = (stats.fwhm / 2.35482).toFixed(3);
        cap.innerHTML = `
          <b>Сопоставление способов определения σ:</b>
          Алгебраический расчёт: <b>σ = √D = ${Core.formatPm(stats.sd, stats.sdSd)}</b> ·
          Графический метод по полуширине (Γ<sub>0.5</sub> = ${stats.fwhm.toFixed(2)}): <b>σ<sub>граф</sub> = Γ<sub>0.5</sub> / 2.355 = ${sigGraf}</b> ·
          Идеальная доска (n = 14, p = 0.5): <b>σ<sub>теор</sub> = √3.5 = 1.871</b>.
        `;
      } else if (state.blindMode) {
        cap.innerHTML = '👁️ В слепом режиме экспериментальная кривая Гаусса скрыта. Измерьте высоты столбиков и выполните расчёт.';
      } else {
        cap.innerHTML = 'Введите высоты столбиков hᵢ во вкладке «1. Таблица» или снимите показания с 3D-доски.';
      }
    }
  }

  // Вкладка 3: Проверка расчётов студента с умной диагностикой (A3, B3)
  function checkStudentCalculations() {
    const stats = getStats();
    if (stats.H <= 0) return;

    const setFb = (id, ok, msg) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.className = 'lab-check-feedback ' + (ok ? 'ok' : 'err');
      el.innerHTML = msg;
    };

    const vH = parseFloat(document.getElementById('chk-inp-H').value);
    if (isNaN(vH)) setFb('chk-fb-H', false, 'Введите числовое значение суммы высот H.');
    else if (Math.abs(vH - stats.H) <= 0.6) setFb('chk-fb-H', true, `✓ Верно! H = ${stats.H.toFixed(1)} мм.`);
    else setFb('chk-fb-H', false, `✗ Не совпадает (у вас ${vH}). Проверьте сложение всех 15 столбиков.`);

    const vMean = parseFloat(document.getElementById('chk-inp-mean').value);
    if (isNaN(vMean)) setFb('chk-fb-mean', false, 'Введите рассчитанное математическое ожидание ⟨x⟩.');
    else if (Math.abs(vMean - stats.mean) <= 0.08) setFb('chk-fb-mean', true, `✓ Отлично! ⟨x⟩ = ${Core.formatPm(stats.mean, stats.sdMean)}.`);
    else {
      let hint = '✗ Не совпадает. ';
      if (Math.abs(vMean - (stats.mean - 1)) <= 0.1) hint += 'Вы нумеровали ячейки с 0 до 14 вместо 1 до 15!';
      else if (Math.abs(vMean - stats.H / 15) <= 1.5) hint += 'Вы посчитали среднюю высоту H/15, а нужно среднюю координату ∑(xᵢ · wᵢ)!';
      else hint += 'Проверьте сумму произведений xᵢ · wᵢ.';
      setFb('chk-fb-mean', false, hint);
    }

    const vVar = parseFloat(document.getElementById('chk-inp-var').value);
    if (isNaN(vVar)) setFb('chk-fb-var', false, 'Введите рассчитанную дисперсию D.');
    else if (Math.abs(vVar - stats.variance) <= 0.12) setFb('chk-fb-var', true, `✓ Верно! Дисперсия D = ${stats.variance.toFixed(3)}.`);
    else {
      let hint = '✗ Ошибка в дисперсии. ';
      if (Math.abs(vVar - stats.sd) <= 0.1) hint += 'Вы ввели СКО σ вместо дисперсии D = σ²!';
      else if (Math.abs(vVar - stats.variance * 15) <= 2) hint += 'Не забудьте умножить каждый квадрат отклонения (xᵢ − ⟨x⟩)² на частоту wᵢ!';
      else hint += 'Формула: D = ∑ (xᵢ − ⟨x⟩)² · wᵢ.';
      setFb('chk-fb-var', false, hint);
    }

    const vSd = parseFloat(document.getElementById('chk-inp-sd').value);
    if (isNaN(vSd)) setFb('chk-fb-sd', false, 'Введите СКО σ.');
    else if (Math.abs(vSd - stats.sd) <= 0.06) setFb('chk-fb-sd', true, `✓ Верно! σ = √D = ${Core.formatPm(stats.sd, stats.sdSd)}.`);
    else if (Math.abs(vSd - stats.variance) <= 0.12) setFb('chk-fb-sd', false, '✗ Вы забыли извлечь квадратный корень из дисперсии: σ = √D!');
    else setFb('chk-fb-sd', false, '✗ Не совпадает. Проверьте извлечение корня √D.');

    const vSdMean = parseFloat(document.getElementById('chk-inp-sdmean').value);
    if (!stats.sdMean) setFb('chk-fb-sdmean', false, 'Задайте число шариков N в панели калибровки.');
    else if (isNaN(vSdMean)) setFb('chk-fb-sdmean', false, 'Введите стандартную ошибку среднего σ_⟨x⟩ = σ / √N.');
    else if (Math.abs(vSdMean - stats.sdMean) <= 0.012) setFb('chk-fb-sdmean', true, `✓ Верно! σ_⟨x⟩ = σ / √N = ${stats.sdMean.toFixed(4)}.`);
    else setFb('chk-fb-sdmean', false, `✗ Проверьте деление σ на √N (при N ≈ ${Math.round(stats.N)}).`);

    const vFwhm = parseFloat(document.getElementById('chk-inp-fwhm').value);
    if (isNaN(vFwhm)) setFb('chk-fb-fwhm', false, 'Введите полуширину на полувысоте Γ₀.₅.');
    else if (Math.abs(vFwhm - stats.fwhm) <= 0.15) setFb('chk-fb-fwhm', true, `✓ Верно! Γ₀.₅ = 2.355 · σ = ${stats.fwhm.toFixed(2)}.`);
    else setFb('chk-fb-fwhm', false, '✗ Умножьте экспериментальное СКО σ на 2.355.');

    const b3 = document.getElementById('step-badge-3');
    if (b3) b3.textContent = '✓';
  }

  // Вкладка 4: Отрисовка глубокого анализа по статистической физике (A1–A6, B4, B5)
  function renderPhysAnalysis(stats) {
    const box = document.getElementById('lab-phys-content');
    if (!box) return;

    if (state.blindMode) {
      box.innerHTML = `<div class="phys-card" style="grid-column:span 2"><h4>👁️ Слепой режим активен</h4><p>Отключите «Слепой режим», чтобы увидеть подробный статистический анализ и критерий Пирсона χ².</p></div>`;
      return;
    }

    const shiftX = stats.mean - 8.0;
    const cg = stats.chiGauss;
    const cb = stats.chiBinom;

    const intRowsHtml = (stats.intervals || []).map(it => `
      <div>
        <span>Интервал ⟨x⟩ ± ${it.k}σ:</span>
        <b>Опыт: ${(it.exp * 100).toFixed(1)}% · Бином P₁₄: ${(it.binom * 100).toFixed(1)}% · Гаусс Φ(${it.k}): ${(it.gauss * 100).toFixed(1)}%</b>
      </div>
    `).join('');

    box.innerHTML = `
      <div class="phys-card">
        <h4>1. Параметры физической установки (p<sub>эфф</sub> и эффективное число рядов n<sub>эфф</sub>)</h4>
        <p>По смещению среднего ⟨x⟩ и величине дисперсии D определяем реальную асимметрию отскоков и эффективное число каскадов рассеяния:</p>
        <div class="phys-kv-list">
          <div><span>Смещение центра Δx = ⟨x⟩ − 8:</span><b>${stats.H > 0 ? `${(shiftX >= 0 ? '+' : '') + shiftX.toFixed(3)} ± ${stats.sdMean ? stats.sdMean.toFixed(3) : '–'} (${stats.tMean !== null ? Math.abs(stats.tMean).toFixed(2) + 'σ' : '–'})` : '–'}</b></div>
          <div><span>Эффективная вероятность шага вправо p<sub>эфф</sub> = (⟨x⟩ − 1)/14:</span><b class="c-cyan">${stats.H > 0 ? stats.pEff.toFixed(4) : '0.5000'} (идеал 0.5000)</b></div>
          <div><span>Эффективное число рядов n<sub>эфф</sub> = D / [p<sub>эфф</sub>(1−p<sub>эфф</sub>)]:</span><b class="c-amber">${stats.H > 0 ? `${stats.nEff.toFixed(1)} рядов (геометрически 14)` : '–'}</b></div>
          <div><span>Эквивалентный наклон в рамках 3D-модели:</span><b>${stats.H > 0 ? (stats.tiltEffDeg >= 0 ? '+' : '') + stats.tiltEffDeg.toFixed(2) + '°' : '0.00°'}</b></div>
        </div>
        <button type="button" class="lab-act-btn" id="btn-apply-eff-tilt" style="margin-top:8px">
          📐 Выставить этот наклон (${Math.round(stats.tiltEffDeg)}°) на 3D-доске
        </button>
      </div>

      <div class="phys-card">
        <h4>2. Критерий согласия Пирсона χ² (по числу шариков N<sub>i</sub> с объединением E<sub>i</sub> ≥ 5)</h4>
        <p>Проверка согласия при N ≈ ${stats.N ? Math.round(stats.N) : '–'} шариков (α = 0.05) и доли попаданий в коридоры ±kσ:</p>
        <div class="phys-kv-list">
          <div>
            <span>Гаусс с параметрами опыта (⟨x⟩, σ):</span>
            <b class="${cg && cg.ok ? 'c-cyan' : 'c-coral'}">${cg ? `χ² = ${cg.chi2.toFixed(2)} (крит. ${cg.crit.toFixed(1)}, df=${cg.df}, p=${cg.p.toFixed(3)}) ${cg.ok ? '✓ Принята' : '✗ Отклонена'}` : 'Задайте N'}</b>
          </div>
          <div>
            <span>Идеальный биномиальный закон B(14; 0.5):</span>
            <b class="${cb && cb.ok ? 'c-cyan' : 'c-amber'}">${cb ? `χ² = ${cb.chi2.toFixed(2)} (крит. ${cb.crit.toFixed(1)}, df=${cb.df}, p=${cb.p.toFixed(4)}) ${cb.ok ? '✓ Согласуется' : 'Отличается'}` : 'Задайте N'}</b>
          </div>
          ${intRowsHtml}
        </div>
      </div>
    `;

    const btnTilt = document.getElementById('btn-apply-eff-tilt');
    if (btnTilt) {
      btnTilt.onclick = () => {
        if (window.__lab) window.__lab.tilt(Math.round(stats.tiltEffDeg));
      };
    }

    renderSeriesBox();
    drawFluctChart();
  }

  // Отрисовка блока серий повторных измерений (B5)
  function renderSeriesBox() {
    const container = document.getElementById('lab-series-box');
    if (!container) return;
    if (!state.seriesList.length) {
      container.innerHTML = `<p style="margin:6px 0 0;font-size:12px;color:#8c98b4">Пока нет сохранённых серий. Нажмите «➕ Сохранить текущий замер в серию» или «🎲 Провести 4 серии».</p>`;
      return;
    }
    const ms = Core.computeMultiSeries(state.seriesList.map(s => s.heights), getCalibOpts());
    if (!ms) return;

    const rowsHtml = ms.perSeries.map((s, idx) => `
      <tr>
        <td style="text-align:center"><b>Серия №${idx + 1}</b></td>
        <td class="mono">${s.H.toFixed(1)} мм</td>
        <td class="mono c-cyan">${s.mean.toFixed(3)}</td>
        <td class="mono">${s.variance.toFixed(3)}</td>
        <td class="mono c-amber">${s.sd.toFixed(3)}</td>
        <td class="mono">${s.chiGauss ? s.chiGauss.chi2.toFixed(2) : '–'}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="lab-table-wrap" style="max-height:190px;min-height:auto;margin-top:8px">
        <table class="lab-table">
          <thead>
            <tr>
              <th>Опыт</th>
              <th>Сумма H</th>
              <th>Среднее ⟨x⟩</th>
              <th>Дисперсия D</th>
              <th>СКО σ</th>
              <th>χ² (Гаусс)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td style="text-align:center"><b>Среднее (${ms.M} сер.)</b></td>
              <td class="mono"><b>${ms.avgH.toFixed(1)} мм</b></td>
              <td class="mono c-cyan"><b>${ms.avgMean.toFixed(3)} ± ${ms.seMean.toFixed(3)}</b></td>
              <td class="mono"><b>${ms.avgVar.toFixed(3)}</b></td>
              <td class="mono c-amber"><b>${ms.avgSd.toFixed(3)}</b></td>
              <td class="mono">s<sub>⟨x⟩</sub> = ${ms.sMean.toFixed(3)} (теор. σ/√N = ${ms.theoSpreadMean ? ms.theoSpreadMean.toFixed(3) : '–'})</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#cbd5e1">
        <span>Межсерийное СКО среднего: <b>s<sub>⟨x⟩</sub> = ${ms.sMean.toFixed(4)}</b> vs теоретическое <b>σ/√N = ${ms.theoSpreadMean ? ms.theoSpreadMean.toFixed(4) : '–'}</b></span>
        <button type="button" class="lab-act-btn primary" id="btn-series-apply-avg">📥 Подставить усреднённые высоты h̄ᵢ в основную таблицу</button>
      </div>
    `;

    const btnAvg = document.getElementById('btn-series-apply-avg');
    if (btnAvg) {
      btnAvg.onclick = () => {
        state.heights = [...ms.avgHeights];
        state.source = 'series';
        saveState();
        renderLabUI();
      };
    }
  }

  // Численный эксперимент по проверке закона 1/√N с вычислением наклона −0.5 (A4)
  function runFluctuationExperiment() {
    state.fluctData = Core.fluctSeries([25, 50, 100, 200, 400, 800, 1600, 3200], 28);
    drawFluctChart();
  }

  function drawFluctChart() {
    const canvas = document.getElementById('lab-fluct-canvas');
    if (!canvas) return;
    if (!state.fluctData) {
      state.fluctData = Core.fluctSeries([25, 50, 100, 200, 400, 800, 1600, 3200], 28, Core.mulberry32(2026));
    }
    const W = 900, Hc = 270;
    const ctx = setupHiDPICanvas(canvas, W, Hc);
    ctx.clearRect(0, 0, W, Hc);
    ctx.fillStyle = '#0b101d';
    ctx.fillRect(0, 0, W, Hc);

    const padL = 68, padR = 28, padT = 32, padB = 42;
    const plotW = W - padL - padR;
    const plotH = Hc - padT - padB;

    const { points, slope } = state.fluctData;
    const isLog = state.fluctLogScale;

    let xToPx, yToPx;
    if (isLog) {
      const lxMin = Math.log10(points[0].N) - 0.08;
      const lxMax = Math.log10(points[points.length - 1].N) + 0.08;
      const allY = points.flatMap(p => [p.rmse, p.theory]);
      const lyMin = Math.log10(Math.min(...allY)) - 0.12;
      const lyMax = Math.log10(Math.max(...allY)) + 0.12;
      xToPx = N => padL + ((Math.log10(N) - lxMin) / (lxMax - lxMin)) * plotW;
      yToPx = v => padT + plotH - ((Math.log10(v) - lyMin) / (lyMax - lyMin)) * plotH;

      // Сетка по Y
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      [0.002, 0.005, 0.01, 0.02, 0.04].forEach(yv => {
        const py = yToPx(yv);
        if (py >= padT && py <= padT + plotH) {
          ctx.beginPath();
          ctx.moveTo(padL, py);
          ctx.lineTo(padL + plotW, py);
          ctx.stroke();
          ctx.fillText(yv.toFixed(3), padL - 8, py);
        }
      });
    } else {
      const maxY = Math.max(...points.map(s => Math.max(s.rmse, s.theory))) * 1.15;
      xToPx = (_, i) => padL + (i / (points.length - 1)) * plotW;
      yToPx = v => padT + plotH - (v / maxY) * plotH;

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let k = 0; k <= 4; k++) {
        const yv = (maxY * k) / 4;
        const py = yToPx(yv);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();
        ctx.fillText(yv.toFixed(3), padL - 8, py);
      }
    }

    // Теоретическая кривая δ(N) = √(∑P_i(1-P_i)/(15N))
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    points.forEach((s, i) => {
      const px = xToPx(s.N, i), py = yToPx(s.theory);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();

    // Экспериментальная кривая RMSE(w_i, P_бином)
    ctx.strokeStyle = '#7fe3ff';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    points.forEach((s, i) => {
      const px = xToPx(s.N, i), py = yToPx(s.rmse);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    points.forEach((s, i) => {
      const px = xToPx(s.N, i), py = yToPx(s.rmse);
      ctx.beginPath();
      ctx.arc(px, py, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb454';
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`N=${s.N}`, px, padT + plotH + 8);
    });

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '600 11.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#7fe3ff';
    ctx.fillText(`● Опыт RMSE(wᵢ, P₁₄) [измеренный наклон k = ${slope.toFixed(2)}, теория −0.50]`, padL + 10, 9);
    ctx.fillStyle = '#34d399';
    ctx.fillText('--- Точная теория δ(N) = √(∑Pᵢ(1−Pᵢ) / 15N)', padL + 510, 9);
  }

  // Экспорт таблицы в CSV (D3)
  function exportCSV() {
    const stats = getStats();
    const lines = [
      'Номер ячейки x_i;Высота столбика h_i (мм);Относительная частота w_i;Погрешность dw_i;x_i * w_i;Отклонение (x_i - <x>);(x_i - <x>)^2 * w_i;Нормальное распределение w_гаусс(x_i);Нормированный остаток (w_i - w_гаусс)/dw_i'
    ];
    stats.rows.forEach(r => {
      lines.push([
        r.x,
        r.h.toFixed(1).replace('.', ','),
        r.w.toFixed(4).replace('.', ','),
        r.dw.toFixed(4).replace('.', ','),
        r.xw.toFixed(4).replace('.', ','),
        r.dev.toFixed(3).replace('.', ','),
        r.dev2w.toFixed(4).replace('.', ','),
        r.wGaussExp.toFixed(4).replace('.', ','),
        r.resid.toFixed(2).replace('.', ',')
      ].join(';'));
    });
    lines.push([
      'СУММА / ИТОГО',
      stats.H.toFixed(1).replace('.', ','),
      '1,0000',
      '',
      stats.mean.toFixed(4).replace('.', ','),
      '0,000',
      stats.variance.toFixed(4).replace('.', ','),
      '',
      ''
    ].join(';'));
    lines.push('');
    lines.push(`Вариант №;${state.variant};Число шариков N;${stats.N ? Math.round(stats.N) : ''}`);
    lines.push(`Математическое ожидание <x>;${Core.formatPm(stats.mean, stats.sdMean).replace(/\./g, ',')};Теория M[X];8,000`);
    lines.push(`Дисперсия D;${stats.variance.toFixed(4).replace('.', ',')};Теория D;3,500`);
    lines.push(`СКО сигма;${Core.formatPm(stats.sd, stats.sdSd).replace(/\./g, ',')};Теория сигма;1,871`);
    if (stats.chiGauss) {
      lines.push(`Критерий Пирсона хи-квадрат;${stats.chiGauss.chi2.toFixed(2).replace('.', ',')};df = ${stats.chiGauss.df};p = ${stats.chiGauss.p.toFixed(3).replace('.', ',')}`);
    }

    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `galton_lab_variant_${state.variant}.csv`;
    a.click();
  }

  // Формирование готового печатного бланка отчёта лабораторной работы по ГОСТ (C7)
  function openPrintableReport() {
    const stats = getStats();
    const prevLight = state.chartLight;
    const prevBlind = state.blindMode;
    state.chartLight = true;
    state.blindMode = false;
    drawHistogramChart(stats);
    const chartDataUrl = document.getElementById('lab-hist-canvas').toDataURL('image/png');
    state.chartLight = prevLight;
    state.blindMode = prevBlind;
    drawHistogramChart(stats);

    const win = window.open('', '_blank');
    if (!win) return;

    const rowsHtml = stats.rows.map(r => `
      <tr>
        <td><b>${r.x}</b></td>
        <td>${r.h.toFixed(1)}</td>
        <td>${r.w.toFixed(4)} ± ${r.dw.toFixed(4)}</td>
        <td>${r.xw.toFixed(4)}</td>
        <td>${(r.dev >= 0 ? '+' : '') + r.dev.toFixed(3)}</td>
        <td>${r.dev2w.toFixed(4)}</td>
        <td>${r.wGaussExp.toFixed(4)}</td>
        <td>${(r.resid >= 0 ? '+' : '') + r.resid.toFixed(2)}σ</td>
      </tr>
    `).join('');

    const cg = stats.chiGauss;

    win.document.write(`<!doctype html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <title>Протокол лабораторной работы (Вариант №${state.variant})</title>
        <style>
          body { font-family: "Times New Roman", Georgia, serif; color: #000; margin: 20px 32px; line-height: 1.4; font-size: 13.5px; }
          h1 { font-size: 18px; text-align: center; margin: 0 0 4px; text-transform: uppercase; }
          h2 { font-size: 14px; text-align: center; font-weight: normal; margin: 0 0 12px; color: #222; }
          .meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; border-bottom: 1.5px solid #000; padding-bottom: 8px; margin-bottom: 12px; font-size: 13.5px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; text-align: center; }
          th, td { border: 1px solid #000; padding: 3.5px 5px; }
          th { background: #f1f5f9; }
          tfoot td { font-weight: bold; background: #f8fafc; }
          .results { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; font-size: 13px; }
          .res-box { border: 1px solid #000; padding: 8px 12px; }
          .chart-box { text-align: center; margin: 10px 0; }
          .chart-box img { max-width: 96%; height: auto; border: 1px solid #999; }
          .concl-box { border: 1px solid #000; padding: 8px 12px; min-height: 54px; margin-top: 10px; }
          .sign-bar { display: flex; justify-content: space-between; margin-top: 18px; font-size: 13.5px; }
          @media print { .no-print { display: none; } body { margin: 8mm; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:12px;text-align:right">
          <button onclick="window.print()" style="padding:7px 16px;font-size:14px;cursor:pointer">🖨️ Печать / Сохранить в PDF</button>
        </div>
        <h1>ЛАБОРАТОРНАЯ РАБОТА ПО СТАТИСТИЧЕСКОЙ ФИЗИКЕ</h1>
        <h2>Изучение статистических закономерностей и распределения Гаусса на доске Гальтона (x<sub>i</sub> = 1 … 15)</h2>
        <div class="meta">
          <span><b>Вариант №:</b> ${state.variant}</span>
          <span><b>Студент:</b> ${state.studentMeta.name || '______________________'}</span>
          <span><b>Группа:</b> ${state.studentMeta.group || '__________'}</span>
          <span><b>Бригада:</b> ${state.studentMeta.brigade || '____'}</span>
          <span><b>Дата:</b> ${new Date().toLocaleDateString('ru-RU')}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>№ ячейки x<sub>i</sub></th>
              <th>Высота h<sub>i</sub>, мм</th>
              <th>Частота w<sub>i</sub> ± Δw<sub>i</sub></th>
              <th>x<sub>i</sub> · w<sub>i</sub></th>
              <th>x<sub>i</sub> − ⟨x⟩</th>
              <th>(x<sub>i</sub> − ⟨x⟩)<sup>2</sup> w<sub>i</sub></th>
              <th>Гаусс w<sub>теор</sub>(x<sub>i</sub>)</th>
              <th>Остаток z<sub>i</sub></th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td>Сумма (∑)</td>
              <td>H = ${stats.H.toFixed(1)} мм</td>
              <td>1.0000</td>
              <td>⟨x⟩ = ${stats.mean.toFixed(3)}</td>
              <td>0.000</td>
              <td>D = ${stats.variance.toFixed(3)}</td>
              <td>1.0000</td>
              <td>RMSE = ${stats.rmse.toFixed(4)}</td>
            </tr>
          </tfoot>
        </table>

        <div class="results">
          <div class="res-box">
            <b>Экспериментальные параметры (с погрешностями):</b><br>
            • Суммарная высота: H = ∑h<sub>i</sub> = ${stats.H.toFixed(1)} мм (N ≈ ${stats.N ? Math.round(stats.N) : '–'} шт., Δh = ${state.deltaH} мм)<br>
            • Математическое ожидание: <b>⟨x⟩ = ${Core.formatPm(stats.mean, stats.sdMean)}</b><br>
            • Дисперсия: <b>D = ${stats.variance.toFixed(3)}</b> (n<sub>эфф</sub> = ${stats.nEff.toFixed(1)} рядов)<br>
            • СКО (табличное): <b>σ = ${Core.formatPm(stats.sd, stats.sdSd)}</b><br>
            • СКО (графическое по Γ<sub>0.5</sub> = ${stats.fwhm.toFixed(2)}): <b>σ<sub>граф</sub> = ${(stats.fwhm / 2.35482).toFixed(3)}</b>
          </div>
          <div class="res-box">
            <b>Проверка статистических гипотез (n = 14 рядов, 15 ячеек):</b><br>
            • Теория (p = 0.5): M[X] = 8.000, D<sub>теор</sub> = 3.500, σ<sub>теор</sub> = 1.871<br>
            • Эффективная вероятность шага вправо: p<sub>эфф</sub> = ${stats.pEff.toFixed(4)}<br>
            • Доля в коридоре ⟨x⟩ ± 1σ: <b>${(stats.in1Sigma * 100).toFixed(1)}%</b> (эталон Гаусса 68.3%)<br>
            • Доля в коридоре ⟨x⟩ ± 2σ: <b>${(stats.in2Sigma * 100).toFixed(1)}%</b> (эталон Гаусса 95.4%)<br>
            • Критерий Пирсона (Гаусс): <b>${cg ? `χ² = ${cg.chi2.toFixed(2)} (крит. ${cg.crit.toFixed(1)}, df=${cg.df}, p=${cg.p.toFixed(3)}) — ${cg.ok ? 'Гипотеза принята' : 'Отклонена'}` : '–'}</b>
          </div>
        </div>

        <div class="chart-box">
          <img src="${chartDataUrl}" alt="Гистограмма, распределение Гаусса и график остатков">
        </div>

        <div class="concl-box">
          <b>Выводы по работе:</b><br>
          ${state.studentMeta.conclusion ? state.studentMeta.conclusion.replace(/</g, '&lt;') : '_________________________________________________________________________________________________________________'}
        </div>

        <div class="sign-bar">
          <span>Подпись студента: _______________________</span>
          <span>Проверил преподаватель: _______________________ (оценка: _______)</span>
        </div>
      </body>
      </html>`);
    win.document.close();
  }

  // Привязка всех обработчиков событий лабораторного модуля
  function bindLabEvents() {
    const panel = document.getElementById('lab-panel');
    const btnOpen = document.getElementById('btn-open-lab');
    const btnClose = document.getElementById('lab-btn-close');
    const btnDock = document.getElementById('lab-btn-dock');
    const btnRuler = document.getElementById('btn-toggle-ruler');
    const btnBlind = document.getElementById('btn-toggle-blind');

    if (btnOpen) {
      btnOpen.onclick = () => {
        panel.hidden = !panel.hidden;
        btnOpen.classList.toggle('active', !panel.hidden);
        if (!panel.hidden) renderLabUI();
      };
    }

    if (btnClose) {
      btnClose.onclick = () => {
        panel.hidden = true;
        if (btnOpen) btnOpen.classList.remove('active');
      };
    }

    if (btnDock) {
      btnDock.onclick = () => {
        state.dockMode = !state.dockMode;
        panel.classList.toggle('docked', state.dockMode);
        panel.classList.toggle('fullscreen', !state.dockMode);
        btnDock.textContent = state.dockMode ? '⇔ Развернуть' : '⇒ Компактно';
        renderLabUI();
      };
    }

    if (btnRuler) {
      btnRuler.onclick = () => {
        state.rulerOn = !state.rulerOn;
        btnRuler.classList.toggle('on', state.rulerOn);
      };
    }

    // Слепой режим теперь скрывает ответы везде: и на 3D-сцене, и в лабораторной панели (B3)
    if (btnBlind) {
      btnBlind.onclick = () => {
        state.blindMode = !state.blindMode;
        window.__blindMode = state.blindMode;
        btnBlind.classList.toggle('on', state.blindMode);
        if (state.blindMode && !state.rulerOn) {
          state.rulerOn = true;
          if (btnRuler) btnRuler.classList.add('on');
        }
        if (window.__lab && window.__lab.forceUI) {
          window.__lab.forceUI();
        }
        renderLabUI();
      };
    }

    // Индивидуальный вариант (B6)
    document.getElementById('lab-btn-load-variant').onclick = () => {
      const vInp = document.getElementById('lab-inp-variant');
      const v = Core.generateVariant(vInp ? vInp.value : 1);
      state.variant = v.variant;
      state.heights = [...v.heights];
      state.calibMode = 'N';
      state.calibN = v.N;
      state.source = 'variant';
      document.getElementById('lab-sel-calib').value = 'N';
      document.getElementById('lab-inp-calib-val').value = v.N;
      saveState();
      renderLabUI();
    };

    // Источники данных
    document.getElementById('lab-act-capture').onclick = () => captureFrom3DBoard();

    document.getElementById('lab-act-drop1000').onclick = () => {
      const lab = window.__lab;
      if (!lab) return;
      if (lab.RUN.n !== N_ROWS) lab.rows(N_ROWS);
      lab.empty();
      lab.drop(1000);
      setTimeout(() => {
        lab.time(20);
        setTimeout(() => captureFrom3DBoard(), 80);
      }, 60);
    };

    document.getElementById('lab-act-demo').onclick = () => {
      state.heights = [...DEMO_REAL_HEIGHTS];
      state.calibMode = 'N';
      state.calibN = 1000;
      document.getElementById('lab-sel-calib').value = 'N';
      document.getElementById('lab-inp-calib-val').value = 1000;
      state.source = 'demo';
      saveState();
      renderLabUI();
    };

    // Вставка из Excel / CSV (D3)
    document.getElementById('lab-act-paste').onclick = async () => {
      let text = '';
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          text = await navigator.clipboard.readText();
        }
      } catch (e) {}
      if (!text) {
        text = window.prompt('Вставьте 15 значений высот h₁…h₁₅ (через пробел, точку с запятой или перенос строки из Excel):', '');
      }
      if (text) {
        const parsed = Core.parseHeightsText(text);
        if (parsed) {
          state.heights = parsed;
          state.source = 'manual';
          saveState();
          renderLabUI();
        } else {
          window.alert('Не удалось распознать 15 неотрицательных чисел. Проверьте скопированный диапазон.');
        }
      }
    };

    document.getElementById('lab-act-clear').onclick = () => {
      state.heights = new Array(N_BINS).fill(0);
      state.manualCells = {};
      state.source = 'manual';
      saveState();
      renderLabUI();
      const firstInp = document.querySelector('.inp-hi[data-idx="0"]');
      if (firstInp) { firstInp.focus(); firstInp.select(); }
    };

    // Калибровка N / k (A1)
    const selCalib = document.getElementById('lab-sel-calib');
    const inpCalibVal = document.getElementById('lab-inp-calib-val');
    selCalib.onchange = e => {
      state.calibMode = e.target.value;
      inpCalibVal.step = state.calibMode === 'N' ? '10' : '0.1';
      inpCalibVal.value = state.calibMode === 'N' ? state.calibN : state.calibK;
      saveState();
      updateTableTotalsAndCharts();
    };
    inpCalibVal.oninput = e => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v) && v > 0) {
        if (state.calibMode === 'N') state.calibN = v;
        else state.calibK = v;
        saveState();
        updateTableTotalsAndCharts();
      }
    };

    document.getElementById('lab-chk-round').onchange = e => {
      state.roundMm = e.target.checked;
      if (state.source === '3d') captureFrom3DBoard();
    };

    document.getElementById('lab-inp-deltah').oninput = e => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v) && v > 0) {
        state.deltaH = v;
        saveState();
        updateTableTotalsAndCharts();
      }
    };

    // Режим ручного расчёта и показ всех колонок (B2, C1)
    document.getElementById('lab-chk-manual-calc').onchange = e => {
      state.manualCalcMode = e.target.checked;
      renderLabUI();
    };
    document.getElementById('lab-chk-allcols').onchange = e => {
      state.showAllCols = e.target.checked;
      renderLabUI();
    };

    // Переключение вкладок
    document.querySelectorAll('.lab-tab').forEach(tab => {
      tab.onclick = () => {
        state.activeTab = tab.dataset.tab;
        document.querySelectorAll('.lab-tab').forEach(t => t.classList.toggle('on', t === tab));
        document.querySelectorAll('.lab-pane').forEach(p => p.classList.toggle('on', p.id === `lab-pane-${state.activeTab}`));
        updateTableTotalsAndCharts();
      };
    });

    // Пресеты графика (C3)
    const applyPreset = preset => {
      state.chartPreset = preset;
      const isReport = preset === 'report';
      state.showGaussExp = true;
      state.showErrorBars = true;
      state.showGaussTheo = !isReport;
      state.showBinom = !isReport;
      state.showFWHM = !isReport;
      state.showSigmaZones = !isReport;
      state.showResiduals = !isReport;
      document.getElementById('chk-gauss-exp').checked = state.showGaussExp;
      document.getElementById('chk-err-bars').checked = state.showErrorBars;
      document.getElementById('chk-gauss-theo').checked = state.showGaussTheo;
      document.getElementById('chk-binom').checked = state.showBinom;
      document.getElementById('chk-fwhm').checked = state.showFWHM;
      document.getElementById('chk-sigma-zones').checked = state.showSigmaZones;
      document.getElementById('chk-residuals').checked = state.showResiduals;
      document.getElementById('btn-preset-report').classList.toggle('primary', isReport);
      document.getElementById('btn-preset-analysis').classList.toggle('primary', !isReport);
      drawHistogramChart(getStats());
    };
    document.getElementById('btn-preset-report').onclick = () => applyPreset('report');
    document.getElementById('btn-preset-analysis').onclick = () => applyPreset('analysis');

    const bindChk = (id, prop) => {
      const el = document.getElementById(id);
      if (el) {
        el.onchange = e => {
          state[prop] = e.target.checked;
          drawHistogramChart(getStats());
        };
      }
    };
    bindChk('chk-gauss-exp', 'showGaussExp');
    bindChk('chk-gauss-theo', 'showGaussTheo');
    bindChk('chk-binom', 'showBinom');
    bindChk('chk-fwhm', 'showFWHM');
    bindChk('chk-sigma-zones', 'showSigmaZones');
    bindChk('chk-err-bars', 'showErrorBars');
    bindChk('chk-residuals', 'showResiduals');

    document.getElementById('btn-chart-theme').onclick = e => {
      state.chartLight = !state.chartLight;
      e.target.textContent = state.chartLight ? '🌙 Тёмный фон' : '☀️ Белый фон';
      drawHistogramChart(getStats());
    };

    document.getElementById('btn-chart-save').onclick = () => {
      const canvas = document.getElementById('lab-hist-canvas');
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `galton_histogram_variant_${state.variant}.png`;
      a.click();
    };

    // Тренажёр самопроверки (с защитой в слепом режиме B3)
    document.getElementById('btn-run-check').onclick = () => checkStudentCalculations();
    document.getElementById('btn-fill-check').onclick = () => {
      if (state.blindMode) {
        window.alert('В «Слепом режиме» автоподстановка ответов отключена! Рассчитайте значения самостоятельно или выключите слепой режим.');
        return;
      }
      const stats = getStats();
      document.getElementById('chk-inp-H').value = stats.H.toFixed(1);
      document.getElementById('chk-inp-mean').value = stats.mean.toFixed(3);
      document.getElementById('chk-inp-var').value = stats.variance.toFixed(3);
      document.getElementById('chk-inp-sd').value = stats.sd.toFixed(3);
      document.getElementById('chk-inp-sdmean').value = stats.sdMean ? stats.sdMean.toFixed(4) : '';
      document.getElementById('chk-inp-fwhm').value = stats.fwhm.toFixed(2);
      checkStudentCalculations();
    };

    // Серии опытов (B5)
    document.getElementById('btn-series-add').onclick = () => {
      if (state.heights.reduce((a, b) => a + b, 0) <= 0) return;
      state.seriesList.push({ heights: [...state.heights], N: state.calibN });
      saveState();
      renderSeriesBox();
    };
    document.getElementById('btn-series-auto').onclick = () => {
      state.seriesList = [];
      for (let s = 1; s <= 4; s++) {
        const v = Core.generateVariant(state.variant * 10 + s);
        state.seriesList.push({ heights: v.heights, N: v.N });
      }
      saveState();
      renderSeriesBox();
    };
    document.getElementById('btn-series-clear').onclick = () => {
      state.seriesList = [];
      saveState();
      renderSeriesBox();
    };

    // Закон 1/√N
    document.getElementById('btn-run-fluct').onclick = () => runFluctuationExperiment();
    document.getElementById('chk-fluct-log').onchange = e => {
      state.fluctLogScale = e.target.checked;
      drawFluctChart();
    };

    // Поля студента и выводы (D2)
    ['name', 'group', 'brigade', 'conclusion'].forEach(field => {
      const el = document.getElementById(`guide-inp-${field}`);
      if (el) {
        el.addEventListener('input', e => {
          state.studentMeta[field] = e.target.value;
          saveState();
          updateStepBadges(getStats());
        });
      }
    });

    // Экспорт
    document.getElementById('btn-export-csv').onclick = () => exportCSV();
    document.getElementById('btn-export-report').onclick = () => openPrintableReport();

    // Автообновление с 3D-доски
    setInterval(() => {
      if (!panel.hidden && state.source === '3d' && document.activeElement?.tagName !== 'INPUT') {
        const lab = window.__lab;
        if (lab && lab.RUN && lab.RUN.n === N_ROWS) {
          const rawMm = lab.getHeightsMm();
          let changed = false;
          for (let i = 0; i < N_BINS; i++) {
            const v = state.roundMm ? Math.round(rawMm[i] || 0) : +(rawMm[i] || 0).toFixed(1);
            if (Math.abs(v - state.heights[i]) > 0.05) {
              state.heights[i] = v;
              changed = true;
            }
          }
          if (changed) {
            if (lab.NOWS && lab.NOWS.settled > 0) state.calibN = Math.round(lab.NOWS.settled);
            saveState();
            updateTableTotalsAndCharts();
          }
        }
      }
    }, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLabDOM);
  } else {
    initLabDOM();
  }
})();
