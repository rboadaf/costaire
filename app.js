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
  pvpcFetchedAt: localStorage.getItem('pvpcFetchedAt') || ''
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
}

function activeConsumption(){
  return SPLITS.filter(s => state.selected.has(s.id)).reduce((sum, s) => sum + s.kwh, 0);
}

function currentPrice(){
  if(state.mode === 'auto' && state.pvpc.length){
    const h = nowHour();
    return state.pvpc.find(p => p.hour === h)?.price ?? state.manualPrice;
  }
  return state.manualPrice;
}

function priceForOffset(offset){
  if(state.mode === 'auto' && state.pvpc.length){
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
    card.addEventListener('click', () => {
      if(state.selected.has(split.id)) state.selected.delete(split.id); else state.selected.add(split.id);
      saveState();
      render();
    });
    grid.appendChild(card);
  });
}

function renderPrices(){
  $('manualPrice').value = state.manualPrice;
  $('esiosToken').value = state.token;
  $('manualPanel').classList.toggle('hidden', state.mode !== 'manual');
  $('autoPanel').classList.toggle('hidden', state.mode !== 'auto');
  $('manualModeBtn').classList.toggle('active', state.mode === 'manual');
  $('autoModeBtn').classList.toggle('active', state.mode === 'auto');
  const badge = $('liveBadge');
  badge.className = `badge ${state.mode === 'auto' && state.pvpc.length ? 'live' : state.mode === 'auto' ? 'error' : 'manual'}`;
  badge.textContent = state.mode === 'auto' && state.pvpc.length ? 'PVPC' : state.mode === 'auto' ? 'Sense dades' : 'Manual';
  const fetched = state.pvpcFetchedAt ? ` · actualitzat ${new Date(state.pvpcFetchedAt).toLocaleString('ca-ES')}` : '';
  $('priceStatus').textContent = `${currentPrice().toFixed(5).replace('.', ',')} €/kWh${state.mode === 'auto' ? fetched : ''}`;
}

function renderResults(){
  const kwh = activeConsumption();
  $('activeKwh').textContent = fmtKwh(kwh);
  $('costNow').textContent = fmtCurrency(kwh * currentPrice());
  $('costNext').textContent = fmtCurrency(costForHours(state.hours));
  $('costEight').textContent = fmtCurrency(costForHours(8));
  $('hoursLabel').textContent = `${state.hours} h`;
  $('hoursRange').value = state.hours;
  document.querySelectorAll('.preset-row button').forEach(b => b.classList.toggle('active', Number(b.dataset.hours) === state.hours));
  const activeNames = SPLITS.filter(s => state.selected.has(s.id)).map(s => s.name);
  $('summaryBox').textContent = [
    `Aires actius: ${activeNames.length ? activeNames.join(' + ') : 'cap'}`,
    `Consum: ${fmtKwh(kwh)}`,
    `Preu aquesta hora: ${currentPrice().toFixed(5).replace('.', ',')} €/kWh`,
    `Cost aquesta hora: ${fmtCurrency(kwh * currentPrice())}`,
    `Cost properes ${state.hours} h: ${fmtCurrency(costForHours(state.hours))}`,
    `Cost nit 8 h: ${fmtCurrency(costForHours(8))}`
  ].join('\n');
}

function renderHourlyTable(){
  const body = $('hourlyTable');
  if(!state.pvpc.length){
    body.innerHTML = '<tr><td colspan="3">Sense dades PVPC carregades.</td></tr>';
    return;
  }
  const kwh = activeConsumption();
  body.innerHTML = state.pvpc.map(row => `<tr><td>${String(row.hour).padStart(2, '0')}:00</td><td>${row.price.toFixed(5).replace('.', ',')} €/kWh</td><td>${fmtCurrency(kwh * row.price)}</td></tr>`).join('');
}

function render(){
  renderSplits();
  renderPrices();
  renderResults();
  renderHourlyTable();
}

async function fetchPVPC(){
  state.token = $('esiosToken').value.trim();
  if(!state.token){ alert('Cal enganxar un token personal ESIOS per provar el mode automàtic.'); return; }
  const date = new Date();
  if($('useTomorrow').checked) date.setDate(date.getDate() + 1);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth()+1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const start = `${yyyy}-${mm}-${dd}T00:00:00`;
  const end = `${yyyy}-${mm}-${dd}T23:59:59`;
  const endpoint = `https://api.esios.ree.es/indicators/1001?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&geo_ids[]=8741`;
  try{
    $('fetchPvpcBtn').disabled = true;
    $('fetchPvpcBtn').textContent = 'Actualitzant...';
    const res = await fetch(endpoint, {
      headers: {
        'Accept': 'application/json; application/vnd.esios-api-v1+json',
        'Content-Type': 'application/json',
        'Authorization': `Token token="${state.token}"`
      }
    });
    if(!res.ok) throw new Error(`Resposta HTTP ${res.status}`);
    const data = await res.json();
    const values = data?.indicator?.values || [];
    const parsed = values.map(v => ({ hour: new Date(v.datetime).getHours(), price: Number(v.value) })).filter(v => Number.isFinite(v.hour) && Number.isFinite(v.price));
    if(!parsed.length) throw new Error('No hi ha valors horaris al JSON rebut.');
    const unique = [];
    const seen = new Set();
    parsed.sort((a,b) => a.hour - b.hour).forEach(v => { if(!seen.has(v.hour)){ seen.add(v.hour); unique.push(v); } });
    state.pvpc = unique;
    state.pvpcFetchedAt = new Date().toISOString();
    state.mode = 'auto';
    saveState();
    render();
  }catch(err){
    console.error(err);
    alert('No he pogut descarregar el PVPC. Pot ser token incorrecte, CORS del navegador o canvis a ESIOS. L\'app continua funcionant amb preu manual.');
  }finally{
    $('fetchPvpcBtn').disabled = false;
    $('fetchPvpcBtn').textContent = 'Actualitza';
  }
}

function wireEvents(){
  $('manualModeBtn').addEventListener('click', () => { state.mode = 'manual'; saveState(); render(); });
  $('autoModeBtn').addEventListener('click', () => { state.mode = 'auto'; saveState(); render(); });
  $('saveManualPrice').addEventListener('click', () => {
    const v = Number(String($('manualPrice').value).replace(',', '.'));
    if(!Number.isFinite(v) || v < 0){ alert('Preu no vàlid.'); return; }
    state.manualPrice = v;
    saveState();
    render();
  });
  $('fetchPvpcBtn').addEventListener('click', fetchPVPC);
  $('hoursRange').addEventListener('input', (e) => { state.hours = Number(e.target.value); saveState(); renderResults(); renderHourlyTable(); });
  document.querySelectorAll('.preset-row button').forEach(btn => btn.addEventListener('click', () => { state.hours = Number(btn.dataset.hours); saveState(); render(); }));
  $('copySummaryBtn').addEventListener('click', async () => {
    try{
      await navigator.clipboard.writeText($('summaryBox').textContent);
      $('copySummaryBtn').textContent = 'Copiat!';
      setTimeout(() => $('copySummaryBtn').textContent = 'Copia resum', 1200);
    }catch{ alert('No he pogut copiar el resum.'); }
  });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('installBtn').classList.remove('hidden'); });
$('installBtn')?.addEventListener('click', async () => { if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt = null; $('installBtn').classList.add('hidden'); } });

if('serviceWorker' in navigator){
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
}
wireEvents();
render();
