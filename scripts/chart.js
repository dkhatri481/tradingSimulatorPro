// ============================================================
//  CHART – Candlestick, OHLC, Timeframes, Indicators
// ============================================================

function updateOHLC(sym) {
  const data = state.stockData[sym];
  const candles = getCandles(sym, state.currentTimeframe);
  if (!data || !candles.length) {
    ['ohlcO', 'ohlcH', 'ohlcL', 'ohlcC', 'ohlcV', 'chartCurrentPrice'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
    const chEl = document.getElementById('chartChange');
    chEl.textContent = '';
    chEl.className = 'change';
    return;
  }
  const last = candles[candles.length - 1];
  const prevClose = candles.length >= 2 ? candles[candles.length - 2].Close : last.Open;
  const livePrice = Number(state.livePrices[sym]);
  const currentPrice = Number.isFinite(livePrice) && livePrice > 0 ? livePrice : last.Close;
  const change = ((currentPrice - prevClose) / prevClose) * 100;
  document.getElementById('ohlcO').textContent = fmtCompact(last.Open);
  document.getElementById('ohlcH').textContent = fmtCompact(last.High);
  document.getElementById('ohlcL').textContent = fmtCompact(last.Low);
  document.getElementById('ohlcC').textContent = fmtCompact(last.Close);
  document.getElementById('ohlcV').textContent = fmtVol(last.Volume);
  document.getElementById('chartCurrentPrice').textContent = fmtPrice(currentPrice, data.currency);
  const chEl = document.getElementById('chartChange');
  chEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
  chEl.className = 'change ' + (change >= 0 ? 'up' : 'down');
}

function drawCandlestickChart(sym, timeframe) {
  const svg = document.getElementById('candleChart');
  const data = state.stockData[sym];
  const allCandles = getCandles(sym, timeframe);
  if (!data || !allCandles.length) {
    setChartStatus('Loading Yahoo Finance data...');
    return;
  }
  const limit = CANDLE_LIMITS[timeframe] || 240;
  const candles = allCandles.slice(-Math.min(limit, allCandles.length));

  const container = document.getElementById('chartContainer');
  const w = container.clientWidth || 800;
  const h = container.clientHeight || 400;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  const margin = { top: 12, right: 62, bottom: 28, left: 18 };
  const cw = w - margin.left - margin.right;
  const ch = h - margin.top - margin.bottom;

  const rawMax = Math.max(...candles.map(d => d.High));
  const rawMin = Math.min(...candles.map(d => d.Low));
  const rawRange = rawMax - rawMin || Math.max(rawMax * 0.01, 1);
  const padding = rawRange * 0.06;
  const maxH = rawMax + padding;
  const minL = Math.max(0, rawMin - padding);
  const range = maxH - minL;
  const volMax = Math.max(...candles.map(d => d.Volume)) || 1;

  const showVol = state.showVolume !== false;
  const volH = showVol ? ch * 0.18 : 0;
  const priceH = ch - volH - (showVol ? 4 : 0);
  const gap = cw / candles.length;
  const candleW = Math.max(2, Math.min(gap * 0.65, 12));

  let html = '';

  for (let i = 0; i <= 4; i++) {
    const y = margin.top + (priceH * i / 4);
    const price = maxH - (range * i / 4);
    html += `<line x1="${margin.left}" y1="${y}" x2="${w - margin.right}" y2="${y}" stroke="#1c2533" stroke-width="0.6"/>`;
    html += `<text x="${w - margin.right + 8}" y="${y + 3}" fill="#aebbd0" font-size="9" text-anchor="start" font-family="monospace">${fmtCompact(price)}</text>`;
  }

  for (let i = 0; i < candles.length; i++) {
    const d = candles[i];
    const x = margin.left + i * gap + gap / 2;
    const yH = margin.top + ((maxH - d.High) / range) * priceH;
    const yL = margin.top + ((maxH - d.Low) / range) * priceH;
    const yO = margin.top + ((maxH - d.Open) / range) * priceH;
    const yC = margin.top + ((maxH - d.Close) / range) * priceH;
    const isGreen = d.Close >= d.Open;
    const color = isGreen ? '#26c281' : '#f0625c';
    const bodyTop = Math.min(yO, yC);
    const bodyH = Math.max(1, Math.abs(yO - yC));

    html += `<line x1="${x}" y1="${yH}" x2="${x}" y2="${yL}" stroke="${color}" stroke-width="0.8"/>`;
    html += `<rect x="${x - candleW/2}" y="${bodyTop}" width="${candleW}" height="${bodyH}" fill="${color}" rx="1"/>`;

    if (showVol) {
      const vH2 = (d.Volume / volMax) * volH;
      const vY2 = margin.top + priceH + 4 + (volH - vH2);
      const vc = isGreen ? 'rgba(38,194,129,0.25)' : 'rgba(240,98,92,0.25)';
      html += `<rect x="${x - candleW/2}" y="${vY2}" width="${candleW}" height="${vH2}" fill="${vc}"/>`;
    }
  }

  if (state.showMA && candles.length >= 2) {
    const period = Math.min(20, candles.length);
    let pts = '';
    for (let i = period - 1; i < candles.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += candles[j].Close;
      const ma = sum / period;
      const x = margin.left + i * gap + gap / 2;
      const y = margin.top + ((maxH - ma) / range) * priceH;
      pts += (i === period - 1 ? 'M' : 'L') + x + ',' + y;
    }
    html += `<path d="${pts}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.95"/>`;
  }

  const step = Math.max(1, Math.floor(candles.length / 8));
  for (let i = 0; i < candles.length; i += step) {
    const x = margin.left + i * gap + gap / 2;
    const label = formatChartDate(candles[i].Date, timeframe);
    html += `<text x="${x}" y="${h - 6}" fill="#5a6a82" font-size="9" text-anchor="middle" font-family="monospace">${label}</text>`;
  }
  const lastIdx = candles.length - 1;
  const lx = margin.left + lastIdx * gap + gap / 2;
  const llab = formatChartDate(candles[lastIdx].Date, timeframe);
  html += `<text x="${lx}" y="${h - 6}" fill="#5a6a82" font-size="9" text-anchor="middle" font-family="monospace">${llab}</text>`;

  svg.innerHTML = html;

  container.onmousemove = (e) => {
    const r = container.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    if (mx < margin.left || mx > w - margin.right || my < margin.top || my > h - margin.bottom) {
      document.getElementById('crosshairV').style.display = 'none';
      document.getElementById('crosshairH').style.display = 'none';
      document.getElementById('chartTooltip').style.display = 'none';
      return;
    }
    const idx = Math.floor((mx - margin.left) / gap);
    if (idx >= 0 && idx < candles.length) {
      const d = candles[idx];
      const cx = margin.left + idx * gap + gap / 2;
      document.getElementById('crosshairV').style.display = 'block';
      document.getElementById('crosshairV').style.left = cx + 'px';
      document.getElementById('crosshairH').style.display = 'block';
      const clampedY = Math.min(Math.max(my, margin.top), h - margin.bottom);
      document.getElementById('crosshairH').style.top = clampedY + 'px';
      const tt = document.getElementById('chartTooltip');
      tt.style.display = 'block';
      let ttLeft = Math.min(mx + 12, w - 180);
      let ttTop = Math.max(10, Math.min(my - 40, h - 100));
      if (ttLeft + 180 > w) ttLeft = w - 180;
      if (ttTop + 80 > h) ttTop = h - 80;
      tt.style.left = ttLeft + 'px';
      tt.style.top = ttTop + 'px';
      tt.innerHTML = `
        <div class="tt-date">${formatTooltipDate(d.Date)}</div>
        <div class="tt-row"><span class="tt-label">O</span><span class="tt-val">${fmtCompact(d.Open)}</span></div>
        <div class="tt-row"><span class="tt-label">H</span><span class="tt-val">${fmtCompact(d.High)}</span></div>
        <div class="tt-row"><span class="tt-label">L</span><span class="tt-val">${fmtCompact(d.Low)}</span></div>
        <div class="tt-row"><span class="tt-label">C</span><span class="tt-val">${fmtCompact(d.Close)}</span></div>
        <div class="tt-row" style="border-top:1px solid var(--border);padding-top:4px;margin-top:4px;">
          <span class="tt-label">Vol</span><span class="tt-val">${fmtVol(d.Volume)}</span>
        </div>
      `;
    }
  };
  container.onmouseleave = () => {
    document.getElementById('crosshairV').style.display = 'none';
    document.getElementById('crosshairH').style.display = 'none';
    document.getElementById('chartTooltip').style.display = 'none';
  };
}

function setChartStatus(message) {
  const svg = document.getElementById('candleChart');
  svg.replaceChildren();
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '50%');
  text.setAttribute('y', '50%');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('fill', '#aebbd0');
  text.setAttribute('font-size', '14');
  text.setAttribute('font-family', 'system-ui');
  text.textContent = message;
  svg.appendChild(text);
}

function formatChartDate(value, timeframe) {
  if (!value) return '';
  const date = new Date(value);
  if (timeframe === '1d' || timeframe === '4h') return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatTooltipDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function updateTimeframeButtons(timeframe) {
  document.querySelectorAll('.timeframes .tf-btn').forEach(button => {
    button.classList.toggle('active', button.id === 'tf-' + timeframe.toUpperCase());
  });
}

function setTimeframe(tf) {
  if (!FETCH_CONFIG[tf]) return;
  state.currentTimeframe = tf;
  updateTimeframeButtons(tf);
  if (state.selected) {
    const symbol = state.selected;
    updateOHLC(state.selected);
    drawCandlestickChart(state.selected, tf);
    refreshMarketData(symbol, tf).then(loaded => {
      if (loaded && state.selected === symbol && state.currentTimeframe === tf) {
        renderMarketData(symbol, tf);
      } else if (!loaded && state.selected === symbol && state.currentTimeframe === tf) {
        showMarketDataError(symbol, tf);
      }
    });
  }
}

function toggleIndicator(type) {
  if (type === 'volume') {
    state.showVolume = !state.showVolume;
    document.getElementById('ind-vol').classList.toggle('active');
  }
  if (type === 'ma') {
    state.showMA = !state.showMA;
    document.getElementById('ind-ma').classList.toggle('active');
  }
  if (state.selected) drawCandlestickChart(state.selected, state.currentTimeframe);
}