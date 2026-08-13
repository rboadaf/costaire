const SPLITS = [
  { id: 'despatx', name: 'Despatx', type: 'Split 12', kwh: 0.59 },
  { id: 'habM', name: 'Hab M', type: 'Split 9', kwh: 0.41 },
  { id: 'habI', name: 'Hab I', type: 'Split 9', kwh: 0.41 },
  { id: 'menjador', name: 'Menjador', type: 'Split 12', kwh: 0.59 }
];
const $ = id => document.getElementById(id);
const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };
const toggle = (id, cls, force) => { const el = $(id); if (el) el.classList.toggle(cls, force); };
const fmtEUR = n => new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(Number.isFinite(n) ? n : 0);
const fmtPrice = n => `${(Number.isFinite(n) ? n : 0).toFixed(5).replace('.', ',')} €/kWh`;
const fmtTime = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const fmtHour = d => `${String(d.getHours()).padStart(2, '0')}:00`;

const state = {
  selected: new Set(JSON.parse(localStorage.getItem('selectedSplits') || '[]')),
  mode: localStorage.getItem('priceMode') || 'auto',
  manualPrice: Number(localStorage.getItem('manualPrice') || 0.096),
  targetSteps: Number(localStorage.getItem('targetSteps') || 4),
  autoPaused: localStorage.getItem('autoPaused') === 'true',
  autoPrices: JSON.parse(localStorage.getItem('autoPrices') || '[]'),
  filePrices: JSON.parse(localStorage.getItem('filePrices') || '[]'),
  updatedAt: localStorage.getItem('updatedAt') || '',
  alarmTimer: null
};

function saveState(){
  localStorage.setItem('selectedSplits', JSON.stringify([...state.selected]));
  localStorage.setItem('priceMode', state.mode);
  localStorage.setItem('manualPrice', String(state.manualPrice));
  localStorage.setItem('targetSteps', String(state.targetSteps));
  localStorage.setItem('autoPaused', String(state.autoPaused));
  localStorage.setItem('autoPrices', JSON.stringify(state.autoPrices));
  localStorage.setItem('filePrices', JSON.stringify(state.filePrices));
  localStorage.setItem('updatedAt', state.updatedAt);
}
function activeConsumption(){ return SPLITS.filter(s => state.selected.has(s.id)).reduce((sum, s) => sum + s.kwh, 0); }
function activePriceTable(){ if(state.mode === 'file') return state.filePrices; if(state.mode === 'auto') return state.autoPrices; return []; }
function priceForHour(hour){
  if(state.mode === 'manual') return state.manualPrice;
  const table = activePriceTable();
  const found = table.find(p => p.hour === ((hour % 24) + 24) % 24);
  return found ? found.price : state.manualPrice;
}
function currentPrice(){ return priceForHour(new Date().getHours()); }
function nextBoundary(now = new Date()){
  const d = new Date(now); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d;
}
function targetBoundary(now = new Date()){
  const base = nextBoundary(now); base.setHours(base.getHours() + state.targetSteps - 1); return base;
}
function minutesUntilNext(now = new Date()){ return Math.max(0, (nextBoundary(now) - now) / 60000); }
function costToNext(now = new Date()){ return activeConsumption() * currentPrice() * minutesUntilNext(now) / 60; }
function costOneHour(){ return activeConsumption() * currentPrice(); }
function costToTarget(now = new Date()){
  const kwh = activeConsumption();
  let total = costToNext(now);
  const firstFullHour = nextBoundary(now).getHours();
  for(let i = 0; i < state.targetSteps - 1; i++) total += kwh * priceForHour(firstFullHour + i);
  return total;
}

function renderSplits(){
  const grid = $('splitGrid'); if(!grid) return; grid.innerHTML = '';
  SPLITS.forEach(split => {
    const card = document.createElement('button');
    card.type = 'button'; card.className = `split-card ${state.selected.has(split.id) ? 'active' : ''}`;
    card.innerHTML = `<div class="toggle-dot"></div><strong>${split.name}</strong><span>${split.type}</span><span>${split.kwh.toFixed(2).replace('.', ',')} kWh/h</span>`;
    card.addEventListener('click', () => { state.selected.has(split.id) ? state.selected.delete(split.id) : state.selected.add(split.id); saveState(); render(); });
    grid.appendChild(card);
  });
}
function renderPricePanel(){
  toggle('manualPanel','hidden', state.mode !== 'manual');
  toggle('autoPanel','hidden', state.mode !== 'auto');
  toggle('filePanel','hidden', state.mode !== 'file');
  toggle('manualModeBtn','active', state.mode === 'manual');
  toggle('autoModeBtn','active', state.mode === 'auto');
  toggle('fileModeBtn','active', state.mode === 'file');
  const input = $('manualPrice'); if(input) input.value = state.manualPrice;
  const p = currentPrice(); const until = fmtHour(nextBoundary());
  const updated = state.updatedAt ? ` · actualitzat ${new Date(state.updatedAt).toLocaleString('ca-ES')}` : '';
  setText('priceStatus', `Fins a les ${until} · ${fmtPrice(p)}${updated}`);
  const pauseText = state.autoPaused ? 'Reprèn actualització automàtica de preu' : 'Pausa actualització automàtica de preu';
  setText('pauseAutoBtnManual', pauseText); setText('pauseAutoBtnFile', pauseText);
}
function renderResults(){
  const next = nextBoundary(); const target = targetBoundary();
  setText('costToNextTitle', `€ fins a les ${fmtHour(next)}`);
  setText('costToTargetTitle', `€ fins a les ${fmtHour(target)}`);
  setText('targetHourLabel', fmtHour(target));
  const range = $('targetRange'); if(range) range.value = state.targetSteps;
  setText('costToNext', fmtEUR(costToNext())); setText('costOneHour', fmtEUR(costOneHour())); setText('costToTarget', fmtEUR(costToTarget()));
  const activeNames = SPLITS.filter(s => state.selected.has(s.id)).map(s => s.name).join(' + ') || 'cap';
  const summary = [`Aires actius: ${activeNames}`, `Consum actiu: ${activeConsumption().toFixed(2).replace('.', ',')} kWh/h`, `Preu actual: ${fmtPrice(currentPrice())}`, `€ fins a les ${fmtHour(next)}: ${fmtEUR(costToNext())}`, `€ 1 h al preu actual: ${fmtEUR(costOneHour())}`, `€ fins a les ${fmtHour(target)}: ${fmtEUR(costToTarget())}`].join('\n');
  setText('summaryBox', summary);
}
function renderTable(){
  const body = $('hourlyTable'); if(!body) return;
  const table = activePriceTable(); const kwh = activeConsumption();
  if(!table.length){ body.innerHTML = '<tr><td colspan="3">Sense dades horàries carregades.</td></tr>'; return; }
  body.innerHTML = table.map(row => `<tr><td>${String(row.hour).padStart(2,'0')}:00</td><td>${fmtPrice(row.price)}</td><td>${fmtEUR(kwh * row.price)}</td></tr>`).join('');
}
function render(){ renderSplits(); renderPricePanel(); renderResults(); renderTable(); }

function normalisePrice(v){ let n = Number(String(v).replace(',', '.')); if(!Number.isFinite(n)) return null; if(n > 1 && n < 1000) n = n / 1000; return n >= 0 && n < 2 ? n : null; }
function uniqueHours(rows){ const seen = new Set(); return rows.sort((a,b)=>a.hour-b.hour).filter(r => !seen.has(r.hour) && seen.add(r.hour)); }
function localDay(d = new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function collectRedata(node, out = []){
  if(!node || typeof node !== 'object') return out;
  if(Array.isArray(node)){ node.forEach(x => collectRedata(x,out)); return out; }
  if(Array.isArray(node.values)) node.values.forEach(v => { const dt = v.datetime || v.date || v.time; const price = normalisePrice(v.value); if(dt && price !== null) out.push({hour:new Date(dt).getHours(), price}); });
  Object.keys(node).forEach(k => collectRedata(node[k], out)); return out;
}
async function fetchAutoPrices({silent=false} = {}){
  if(state.autoPaused && silent) return;
  const day = localDay();
  const url = `https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?start_date=${day}T00:00&end_date=${day}T23:59&time_trunc=hour&geo_ids=8741`;
  const btn = $('refreshBtn'); if(btn && !silent){ btn.disabled = true; btn.textContent = 'Actualitzant...'; }
  try{
    const res = await fetch(url, {cache:'no-store', headers:{Accept:'application/json'}}); if(!res.ok) throw new Error(res.status);
    const rows = uniqueHours(collectRedata(await res.json()).filter(r => Number.isFinite(r.hour) && r.price !== null)); if(!rows.length) throw new Error('sense valors');
    state.autoPrices = rows; state.updatedAt = new Date().toISOString(); saveState(); render();
  }catch(e){ console.warn(e); if(!silent) alert('No he pogut actualitzar REData. Mantinc l’últim preu disponible.'); }
  finally{ if(btn){ btn.disabled = false; btn.textContent = 'Actualitza'; } }
}
function parseWorkbook(buffer){
  if(typeof XLSX === 'undefined') return [];
  const wb = XLSX.read(buffer, {type:'array'}); const sh = wb.Sheets['Tabla de Datos PCB']; if(!sh) return [];
  const rows = []; for(let r=6;r<=29;r++){ const v = sh[`E${r}`]?.v; const n = Number(String(v).replace(',', '.')); if(Number.isFinite(n)) rows.push({hour:r-6, price:n/1000}); }
  return rows;
}
async function handleFile(e){
  const file = e.target.files?.[0]; if(!file) return; const buffer = await file.arrayBuffer(); let rows = [];
  if(file.name.toLowerCase().match(/\.xlsx?$/)) rows = parseWorkbook(buffer);
  if(!rows.length){ const txt = new TextDecoder('utf-8').decode(buffer); txt.split(/\r?\n/).forEach(line => { const h = line.match(/\b([01]?\d|2[0-3])[:.]\d\d\b/); const nums = line.match(/-?\d+(?:[\.,]\d+)?/g)||[]; const price = nums.map(normalisePrice).filter(x=>x!==null).pop(); if(h && price!==undefined) rows.push({hour:Number(h[1]), price}); }); rows = uniqueHours(rows); }
  if(!rows.length){ alert('No he pogut llegir el fitxer.'); return; }
  state.filePrices = rows; state.mode = 'file'; state.updatedAt = new Date().toISOString(); saveState(); render();
}
function togglePause(){ state.autoPaused = !state.autoPaused; saveState(); render(); }
async function scheduleAlarm(){
  const target = targetBoundary(); const ms = target - new Date(); if(ms <= 0) return;
  if(!('Notification' in window)){ alert('Aquest navegador no admet notificacions.'); return; }
  if(Notification.permission !== 'granted'){ const p = await Notification.requestPermission(); if(p !== 'granted') return; }
  if(state.alarmTimer) clearTimeout(state.alarmTimer);
  setText('alarmStatus', `Avís programat per les ${fmtHour(target)}.`);
  state.alarmTimer = setTimeout(async () => {
    const title = 'Costair€'; const body = `Hora marcada: ${fmtHour(target)}. Revisa els aires actius.`;
    if(navigator.serviceWorker?.ready){ const reg = await navigator.serviceWorker.ready; reg.showNotification(title, {body, icon:'icons/icon-192.png'}); }
    else new Notification(title, {body, icon:'icons/icon-192.png'});
    if(navigator.vibrate) navigator.vibrate([200,100,200]);
  }, ms);
}
function wire(){
  on('manualModeBtn','click',()=>{state.mode='manual';saveState();render();}); on('autoModeBtn','click',()=>{state.mode='auto';saveState();render();}); on('fileModeBtn','click',()=>{state.mode='file';saveState();render();});
  on('refreshBtn','click',()=>fetchAutoPrices({silent:false})); on('saveManualPrice','click',()=>{ const v=normalisePrice($('manualPrice')?.value); if(v===null){alert('Preu no vàlid.');return;} state.manualPrice=v; state.mode='manual'; saveState(); render(); });
  on('pauseAutoBtnManual','click',togglePause); on('pauseAutoBtnFile','click',togglePause); on('pvpcFile','change',handleFile); on('clearPvpcBtn','click',()=>{state.filePrices=[];saveState();render();});
  on('targetRange','input',e=>{state.targetSteps=Number(e.target.value);saveState();render();}); on('alarmBtn','click',scheduleAlarm);
  on('copySummaryBtn','click',async()=>{try{await navigator.clipboard.writeText($('summaryBox')?.textContent||'');}catch{}});
}
let deferredPrompt; window.addEventListener('beforeinstallprompt', e=>{e.preventDefault(); deferredPrompt=e; toggle('installBtn','hidden',false);}); on('installBtn','click',async()=>{if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null;toggle('installBtn','hidden',true);}});
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
wire(); render(); fetchAutoPrices({silent:true}); setInterval(render, 30000);
