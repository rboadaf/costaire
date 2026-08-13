const SPLITS = [
  { id: 'despatx', name: 'Despatx', type: 'Split 12', kwh: 0.59 },
  { id: 'habM', name: 'Hab M', type: 'Split 9', kwh: 0.41 },
  { id: 'habI', name: 'Hab I', type: 'Split 9', kwh: 0.41 },
  { id: 'menjador', name: 'Menjador', type: 'Split 12', kwh: 0.59 }
];

const state = {
  selected: new Set(JSON.parse(localStorage.getItem('selectedSplits') || '[]')),
  hours: Number(localStorage.getItem('hours') || 8),
  mode: localStorage.getItem('priceMode') || 'manual',
  manualPrice: Number(localStorage.getItem('manualPrice') || 0.096),
  token: localStorage.getItem('esiosToken') || '',
  pvpc: JSON.parse(localStorage.getItem('pvpcData') || '[]'),
  pvpcFetchedAt: localStorage.getItem('pvpcFetchedAt') || '',
  protectedMode: localStorage.getItem('protectedMode') || 'peninsula'
};

const $ = (id) => document.getElementById(id);
const fmtCurrency = (n) => new Intl.NumberFormat('ca-ES', { style:'currency', currency:'EUR', minimumFractionDigits:2, maximumFractionDigits:3 }).format(Number.isFinite(n) ? n : 0);
const fmtKwh = (n) => `${(Number.isFinite(n) ? n : 0).toFixed(2).replace('.', ',')} kWh/h`;
const nowHour = () => new Date().getHours();

function saveState(){
  localStorage.setItem('selectedSplits', JSON.stringify([...state.selected]));
  localStorage.setItem('hours', String(state.hours));
  localStorage.setItem('priceMode', state.mode);
  localStorage.setItem('manualPrice', String(state.manualPrice));
  localStorage.setItem('esiosToken', state.token);
  localStorage.setItem('pvpcData', JSON.stringify(state.pvpc));
  localStorage.setItem('pvpcFetchedAt', state.pvpcFetchedAt);
  localStorage.setItem('protectedMode', state.protectedMode);
}

function activeConsumption(){ return SPLITS.filter(s => state.selected.has(s.id)).reduce((sum, s) => sum + s.kwh, 0); }
function currentPrice(){
  if(state.mode !== 'manual' && state.pvpc.length){
    const h = nowHour();
    return state.pvpc.find(p => p.hour === h)?.price ?? state.manualPrice;
  }
  return state.manualPrice;
}
function priceForOffset(offset){
  if(state.mode !== 'manual' && state.pvpc.length){
    const h = (nowHour() + offset) % 24;
    return state.pvpc.find(p => p.hour === h)?.price ?? state.manualPrice;
  }
  return state.manualPrice;
}
function costForHours(hours){
  const kwh = activeConsumption();
  let total = 0;
  for(let i = 0; i < hours; i++) total += kwh * priceForOffset(i);
  return total;
}

function renderSplits(){
  const grid = $('splitGrid');
  grid.innerHTML = '';
  SPLITS.forEach(split => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `split-card ${state.selected.has(split.id) ? 'active' : ''}`;
    card.innerHTML = `<div class="toggle-dot" aria-hidden="true"></div><strong>${split.name}</strong><span>${split.type}</span><span>${split.kwh.toFixed(2).replace('.', ',')} kWh/h</span>`;
    card.addEventListener('click', () => { state.selected.has(split.id) ? state.selected.delete(split.id) : state.selected.add(split.id); saveState(); render(); });
    grid.appendChild(card);
  });
}

function renderPanels(){
  $('manualPrice').value = state.manualPrice;
  $('esiosToken').value = state.token;
  $('manualPanel').classList.toggle('hidden', state.mode !== 'manual');
  $('autoPanel').classList.toggle('hidden', state.mode !== 'auto');
  $('filePanel').classList.toggle('hidden', state.mode !== 'file');
  $('manualModeBtn').classList.toggle('active', state.mode === 'manual');
  $('autoModeBtn').classList.toggle('active', state.mode === 'auto');
  $('fileModeBtn').classList.toggle('active', state.mode === 'file');
  const badge = $('liveBadge');
  badge.className = `badge ${state.mode !== 'manual' && state.pvpc.length ? 'live' : state.mode !== 'manual' ? 'error' : 'manual'}`;
  badge.textContent = state.mode === 'manual' ? 'Manual' : state.pvpc.length ? (state.mode === 'file' ? 'Fitxer' : 'PVPC') : 'Sense dades';
  const fetched = state.pvpcFetchedAt ? ` · actualitzat ${new Date(state.pvpcFetchedAt).toLocaleString('ca-ES')}` : '';
  $('priceStatus').textContent = `${currentPrice().toFixed(5).replace('.', ',')} €/kWh${state.mode !== 'manual' ? fetched : ''}`;
}

function renderResults(){
  const kwh = activeConsumption();
  $('activeKwh').textContent = fmtKwh(kwh);
  $('costNow').textContent = fmtCurrency(kwh * currentPrice());
  $('costNext').textContent = fmtCurrency(costForHours(state.hours));
  $('costNextLabel').textContent = `Cost properes ${state.hours} h`;
  $('hoursLabel').textContent = `${state.hours} h`;
  $('hoursHelp').textContent = `Fes lliscar la barra per veure el cost acumulat durant ${state.hours} hores.`;
  $('hoursRange').value = state.hours;
  const activeNames = SPLITS.filter(s => state.selected.has(s.id)).map(s => s.name);
  $('summaryBox').textContent = [
    `Aires actius: ${activeNames.length ? activeNames.join(' + ') : 'cap'}`,
    `Consum: ${fmtKwh(kwh)}`,
    `Preu aquesta hora: ${currentPrice().toFixed(5).replace('.', ',')} €/kWh`,
    `Cost aquesta hora: ${fmtCurrency(kwh * currentPrice())}`,
    `Cost properes ${state.hours} h: ${fmtCurrency(costForHours(state.hours))}`
  ].join('\n');
}

function renderHourlyTable(){
  const body = $('hourlyTable');
  $('noPvpcBox').classList.toggle('hidden', !!state.pvpc.length);
  if(!state.pvpc.length){ body.innerHTML = '<tr><td colspan="3">Sense dades PVPC carregades.</td></tr>'; return; }
  const kwh = activeConsumption();
  body.innerHTML = state.pvpc.map(row => `<tr><td>${String(row.hour).padStart(2, '0')}:00</td><td>${row.price.toFixed(5).replace('.', ',')} €/kWh</td><td>${fmtCurrency(kwh * row.price)}</td></tr>`).join('');
}
function render(){ renderSplits(); renderPanels(); renderResults(); renderHourlyTable(); }

function normalisePrice(value){
  let n = Number(String(value).trim().replace(',', '.'));
  if(!Number.isFinite(n)) return null;
  // ESIOS Desglose uses €/MWh in the FEU column. Convert to €/kWh.
  if(n > 1 && n < 1000) n = n / 1000;
  if(n >= 0 && n < 2) return n;
  return null;
}
function uniqueHours(rows){
  const unique = [];
  const seen = new Set();
  rows.sort((a,b)=>a.hour-b.hour).forEach(v => { if(!seen.has(v.hour)){ seen.add(v.hour); unique.push(v); } });
  return unique;
}
function decodeFileBuffer(buffer){
  const decoders = ['utf-8', 'windows-1252', 'iso-8859-1'];
  for(const enc of decoders){
    try{
      const text = new TextDecoder(enc).decode(buffer);
      if(text.includes('Detalle cálculo') || text.includes('PVPC') || text.includes('Término energía')) return text;
    }catch{}
  }
  return new TextDecoder().decode(buffer);
}
function parseEsiosDetalleText(text){
  const clean = text.replace(/\r/g, '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ');
  const marker = /Detalle\s+c[áa]lculo\s+t[ée]rmino\s+energ[íi]a\s+PVPC\s+para\s+Pen[íi]nsula,\s*Canarias\s+y\s+Baleares/i;
  const startMatch = clean.match(marker);
  if(!startMatch) return [];
  const start = startMatch.index + startMatch[0].length;
  const nextBlock = clean.slice(start).search(/Detalle\s+c[áa]lculo\s+t[ée]rmino\s+energ[íi]a\s+PVPC\s+para\s+Ceuta/i);
  const block = nextBlock >= 0 ? clean.slice(start, start + nextBlock) : clean.slice(start);
  const lines = block.split('\n').map(x => x.trim()).filter(Boolean);
  const rows = [];
  for(let i = 0; i < lines.length - 4; i++){
    const excelDay = Number(lines[i]);
    const esiosHour = Number(lines[i + 1]);
    const tariff = lines[i + 2];
    const period = Number(lines[i + 3]);
    const feu = Number(String(lines[i + 4]).replace(',', '.'));
    if(excelDay > 30000 && esiosHour >= 1 && esiosHour <= 24 && /2\.0TD/i.test(tariff) && [1,2,3].includes(period) && Number.isFinite(feu)){
      rows.push({ hour: esiosHour - 1, price: feu / 1000 });
      i += 4;
    }
  }
  return uniqueHours(rows);
}
function parsePvpcText(text){
  const detalleRows = parseEsiosDetalleText(text);
  if(detalleRows.length) return detalleRows;
  try{
    const json = JSON.parse(text);
    const values = json?.indicator?.values || json?.values || json;
    if(Array.isArray(values)){
      const rows = values.map(v => ({ hour: new Date(v.datetime || v.date || v.time || v.hour).getHours(), price: normalisePrice(v.value ?? v.price ?? v.preu) })).filter(v => Number.isFinite(v.hour) && v.price !== null);
      if(rows.length) return uniqueHours(rows);
    }
  }catch{}
  const rows = [];
  text.replace(/\r/g, '').split('\n').forEach(line => {
    const time = line.match(/\b([01]?\d|2[0-3])(?::|\.)([0-5]\d)\b|\b([01]?\d|2[0-3])\s*h\b/i);
    if(!time) return;
    const hour = Number(time[1] ?? time[3]);
    const nums = line.match(/-?\d+(?:[\.,]\d+)?/g) || [];
    const candidates = nums.map(normalisePrice).filter(v => v !== null);
    const price = candidates.reverse().find(v => v >= 0 && v < 2);
    if(Number.isFinite(hour) && price !== undefined) rows.push({ hour, price });
  });
  return uniqueHours(rows);
}
async function handleFile(event){
  const file = event.target.files?.[0];
  if(!file) return;
  const buffer = await file.arrayBuffer();
  const text = decodeFileBuffer(buffer);
  const parsed = parsePvpcText(text);
  if(parsed.length < 1){ alert('No he pogut detectar preus horaris. Assegura’t que és el fitxer ESIOS “PVPC Término de facturación energía activa – Desglose”.'); return; }
  state.pvpc = parsed;
  state.pvpcFetchedAt = new Date().toISOString();
  state.mode = 'file';
  saveState();
  render();
  if(parsed.length < 24) alert(`He carregat ${parsed.length} hores. Pot faltar alguna hora al fitxer.`);
}

async function fetchPVPC(){
  state.token = $('esiosToken').value.trim();
  if(!state.token){ alert('Cal enganxar un token personal ESIOS per provar el mode automàtic.'); return; }
  const date = new Date(); if($('useTomorrow').checked) date.setDate(date.getDate() + 1);
  const yyyy = date.getFullYear(), mm = String(date.getMonth()+1).padStart(2, '0'), dd = String(date.getDate()).padStart(2, '0');
  const start = `${yyyy}-${mm}-${dd}T00:00:00`, end = `${yyyy}-${mm}-${dd}T23:59:59`;
  const endpoint = `https://api.esios.ree.es/indicators/1001?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&geo_ids[]=8741`;
  try{
    $('fetchPvpcBtn').disabled = true; $('fetchPvpcBtn').textContent = 'Actualitzant...';
    const res = await fetch(endpoint, { headers: { 'Accept':'application/json; application/vnd.esios-api-v1+json', 'Content-Type':'application/json', 'Authorization':`Token token="${state.token}"` } });
    if(!res.ok) throw new Error(`Resposta HTTP ${res.status}`);
    const data = await res.json();
    const parsed = (data?.indicator?.values || []).map(v => ({ hour: new Date(v.datetime).getHours(), price: normalisePrice(v.value) })).filter(v => Number.isFinite(v.hour) && v.price !== null);
    if(!parsed.length) throw new Error('No hi ha valors horaris al JSON rebut.');
    state.pvpc = uniqueHours(parsed); state.pvpcFetchedAt = new Date().toISOString(); state.mode = 'auto'; saveState(); render();
  }catch(err){ console.error(err); alert('No he pogut descarregar el PVPC. Pot ser token incorrecte, CORS del navegador o canvis a ESIOS. Pots carregar el fitxer .xls a la pestanya Fitxer.'); }
  finally{ $('fetchPvpcBtn').disabled = false; $('fetchPvpcBtn').textContent = 'Actualitza'; }
}

function wireEvents(){
  $('manualModeBtn').addEventListener('click', () => { state.mode = 'manual'; saveState(); render(); });
  $('autoModeBtn').addEventListener('click', () => { state.mode = 'auto'; saveState(); render(); });
  $('fileModeBtn').addEventListener('click', () => { state.mode = 'file'; saveState(); render(); });
  $('saveManualPrice').addEventListener('click', () => { const v = Number(String($('manualPrice').value).replace(',', '.')); if(!Number.isFinite(v) || v < 0){ alert('Preu no vàlid.'); return; } state.manualPrice = v; saveState(); render(); });
  $('fetchPvpcBtn').addEventListener('click', fetchPVPC);
  $('pvpcFile').addEventListener('change', handleFile);
  $('clearPvpcBtn').addEventListener('click', () => { state.pvpc = []; state.pvpcFetchedAt = ''; saveState(); render(); });
  $('hoursRange').addEventListener('input', (e) => { state.hours = Number(e.target.value); saveState(); renderResults(); renderHourlyTable(); });
  $('copySummaryBtn').addEventListener('click', async () => { try{ await navigator.clipboard.writeText($('summaryBox').textContent); $('copySummaryBtn').textContent = 'Copiat!'; setTimeout(()=> $('copySummaryBtn').textContent = 'Copia resum', 1200); }catch{ alert('No he pogut copiar el resum.'); } });
}
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('installBtn').classList.remove('hidden'); });
$('installBtn')?.addEventListener('click', async () => { if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt = null; $('installBtn').classList.add('hidden'); } });
if('serviceWorker' in navigator){ window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn)); }
wireEvents(); render();
