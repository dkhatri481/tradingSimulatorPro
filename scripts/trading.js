// ============================================================
//  TRADING – Buy/Sell, Portfolio, Orders, UI Rendering
// ============================================================

// ---------- TRADE PANEL ----------
function updateTradeTotal() {
  const qty = parseInt(document.getElementById('tradeQty').value) || 0;
  const marketPrice = state.livePrices[state.selected] || 0;
  const orderType = document.getElementById('orderType').value;
  const limitPrice = Number(document.getElementById('limitPrice').value);
  const price = orderType === 'limit' && limitPrice > 0 ? limitPrice : marketPrice;
  const total = qty * price;
  const currency = state.stockData[state.selected]?.currency || 'USD';
  document.getElementById('tradeTotal').textContent = fmtPrice(total, currency);
  return total;
}

function setOrderType(type) {
  const limitGroup = document.getElementById('limitPriceGroup');
  const limitInput = document.getElementById('limitPrice');
  const marketPrice = state.livePrices[state.selected] || 0;
  limitGroup.style.display = type === 'limit' ? 'block' : 'none';
  if (type === 'limit' && marketPrice > 0 && (!limitInput.value || Number(limitInput.value) <= 0)) {
    limitInput.value = marketPrice.toFixed(2);
  }
  updateTradeTotal();
}

let tradeMsgTimer;
function showTradeMsg(msg, type) {
  const el = document.getElementById('tradeMsg');
  el.textContent = msg;
  el.className = 'trade-msg ' + type;
  clearTimeout(tradeMsgTimer);
  tradeMsgTimer = setTimeout(() => { el.className = 'trade-msg'; }, 5000);
}

function openTradeDialog(type, sym) {
  if (sym) selectStock(sym);
  state.dialogAction = type;
  const symbol = state.selected;
  const price = state.livePrices[symbol] || 0;
  document.getElementById('dialogAction').textContent = type === 'buy' ? 'Buy' : 'Sell';
  document.getElementById('dialogSymbol').textContent = symbol;
  document.getElementById('dialogMarketPrice').textContent = fmtPrice(price, state.stockData[symbol]?.currency);
  const posQty = state.portfolio[symbol] ? state.portfolio[symbol].qty : 0;
  document.getElementById('dialogQty').value = type === 'sell' && posQty > 0 ? posQty : 1;
  document.getElementById('dialogOrderType').value = 'market';
  document.getElementById('dialogLimitPrice').value = price > 0 ? price.toFixed(2) : '';
  document.getElementById('dialogStopLoss').value = '';
  document.getElementById('dialogSubmit').className = 'trade-btn ' + type + ' dialog-submit';
  document.getElementById('dialogSubmit').textContent = 'Execute ' + (type === 'buy' ? 'Buy' : 'Sell');
  updateDialogFields();
  const dialog = document.getElementById('tradeDialog');
  dialog.classList.add('open');
  dialog.setAttribute('aria-hidden', 'false');
  document.getElementById('dialogQty').focus();
}

function closeTradeDialog() {
  const dialog = document.getElementById('tradeDialog');
  dialog.classList.remove('open');
  dialog.setAttribute('aria-hidden', 'true');
}

function updateDialogFields() {
  const type = document.getElementById('dialogOrderType').value;
  document.getElementById('dialogLimitGroup').hidden = type !== 'limit';
  const symbol = state.selected;
  const price = type === 'limit' ? Number(document.getElementById('dialogLimitPrice').value) : state.livePrices[symbol];
  const qty = Number(document.getElementById('dialogQty').value) || 0;
  document.getElementById('dialogTotal').textContent = fmtPrice(qty * price, state.stockData[symbol]?.currency);
  document.getElementById('dialogHint').textContent = type === 'limit'
    ? (state.dialogAction === 'buy' ? 'Buy limit must be at or above the current market to fill now.' : 'Sell limit must be at or below the current market to fill now.')
    : 'The trade executes at the current market price.';
}

function submitTradeDialog(event) {
  event.preventDefault();
  const type = state.dialogAction;
  const sym = state.selected;
  const qty = Number(document.getElementById('dialogQty').value);
  const marketPrice = state.livePrices[sym];
  const orderType = document.getElementById('dialogOrderType').value;
  const limitPrice = Number(document.getElementById('dialogLimitPrice').value);
  const stopLoss = Number(document.getElementById('dialogStopLoss').value);
  if (!Number.isInteger(qty) || qty <= 0) return showTradeMsg('Enter a whole quantity', 'error');
  if (!marketPrice || marketPrice <= 0) return showTradeMsg('Price not available', 'error');
  if (orderType === 'limit' && (!Number.isFinite(limitPrice) || limitPrice <= 0)) return showTradeMsg('Enter a valid limit price', 'error');
  if (orderType === 'limit' && ((type === 'buy' && limitPrice < marketPrice) || (type === 'sell' && limitPrice > marketPrice))) {
    return showTradeMsg('Limit order is not executable at the current market price', 'error');
  }
  if (Number.isFinite(stopLoss) && stopLoss > 0 && ((type === 'buy' && stopLoss >= (orderType === 'limit' ? limitPrice : marketPrice)) || (type === 'sell' && stopLoss <= (orderType === 'limit' ? limitPrice : marketPrice)))) {
    return showTradeMsg(type === 'buy' ? 'Buy stop-loss must be below entry price' : 'Sell stop-loss must be above entry price', 'error');
  }
  const oldQty = document.getElementById('tradeQty').value;
  const oldOrder = document.getElementById('orderType').value;
  const oldLimit = document.getElementById('limitPrice').value;
  document.getElementById('tradeQty').value = qty;
  document.getElementById('orderType').value = orderType;
  document.getElementById('limitPrice').value = orderType === 'limit' ? limitPrice : '';
  executeTrade(type, { stopLoss });
  document.getElementById('tradeQty').value = oldQty;
  document.getElementById('orderType').value = oldOrder;
  document.getElementById('limitPrice').value = oldLimit;
  closeTradeDialog();
}

function executeTrade(type, options = {}) {
  const qtyInput = document.getElementById('tradeQty');
  const qty = parseInt(qtyInput.value) || 0;
  if (qty <= 0) {
    showTradeMsg('Enter a valid quantity', 'error');
    return;
  }
  const sym = state.selected;
  const marketPrice = state.livePrices[sym];
  if (!marketPrice || marketPrice <= 0) {
    showTradeMsg('Price not available', 'error');
    return;
  }
  const orderType = document.getElementById('orderType').value;
  const limitPrice = Number(document.getElementById('limitPrice').value);
  if (orderType === 'limit') {
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
      showTradeMsg('Enter a valid limit price', 'error');
      return;
    }
    const executable = type === 'buy' ? limitPrice >= marketPrice : limitPrice <= marketPrice;
    if (!executable) {
      showTradeMsg(`Limit order not filled. Market is ${fmtCompact(marketPrice)}`, 'error');
      return;
    }
  }
  const price = orderType === 'limit' ? limitPrice : marketPrice;
  const total = qty * price;
  const currency = state.stockData[sym]?.currency || 'USD';
  const totalInAccountCurrency = toAccountCurrency(total, currency);

  if (type === 'buy') {
    if (totalInAccountCurrency > state.balance) {
      showTradeMsg(`Insufficient balance! Need ${fmtPrice(total, currency)}`, 'error');
      return;
    }
    state.balance -= totalInAccountCurrency;
    if (!state.portfolio[sym]) state.portfolio[sym] = { qty: 0, avg: 0, invested: 0 };
    const p = state.portfolio[sym];
    const previousQty = p.qty;
    p.qty += qty;
    p.invested += totalInAccountCurrency;
    p.avg = ((p.avg * previousQty) + (price * qty)) / p.qty;
    p.avgNative = p.avg;
    if (options.stopLoss > 0) p.stopLoss = options.stopLoss;
    showTradeMsg(`✅ Bought ${qty} ${sym} @ ${fmtCompact(price)}`, 'success');
  } else {
    if (!state.portfolio[sym] || state.portfolio[sym].qty < qty) {
      showTradeMsg(`❌ Not enough shares. You have ${state.portfolio[sym]?.qty || 0} ${sym}`, 'error');
      return;
    }
    const p = state.portfolio[sym];
    const sellVal = qty * price;
    const sellValInAccountCurrency = toAccountCurrency(sellVal, currency);
    const cost = qty * p.avg;
    const costInAccountCurrency = toAccountCurrency(cost, currency);
    const pl = sellValInAccountCurrency - costInAccountCurrency;
    state.dayPnL += pl;
    state.balance += sellValInAccountCurrency;
    p.qty -= qty;
    p.invested -= costInAccountCurrency;
    p.avgNative = p.avg;
    if (options.stopLoss > 0) p.stopLoss = options.stopLoss;
    if (p.qty === 0) delete state.portfolio[sym];
    const sign = pl >= 0 ? '+' : '';
    showTradeMsg(`✅ Sold ${qty} ${sym} @ ${fmtCompact(price)}  |  P&L: ${sign}${fmtCompact(pl)}`, pl >= 0 ? 'success' : 'error');
  }

  state.orders.unshift({
    time: new Date().toLocaleTimeString('en-US', { hour12: false }),
    sym,
    type: type.toUpperCase(),
    qty,
    price,
    total
  });
  if (state.orders.length > 50) state.orders.pop();

  // Keep the quantity user entered – DO NOT reset to 1
  // Only reset limit price to market if limit order
  if (orderType === 'limit') document.getElementById('limitPrice').value = marketPrice.toFixed(2);
  updateTradeTotal();
  updateStats();
  renderPositions();
  renderHoldings();
  renderOrders();
  saveState();
}

// ---------- SIDEBAR & FILTERS ----------
function getChange(sym) {
  const c = getCandles(sym, '1d');
  if (c.length < 2) return 0;
  const prev = c[c.length - 2].Close;
  const curr = c[c.length - 1].Close;
  return ((curr - prev) / prev) * 100;
}

function renderStockList() {
  const el = document.getElementById('stockList');
  el.innerHTML = '';
  const q = (document.getElementById('stockSearch').value || '').trim().toLowerCase();
  let list = Object.keys(state.stockData).map(sym => ({
    sym,
    name: state.stockData[sym].name,
    currency: state.stockData[sym].currency,
    price: state.livePrices[sym] || 0,
    change: getChange(sym)
  }));
  if (state.tab === 'india') list = list.filter(s => s.sym.endsWith('.NS'));
  else if (state.tab === 'us') list = list.filter(s => !s.sym.endsWith('.NS') && !s.sym.endsWith('-USD'));
  else if (state.tab === 'crypto') list = list.filter(s => s.sym.endsWith('-USD'));
  if (q) {
    list = list.filter(s =>
      s.sym.toLowerCase().includes(q) ||
      String(s.name || '').toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  list.forEach(s => {
    const div = document.createElement('div');
    div.className = 'stock-item' + (s.sym === state.selected ? ' active' : '');
    div.onclick = () => selectStock(s.sym);
    const chClass = s.change >= 0 ? 'up' : 'down',
          chSign = s.change >= 0 ? '+' : '';
    div.innerHTML = `
      <div class="stock-info">
        <span class="stock-symbol">${s.sym}</span>
        <span class="stock-name">${s.name}</span>
      </div>
      <div class="stock-actions">
        <button class="quick-trade quick-buy" onclick="event.stopPropagation(); openTradeDialog('buy', '${s.sym}')">B</button>
        <button class="quick-trade quick-sell" onclick="event.stopPropagation(); openTradeDialog('sell', '${s.sym}')">S</button>
      </div>
      <div class="stock-price">
        <span class="stock-price-val">${fmtPrice(s.price, s.currency)}</span>
        <span class="stock-change ${chClass}">${chSign}${s.change.toFixed(2)}%</span>
      </div>
    `;
    el.appendChild(div);
  });
}

function selectStock(sym) {
  state.selected = sym;
  renderStockList();
  const info = state.stockData[sym];
  if (!info) return;
  document.getElementById('chartSymbol').textContent = sym;
  document.getElementById('chartName').textContent = info.name;
  updateOHLC(sym);
  updateTradeTotal();
  drawCandlestickChart(sym, state.currentTimeframe);
  refreshMarketData(sym, state.currentTimeframe).then(loaded => {
    if (loaded && state.selected === sym) {
      updateOHLC(sym);
      updateTradeTotal();
      drawCandlestickChart(sym, state.currentTimeframe);
      renderStockList();
    }
  });
}

function filterStocks() { renderStockList(); }

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  renderStockList();
}

// ---------- STATS & BOTTOM PANELS ----------
function updateStats() {
  let portVal = 0, totalPL = 0;
  Object.entries(state.portfolio).forEach(([sym, p]) => {
    if (p.qty > 0 && state.livePrices[sym]) {
        const currency = state.stockData[sym]?.currency || 'USD';
        const cv = toAccountCurrency(p.qty * state.livePrices[sym], currency);
        portVal += cv;
        totalPL += cv - p.invested;
    }
  });
  document.getElementById('statBalance').textContent = fmtPrice(state.balance, 'USD');
  document.getElementById('statPortfolio').textContent = fmtPrice(portVal, 'USD');
  const plTotal = totalPL + (state.balance - 100000);
  const plEl = document.getElementById('statPnL');
  plEl.textContent = (plTotal >= 0 ? '+' : '') + fmtCompact(plTotal);
  plEl.className = 'value ' + (plTotal >= 0 ? 'green' : 'red');
  const dayEl = document.getElementById('statDayPnL');
  dayEl.textContent = (state.dayPnL >= 0 ? '+' : '') + fmtCompact(state.dayPnL);
  dayEl.className = 'value ' + (state.dayPnL >= 0 ? 'green' : 'red');
}

function renderPositions() {
  const tb = document.getElementById('posTable');
  tb.innerHTML = '';
  let c = 0;
  Object.entries(state.portfolio).forEach(([sym, p]) => {
    if (!p.qty) return;
    c++;
    const ltp = state.livePrices[sym] || 0;
    const currency = state.stockData[sym]?.currency || 'USD';
    const pl = (ltp - p.avg) * p.qty;
    const cls = pl >= 0 ? 'green' : 'red';
    const sg = pl >= 0 ? '+' : '';
    tb.innerHTML += `<tr>
      <td><strong>${sym}</strong></td>
      <td class="text-right">${p.qty}</td>
      <td class="text-right">${fmtCompact(p.avg)}</td>
      <td class="text-right">${fmtCompact(ltp)}</td>
      <td class="text-right ${cls}">${sg}${fmtCompact(pl)}</td>
    </tr>`;
  });
  if (!c) tb.innerHTML = '<tr><td colspan="5" class="empty-state">No positions</td></tr>';
  document.getElementById('posCount').textContent = '(' + c + ')';
}

function renderHoldings() {
  const tb = document.getElementById('holdTable');
  tb.innerHTML = '';
  let c = 0;
  Object.entries(state.portfolio).forEach(([sym, p]) => {
    if (!p.qty) return;
    c++;
    const currency = state.stockData[sym]?.currency || 'USD';
    const avgPrice = p.avg;
    const investedNative = p.qty * avgPrice;
    const cv = p.qty * (state.livePrices[sym] || 0);
    const pl = cv - investedNative;
    const cls = pl >= 0 ? 'green' : 'red';
    const sg = pl >= 0 ? '+' : '';
    tb.innerHTML += `<tr>
      <td><strong>${sym}</strong></td>
      <td class="text-right">${p.qty}</td>
      <td class="text-right">${fmtCompact(avgPrice)}</td>
      <td class="text-right">${fmtCompact(investedNative)}</td>
      <td class="text-right">${fmtCompact(cv)}</td>
      <td class="text-right ${cls}">${sg}${fmtCompact(pl)}</td>
    </tr>`;
  });
  if (!c) tb.innerHTML = '<tr><td colspan="6" class="empty-state">No holdings</td></tr>';
  document.getElementById('holdCount').textContent = '(' + c + ')';
}

function renderOrders() {
  const tb = document.getElementById('orderTable');
  tb.innerHTML = '';
  if (!state.orders.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty-state">No orders</td></tr>';
    return;
  }
  state.orders.forEach(o => {
    tb.innerHTML += `<tr>
      <td style="color:var(--text3);font-size:10px;">${o.time}</td>
      <td><strong>${o.sym}</strong></td>
      <td><span class="badge ${o.type.toLowerCase()}">${o.type}</span></td>
      <td class="text-right">${o.qty}</td>
      <td class="text-right">${fmtCompact(o.price)}</td>
      <td class="text-right">${fmtCompact(o.total)}</td>
    </tr>`;
  });
}