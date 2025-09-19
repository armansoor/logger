/* app.js - SimpleLogs extended */
const STORAGE_KEY = "simplelogs:v1";
let logs = [];
let showPinnedOnly = false;
let autoScroll = false;

const $ = sel => document.querySelector(sel);
function uid(){ return Math.random().toString(36).slice(2,9); }
function nowISO(){ return new Date().toISOString(); }
function saveLocal(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(logs)); }
function loadLocal(){ try{ logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch(e){ logs=[]; } }

/* Add Log */
function addLog({level="info", tag="", msg=""}){
  if(!msg.trim()) return;
  logs.unshift({ id: uid(), ts: nowISO(), level, tag: tag||"", msg: msg.trim(), pinned:false });
  saveLocal(); renderAll();
}

/* Parse log text lines */
function parseLogText(text){
  const out=[]; text.split(/\r?\n/).forEach(line=>{
    if(!line.trim()) return;
    const m = line.match(/^\s*(?:(INFO|WARN|ERROR|DEBUG)\s*)?(?:(.*?)\s*)?(.*)$/i);
    const level = (m && m[1]) ? m[1].toLowerCase() : "info";
    const tag = (m && m[2]) ? m[2] : "";
    const msg = (m && m[3]) ? m[3] : line;
    out.push({level,tag,msg});
  }); return out;
}

/* Escape HTML */
function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

/* Render Logs */
function renderLogs(){
  const list=$("#log-list"); list.innerHTML="";
  const search=$("#search").value.trim().toLowerCase();
  const filterLevel=$("#filter-level").value;
  const filterTag=$("#filter-tag").value.trim().toLowerCase();

  let filtered=logs.filter(l=>{
    if(showPinnedOnly && !l.pinned) return false;
    if(filterLevel && l.level!==filterLevel) return false;
    if(filterTag && !l.tag.toLowerCase().includes(filterTag)) return false;
    if(search){
      const hay=(l.msg+" "+l.tag+" "+l.level+" "+l.ts).toLowerCase();
      if(!hay.includes(search)) return false;
    }
    return true;
  });

  if(!filtered.length){ list.innerHTML="<div class='meta' style='padding:1rem'>No logs</div>"; return; }

  filtered.forEach(l=>{
    const wrap=document.createElement("div");
    wrap.className=`log-line level-${l.level}`;
    if(l.pinned) wrap.style.background="linear-gradient(90deg,rgba(255,249,230,0.6),transparent)";
    wrap.innerHTML=`
      <div class="meta">
        <div><strong>${new Date(l.ts).toLocaleString()}</strong></div>
        <div style="margin-top:6px">${l.level}<span class="tag">${l.tag||"—"}</span></div>
        <div style="margin-top:8px">
          <button data-id="${l.id}" class="btn-pin">${l.pinned?"Unpin":"Pin"}</button>
          <button data-id="${l.id}" class="btn-copy">Copy</button>
          <button data-id="${l.id}" class="btn-delete">Del</button>
        </div>
      </div>
      <div class="message">${escapeHtml(l.msg)}</div>`;
    wrap.querySelector(".btn-copy").onclick=()=>navigator.clipboard.writeText(l.msg);
    wrap.querySelector(".btn-delete").onclick=()=>{logs=logs.filter(x=>x.id!==l.id); saveLocal(); renderAll();};
    wrap.querySelector(".btn-pin").onclick=()=>{l.pinned=!l.pinned; saveLocal(); renderLogs();};
    list.appendChild(wrap);
  });

  if(autoScroll) list.scrollTop=list.scrollHeight;
}

/* Timeline */
let chart=null;
function renderTimeline(group="minute"){
  const map=new Map();
  for(const l of logs){
    const d=new Date(l.ts); let key;
    if(group==="hour") key=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:00`;
    else key=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;
    map.set(key,(map.get(key)||0)+1);
  }
  const labels=Array.from(map.keys()).reverse(); const data=labels.map(l=>map.get(l));
  const ctx=$("#timeline-chart").getContext("2d");
  if(chart) chart.destroy();
  chart=new Chart(ctx,{ type:'line', data:{labels,datasets:[{label:'logs',data,fill:true,tension:0.3}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});
}

/* Statistics */
function renderStats(){
  const box=$("#stats-box"); if(!logs.length){box.innerHTML="No logs yet."; return;}
  const total=logs.length;
  const byLevel={}; const byTag={};
  logs.forEach(l=>{ byLevel[l.level]=(byLevel[l.level]||0)+1; if(l.tag) byTag[l.tag]=(byTag[l.tag]||0)+1; });
  let html=`<p>Total logs: ${total}</p><ul>`;
  for(const [lvl,c] of Object.entries(byLevel)) html+=`<li>${lvl}: ${c}</li>`;
  html+="</ul>";
  if(Object.keys(byTag).length){ html+="<p>Top tags:</p><ul>"; for(const [t,c] of Object.entries(byTag)) html+=`<li>${t}: ${c}</li>`; html+="</ul>"; }
  box.innerHTML=html;
}

/* Render all */
function renderAll(){ renderLogs(); renderTimeline(); renderStats(); }

/* Download Helper */
function downloadFile(content,filename,type){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(()=>URL.revokeObjectURL(url),5000);
}

/* Exports */
function exportCSV(){
  let csv="timestamp,level,tag,message\n";
  logs.slice().reverse().forEach(l=>{
    csv+=`"${l.ts}","${l.level}","${l.tag}","${l.msg.replace(/"/g,'""')}"\n`;
  });
  downloadFile(csv,`simplelogs-${nowISO()}.csv`,"text/csv");
}
function exportHTML(){
  let html=`<html><head><meta charset="utf-8"><title>Log Report</title></head><body><h2>Log Report</h2><table border="1" cellpadding="6"><tr><th>Timestamp</th><th>Level</th><th>Tag</th><th>Message</th></tr>`;
  logs.slice().reverse().forEach(l=>{ html+=`<tr><td>${l.ts}</td><td>${l.level}</td><td>${l.tag}</td><td>${escapeHtml(l.msg)}</td></tr>`; });
  html+="</table></body></html>";
  downloadFile(html,`simplelogs-${nowISO()}.html`,"text/html");
}

/* Copy filtered logs */
function copyFiltered(){
  const search=$("#search").value.trim().toLowerCase();
  const filterLevel=$("#filter-level").value;
  const filterTag=$("#filter-tag").value.trim().toLowerCase();
  const filtered=logs.filter(l=>{
    if(showPinnedOnly && !l.pinned) return false;
    if(filterLevel && l.level!==filterLevel) return false;
    if(filterTag && !l.tag.toLowerCase().includes(filterTag)) return false;
    if(search){ const hay=(l.msg+" "+l.tag+" "+l.level+" "+l.ts).toLowerCase(); if(!hay.includes(search)) return false; }
    return true;
  });
  const text=filtered.map(l=>`[${l.level.toUpperCase()}] [${l.tag}] ${l.ts} ${l.msg}`).join("\n");
  navigator.clipboard.writeText(text); alert("Copied "+filtered.length+" logs to clipboard.");
}

/* Setup UI */
function setupUI(){
  loadLocal(); renderAll();

  $("#add-log").onclick=()=>{ addLog({level:$("#level-select").value, tag:$("#tag-input").value, msg:$("#quick-log").value}); $("#quick-log").value=""; };
  $("#quick-log").addEventListener("keydown",e=>{ if((e.ctrlKey||e.metaKey)&&e.key==="Enter") $("#add-log").click(); });
  $("#clear-input").onclick=()=>$("#quick-log").value="";
  $("#search").oninput=()=>renderLogs(); $("#filter-level").onchange=()=>renderLogs(); $("#filter-tag").oninput=()=>renderLogs();
  $("#clear-filters").onclick=()=>{ $("#search").value=""; $("#filter-level").value=""; $("#filter-tag").value=""; renderLogs(); };
  $("#clear-all").onclick=()=>{ if(confirm("Clear all logs?")){ logs=[]; saveLocal(); renderAll(); } };

  $("#load-file").onclick=async()=>{ const f=$("#file-input").files[0]; if(!f) return alert("Choose file"); const text=await f.text();
    if(f.name.ends
