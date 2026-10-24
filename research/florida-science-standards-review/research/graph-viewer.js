(() => {
  'use strict';
  const base = '/research/florida-science-standards-review/research/';
  const graphURL = base + 'benchmark-variant-graph.json';
  const addendumURL = base + 'variant-graph-addendum.json';
  const materialsURL = base + 'curriculum-materials.json';
  const coverageURL = base + 'graph-source-coverage.json';
  const labelMap = {
    'doc:fl-science-1996': 'Florida Science Standards (1996)',
    'doc:fl-science-gle-1999': 'Florida Grade-Level Expectations (1998/99)',
    'doc:fl-science-2008': 'Florida Science Standards (2008)',
    'doc:fl-science-2026-draft': 'Florida Draft Science Standards (2026)',
    'doc:ngss-all-topic-standards': 'Next Generation Science Standards',
    'doc:south-carolina-science-2014': 'South Carolina Science Standards (2014)',
    'doc:external:89574ee13dd2c447': 'External comparison source (South Carolina copy)',
    'doc:external:9aab810f0e14c6e9': 'Massachusetts Science and Technology/Engineering Framework (2006)',
    'doc:external:a6ff73f1309c8ec5': 'California Science Framework (2006)',
    'doc:external:8f3e333f4967c18a': 'Florida Citizens for Science proposal (2007)',
    'doc:unassigned-source': 'Unassigned source mapping'
  };
  const sourceURLs = {
    'doc:fl-science-1996': [{label:'Florida historical standards archive',url:'https://fcit.usf.edu/sss/sss/'},{label:'Internet Archive scan',url:'https://web.archive.org/web/20040203203325id_/http://www.firn.edu/doe/curric/prek12/pdf/science6.pdf'}],
    'doc:fl-science-gle-1999': [{label:'Florida historical standards archive',url:'https://fcit.usf.edu/sss/sss/'},{label:'Internet Archive GLE scan',url:'https://web.archive.org/web/20041016150428id_/http://www.firn.edu/doe/curric/prek12/pdf/scigle6.pdf'}],
    'doc:fl-science-2008': [{label:'Florida Department of Education standards page',url:'https://www.fldoe.org/academics/standards/subject-areas/math-science/science/'},{label:'Public PDF copy used for comparison',url:'https://science4inquiry.com/documents/Florida%20science_k-12_standards.pdf'}],
    'doc:fl-science-2026-draft': [{label:'Florida Department of Education review portal',url:'https://www.fldoe.org/standardsreview/'}],
    'doc:ngss-all-topic-standards': [{label:'Official NGSS topic-arrangement PDF',url:'https://www.nextgenscience.org/sites/default/files/AllTopic.pdf'}],
    'doc:south-carolina-science-2014': [{label:'South Carolina 2014 standards PDF',url:'https://ed.sc.gov/sites/scdoe/assets/file/agency/ccr/Standards-Learning/documents/South_Carolina_Academic_Standards_and_Performance_Indicators_for_Science_2014.pdf'},{label:'South Carolina standards page',url:'https://www.ed.sc.gov/instruction/standards/science/'}],
    'doc:external:89574ee13dd2c447': [{label:'South Carolina 2014 standards PDF',url:'https://ed.sc.gov/sites/scdoe/assets/file/agency/ccr/Standards-Learning/documents/South_Carolina_Academic_Standards_and_Performance_Indicators_for_Science_2014.pdf'}],
    'doc:external:9aab810f0e14c6e9': [{label:'Massachusetts 2006 framework (ERIC copy)',url:'https://files.eric.ed.gov/fulltext/ED508413.pdf'}],
    'doc:external:a6ff73f1309c8ec5': [{label:'California Science Framework PDF (CDE-hosted copy)',url:'https://www.cde.ca.gov/ci/cr/cf/documents/scienceframework.pdf'}],
    'doc:external:8f3e333f4967c18a': [{label:'Florida Citizens for Science 2007 public proposal',url:'https://www.flascience.org/FCSstandards.pdf'}]
  };
  const reviewLinks = [
    {label:'2026/2008 and external-source omission crosswalk',url:base+'sources/alt-ngss/omission-crosswalk.html'},
    {label:'Alternative-source and wording analysis',url:base+'alternative-source-analysis.html'},
    {label:'Full-draft comparison',url:base+'full-draft-comparison.html'}
  ];
  const byId = new Map(), docs = [], units = [], concepts = [], assertions = [];
  const adj = new Map();
  const $ = s => document.querySelector(s);
  const materialsByCode = new Map();
  const coverageByDoc = new Map();
  const mapEl = $('#corpus-map'), mapStatus = $('#map-status'), mapChoices = $('#map-source-choices');
  const searchInput = $('#graph-search'), versionFilter = $('#version-filter'), gradeFilter = $('#grade-filter'), statusFilter = $('#status-filter');
  const resultsEl = $('#result-list'), countEl = $('#result-count'), moreBtn = $('#more-results'), detailEl = $('#item-detail');
  let results = [], shown = 0, selectedId = null;
  let viewMode = 'sources', mapZoom = 100, sourceMapEdges = [];
  const defaultMapSources = new Set(['doc:fl-science-2026-draft','doc:fl-science-2008','doc:fl-science-1996','doc:fl-science-gle-1999','doc:ngss-all-topic-standards']);
  const batch = 50;
  function esc(v='') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function title(id) {
    if (!id) return 'Unspecified source';
    if (labelMap[id]) return labelMap[id];
    const n = byId.get(id);
    if (n?.type === 'Concept') return n.text || n.conceptId || id;
    if (n?.type === 'TextUnit') return n.code || id;
    if (n?.type === 'StandardVersion') return (n.sourceFiles||[])[0]?.file || id;
    return id;
  }
  function textPreview(n) { return n.type === 'Concept' ? n.text : (n.text || ''); }
  function initOptions() {
    const docCounts = new Map();
    units.forEach(n => docCounts.set(n.sourceDocument,(docCounts.get(n.sourceDocument)||0)+1));
    docs.forEach(d => { const o=document.createElement('option'); o.value=d.id; o.textContent=title(d.id); versionFilter.append(o); });
    const grades=[...new Set(units.map(n=>n.gradeSpan).filter(Boolean))].sort((a,b)=>gradeSort(a)-gradeSort(b));
    grades.forEach(g=>{const o=document.createElement('option');o.value=g;o.textContent=/^\d+$/.test(g)?`Grade ${Number(g)}`:g;gradeFilter.append(o);});
    const states=[...new Set(units.map(n=>n.status).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    states.forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;statusFilter.append(o);});
    const host=$('#source-cards');
    host.innerHTML=docs.map(d=>{const c=coverageByDoc.get(d.id);return `<article class="source-card"><h3>${esc(title(d.id))}</h3><p>${esc(d.status||'Source version')}</p><p><strong>${(docCounts.get(d.id)||0).toLocaleString()}</strong> encoded items · ${esc(c?.coverage||'coverage unassessed')}</p>${c?.note?`<p class="coverage-warning">${esc(c.note)}</p>`:''}<button type="button" data-doc="${esc(d.id)}">Browse these items</button></article>`;}).join('');
    host.querySelectorAll('button[data-doc]').forEach(b=>b.addEventListener('click',()=>{versionFilter.value=b.dataset.doc;searchInput.value='';gradeFilter.value='';statusFilter.value='';updateResults();showDoc(b.dataset.doc);}));
  }
  function gradeSort(g) { const m=String(g).match(/\d+/); return m?Number(m[0]):100; }
  function gradeLabel(g) { return ({'912':'9–12','9-12':'9–12','9–12':'9–12','6-8':'6–8','6–8':'6–8','3-5':'3–5','3–5':'3–5','K-2':'K–2','K–2':'K–2'})[String(g)]||String(g||'Unspecified'); }
  function shortTitle(id) {
    return ({'doc:fl-science-2026-draft':'2026 Florida draft','doc:fl-science-2008':'Florida 2008','doc:fl-science-1996':'Florida 1996','doc:fl-science-gle-1999':'Florida GLE 1998/99','doc:ngss-all-topic-standards':'NGSS','doc:external:8f3e333f4967c18a':'FCS proposal 2007','doc:south-carolina-science-2014':'South Carolina 2014','doc:external:89574ee13dd2c447':'South Carolina copy','doc:external:9aab810f0e14c6e9':'Massachusetts 2006','doc:external:a6ff73f1309c8ec5':'California 2006','doc:unassigned-source':'Unassigned source mapping'})[id]||title(id);
  }
  function docClass(id) { return id==='doc:unassigned-source'?'unassigned':id==='doc:fl-science-2026-draft'?'draft':id==='doc:fl-science-2008'||id==='doc:fl-science-1996'||id==='doc:fl-science-gle-1999'?'florida':'external'; }
  function buildSourceMapEdges() {
    const agg=new Map();
    assertions.forEach(a=>{
      if(!a.sourceUnit||!a.targetUnit||!byId.has(a.sourceUnit)||!byId.has(a.targetUnit))return;
      const from=byId.get(a.sourceUnit).sourceDocument,to=byId.get(a.targetUnit).sourceDocument;
      if(!from||!to||from===to)return;
      const key=[from,to].sort().join('|');
      if(!agg.has(key))agg.set(key,{a:[from,to].sort()[0],b:[from,to].sort()[1],count:0,relations:new Map()});
      const e=agg.get(key);e.count++;e.relations.set(a.relation,(e.relations.get(a.relation)||0)+1);if(!e.sample)e.sample=a;
    });
    sourceMapEdges=[...agg.values()].sort((a,b)=>b.count-a.count);
  }
  function renderSourceMap() {
    const width=1200,height=620, pos={
      'doc:fl-science-2026-draft':[600,300], 'doc:fl-science-2008':[330,300], 'doc:fl-science-1996':[130,210], 'doc:fl-science-gle-1999':[150,435],
      'doc:ngss-all-topic-standards':[930,155], 'doc:external:8f3e333f4967c18a':[970,435], 'doc:south-carolina-science-2014':[890,535],
    'doc:external:89574ee13dd2c447':[1060,525], 'doc:external:9aab810f0e14c6e9':[1060,280], 'doc:external:a6ff73f1309c8ec5':[880,300], 'doc:unassigned-source':[380,520]
    };
    const counts=new Map();units.forEach(u=>counts.set(u.sourceDocument,(counts.get(u.sourceDocument)||0)+1));
    const paths=sourceMapEdges.map((e,i)=>{const p=pos[e.a],q=pos[e.b];if(!p||!q)return'';const max=Math.max(1,...sourceMapEdges.map(x=>x.count));const sw=1+3*Math.sqrt(e.count/max);const label=e.count>1?e.count:'';return `<g class="source-edge" data-edge="${i}" tabindex="0" role="button" aria-label="Explore ${e.count} comparison links between ${esc(title(e.a))} and ${esc(title(e.b))}"><line class="map-edge" stroke-width="${sw}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/><title>${esc(title(e.a))} ↔ ${esc(title(e.b))}: ${e.count} recorded comparison links</title>${label?`<text class="map-edge-label" x="${(p[0]+q[0])/2}" y="${(p[1]+q[1])/2-5}" text-anchor="middle">${label}</text>`:''}</g>`;}).join('');
    const nodes=docs.map(d=>{const p=pos[d.id]||[width/2,height/2],count=counts.get(d.id)||0,r=24+Math.min(30,Math.sqrt(count)*.75),coverage=coverageByDoc.get(d.id)||{},cl=docClass(d.id),alias=coverage.coverage?.includes('alias'),note=coverage.note||'',status=coverage.coverage||'coverage not classified';const badge=status.includes('complete')?'COMPLETE':status.includes('partial')?'PARTIAL':status.includes('sample')?'SAMPLE':status.includes('alias')?'ALIAS':status.includes('missing')?'MAPPING GAP':status.includes('reviewed')?'REVIEWED':'SELECTED';return `<g class="source-group" data-doc="${esc(d.id)}" tabindex="0" role="button" aria-label="Open ${esc(title(d.id))}; ${count} encoded graph items; coverage: ${esc(status)}"><circle class="source-node ${cl} ${alias?'alias':''}" cx="${p[0]}" cy="${p[1]}" r="${r}"/><text class="source-title ${cl==='draft'?'draft-label':''}" x="${p[0]}" y="${p[1]-4}">${esc(shortTitle(d.id))}</text><text class="source-count ${cl==='draft'?'draft-label':''}" x="${p[0]}" y="${p[1]+15}">${count.toLocaleString()} encoded</text><text class="coverage-badge" x="${p[0]}" y="${p[1]+r+14}" text-anchor="middle">${esc(badge)}</text><title>${esc(note)}</title></g>`;}).join('');
    mapEl.setAttribute('viewBox',`0 0 ${width*(100/mapZoom)} ${height*(100/mapZoom)}`);mapEl.innerHTML=`<g class="map-world">${paths}${nodes}</g>`;
    mapEl.querySelectorAll('.source-group').forEach(g=>{const go=()=>{const id=g.dataset.doc;versionFilter.value=id;updateResults();showDoc(id);};g.addEventListener('click',go);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
    mapEl.querySelectorAll('.source-edge').forEach(g=>{const go=()=>{const e=sourceMapEdges[Number(g.dataset.edge)];if(!e)return;searchInput.value='';versionFilter.value='';gradeFilter.value='';statusFilter.value='';updateResults();mapChoices.querySelectorAll('input').forEach(c=>c.checked=c.value===e.a||c.value===e.b);setView('benchmarks');if(e.sample?.sourceUnit&&byId.has(e.sample.sourceUnit))showNode(e.sample.sourceUnit);};g.addEventListener('click',go);g.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();go();}});});
    mapStatus.textContent=`${docs.length} source/version nodes · ${sourceMapEdges.length} source-to-source relationship groups · ${sourceMapEdges.reduce((s,e)=>s+e.count,0).toLocaleString()} recorded item-level links.`;
  }
  function populateMapSourceChoices() {
    const counts=new Map();units.forEach(u=>counts.set(u.sourceDocument,(counts.get(u.sourceDocument)||0)+1));
    mapChoices.innerHTML=docs.map(d=>`<label><input type="checkbox" value="${esc(d.id)}" ${defaultMapSources.has(d.id)?'checked':''}>${esc(shortTitle(d.id))} (${(counts.get(d.id)||0).toLocaleString()})</label>`).join('');
    mapChoices.querySelectorAll('input').forEach(x=>x.addEventListener('change',renderBenchmarkMap));
  }
  function renderBenchmarkMap() {
    if(selectedId && byId.has(selectedId)) return renderFocusMap(selectedId);
    const active=[...mapChoices.querySelectorAll('input:checked')].map(x=>x.value);
    const selectedUnits=units.filter(u=>active.includes(u.sourceDocument)&&(!versionFilter.value||u.sourceDocument===versionFilter.value)&&(!gradeFilter.value||u.gradeSpan===gradeFilter.value)&&(!statusFilter.value||u.status===statusFilter.value));
    const width=Math.max(1200,active.length*330),height=850,colW=width/Math.max(1,active.length),positions=new Map();
    const gradeOrder=['K','K–2','1','2','3','3–5','4','5','6','6–8','7','8','9','9–12','10','11','12','K–5','MS','HS','H','Unspecified'];
    const heading=active.map((doc,i)=>`<text class="map-heading" x="${i*colW+colW/2}" y="27" text-anchor="middle">${esc(shortTitle(doc))}</text>`).join('');
    const groups=new Map();selectedUnits.forEach(u=>{if(!groups.has(u.sourceDocument))groups.set(u.sourceDocument,new Map());const g=groups.get(u.sourceDocument),key=gradeLabel(u.gradeSpan);if(!g.has(key))g.set(key,[]);g.get(key).push(u);});
    active.forEach((doc,di)=>{
      const gs=groups.get(doc)||new Map();
      [...gs.keys()].sort((a,b)=>gradeOrder.indexOf(a)-gradeOrder.indexOf(b)).forEach(grade=>{
        const gi=gradeOrder.indexOf(grade), items=gs.get(grade).sort((a,b)=>(a.code||'').localeCompare(b.code||'')), cols=Math.max(1,Math.min(30,Math.ceil(Math.sqrt(items.length*320/29)))), rows=Math.ceil(items.length/cols), dx=320/cols, dy=Math.min(3,25/Math.max(1,rows));
        items.forEach((u,i)=>positions.set(u.id,[di*colW+5+(i%cols)*dx,65+gi*34+Math.floor(i/cols)*dy]));
      });
    });
    const guides=gradeOrder.map((_,i)=>`<line class="grade-guide" x1="0" y1="${56+i*34}" x2="${width}" y2="${56+i*34}"/>`).join('');
    const labels=active.map((doc,di)=>gradeOrder.map((grade,gi)=>groups.get(doc)?.has(grade)?`<text class="map-text" x="${di*colW+6}" y="${62+gi*34}">${esc(grade)}</text>`:'').join('')).join('');
    const selectedNeighbors=new Map();if(selectedId)(adj.get(selectedId)||[]).forEach(e=>{const other=e.a===selectedId?e.b:e.a;if(positions.has(other))selectedNeighbors.set(other,e);});
    let edges='';if(selectedId&&positions.has(selectedId))selectedNeighbors.forEach((e,nid)=>{const a=positions.get(selectedId),b=positions.get(nid);edges+=`<line class="map-edge active" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><title>${esc(e.assertion.relation||'related')}</title>`;});
    const dots=selectedUnits.map(u=>{const p=positions.get(u.id),isSel=u.id===selectedId,isNeighbor=selectedNeighbors.has(u.id),cls=`benchmark-dot ${docClass(u.sourceDocument)}${isSel?' selected':''}${isNeighbor?' neighbor':''}`;return `<circle class="${cls}" cx="${p[0]}" cy="${p[1]}" r="${isSel?7:isNeighbor?5:2.6}" data-node="${esc(u.id)}"><title>${esc(u.code)} · ${esc(shortTitle(u.sourceDocument))} · ${esc(u.status||'status unclassified')} · ${esc((u.text||'').slice(0,180))}</title></circle>`;}).join('');
    mapEl.setAttribute('viewBox',`0 0 ${width*(100/mapZoom)} ${height*(100/mapZoom)}`);mapEl.innerHTML=`<g class="map-world">${guides}${heading}${labels}${edges}${dots}</g>`;
    mapEl.querySelectorAll('[data-node]').forEach(c=>c.addEventListener('click',()=>showNode(c.dataset.node)));
    mapStatus.textContent=`${selectedUnits.length.toLocaleString()} benchmark/source items shown across ${active.length} selected versions. ${selectedId?`${selectedNeighbors.size} linked neighbor(s) highlighted; select a dot or use the searchable list.`:'Select an item from search to reveal its recorded cross-version connections.'} Grade labels group items for navigation only; they do not indicate a within-year teaching sequence.`;
  }
  function focusNeighborhood(root, depthLimit) {
    const depthById=new Map([[root,0]]), keptEdges=new Map(), frontier=[root];
    const maxNodes=250;
    for(let depth=0;depth<depthLimit && frontier.length;depth++){
      const next=[];
      for(const id of frontier){
        const outgoing=(adj.get(id)||[]).filter(e=>e.assertion?.relation!=='sourceDocumentOf' && [e.a,e.b].every(x=>['TextUnit','Concept'].includes(byId.get(x)?.type)));
        outgoing.sort((a,b)=>title(a.a===id?a.b:a.a).localeCompare(title(b.a===id?b.b:b.a)));
        for(const e of outgoing){
          const other=e.a===id?e.b:e.a, key=[e.a,e.b].sort().join('|');
          if(!keptEdges.has(key))keptEdges.set(key,e);
          if(!depthById.has(other)&&depthById.size<maxNodes){depthById.set(other,depth+1);next.push(other);}
        }
      }
      frontier.splice(0,frontier.length,...next);
    }
    const truncated=[...frontier].some(id=>(adj.get(id)||[]).some(e=>e.assertion?.relation!=='sourceDocumentOf' && [e.a,e.b].every(x=>['TextUnit','Concept'].includes(byId.get(x)?.type)) && !depthById.has(e.a===id?e.b:e.a)));
    return {depthById,edges:[...keptEdges.values()],truncated};
  }
  function renderFocusMap(root) {
    const depthLimit=Number($('#focus-depth').value)||0;
    const {depthById,edges,truncated}=focusNeighborhood(root,depthLimit);
    const levels=new Map();depthById.forEach((d,id)=>{if(!levels.has(d))levels.set(d,[]);levels.get(d).push(id);});
    const width=1120, ringGap=210, maxDepth=Math.max(0,...depthById.values()), height=Math.max(760,2*(maxDepth*ringGap+120)),cx=width/2,cy=height/2,positions=new Map([[root,[cx,cy]]]);
    for(let d=1;d<=maxDepth;d++){
      const ids=(levels.get(d)||[]).sort((a,b)=>title(a).localeCompare(title(b))), radius=d*ringGap, start=-Math.PI/2;
      ids.forEach((id,i)=>{const angle=start+2*Math.PI*i/Math.max(1,ids.length);positions.set(id,[cx+radius*Math.cos(angle),cy+radius*Math.sin(angle)]);});
    }
    const visibleEdges=edges.filter(e=>positions.has(e.a)&&positions.has(e.b));
    const lines=visibleEdges.map(e=>{const p=positions.get(e.a),q=positions.get(e.b),relation=e.assertion?.relation||'related';return `<line class="focus-edge" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"><title>${esc(relation)} · ${esc(e.assertion?.evidence||'No evidence note recorded.')}</title></line>`;}).join('');
    const circles=[...positions].map(([id,p])=>{const n=byId.get(id),d=depthById.get(id)||0,label=n.code||n.conceptId||title(id),selected=id===root;return `<g class="focus-node depth-${d}${selected?' selected':''}" data-node="${esc(id)}" tabindex="0" role="button" aria-label="Focus on ${esc(label)}; ${d===0?'selected item':`${d} connection${d===1?'':'s'} away`}"><circle cx="${p[0]}" cy="${p[1]}" r="${selected?19:12}"/><text x="${p[0]}" y="${p[1]+(selected?36:29)}" text-anchor="middle">${esc(label.length>34?label.slice(0,31)+'…':label)}</text><title>${esc(label)} · ${esc(n.text||'')}</title></g>`;}).join('');
    mapEl.setAttribute('viewBox',`${cx-width*(100/mapZoom)/2} ${cy-height*(100/mapZoom)/2} ${width*(100/mapZoom)} ${height*(100/mapZoom)}`);
    mapEl.innerHTML=`<g class="map-world">${[...Array(maxDepth)].map((_,i)=>`<circle class="focus-ring" cx="${cx}" cy="${cy}" r="${(i+1)*ringGap}"/>`).join('')}${lines}${circles}</g>`;
    mapEl.querySelectorAll('[data-node]').forEach(g=>{const go=()=>showNode(g.dataset.node,{scroll:false});g.addEventListener('click',go);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
    mapStatus.textContent=`Focused on ${title(root)} · ${depthById.size.toLocaleString()} item(s) through ${depthLimit} connection(s) · ${visibleEdges.length.toLocaleString()} recorded links${truncated?' · display capped at 250 nodes; increase depth only when needed':''}. Select any node to refocus.`;
  }
  function setView(mode) {
    viewMode=mode;$('#view-sources').setAttribute('aria-pressed',String(mode==='sources'));$('#view-benchmarks').setAttribute('aria-pressed',String(mode==='benchmarks'));
    mapChoices.hidden=mode!=='benchmarks';
    $('#map-explanation').textContent=mode==='sources'?'Source-level overview. Each circle represents a source/version node; size reflects how many items are encoded for comparison. Links summarize recorded benchmark relationships across sources. Counts describe graph coverage, not the full size or importance of the source.':'Benchmark-level map. Columns group items by source version and rows by grade/course. Select a dot, or search below, to reveal its recorded links. Connections are drawn for the selected benchmark so the map stays readable; the searchable relationship list retains the evidence notes.';
    if(mode==='sources')renderSourceMap();else renderBenchmarkMap();
  }
  function updateMap() { if(viewMode==='sources')renderSourceMap();else renderBenchmarkMap(); }
  function addEdge(a,b,assertion) {
    if (!a||!b||a===b||!byId.has(a)||!byId.has(b)) return;
    const e={a,b,assertion};
    if(!adj.has(a))adj.set(a,[]); if(!adj.has(b))adj.set(b,[]);
    adj.get(a).push(e); adj.get(b).push(e);
  }
  function addAssertionEdges(a) {
    const links=[];
    if(a.sourceUnit)links.push(a.sourceUnit);
    if(a.targetUnit)links.push(a.targetUnit);
    if(a.unit)links.push(a.unit);
    if(a.concept)links.push(a.concept);
    if(a.sourceDocument)links.push(a.sourceDocument);
    if(a.targetDocument)links.push(a.targetDocument);
    if(a.document)links.push(a.document);
    const unique=[...new Set(links)];
    for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++)addEdge(unique[i],unique[j],a);
  }
  function searchText(n) {
    const d=byId.get(n.sourceDocument);
    return [n.id,n.code,n.gradeSpan,n.text,n.status,n.crosswalkNote,n.provenanceStatus,n.provenanceFollowup,n.conceptId,title(n.sourceDocument),d?.status].join(' ').toLowerCase();
  }
  function updateResults() {
    const q=searchInput.value.trim().toLowerCase(), ver=versionFilter.value, grade=gradeFilter.value, state=statusFilter.value;
    results=[...units,...concepts].filter(n=>(!q||searchText(n).includes(q))&&(!ver||n.sourceDocument===ver)&&(!grade||n.gradeSpan===grade)&&(!state||n.status===state));
    results.sort((a,b)=> (a.type===b.type?0:(a.type==='TextUnit'?-1:1)) || title(a.sourceDocument).localeCompare(title(b.sourceDocument)) || (a.code||a.conceptId||'').localeCompare(b.code||b.conceptId||''));
    shown=0; resultsEl.innerHTML=''; renderMore();
    countEl.textContent=`${results.length.toLocaleString()} matching items${q||ver||grade||state?'':' · search across all represented sources'}`;
  }
  function renderMore() {
    const frag=document.createDocumentFragment(), end=Math.min(shown+batch,results.length);
    for(;shown<end;shown++){
      const n=results[shown], b=document.createElement('button'); b.type='button'; b.className='result-card'; b.setAttribute('role','listitem'); b.dataset.id=n.id;
      b.setAttribute('aria-current',String(n.id===selectedId));
      const meta=n.type==='Concept'?'Concept':`${title(n.sourceDocument)}${n.gradeSpan?` · Grade ${n.gradeSpan}`:''}${n.status?` · ${n.status}`:''}`;
      b.innerHTML=`<strong>${esc(n.code||n.conceptId||title(n.id))}</strong><span class="card-meta">${esc(meta)}</span><span class="card-text">${esc(textPreview(n).slice(0,300))}${textPreview(n).length>300?'…':''}</span>`;
      b.addEventListener('click',()=>showNode(n.id)); frag.append(b);
    }
    resultsEl.append(frag); moreBtn.hidden=shown>=results.length;
  }
  function linkList(urls) { return urls.map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join(' · '); }
  function makeNeighborhood(id) {
    const edges=(adj.get(id)||[]).slice(0,10), ids=[id];
    edges.forEach(e=>{const other=e.a===id?e.b:e.a;if(!ids.includes(other)&&ids.length<11)ids.push(other);});
    if(ids.length<2)return '<p>No explicit graph connection is recorded for this item. That absence should not be read as evidence of no relationship.</p>';
    const cx=400,cy=138,rx=290,ry=96, coords=new Map();
    ids.forEach((nid,i)=>{if(i===0)coords.set(nid,[cx,cy]);else{const a=(2*Math.PI*(i-1)/Math.max(1,ids.length-1))-Math.PI/2;coords.set(nid,[cx+rx*Math.cos(a),cy+ry*Math.sin(a)]);}});
    const lines=edges.filter(e=>coords.has(e.a===id?e.b:e.a)).map(e=>{const other=e.a===id?e.b:e.a,p=coords.get(other);return `<line class="edge" x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}"/><text x="${(cx+p[0])/2}" y="${(cy+p[1])/2-4}" text-anchor="middle">${esc(e.assertion.relation||'related')}</text>`;}).join('');
    const circles=ids.map(nid=>{const n=byId.get(nid),p=coords.get(nid),sel=nid===id,label=(n.code||n.conceptId||title(nid));return `<g tabindex="0" role="button" aria-label="Open ${esc(label)}" data-node="${esc(nid)}"><circle class="node ${sel?'selected':''}" cx="${p[0]}" cy="${p[1]}" r="${sel?27:21}"/><text class="node-label ${sel?'selected':''}" x="${p[0]}" y="${p[1]+42}" text-anchor="middle">${esc(label.slice(0,28))}</text></g>`;}).join('');
    return `<svg class="neighborhood" viewBox="0 0 800 280" role="group" aria-label="Selected item and its recorded graph connections">${lines}${circles}</svg>`;
  }
  function addNeighborhoodHandlers() { detailEl.querySelectorAll('[data-node]').forEach(el=>{const go=()=>showNode(el.dataset.node);el.addEventListener('click',go);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});}); }
  function showDocumentLinks(docId) {
    const urls=sourceURLs[docId]||[];
    return `<div class="detail-links">${urls.length?linkList(urls):'<span>Direct source URL not recorded in this graph entry; see source filenames and review links below.</span>'}${linkList(reviewLinks)}</div>`;
  }
  function showDoc(id) {
    const d=byId.get(id); if(!d)return;
    selectedId=id;
    history.replaceState(null,'',`#${encodeURIComponent(id)}`);
    const nodeCount=units.filter(u=>u.sourceDocument===id).length;
    const files=(d.sourceFiles||[]).map(f=>`<li><code>${esc(f.file)}</code>${f.sha256?` · SHA-256 <code>${esc(f.sha256)}</code>`:''}</li>`).join('');
    const coverage=coverageByDoc.get(id);
    detailEl.innerHTML=`<p class="item-kicker">Source version · ${esc(coverage?.coverage||'coverage not assessed')}</p><h2 id="detail-title">${esc(title(id))}</h2><p>${esc(d.status||'')}</p><p><strong>${nodeCount.toLocaleString()}</strong> text items are assigned to this source node in the graph.</p>${coverage?.note?`<p class="coverage-warning"><strong>Coverage note:</strong> ${esc(coverage.note)}</p>`:''}<h3>Open source or related review</h3>${showDocumentLinks(id)}<h3>Source files recorded in the graph</h3><ul>${files||'<li>No source file names recorded.</li>'}</ul><p>Source links open the original host. Text reproduced in this graph is the item-level content available in the published research data. Graph node counts are not source document size or evidence that unrepresented material is absent.</p>`;
    updateSelectionStyle();
  }
  function showNode(id,options={}) {
    const n=byId.get(id); if(!n)return;
    if(n.type==='StandardVersion')return showDoc(id);
    selectedId=id; history.replaceState(null,'',`#${encodeURIComponent(id)}`); updateSelectionStyle();
    if(n.sourceDocument){const choice=mapChoices.querySelector(`input[value="${CSS.escape(n.sourceDocument)}"]`);if(choice)choice.checked=true;}
    if(viewMode!=='benchmarks')setView('benchmarks');else renderBenchmarkMap();
    if(options.scroll!==false)$('#map-heading').scrollIntoView({behavior:'smooth',block:'start'});
    const isUnit=n.type==='TextUnit', doc=byId.get(n.sourceDocument), rels=adj.get(id)||[], isDraftBenchmark=isUnit&&n.sourceDocument==='doc:fl-science-2026-draft'&&n.code&&!/[;,]/.test(n.code);
    const direct=rels.map(e=>({e,other:e.a===id?e.b:e.a})).filter(x=>byId.has(x.other)).slice(0,80);
    const materialRecord=materialsByCode.get(n.code), resources=materialRecord?.resources||[];
    const materialStatus=materialRecord?.status||'not_assessed';
    const materialLabel={not_assessed:'Not inventoried',located:'Resource located; fit not fully verified',verified:'Resource fit reviewed',none_found_in_search:'None found in a bounded search'}[materialStatus]||materialStatus;
    const material=resources.length?resources.map(r=>`<li>${r.viewUrl?`<a href="${esc(r.viewUrl)}">${esc(r.title||'Prepared curriculum material')} (view content)</a>`:esc(r.title||'Prepared curriculum material')}${r.url?` · <a href="${esc(r.url)}" target="_blank" rel="noopener">source</a>`:''} · ${esc(r.format||'format not stated')}${r.gradeFit?` · grades: ${esc(r.gradeFit)}`:''}${r.benchmarkFit?` · fit: ${esc(r.benchmarkFit)}`:''}${r.accessibility?` · accessibility: ${esc(r.accessibility)}`:''}${r.redistribution?` · redistribution: ${esc(r.redistribution)}`:''}</li>`).join(''):'<li>No prepared curriculum material is linked in the current inventory. This does not mean none is available.</li>';
    const relationRows=direct.map(({e,other})=>`<li><strong>${esc(e.assertion.relation||'related')}</strong> · <button type="button" data-open-node="${esc(other)}">${esc(title(other))}</button><div class="relation-meta">${esc(e.assertion.evidence||e.assertion.status||'No evidence note recorded.')}${e.assertion.confidence!==undefined?` · confidence recorded as ${esc(e.assertion.confidence)}`:''}${e.assertion.method?` · method: ${esc(e.assertion.method)}`:''}</div></li>`).join('');
    const sourcefiles=n.sourceFiles||[];
    detailEl.innerHTML=`<p class="item-kicker">${isUnit?'Benchmark / source text':'Concept'}</p><h2 id="detail-title">${esc(n.code||n.conceptId||n.id)}</h2><div class="item-content">${esc(textPreview(n)||'This graph node points to a source item, but does not include its complete text. Use the source locator and links below.')}</div>${n._sourceMappingMissing?'<p class="coverage-warning"><strong>Source mapping missing:</strong> this graph item has no sourceDocument assignment. It is grouped under the processing-gap node until its original source is identified.</p>':''}${isUnit&&n.sourceDocument==='doc:fl-science-2026-draft'&&!isDraftBenchmark?'<p class="coverage-warning"><strong>Aggregate source row:</strong> this is not one of the 1,512 leaf benchmark IDs; material availability is not applicable at this row level.</p>':''}<div class="detail-grid"><p><strong>Source:</strong> <button type="button" class="text-link" data-open-node="${esc(n.sourceDocument||'')}">${esc(title(n.sourceDocument))}</button></p><p><strong>Grade/course:</strong> ${esc(n.gradeSpan||'Not specified')}</p><p><strong>Comparison status:</strong> ${esc(n.status||'Not classified in this node')}</p><p><strong>Source locator:</strong> ${esc(n.pageOrAnchor||'Not recorded')}</p></div>${isDraftBenchmark?`<div class="material-flag ${materialStatus==='verified'?'available':''}"><strong>Prepared curriculum material: ${esc(materialLabel)}</strong>${materialRecord?.checkedOn?`<p>Checked: ${esc(materialRecord.checkedOn)}${materialRecord.searchScope?` · Search scope: ${esc(materialRecord.searchScope)}`:''}</p>`:''}<ul>${material}</ul><p>Inventory details and redistribution fields: <a href="curriculum-materials.json">curriculum-materials.json</a>. Content is shown locally only when the recorded rights allow; otherwise, follow the source link.</p></div>`:''}${n.crosswalkNote?`<h3>Comparison note</h3><p>${esc(n.crosswalkNote)}</p>`:''}${n.provenanceStatus?`<h3>Provenance status</h3><p>${esc(n.provenanceStatus)}</p>`:''}${n.provenanceFollowup?`<p><strong>Follow-up:</strong> ${esc(n.provenanceFollowup)}</p>`:''}<h3>Source access</h3>${showDocumentLinks(n.sourceDocument)}${sourcefiles.length?`<p><strong>File references:</strong> ${sourcefiles.map(f=>`<code>${esc(f.file)}</code>${f.sha256?` <span class="relation-meta">(SHA-256 ${esc(f.sha256)})</span>`:''}`).join(' · ')}</p>`:''}<p>The map above highlights this item and its recorded cross-version neighbors. The list below preserves the relationship labels, evidence notes, and confidence values for review.</p><h3>Recorded relationships (${direct.length})</h3>${direct.length?`<ul class="relation-list">${relationRows}</ul>`:'<p>No explicit relationship is recorded in the graph for this item. This is not evidence that no relationship exists.</p>'}`;
    detailEl.querySelectorAll('[data-open-node]').forEach(b=>b.addEventListener('click',()=>showNode(b.dataset.openNode)));
  }
  function updateSelectionStyle(){resultsEl.querySelectorAll('.result-card').forEach(b=>b.setAttribute('aria-current',String(b.dataset.id===selectedId)));}
  async function init(){
    try{
      const [a,b,c,d]=await Promise.all([fetch(graphURL),fetch(addendumURL),fetch(materialsURL),fetch(coverageURL)]);
      if(!a.ok)throw new Error(`Graph request returned ${a.status}`);
      const primary=await a.json(), extra=b.ok?await b.json():{'@graph':[]}, materials=c.ok?await c.json():{records:[]}, coverage=d.ok?await d.json():{sources:{}};
      (materials.records||[]).forEach(r=>{if(r.benchmarkId)materialsByCode.set(r.benchmarkId,r);});
      Object.entries(coverage.sources||{}).forEach(([id,record])=>coverageByDoc.set(id,record));
      const all=[...(primary['@graph']||[]),...(extra['@graph']||[])];
      all.forEach(n=>{if(!byId.has(n.id))byId.set(n.id,n);});
      byId.forEach(n=>{if(n.type==='StandardVersion')docs.push(n);else if(n.type==='TextUnit')units.push(n);else if(n.type==='Concept')concepts.push(n);else if(n.type==='EvidenceAssertion')assertions.push(n);});
      const unmapped=units.filter(n=>!n.sourceDocument);
      if(unmapped.length){const id='doc:unassigned-source';const placeholder={id,type:'StandardVersion',status:`${unmapped.length} TextUnits have no sourceDocument assignment in the graph; this is a processing gap.`,sourceFiles:[]};byId.set(id,placeholder);docs.push(placeholder);unmapped.forEach(n=>{n.sourceDocument=id;n._sourceMappingMissing=true;});}
      assertions.forEach(addAssertionEdges);
      units.forEach(n=>{if(n.sourceDocument)addEdge(n.id,n.sourceDocument,{relation:'sourceDocumentOf',evidence:'Source-document association recorded on the text item.'});});
      docs.sort((a,b)=>title(a.id).localeCompare(title(b.id)));
      initOptions(); populateMapSourceChoices(); buildSourceMapEdges(); updateResults(); renderSourceMap();
      if(location.hash){const id=decodeURIComponent(location.hash.slice(1));if(byId.has(id))showNode(id);}
    }catch(err){countEl.textContent='The graph could not be loaded.';resultsEl.innerHTML=`<p class="loading-error">${esc(err.message)}. Use the JSON download and source reports linked below.</p>`;}
  }
  searchInput.addEventListener('input',updateResults);
  [versionFilter,gradeFilter,statusFilter].forEach(el=>el.addEventListener('change',()=>{updateResults();updateMap();}));
  $('#view-sources').addEventListener('click',()=>setView('sources'));
  $('#view-benchmarks').addEventListener('click',()=>setView('benchmarks'));
  $('#map-reset').addEventListener('click',()=>{mapZoom=100;selectedId=null;$('#map-zoom').value='100';$('#zoom-value').textContent='100%';updateMap();});
  $('#map-zoom').addEventListener('input',e=>{mapZoom=Number(e.target.value)||100;$('#zoom-value').textContent=`${mapZoom}%`;updateMap();});
  $('#focus-depth').addEventListener('change',()=>updateMap());
  moreBtn.addEventListener('click',renderMore);
  init();
})();
