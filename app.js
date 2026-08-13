const SPLITS = [
  { id: 'despatx', name: 'Despatx', type: 'Split 12', kwh: 0.59 },
  { id: 'habM', name: 'Hab M', type: 'Split 9', kwh: 0.41 },
  { id: 'habI', name: 'Hab I', type: 'Split 9', kwh: 0.41 },
  { id: 'menjador', name: 'Menjador', type: 'Split 12', kwh: 0.59 }
];

const $ = id => document.getElementById(id);
const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };
const setValue = (id, value) => { const el = $(id); if (el) el.value = value; };
const toggle = (id, cls, force) => { const el = $(id); if (el) el.classList.toggle(cls, force); };
const fmtEUR = n => new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(Number.isFinite(n) ? n : 0);
const fmtKwh = n => `${(Number.isFinite(n) ? n : 0).toFixed(2).replace('.', ',')} kWh/h`;
const hourNow = () => new Date().getHours();

const state = {
  selected: new Set(JSON.parse(localStorage.getItem('selectedSplits') || '[]')),
  hours: Number(localStorage.getItem('hours') || 8),
  mode: localStorage.getItem('priceMode') || 'manual',
  manualPrice: Number(localStorage.getItem('manualPrice') || 0.096),
  token: localStorage.getItem('esiosToken') || '',
  pvpc: JSON.parse(localStorage.getItem('pvpcData') || '[]'),
  webPrice: Number(localStorage.getItem('webPrice') || NaN),
  pvpcFetchedAt: localStorage.getItem('pvpcFetchedAt') || ''
};

function saveState(){
  localStorage.setItem('selectedSplits', JSON.stringify([...state.selected]));
  localStorage.setItem('hours', String(state.hours));
  localStorage.setItem('priceMode', state.mode);
  localStorage.setItem('manualPrice', String(state.manualPrice));
  localStorage.setItem('esiosToken', state.token);
  localStorage.setItem('pvpcData', JSON.stringify(state.pvpc));
  localStorage.setItem('pvpcFetchedAt', state.pvpcFetchedAt);
  if (Number.isFinite(state.webPrice)) localStorage.setItem('webPrice', String(state.webPrice));
}

function activeConsumption(){
  return SPLITS.filter(s => state.selected.has(s.id)).reduce((sum, s) => sum + s.kwh, 0);
}

function currentPrice(){
  if (state.mode === 'web' && Number.isFinite(state.webPrice)) return state.webPrice;
  if (state.mode !== 'manual' && state.pvpc.length) {
    return state.pvpc.find(p => p.hour === hourNow())?.price ?? state.manualPrice;
  }
  return state.manualPrice;
}

function priceForOffset(offset){
  if (state.mode === 'web' && Number.isFinite(state.webPrice)) return state.webPrice;
  if (state.mode !== 'manual' && state.pvpc.length) {
    const h = (hourNow() + offset) % 24;
    return state.pvpc.find(p => p.hour === h)?.price ?? state.manualPrice;
  }
  return state.manualPrice;
}

function costForHours(hours){
  const kwh = activeConsumption();
  let total = 0;
  for (let i = 0; i < hours; i++) total += kwh * priceForOffset(i);
  return total;
}

function renderSplits(){
  const grid = $('splitGrid');
  if (!grid) return;
  grid.innerHTML = '';
  SPLITS.forEach(split => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `split-card ${state.selected.has(split.id) ? 'active' : ''}`;
    card.innerHTML = `<div class="toggle-dot" aria-hidden="true"></div><strong>${split.name}</strong><span>${split.type}</span><span>${split.kwh.toFixed(2).replace('.', ',')} kWh/h</span>`;
    card.addEventListener('click', () => {
      state.selected.has(split.id) ? state.selected.delete(split.id) : state.selected.add(split.id);
      saveState();
      render();
    });
    grid.appendChild(card);
  });
}

function renderPanels(){
  setValue('manualPrice', state.manualPrice);
  setValue('esiosToken', state.token);
  toggle('manualPanel', 'hidden', state.mode !== 'manual');
  toggle('webPanel', 'hidden', state.mode !== 'web');
  toggle('autoPanel', 'hidden', state.mode !== 'auto');
  toggle('filePanel', 'hidden', state.mode !== 'file');
  toggle('manualModeBtn', 'active', state.mode === 'manual');
  toggle('webModeBtn', 'active', state.mode === 'web');
  toggle('autoModeBtn', 'active', state.mode === 'auto');
  toggle('fileModeBtn', 'active', state.mode === 'file');
  const badge = $('liveBadge');
  if (badge) {
    const hasData = (state.mode === 'web' && Number.isFinite(state.webPrice)) || (state.mode !== 'manual' && state.pvpc.length);
    badge.className = `badge ${state.mode === 'manual' ? 'manual' : hasData ? 'live' : 'error'}`;
    badge.textContent = state.mode === 'manual' ? 'Manual' : state.mode === 'web' ? 'Web' : state.mode === 'file' ? 'Fitxer' : 'API';
  }
  const fetched = state.pvpcFetchedAt ? ` · actualitzat ${new Date(state.pvpcFetchedAt).toLocaleString('ca-ES')}` : '';
  setText('priceStatus', `${currentPrice().toFixed(5).replace('.', ',')} €/kWh${state.mode !== 'manual' ? fetched : ''}`);
}

function renderResults(){
  const kwh = activeConsumption();
  setText('activeKwh', fmtKwh(kwh));
  setText('costNow', fmtEUR(kwh * currentPrice()));
  setText('costNext', fmtEUR(costForHours(state.hours)));
  setText('costNextLabel', `Cost properes ${state.hours} h`);
  setText('hoursLabel', `${state.hours} h`);
  setText('hoursHelp', `Fes lliscar la barra per veure el cost acumulat durant ${state.hours} hores.`);
  setValue('hoursRange', state.hours);
  const activeNames = SPLITS.filter(s => state.selected.has(s.id)).map(s => s.name);
  const summary = [
    `Aires actius: ${activeNames.length ? activeNames.join(' + ') : 'cap'}`,
    `Consum: ${fmtKwh(kwh)}`,
    `Preu aquesta hora: ${currentPrice().toFixed(5).replace('.', ',')} €/kWh${state.mode === 'web' ? ' (web ESIOS actual)' : ''}`,
    `Cost aquesta hora: ${fmtEUR(kwh * currentPrice())}`,
    `Cost properes ${state.hours} h: ${fmtEUR(costForHours(state.hours))}`
  ].join('\n');
  setText('summaryBox', summary);
}

function renderHourlyTable(){
  const body = $('hourlyTable');
  if (!body) return;
  toggle('noPvpcBox', 'hidden', !!state.pvpc.length);
  if (!state.pvpc.length) {
    body.innerHTML = '<tr><td colspan="3">Sense dades PVPC carregades.</td></tr>';
    return;
  }
  const kwh = activeConsumption();
  body.innerHTML = state.pvpc.map(row => `<tr><td>${String(row.hour).padStart(2, '0')}:00</td><td>${row.price.toFixed(5).replace('.', ',')} €/kWh</td><td>${fmtEUR(kwh * row.price)}</td></tr>`).join('');
}

function render(){
  renderSplits();
  renderPanels();
  renderResults();
  renderHourlyTable();
}

function uniqueHours(rows){
  const seen = new Set();
  return rows.sort((a,b) => a.hour - b.hour).filter(r => {
    if (seen.has(r.hour)) return false;
    seen.add(r.hour);
    return true;
  });
}

function normalisePrice(value){
  let n = Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n < 1000) n = n / 1000;
  return n >= 0 && n < 2 ? n : null;
}

function parseEsiosWorkbook(buffer){
  if (typeof XLSX === 'undefined') return [];
  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const sheet = workbook.Sheets['Tabla de Datos PCB'];
    if (!sheet) return [];
    const rows = [];
    for (let row = 6; row <= 29; row++) {
      const cell = sheet[`E${row}`];
      const value = cell ? Number(String(cell.v).replace(',', '.')) : NaN;
      if (Number.isFinite(value)) rows.push({ hour: row - 6, price: value / 1000 });
    }
    return rows.length === 24 ? rows : uniqueHours(rows);
  } catch (err) {
    console.warn('Error llegint XLS ESIOS', err);
    return [];
  }
}

function decodeText(buffer){
  for (const enc of ['utf-8', 'windows-1252', 'iso-8859-1']) {
    try { return new TextDecoder(enc).decode(buffer); } catch {}
  }
  return '';
}

function parseTextPrices(text){
  const rows = [];
  text.replace(/\r/g, '').split('\n').forEach(line => {
    const time = line.match(/\b([01]?\d|2[0-3])(?::|\.)([0-5]\d)\b|\b([01]?\d|2[0-3])\s*h\b/i);
    if (!time) return;
    const hour = Number(time[1] ?? time[3]);
    const nums = line.match(/-?\d+(?:[\.,]\d+)?/g) || [];
    const price = nums.map(normalisePrice).filter(v => v !== null).pop();
    if (Number.isFinite(hour) && price !== undefined) rows.push({ hour, price });
  });
  return uniqueHours(rows);
}

async function handleFile(event){
  const file = event.target.files?.[0];
  if (!file) return;
  const buffer = await file.arrayBuffer();
  const name = (file.name || '').toLowerCase();
  let parsed = [];
  if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
    parsed = parseEsiosWorkbook(buffer);
    if (!parsed.length && typeof XLSX === 'undefined') {
      alert('No s’ha carregat la llibreria per llegir XLS. Recarrega la pàgina amb connexió i torna-ho a provar.');
      return;
    }
  }
  if (!parsed.length) parsed = parseTextPrices(decodeText(buffer));
  if (!parsed.length) {
    alert('No he pogut detectar preus horaris. El fitxer correcte és el PVPC “Desglose” d’ESIOS.');
    return;
  }
  state.pvpc = parsed;
  state.webPrice = NaN;
  localStorage.removeItem('webPrice');
  state.pvpcFetchedAt = new Date().toISOString();
  state.mode = 'file';
  saveState();
  render();
}

function parseEsiosScreenPrice(text){
  const compact = text.replace(/\r/g, '').replace(/<[^>]+>/g, '\n');
  const match = compact.match(/Península,\s*Baleares\s*y\s*Canarias[\s\S]{0,260}?([0-9]+(?:[\.,][0-9]+)?)\s*€\/kWh/i);
  if (!match) return null;
  const price = Number(match[1].replace(',', '.'));
  return Number.isFinite(price) ? price : null;
}

async function fetchEsiosScreenPrice(){
  const urls = ['https://www.esios.ree.es/es/pvpc', 'https://r.jina.ai/https://www.esios.ree.es/es/pvpc'];
  let lastError = null;
  const btn = $('fetchWebPriceBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Consultant...'; }
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const price = parseEsiosScreenPrice(await res.text());
      if (price === null) throw new Error('preu no trobat');
      state.webPrice = price;
      state.pvpc = [{ hour: hourNow(), price }];
      state.pvpcFetchedAt = new Date().toISOString();
      state.mode = 'web';
      saveState();
      render();
      if (btn) { btn.disabled = false; btn.textContent = 'Consulta preu web ESIOS'; }
      return;
    } catch (err) { lastError = err; }
  }
  console.error(lastError);
  if (btn) { btn.disabled = false; btn.textContent = 'Consulta preu web ESIOS'; }
  alert('No he pogut llegir el preu visible d’ESIOS. Pots usar Manual o Fitxer.');
}

async function fetchPVPC(){
  state.token = ($('esiosToken')?.value || '').trim();
  if (!state.token) { alert('Cal un token personal ESIOS.'); return; }
  const d = new Date();
  if ($('useTomorrow')?.checked) d.setDate(d.getDate() + 1);
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  const endpoint = `https://api.esios.ree.es/indicators/1001?start_date=${encodeURIComponent(`${y}-${m}-${day}T00:00:00`)}&end_date=${encodeURIComponent(`${y}-${m}-${day}T23:59:59`)}&geo_ids[]=8741`;
  const btn = $('fetchPvpcBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Actualitzant...'; }
  try {
    const res = await fetch(endpoint, { headers: { 'Accept':'application/json; application/vnd.esios-api-v1+json', 'Content-Type':'application/json', 'Authorization':`Token token="${state.token}"` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rows = (data?.indicator?.values || []).map(v => ({ hour: new Date(v.datetime).getHours(), price: normalisePrice(v.value) })).filter(v => Number.isFinite(v.hour) && v.price !== null);
    if (!rows.length) throw new Error('sense dades');
    state.pvpc = uniqueHours(rows);
    state.webPrice = NaN;
    localStorage.removeItem('webPrice');
    state.pvpcFetchedAt = new Date().toISOString();
    state.mode = 'auto';
    saveState();
    render();
  } catch (err) {
    console.error(err);
    alert('No he pogut descarregar el PVPC per API. Pots usar Manual, Web ESIOS o Fitxer.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Actualitza'; }
  }
}

function wireEvents(){
  on('manualModeBtn', 'click', () => { state.mode = 'manual'; saveState(); render(); });
  on('webModeBtn', 'click', () => { state.mode = 'web'; saveState(); render(); });
  on('autoModeBtn', 'click', () => { state.mode = 'auto'; saveState(); render(); });
  on('fileModeBtn', 'click', () => { state.mode = 'file'; saveState(); render(); });
  on('fetchWebPriceBtn', 'click', fetchEsiosScreenPrice);
  on('fetchPvpcBtn', 'click', fetchPVPC);
  on('pvpcFile', 'change', handleFile);
  on('clearPvpcBtn', 'click', () => { state.pvpc = []; state.webPrice = NaN; localStorage.removeItem('webPrice'); state.pvpcFetchedAt = ''; saveState(); render(); });
  on('saveManualPrice', 'click', () => {
    const v = Number(String($('manualPrice')?.value ?? state.manualPrice).replace(',', '.'));
    if (!Number.isFinite(v) || v < 0) { alert('Preu no vàlid.'); return; }
    state.manualPrice = v;
    saveState();
    render();
  });
  on('hoursRange', 'input', e => { state.hours = Number(e.target.value); saveState(); render(); });
  on('copySummaryBtn', 'click', async () => {
    try {
      await navigator.clipboard.writeText($('summaryBox')?.textContent || '');
      const btn = $('copySummaryBtn');
      if (btn) { btn.textContent = 'Copiat!'; setTimeout(() => btn.textContent = 'Copia resum', 1200); }
    } catch { alert('No he pogut copiar el resum.'); }
  });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; toggle('installBtn', 'hidden', false); });
on('installBtn', 'click', async () => { if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; toggle('installBtn', 'hidden', true); } });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
}

wireEvents();
render();
