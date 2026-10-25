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
    'doc:external:indiana-2000': 'Indiana Academic Standards for Science (2000; K–8)',
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
    'doc:external:8f3e333f4967c18a': [{label:'Florida Citizens for Science 2007 public proposal',url:'https://www.flascience.org/FCSstandards.pdf'}],
    'doc:external:indiana-2000': [{label:'Indiana standards collection on ERIC',url:'https://eric.ed.gov/?q=Indiana+Academic+Standards+Science+2000'}],
    'doc:corpus:fldoe-workgroup-call': [{label:'FLDOE workgroup-call memorandum (DPS 2024-199)',url:'https://info.fldoe.org/docushare/dsweb/Get/Document-10448/DPS-2024-199.pdf'}],
    'doc:corpus:fldoe-listening-tour': [{label:'FLDOE standards review portal',url:'https://www.fldoe.org/standardsreview/'}],
    'doc:corpus:florida-1998-review': [{label:'ERIC record for the 1998 review report',url:'https://eric.ed.gov/?id=ED439133'}],
    'doc:corpus:ngss-dci': [{label:'NGSS three dimensions',url:'https://www.nextgenscience.org/three-dimensions'}],
    'doc:corpus:ngss-appendix-e': [{label:'Official NGSS Appendix E PDF',url:'https://www.nextgenscience.org/sites/ngss/files/Appendix%20E%20-%20Progressions%20within%20NGSS%20-%20052213.pdf'},{label:'NGSS appendices page',url:'https://www.nextgenscience.org/resources/ngss-appendices'}],
    'doc:corpus:ngss-ms-ls-evidence': [{label:'Official MS-LS Evidence Statements',url:'https://www.nextgenscience.org/evidence-statement/ms-ls-evidence-statements'}],
    'doc:corpus:nrc-framework-brief': [{label:'National Academies Framework publication',url:'https://nap.nationalacademies.org/catalog/13165/a-framework-for-k-12-science-education-practices-crosscutting-concepts-and-core-ideas'}],
    'doc:corpus:massachusetts-2016': [{label:'Massachusetts STE standards and 2016 framework',url:'https://www.doe.mass.edu/stem/ste/standards.html'}]
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
  const mapEl = $('#corpus-map'), mapStatus = $('#map-status'), mapChoices = $('#map-source-choices'), mapViewport = $('#map-scroll');
  const searchInput = $('#graph-search'), versionFilter = $('#version-filter'), gradeFilter = $('#grade-filter'), statusFilter = $('#status-filter'), materialFilter = $('#material-filter');
  const resultsEl = $('#result-list'), countEl = $('#result-count'), moreBtn = $('#more-results'), detailDialog = $('#item-detail'), detailEl = $('#item-detail-body');
  let results = [], shown = 0, selectedId = null;
  let viewMode = 'sources', sourceLayout = 'curated', mapZoom = 100, mapPanX = 0, mapPanY = 0, sourceMapEdges = [];
  let viewGeometry = {width:1200,height:620,cx:600,cy:310}, dragState = null;
  const defaultMapSources = new Set(['doc:fl-science-2026-draft']);
  const comparisonMapSources = new Set(['doc:fl-science-2026-draft','doc:fl-science-2008','doc:fl-science-1996','doc:fl-science-gle-1999','doc:ngss-all-topic-standards']);
  const batch = 50;
  function esc(v='') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function applyMapViewBox() {
    const width=viewGeometry.width*(100/mapZoom),height=viewGeometry.height*(100/mapZoom);
    const x=viewGeometry.cx-width/2+mapPanX,y=viewGeometry.cy-height/2+mapPanY;
    mapEl.setAttribute('viewBox',`${x} ${y} ${width} ${height}`);
  }
  function setMapGeometry(width,height,cx=width/2,cy=height/2) {
    viewGeometry={width,height,cx,cy}; applyMapViewBox();
  }
  function openDetails() { if(!detailDialog.open)detailDialog.showModal(); }
  function setZoom(value) {
    mapZoom=Math.min(400,Math.max(45,Number(value)||100));
    $('#map-zoom').value=String(mapZoom);$('#zoom-value').textContent=`${mapZoom}%`;applyMapViewBox();
  }
  function title(id) {
    if (!id) return 'Unspecified source';
    if (labelMap[id]) return labelMap[id];
    const n = byId.get(id);
    if (n?.type === 'Concept') return n.text || n.conceptId || id;
    if (n?.type === 'TextUnit') return n.code || id;
    if (n?.type === 'StandardVersion') return n.title || (n.sourceFiles||[])[0]?.file || id;
    return id;
  }
  function textPreview(n) { return n.type === 'Concept' ? n.text : (n.text || ''); }
  function itemStatus(n) { return n.status || n.reviewStatus || ''; }
  function statusCategory(n) {
    if(n.status)return n.status;
    const s=String(n.reviewStatus||'').toLowerCase();
    if(s.includes('unreviewed'))return 'unreviewed lead';
    if(s.startsWith('reviewed direct-anchor'))return 'reviewed direct anchor';
    if(s.startsWith('reviewed source-first'))return 'reviewed source-first';
    if(s.includes('retained/relocated'))return 'retained/relocated';
    if(s.includes('partial'))return 'partial continuity';
    if(s.includes('omission'))return 'possible omission';
    if(s.includes('source text')||s.includes('full source item'))return 'source text; comparison pending';
    return s?'review note recorded':'';
  }
  function materialStatus(n) {
    const record=materialsByCode.get(n.code);
    return record?.status || (n.sourceDocument==='doc:fl-science-2026-draft'?'not_assessed':'not_applicable');
  }
  function matchesMaterialFilter(n) {
    if(!materialFilter.value)return true;
    if(!isDraftUnit(n))return false;
    const record=materialsByCode.get(n.code),state=materialFilter.value;
    if(state==='has_resource')return Boolean(record?.resources?.length);
    return materialStatus(n)===state;
  }
  function initOptions() {
    const docCounts = new Map();
    units.forEach(n => docCounts.set(n.sourceDocument,(docCounts.get(n.sourceDocument)||0)+1));
    docs.forEach(d => { const o=document.createElement('option'); o.value=d.id; o.textContent=title(d.id); versionFilter.append(o); });
    const grades=[...new Set(units.map(n=>n.gradeSpan).filter(Boolean))].sort((a,b)=>gradeSort(a)-gradeSort(b));
    grades.forEach(g=>{const o=document.createElement('option');o.value=g;o.textContent=/^\d+$/.test(g)?`Grade ${Number(g)}`:g;gradeFilter.append(o);});
    const states=[...new Set(units.map(statusCategory).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    states.forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;statusFilter.append(o);});
    const host=$('#source-cards');
    host.innerHTML=docs.map(d=>{const c=coverageByDoc.get(d.id),count=docCounts.get(d.id)||0;return `<article class="source-card"><h3>${esc(title(d.id))}</h3><p>${esc(d.status||'Source version')}</p><p><strong>${count.toLocaleString()}</strong> encoded items · ${esc(c?.coverage||'coverage unassessed')}</p>${c?.note?`<p class="coverage-warning">${esc(c.note)}</p>`:''}<button type="button" data-doc="${esc(d.id)}">${count?'Browse encoded items':'View source record'}</button></article>`;}).join('');
    host.querySelectorAll('button[data-doc]').forEach(b=>b.addEventListener('click',()=>{versionFilter.value=b.dataset.doc;searchInput.value='';gradeFilter.value='';statusFilter.value='';updateResults();showDoc(b.dataset.doc);}));
  }
  function gradeSort(g) { const m=String(g).match(/\d+/); return m?Number(m[0]):100; }
  function gradeLabel(g) { return ({'912':'9–12','9-12':'9–12','9–12':'9–12','6-8':'6–8','6–8':'6–8','3-5':'3–5','3–5':'3–5','K-2':'K–2','K–2':'K–2'})[String(g)]||String(g||'Unspecified'); }
  function shortTitle(id) {
    return ({'doc:fl-science-2026-draft':'2026 Florida draft','doc:fl-science-2008':'Florida 2008','doc:fl-science-1996':'Florida 1996','doc:fl-science-gle-1999':'Florida GLE 1998/99','doc:ngss-all-topic-standards':'NGSS','doc:external:8f3e333f4967c18a':'FCS proposal 2007','doc:south-carolina-science-2014':'South Carolina 2014','doc:external:89574ee13dd2c447':'South Carolina copy','doc:external:9aab810f0e14c6e9':'Massachusetts 2006','doc:external:a6ff73f1309c8ec5':'California 2006','doc:external:indiana-2000':'Indiana 2000 K–8','doc:corpus:fldoe-workgroup-call':'FLDOE workgroup call','doc:corpus:fldoe-listening-tour':'FLDOE listening tour','doc:corpus:florida-1998-review':'Florida 1998 review report','doc:corpus:florida-1996-fcat':'Florida 1996 assessment','doc:corpus:florida-gle-assessment':'Florida GLE assessment','doc:corpus:fcat-alignment':'FCAT alignment memo','doc:corpus:aaas-2007-presentation':'AAAS 2007 process','doc:corpus:achieve-2007-presentation':'Achieve 2007 process','doc:corpus:naep-2007-presentation':'NAEP 2007 process','doc:corpus:new-standards-2007-presentation':'2007 rationale presentation','doc:corpus:ngss-dci':'NGSS DCI','doc:corpus:ngss-appendix-e':'NGSS Appendix E','doc:corpus:ngss-ms-ls-evidence':'NGSS MS-LS evidence','doc:corpus:nrc-framework-brief':'NRC Framework brief','doc:corpus:massachusetts-2016':'Massachusetts 2016','doc:unassigned-source':'Unassigned source mapping'})[id]||title(id);
  }
  function docClass(id) { return id==='doc:unassigned-source'?'unassigned':id==='doc:fl-science-2026-draft'?'draft':id==='doc:fl-science-2008'||id==='doc:fl-science-1996'||id==='doc:fl-science-gle-1999'?'florida':'external'; }
  function locatorSourceDocs(unit) {
    const locator=String(unit?.pageOrAnchor||'').toLowerCase().replace(/\\/g,'/'),found=new Set();
    if(!locator)return [];
    docs.forEach(doc=>(doc.sourceFiles||[]).forEach(file=>{
      const path=String(file.file||'').toLowerCase().replace(/\\/g,'/');if(!path)return;
      const stem=path.replace(/\.(pdf|txt|md|csv|xls|xlsx|ppt|pptx)$/i,'');
      const candidates=[path,stem+'.txt',stem+'.pdf',path.split('/').pop(),stem.split('/').pop()];
      if(candidates.some(value=>value.length>8&&locator.includes(value)))found.add(doc.id);
    }));
    return [...found];
  }
  function buildSourceMapEdges() {
    const agg=new Map();
    function group(from,to) {
      if(!from||!to||from===to)return null;
      const [a,b]=[from,to].sort(),key=`${a}|${b}`;
      if(!agg.has(key))agg.set(key,{a,b,count:0,referenceCount:0,relations:new Map(),sample:null,referenceSample:null});
      return agg.get(key);
    }
    assertions.forEach(a=>{
      if(a.method==='semantic_neighbor_screen')return;
      if(!a.sourceUnit||!a.targetUnit||!byId.has(a.sourceUnit)||!byId.has(a.targetUnit))return;
      const source=byId.get(a.sourceUnit),target=byId.get(a.targetUnit),from=source.sourceDocument,to=target.sourceDocument;
      if(from&&!source._sourceMappingMissing&&to&&!target._sourceMappingMissing&&from!==to){
        const e=group(from,to);e.count++;e.relations.set(a.relation,(e.relations.get(a.relation)||0)+1);if(!e.sample)e.sample=a;
      }
      const unmapped=source._sourceMappingMissing?source:target._sourceMappingMissing?target:null;
      const mapped=unmapped===source?target:source;
      if(unmapped&&mapped.sourceDocument&&!mapped._sourceMappingMissing){
        locatorSourceDocs(unmapped).forEach(docId=>{
          if(docId===mapped.sourceDocument)return;
          const e=group(docId,mapped.sourceDocument);if(!e)return;
          e.referenceCount++;if(!e.referenceSample)e.referenceSample={assertion:a,focusUnit:mapped.id};
        });
      }
    });
    sourceMapEdges=[...agg.values()].sort((a,b)=>(b.count+b.referenceCount)-(a.count+a.referenceCount));
  }
  function renderSourceMap() {
    let width=1700,height=1120, headings='';
    const pos={
      'doc:fl-science-2026-draft':[600,300], 'doc:fl-science-2008':[330,300], 'doc:fl-science-1996':[130,210], 'doc:fl-science-gle-1999':[150,435],
      'doc:ngss-all-topic-standards':[930,155], 'doc:external:8f3e333f4967c18a':[970,435], 'doc:south-carolina-science-2014':[890,535],
      'doc:external:89574ee13dd2c447':[1060,525], 'doc:external:9aab810f0e14c6e9':[1060,280], 'doc:external:a6ff73f1309c8ec5':[880,300], 'doc:external:indiana-2000':[620,540], 'doc:unassigned-source':[380,520]
    };
    if(sourceLayout==='families'){
      const family=id=>id==='doc:unassigned-source'?0:(id.startsWith('doc:fl-science')||id==='doc:external:8f3e333f4967c18a'||id.startsWith('doc:corpus:florida')||id.startsWith('doc:corpus:fcat')||id.startsWith('doc:corpus:aaas')||id.startsWith('doc:corpus:achieve')||id.startsWith('doc:corpus:naep')||id.startsWith('doc:corpus:new-standards'))?0:id.startsWith('doc:corpus:')?2:1;
      const labels=['Florida standards and proposals','External standards comparisons','Process and framework records'],xs=[360,1080,1800],groups=[[],[],[]];
      docs.forEach(d=>groups[family(d.id)].push(d));width=2160;height=Math.max(760,...groups.map(g=>150+g.length*155));
      headings=labels.map((label,i)=>`<text class="source-group-heading" x="${xs[i]}" y="45" text-anchor="middle">${esc(label)}</text>`).join('');
      groups.forEach((group,gi)=>group.forEach((d,i)=>{pos[d.id]=[xs[gi],130+i*155];}));
    }else{
      const extra=docs.filter(d=>!pos[d.id]);
      extra.forEach((d,i)=>{pos[d.id]=[170+(i%5)*340,720+Math.floor(i/5)*170];});
      height=Math.max(height,720+Math.ceil(extra.length/5)*170);
    }
    const counts=new Map();units.forEach(u=>counts.set(u.sourceDocument,(counts.get(u.sourceDocument)||0)+1));
    const max=Math.max(1,...sourceMapEdges.map(x=>x.count));
    const paths=sourceMapEdges.map((e,i)=>{const p=pos[e.a],q=pos[e.b];if(!p||!q)return'';const sw=e.count?1.5+4.5*Math.sqrt(e.count/max):0,dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy)||1,ox=-dy/len*5,oy=dx/len*5,label=e.count>1?e.count:'',relationCounts=[...e.relations].map(([name,count])=>`${name}: ${count}`).join('; ');return `<g class="source-edge" data-edge="${i}" tabindex="0" role="button" aria-label="Explore ${e.count} recorded comparison links and ${e.referenceCount} source-file mentions in locators between ${esc(title(e.a))} and ${esc(title(e.b))}">${e.count?`<line class="map-edge" stroke-width="${sw}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`:''}${e.referenceCount?`<line class="map-edge locator-reference" x1="${p[0]+ox}" y1="${p[1]+oy}" x2="${q[0]+ox}" y2="${q[1]+oy}"/>`:''}<line class="edge-hit-target" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/><title>${esc(title(e.a))} ↔ ${esc(title(e.b))}: ${e.count} recorded comparison links${relationCounts?` (${esc(relationCounts)})`:''}; ${e.referenceCount} additional source-file mentions in item locators. These citations provide context and do not establish benchmark equivalence.</title>${label?`<text class="map-edge-label" x="${(p[0]+q[0])/2}" y="${(p[1]+q[1])/2-5}" text-anchor="middle">${label}</text>`:''}</g>`;}).join('');
    const nodes=docs.map(d=>{const p=pos[d.id]||[width/2,height/2],count=counts.get(d.id)||0,r=24+Math.min(30,Math.sqrt(count)*.75),coverage=coverageByDoc.get(d.id)||{},cl=docClass(d.id),alias=coverage.coverage?.includes('alias'),note=coverage.note||'',status=coverage.coverage||'coverage not classified';const badge=count===0?'DOC ONLY':status.includes('complete')?'COMPLETE':status.includes('partial')?'PARTIAL':status.includes('sample')?'SAMPLE':status.includes('alias')?'ALIAS':status.includes('missing')?'MAPPING GAP':status.includes('reviewed')?'REVIEWED':'SELECTED';return `<g class="source-group" data-doc="${esc(d.id)}" tabindex="0" role="button" aria-label="Open ${esc(title(d.id))}; ${count} encoded graph items; coverage: ${esc(status)}"><circle class="source-node ${cl} ${alias?'alias':''}" cx="${p[0]}" cy="${p[1]}" r="${r}"/><text class="source-title ${cl==='draft'?'draft-label':''}" x="${p[0]}" y="${p[1]-4}">${esc(shortTitle(d.id))}</text><text class="source-count ${cl==='draft'?'draft-label':''}" x="${p[0]}" y="${p[1]+15}">${count.toLocaleString()} encoded</text><text class="coverage-badge" x="${p[0]}" y="${p[1]+r+14}" text-anchor="middle">${esc(badge)}</text><title>${esc(note)}</title></g>`;}).join('');
    mapEl.innerHTML=`<g class="map-world">${headings}${paths}${nodes}</g>`;setMapGeometry(width,height,width/2,height/2);
    mapEl.querySelectorAll('.source-group').forEach(g=>{const go=()=>{const id=g.dataset.doc;versionFilter.value=id;updateResults();showDoc(id);};g.addEventListener('click',go);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
    mapEl.querySelectorAll('.source-edge').forEach(g=>{const go=()=>{const e=sourceMapEdges[Number(g.dataset.edge)];if(!e)return;selectedId=null;searchInput.value='';versionFilter.value='';gradeFilter.value='';statusFilter.value='';updateResults();mapChoices.querySelectorAll('input').forEach(c=>c.checked=c.value===e.a||c.value===e.b);setView('benchmarks');const sample=e.sample?.sourceUnit||e.referenceSample?.focusUnit;if(sample&&byId.has(sample))showNode(sample);};g.addEventListener('click',go);g.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();go();}});});
    mapStatus.textContent=`${docs.length} source/version nodes · ${sourceMapEdges.length} source pairs · ${sourceMapEdges.reduce((s,e)=>s+e.count,0).toLocaleString()} recorded links · ${sourceMapEdges.reduce((s,e)=>s+e.referenceCount,0).toLocaleString()} source-file mentions in locators.`;
  }
  function populateMapSourceChoices() {
    const counts=new Map();units.forEach(u=>{if(u.sourceDocument!=='doc:fl-science-2026-draft'||isDraftUnit(u))counts.set(u.sourceDocument,(counts.get(u.sourceDocument)||0)+1);});
    mapChoices.innerHTML=`<span class="source-choice-title">Versions shown in benchmark view</span>`+docs.map(d=>`<label><input type="checkbox" value="${esc(d.id)}" ${defaultMapSources.has(d.id)?'checked':''}>${esc(shortTitle(d.id))} (${(counts.get(d.id)||0).toLocaleString()})</label>`).join('');
    mapChoices.querySelectorAll('input').forEach(x=>x.addEventListener('change',renderBenchmarkMap));
  }
  function renderBenchmarkMap() {
    if(selectedId && ['TextUnit','Concept'].includes(byId.get(selectedId)?.type)) return renderFocusMap(selectedId);
    const active=[...mapChoices.querySelectorAll('input:checked')].map(x=>x.value);
    const selectedUnits=units.filter(u=>active.includes(u.sourceDocument)&&(u.sourceDocument!=='doc:fl-science-2026-draft'||isDraftUnit(u))&&(!versionFilter.value||u.sourceDocument===versionFilter.value)&&(!gradeFilter.value||u.gradeSpan===gradeFilter.value)&&(!statusFilter.value||statusCategory(u)===statusFilter.value)&&matchesMaterialFilter(u));
    const width=2200,colW=width/Math.max(1,active.length),positions=new Map();
    const gradeOrder=['K','K–2','1','2','3','3–5','4','5','6','6–8','7','8','9','9–12','10','11','12','K–5','MS','HS','H','Unspecified'];
    const heading=active.map((doc,i)=>`<text class="map-heading" x="${i*colW+colW/2}" y="27" text-anchor="middle">${esc(shortTitle(doc))}</text>`).join('');
    const groups=new Map();selectedUnits.forEach(u=>{if(!groups.has(u.sourceDocument))groups.set(u.sourceDocument,new Map());const g=groups.get(u.sourceDocument),key=gradeLabel(u.gradeSpan);if(!g.has(key))g.set(key,[]);g.get(key).push(u);});
    const colsFor=items=>Math.max(1,Math.min(30,Math.ceil(Math.sqrt(items.length*320/29))));
    const activeGrades=gradeOrder.filter(grade=>active.some(doc=>groups.get(doc)?.has(grade)));
    const gradeTop=new Map();let nextGradeY=64;
    activeGrades.forEach(grade=>{
      gradeTop.set(grade,nextGradeY);
      const maxRows=Math.max(1,...active.map(doc=>{const items=groups.get(doc)?.get(grade)||[];return items.length?Math.ceil(items.length/colsFor(items)):0;}));
      nextGradeY+=maxRows*12+34;
    });
    const height=Math.max(420,nextGradeY+40);
    active.forEach((doc,di)=>{
      const gs=groups.get(doc)||new Map();
      activeGrades.forEach(grade=>{
        const items=(gs.get(grade)||[]).sort((a,b)=>(a.code||'').localeCompare(b.code||''));if(!items.length)return;
        const cols=colsFor(items),rows=Math.ceil(items.length/cols),dx=(colW-32)/cols,dy=12,top=gradeTop.get(grade);
        items.forEach((u,i)=>positions.set(u.id,[di*colW+16+(i%cols)*dx,top+Math.floor(i/cols)*dy]));
      });
    });
    const guides=activeGrades.map(grade=>`<line class="grade-guide" x1="0" y1="${gradeTop.get(grade)-14}" x2="${width}" y2="${gradeTop.get(grade)-14}"/>`).join('');
    const labels=active.map((doc,di)=>activeGrades.map(grade=>groups.get(doc)?.has(grade)?`<text class="map-text" x="${di*colW+6}" y="${gradeTop.get(grade)-2}">${esc(grade)}</text>`:'').join('')).join('');
    const selectedNeighbors=new Map();if(selectedId)(adj.get(selectedId)||[]).forEach(e=>{const other=e.a===selectedId?e.b:e.a;if(positions.has(other)){if(!selectedNeighbors.has(other))selectedNeighbors.set(other,[]);selectedNeighbors.get(other).push(e.assertion);}});
    let edges='';if(selectedId&&positions.has(selectedId))selectedNeighbors.forEach((assertions,nid)=>{const a=positions.get(selectedId),b=positions.get(nid),machineOnly=assertions.every(x=>x?.method==='semantic_neighbor_screen'),mixed=assertions.some(x=>x?.method==='semantic_neighbor_screen')&&!machineOnly,relations=[...new Set(assertions.map(x=>x?.relation||'related'))];edges+=`<line class="map-edge active ${machineOnly?'machine-candidate':''}${mixed?' mixed-evidence':''}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><title>${assertions.length} assertion(s) · ${esc(relations.join(', '))}${machineOnly?' · unreviewed machine-ranked lead':''}</title>`;});
    const dots=selectedUnits.map(u=>{const p=positions.get(u.id),isSel=u.id===selectedId,isNeighbor=selectedNeighbors.has(u.id),cls=`benchmark-dot ${docClass(u.sourceDocument)}${isSel?' selected':''}${isNeighbor?' neighbor':''}`;return `<circle class="${cls}" cx="${p[0]}" cy="${p[1]}" r="${isSel?8:isNeighbor?6:4}" data-node="${esc(u.id)}" tabindex="0" role="button" aria-label="Open ${esc(u.code)} from ${esc(title(u.sourceDocument))}; Grade ${esc(u.gradeSpan||'unspecified')}; ${esc(itemStatus(u)||'status unclassified')}"><title>${esc(u.code)} · ${esc(shortTitle(u.sourceDocument))} · ${esc(itemStatus(u)||'status unclassified')} · ${esc((u.text||'').slice(0,180))}</title></circle>`;}).join('');
    mapEl.innerHTML=`<g class="map-world">${guides}${heading}${labels}${edges}${dots}</g>`;setMapGeometry(width,height,width/2,height/2);
    mapEl.querySelectorAll('[data-node]').forEach(c=>{const go=()=>showNode(c.dataset.node);c.addEventListener('click',go);c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
    mapStatus.textContent=`${selectedUnits.length.toLocaleString()} benchmark/source items shown across ${active.length} selected versions. Nodes are spaced within grade/course bands; hover or focus a point for its exact code, or select it or a result for details. ${selectedId?`${selectedNeighbors.size} linked neighbor(s) highlighted.`:'Search by benchmark code or filter by source and grade to narrow the map.'} Grade labels group items for navigation only; they do not indicate a within-year teaching sequence.`;
  }
  function passesFocusFilters(id) {
    const n=byId.get(id);
    if(!n||!['TextUnit','Concept'].includes(n.type))return false;
    if(n.type==='Concept')return !gradeFilter.value&&!statusFilter.value&&!materialFilter.value;
    const active=new Set([...mapChoices.querySelectorAll('input:checked')].map(x=>x.value));
    return (!active.size||active.has(n.sourceDocument))
      &&(!versionFilter.value||n.sourceDocument===versionFilter.value)
      &&(!gradeFilter.value||n.gradeSpan===gradeFilter.value)
      &&(!statusFilter.value||statusCategory(n)===statusFilter.value)
      &&matchesMaterialFilter(n);
  }
  function focusNeighborhood(root, depthLimit) {
    const depthById=new Map([[root,0]]), keptEdges=new Map(), frontier=[root];
    const maxNodes=250;let hitNodeCap=false;
    const graphEdges=id=>(adj.get(id)||[]).filter(e=>e.assertion?.relation!=='sourceDocumentOf'&&[e.a,e.b].every(x=>['TextUnit','Concept'].includes(byId.get(x)?.type)));
    const edgePriority=e=>e.assertion?.method==='semantic_neighbor_screen'?1:0;
    for(let depth=0;depth<depthLimit&&frontier.length;depth++){
      const next=[];
      for(const id of frontier){
        const outgoing=graphEdges(id).filter(e=>passesFocusFilters(e.a===id?e.b:e.a));
        outgoing.sort((a,b)=>edgePriority(a)-edgePriority(b)||title(a.a===id?a.b:a.a).localeCompare(title(b.a===id?b.b:b.a)));
        for(const e of outgoing){
          const other=e.a===id?e.b:e.a,key=[e.a,e.b].sort().join('|');
          let group=keptEdges.get(key);
          if(!group){group={a:[e.a,e.b].sort()[0],b:[e.a,e.b].sort()[1],assertions:[]};keptEdges.set(key,group);}
          if(!group.assertions.some(a=>a.id===e.assertion?.id))group.assertions.push(e.assertion);
          if(!depthById.has(other)){
            if(depthById.size>=maxNodes){hitNodeCap=true;continue;}
            depthById.set(other,depth+1);next.push(other);
          }
        }
      }
      frontier.splice(0,frontier.length,...next);
    }
    let moreBeyondDepth=false;
    for(const [id,depth] of depthById){
      if(depth<depthLimit)continue;
      if(graphEdges(id).some(e=>{const other=e.a===id?e.b:e.a;return passesFocusFilters(other)&&!depthById.has(other);}))moreBeyondDepth=true;
    }
    return {depthById,edges:[...keptEdges.values()],hitNodeCap,moreBeyondDepth};
  }
  function renderFocusMap(root) {
    const depthLimit=Number($('#focus-depth').value)||0;
    const {depthById,edges,hitNodeCap,moreBeyondDepth}=focusNeighborhood(root,depthLimit);
    const levels=new Map();depthById.forEach((d,id)=>{if(!levels.has(d))levels.set(d,[]);levels.get(d).push(id);});
    const maxDepth=Math.max(0,...depthById.values());
    const widestLayer=Math.max(1,...[...levels.entries()].filter(([d])=>d>0).map(([,ids])=>ids.length));
    const ringGap=Math.max(210,Math.ceil(widestLayer*32/(2*Math.PI)));
    const outerRadius=maxDepth*ringGap, width=Math.max(1120,2*(outerRadius+220)), height=Math.max(760,2*(outerRadius+220));
    const cx=width/2,cy=height/2,positions=new Map([[root,[cx,cy]]]);
    for(let d=1;d<=maxDepth;d++){
      const ids=(levels.get(d)||[]).sort((a,b)=>title(a).localeCompare(title(b))), radius=d*ringGap, start=-Math.PI/2;
      ids.forEach((id,i)=>{const angle=start+2*Math.PI*i/Math.max(1,ids.length);positions.set(id,[cx+radius*Math.cos(angle),cy+radius*Math.sin(angle)]);});
    }
    const visibleEdges=edges.filter(e=>positions.has(e.a)&&positions.has(e.b));
    const lines=visibleEdges.map(e=>{const p=positions.get(e.a),q=positions.get(e.b),assertions=e.assertions||[],machineOnly=assertions.length>0&&assertions.every(a=>a?.method==='semantic_neighbor_screen'),mixed=assertions.some(a=>a?.method==='semantic_neighbor_screen')&&!machineOnly,relations=[...new Set(assertions.map(a=>a?.relation||'related'))],note=assertions.slice(0,3).map(a=>`${a?.relation||'related'}: ${a?.evidence||a?.status||'No evidence note'}`).join(' | ');return `<line class="focus-edge ${machineOnly?'machine-candidate':''}${mixed?' mixed-evidence':''}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"><title>${assertions.length} assertion(s) · ${esc(mixed?'Includes reviewed and machine-ranked evidence':machineOnly?'Unreviewed machine-ranked lead':'Recorded reviewed/other relation')} · ${esc(relations.join(', '))} · ${esc(note)}</title></line>`;}).join('');
    const circles=[...positions].map(([id,p])=>{const n=byId.get(id),d=depthById.get(id)||0,label=n.code||n.conceptId||title(id),selected=id===root,hideLabel=!selected&&(levels.get(d)||[]).length>24;return `<g class="focus-node depth-${d}${selected?' selected':''}${hideLabel?' labels-hidden':''}" data-node="${esc(id)}" tabindex="0" role="button" aria-label="Focus on ${esc(label)}; ${d===0?'selected item':`${d} connection${d===1?'':'s'} away`}"><circle cx="${p[0]}" cy="${p[1]}" r="${selected?19:12}"/><text x="${p[0]}" y="${p[1]+(selected?36:29)}" text-anchor="middle">${esc(label.length>34?label.slice(0,31)+'…':label)}</text><title>${esc(label)} · ${esc(n.text||'')}</title></g>`;}).join('');
    mapEl.innerHTML=`<g class="map-world">${[...Array(maxDepth)].map((_,i)=>`<circle class="focus-ring" cx="${cx}" cy="${cy}" r="${(i+1)*ringGap}"/>`).join('')}${lines}${circles}</g>`;setMapGeometry(width,height,cx,cy);
    mapEl.querySelectorAll('[data-node]').forEach(g=>{const go=()=>showNode(g.dataset.node,{scroll:false});g.addEventListener('click',go);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
    mapStatus.textContent=`Focused on ${title(root)} · ${depthById.size.toLocaleString()} item(s) through ${depthLimit} connection(s) · ${visibleEdges.length.toLocaleString()} connection pair(s) representing ${visibleEdges.reduce((s,e)=>s+(e.assertions||[]).length,0).toLocaleString()} assertions. Source, grade, comparison-status, and curriculum filters constrain connected items; the selected item stays visible. ${widestLayer>24?'Labels are hidden on dense layers; focus or select a node to identify it, or use the relationship list below. ':''}${hitNodeCap?'The neighborhood reached its 250-item display cap. ':moreBeyondDepth?'Additional filtered connections exist beyond the selected depth. ':''}Select any node to refocus.`;
  }
  function setView(mode) {
    if(mode!==viewMode){mapPanX=0;mapPanY=0;}
    viewMode=mode;$('#view-sources').setAttribute('aria-pressed',String(mode==='sources'));$('#view-benchmarks').setAttribute('aria-pressed',String(mode==='benchmarks'));
    mapChoices.hidden=mode!=='benchmarks';
    $('#source-layout').disabled=mode!=='sources';
    $('#map-heading').textContent=mode==='sources'?'Source-level overview':'Benchmark network';
    $('#map-explanation').textContent=mode==='sources'?'Each circle represents a source/version; solid links are recorded comparison assertions, while dashed amber links mark source files named in composite-item locators. Locator citations add context, not a claim of equivalence.':'Each point is a benchmark item, grouped by source and grade/course. This view starts with the 2026 draft; use source and grade filters or search by code. Hover or focus points to identify them; select a point or result for details.';
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
    const d=byId.get(n.sourceDocument),c=coverageByDoc.get(n.id),files=(n.sourceFiles||[]).map(f=>f.file).join(' ');
    return [n.id,n.title,n.code,n.gradeSpan,n.text,itemStatus(n),n.crosswalkNote,n.provenanceStatus,n.provenanceFollowup,n.conceptId,title(n.sourceDocument),d?.status,title(n.id),files,c?.coverage,c?.note].join(' ').toLowerCase();
  }
  function updateResults() {
    const q=searchInput.value.trim().toLowerCase(), ver=versionFilter.value, grade=gradeFilter.value, state=statusFilter.value, material=materialFilter.value;
    const pool=[...units,...concepts,...(q?docs:[])];
    results=pool.filter(n=>{
      const isDoc=n.type==='StandardVersion';
      return (!q||searchText(n).includes(q))
        &&(!ver||(isDoc?n.id===ver:n.sourceDocument===ver))
        &&(!grade||(!isDoc&&n.gradeSpan===grade))
        &&(!state||(!isDoc&&statusCategory(n)===state))
        &&(!material||matchesMaterialFilter(n));
    });
    const rank=n=>{if(!q)return 0;const code=String(n.code||n.conceptId||'').toLowerCase();if(code===q)return -100;if(code.startsWith(q))return -50;const position=searchText(n).indexOf(q);return position<0?100:position;};
    results.sort((a,b)=>rank(a)-rank(b)||(a.type===b.type?0:(a.type==='TextUnit'?-1:a.type==='Concept'?1:2)) || title(a.sourceDocument||a.id).localeCompare(title(b.sourceDocument||b.id)) || (a.code||a.conceptId||a.title||'').localeCompare(b.code||b.conceptId||b.title||''));
    shown=0; resultsEl.innerHTML=''; renderMore();
    countEl.textContent=`${results.length.toLocaleString()} matching items${q||ver||grade||state||material?'':' · search across all represented sources'}`;
  }
  function renderMore() {
    const frag=document.createDocumentFragment(), end=Math.min(shown+batch,results.length);
    for(;shown<end;shown++){
      const n=results[shown], li=document.createElement('li'), b=document.createElement('button'); li.className='result-list-item'; b.type='button'; b.className='result-card'; b.dataset.id=n.id;
      b.setAttribute('aria-current',String(n.id===selectedId));
      const isDoc=n.type==='StandardVersion',meta=isDoc?`Source record · ${coverageByDoc.get(n.id)?.coverage||'coverage unassessed'}`:n.type==='Concept'?'Concept':`${title(n.sourceDocument)}${n.gradeSpan?` · Grade ${n.gradeSpan}`:''}${itemStatus(n)?` · ${itemStatus(n)}`:''}`;
      const body=isDoc?(n.status||coverageByDoc.get(n.id)?.note||'Document-level source record; benchmark items are not separately encoded.'):textPreview(n);
      const materials=isDraftUnit(n)?materialStatus(n):'not_applicable';
      const materialBadge=materials==='verified'?'<span class="resource-badge available">Prepared material: verified fit</span>':materials==='located'?'<span class="resource-badge">Prepared material: located</span>':materials==='none_found_in_search'?'<span class="resource-badge none-found">No resource found in bounded search</span>':materials==='not_assessed'?'<span class="resource-badge not-assessed">Materials not inventoried</span>':'';
      b.innerHTML=`<strong>${esc(n.code||n.conceptId||title(n.id))}</strong><span class="card-meta">${esc(meta)}</span>${materialBadge}<span class="card-text">${esc(body.slice(0,300))}${body.length>300?'…':''}</span>`;
      b.addEventListener('click',()=>showNode(n.id)); li.append(b); frag.append(li);
    }
    resultsEl.append(frag); moreBtn.hidden=shown>=results.length;
  }
  function isDraftUnit(n) { return n.type==='TextUnit'&&n.sourceDocument==='doc:fl-science-2026-draft'&&n.code&&!/[;,]/.test(n.code); }
  function runStartAction(action) {
    mapPanX=0;mapPanY=0;
    selectedId=null;gradeFilter.value='';statusFilter.value='';materialFilter.value='';versionFilter.value='';searchInput.value='';
    mapChoices.querySelectorAll('input').forEach(x=>{x.checked=(action==='compare'?comparisonMapSources:defaultMapSources).has(x.value);});
    if(action==='benchmark')versionFilter.value='doc:fl-science-2026-draft';
    if(action==='materials'){versionFilter.value='doc:fl-science-2026-draft';materialFilter.value='has_resource';}
    if(action==='evolution'){versionFilter.value='doc:fl-science-2026-draft';searchInput.value='evolution';}
    if(action==='climate'){versionFilter.value='doc:fl-science-2026-draft';searchInput.value='climate change';}
    updateResults();setView('benchmarks');updateSelectionStyle();
    searchInput.focus({preventScroll:true});
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
    detailEl.innerHTML=`<p class="item-kicker">Source record · ${esc(coverage?.coverage||'coverage not assessed')}</p><h2 id="detail-title">${esc(title(id))}</h2><p>${esc(d.status||'')}</p><p><strong>${nodeCount.toLocaleString()}</strong> text items are assigned to this source node in the graph.${nodeCount===0?' This is a document-level record; item text has not been separately encoded here.':''}</p>${coverage?.note?`<p class="coverage-warning"><strong>Coverage note:</strong> ${esc(coverage.note)}</p>`:''}<h3>Open source or related review</h3>${showDocumentLinks(id)}<h3>Source files recorded in the graph</h3><ul>${files||'<li>No source file names recorded.</li>'}</ul><p>Source links open the original host. Text reproduced in this graph is the item-level content available in the published research data. Graph node counts are not source document size or evidence that unrepresented material is absent.</p>`;
    updateSelectionStyle();openDetails();
  }
  function showNode(id,options={}) {
    const n=byId.get(id); if(!n)return;
    if(n.type==='StandardVersion')return showDoc(id);
    mapPanX=0;mapPanY=0;
    selectedId=id; history.replaceState(null,'',`#${encodeURIComponent(id)}`); updateSelectionStyle();
    if(n.sourceDocument){const choice=mapChoices.querySelector(`input[value="${CSS.escape(n.sourceDocument)}"]`);if(choice)choice.checked=true;}
    if(viewMode!=='benchmarks')setView('benchmarks');else renderBenchmarkMap();
    const isUnit=n.type==='TextUnit', doc=byId.get(n.sourceDocument), rels=adj.get(id)||[], isDraftBenchmark=isDraftUnit(n);
    const directAll=rels.map(e=>({e,other:e.a===id?e.b:e.a})).filter(x=>byId.has(x.other)&&x.e.assertion?.relation!=='sourceDocumentOf'&&['TextUnit','Concept'].includes(byId.get(x.other)?.type));
    const semanticDirect=directAll.filter(x=>x.e.assertion?.method==='semantic_neighbor_screen').sort((a,b)=>(b.e.assertion.similarityScore||0)-(a.e.assertion.similarityScore||0));
    const reviewedDirect=directAll.filter(x=>x.e.assertion?.method!=='semantic_neighbor_screen');
    const direct=reviewedDirect.slice(0,20), remainingDirect=reviewedDirect.slice(20);
    const materialRecord=materialsByCode.get(n.code), resources=materialRecord?.resources||[];
    const materialStatus=materialRecord?.status||'not_assessed';
    const materialLabel={not_assessed:'Not inventoried',located:'Resource located; fit not fully verified',verified:'Resource fit reviewed',none_found_in_search:'None found in a bounded search'}[materialStatus]||materialStatus;
    const material=resources.length?resources.map(r=>`<li>${r.viewUrl?`<a href="${esc(r.viewUrl)}">${esc(r.title||'Prepared curriculum material')} (view content)</a>`:esc(r.title||'Prepared curriculum material')}${r.url?` · <a href="${esc(r.url)}" target="_blank" rel="noopener">source</a>`:''} · ${esc(r.format||'format not stated')}${r.gradeFit?` · grades: ${esc(r.gradeFit)}`:''}${r.benchmarkFit?` · fit: ${esc(r.benchmarkFit)}`:''}${r.accessibility?` · accessibility: ${esc(r.accessibility)}`:''}${r.redistribution?` · redistribution: ${esc(r.redistribution)}`:''}</li>`).join(''):'<li>No prepared curriculum material is linked in the current inventory. This does not mean none is available.</li>';
    const renderRelation=({e,other})=>`<li><strong>${esc(e.assertion.relation||'related')}</strong> · <button type="button" data-open-node="${esc(other)}">${esc(title(other))}</button><div class="relation-meta">${e.assertion.method==='semantic_neighbor_screen'?'<strong>Unreviewed machine-ranked lead.</strong> ':''}${esc(e.assertion.evidence||e.assertion.status||'No evidence note recorded.')}${e.assertion.similarityScore!==undefined&&e.assertion.similarityScore!==null?` · similarity score: ${esc(e.assertion.similarityScore)}`:''}${e.assertion.confidence!==undefined?` · confidence recorded as ${esc(e.assertion.confidence)}`:''}${e.assertion.method?` · method: ${esc(e.assertion.method)}`:''}</div></li>`;
    const renderSemanticLead=({e,other})=>`<li><button type="button" data-open-node="${esc(other)}">${esc(title(other))}</button><div class="relation-meta"><strong>Unreviewed machine-ranked lead.</strong> Similarity score: ${esc(e.assertion.similarityScore??'not recorded')} · ${esc(e.assertion.evidence||'Candidate surfaced by the corpus similarity screen; inspect both source passages.')}</div></li>`;
    const relationRows=direct.map(renderRelation).join(''), remainingRows=remainingDirect.map(renderRelation).join('');
    const leadRows=semanticDirect.slice(0,15).map(renderSemanticLead).join(''), remainingLeadRows=semanticDirect.slice(15).map(renderSemanticLead).join('');
    const semanticUrl=`semantic-search.html?query=${encodeURIComponent(n.text||n.code||'')}`;
    const sourcefiles=n.sourceFiles||[];
    const mappingNote=n._sourceMappingMissing?(sourcefiles.length>1?'This is a composite crosswalk item citing multiple source files; assigning it to one standard version would be misleading. See the individual file references below.':'No single source-version assignment is recorded for this derived item. See its source locator and file reference below.'):'';
    detailEl.innerHTML=`<p class="item-kicker">${isUnit?'Benchmark / source text':'Concept'}</p><h2 id="detail-title">${esc(n.code||n.conceptId||n.id)}</h2><div class="item-content">${esc(textPreview(n)||'This graph node points to a source item, but does not include its complete text. Use the source locator and links below.')}</div>${mappingNote?`<p class="coverage-warning"><strong>Composite source mapping:</strong> ${esc(mappingNote)}</p>`:''}${isUnit&&n.sourceDocument==='doc:fl-science-2026-draft'&&!isDraftBenchmark?'<p class="coverage-warning"><strong>Aggregate source row:</strong> this is not one of the 1,512 leaf benchmark IDs; material availability is not applicable at this row level.</p>':''}<div class="detail-grid"><p><strong>Source:</strong> <button type="button" class="text-link" data-open-node="${esc(n.sourceDocument||'')}">${esc(title(n.sourceDocument))}</button></p><p><strong>Grade/course:</strong> ${esc(n.gradeSpan||'Not specified')}</p><p><strong>Comparison status:</strong> ${esc(itemStatus(n)||'Not classified in this node')}</p><p><strong>Source locator:</strong> ${esc(n.pageOrAnchor||'Not recorded')}</p></div>${isDraftBenchmark?`<div class="material-flag ${materialStatus==='verified'?'available':''}"><strong>Prepared curriculum material: ${esc(materialLabel)}</strong>${materialRecord?.checkedOn?`<p>Checked: ${esc(materialRecord.checkedOn)}${materialRecord.searchScope?` · Search scope: ${esc(materialRecord.searchScope)}`:''}</p>`:''}<ul>${material}</ul><p>Inventory details and redistribution fields: <a href="curriculum-materials.json">curriculum-materials.json</a>. Content is shown locally only when the recorded rights allow; otherwise, follow the source link.</p></div>`:''}${n.crosswalkNote?`<h3>Comparison note</h3><p>${esc(n.crosswalkNote)}</p>`:''}${n.provenanceStatus?`<h3>Provenance status</h3><p>${esc(n.provenanceStatus)}</p>`:''}${n.provenanceFollowup?`<p><strong>Follow-up:</strong> ${esc(n.provenanceFollowup)}</p>`:''}<h3>Source access</h3>${showDocumentLinks(n.sourceDocument)}${sourcefiles.length?`<p><strong>File references:</strong> ${sourcefiles.map(f=>`<code>${esc(f.file)}</code>${f.sha256?` <span class="relation-meta">(SHA-256 ${esc(f.sha256)})</span>`:''}`).join(' · ')}</p>`:''}<p class="semantic-leads-note"><a href="${esc(semanticUrl)}">Prepare a corpus semantic-search query from this item</a>. The public site shows recorded candidate links below; full-corpus semantic queries run through the documented local search workflow.</p>${semanticDirect.length?`<section class="semantic-leads" aria-labelledby="semantic-leads-heading"><h3 id="semantic-leads-heading">Machine-ranked similarity candidates (${semanticDirect.length})</h3><p class="semantic-leads-note">These are unreviewed discovery leads, sorted by recorded similarity score. Similarity does not establish shared source, borrowing, or conceptual equivalence.</p><ul class="relation-list">${leadRows}</ul>${semanticDirect.length>15?`<details class="more-relations"><summary>Show ${semanticDirect.length-15} more similarity candidates</summary><ul class="relation-list">${remainingLeadRows}</ul></details>`:''}</section>`:''}<p>The map above highlights recorded cross-version neighbors. The list below preserves relationship labels, evidence notes, and confidence values for reviewed or otherwise recorded links.</p><h3>Recorded relationships (${reviewedDirect.length})</h3>${reviewedDirect.length?`<ul class="relation-list">${relationRows}</ul>${remainingDirect.length?`<details class="more-relations"><summary>Show ${remainingDirect.length} additional recorded relationships</summary><ul class="relation-list">${remainingRows}</ul></details>`:''}`:'<p>No reviewed or otherwise recorded relationship is present for this item.</p>'}`;
    detailEl.querySelectorAll('[data-open-node]').forEach(b=>b.addEventListener('click',()=>showNode(b.dataset.openNode)));
    openDetails();
  }
  function updateSelectionStyle(){resultsEl.querySelectorAll('.result-card').forEach(b=>b.setAttribute('aria-current',String(b.dataset.id===selectedId)));}
  function saveBlob(blob,filename) {
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function currentSvgText() {
    const rect=mapViewport.getBoundingClientRect(),svg=mapEl.cloneNode(true),view=mapEl.viewBox.baseVal;
    svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
    svg.setAttribute('width',String(Math.max(900,Math.round(rect.width*2))));
    svg.setAttribute('height',String(Math.max(600,Math.round(rect.height*2))));
    const style=document.createElementNS('http://www.w3.org/2000/svg','style');
    const response=await fetch('graph-viewer.css');style.textContent=response.ok?await response.text():'';
    svg.insertBefore(style,svg.firstChild);
    const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');
    bg.setAttribute('x',String(view.x));bg.setAttribute('y',String(view.y));bg.setAttribute('width',String(view.width));bg.setAttribute('height',String(view.height));bg.setAttribute('fill','#fbfcfb');
    svg.insertBefore(bg,style);
    return new XMLSerializer().serializeToString(svg);
  }
  async function exportSvg() {
    const source=await currentSvgText();
    saveBlob(new Blob([source],{type:'image/svg+xml;charset=utf-8'}),`florida-standards-graph-${viewMode}.svg`);
    mapStatus.textContent='Current graph view exported as SVG.';
  }
  async function exportPng() {
    const source=await currentSvgText(),svgBlob=new Blob([source],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(svgBlob),img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas'),rect=mapViewport.getBoundingClientRect();
      canvas.width=Math.max(900,Math.round(rect.width*2));canvas.height=Math.max(600,Math.round(rect.height*2));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fbfcfb';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
      canvas.toBlob(blob=>{if(blob){saveBlob(blob,`florida-standards-graph-${viewMode}.png`);mapStatus.textContent='Current graph view exported as PNG.';}else mapStatus.textContent='PNG export failed; try SVG export.';},'image/png');
      URL.revokeObjectURL(url);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);mapStatus.textContent='PNG export failed; try SVG export.';};
    img.src=url;
  }
  function exportFilteredData() {
    const filters={query:searchInput.value,sourceVersion:versionFilter.value,grade:gradeFilter.value,status:statusFilter.value,curriculumMaterial:materialFilter.value};
    const items=results.map(n=>({id:n.id,type:n.type,title:title(n.id),code:n.code||null,conceptId:n.conceptId||null,sourceDocument:n.sourceDocument||null,sourceTitle:n.sourceDocument?title(n.sourceDocument):null,gradeSpan:n.gradeSpan||null,text:textPreview(n)||null,status:itemStatus(n)||null,sourceLocator:n.pageOrAnchor||null,relationships:(adj.get(n.id)||[]).filter(e=>e.assertion?.relation!=='sourceDocumentOf').map(e=>({targetId:e.a===n.id?e.b:e.a,relation:e.assertion?.relation||null,evidence:e.assertion?.evidence||null,method:e.assertion?.method||null,confidence:e.assertion?.confidence??null}))}));
    const payload={title:'Filtered Florida science standards graph records',exportedAt:new Date().toISOString(),view:viewMode,filters,matchCount:items.length,items};
    saveBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`florida-standards-graph-filtered-${new Date().toISOString().slice(0,10)}.json`);
    mapStatus.textContent=`Exported ${items.length.toLocaleString()} filtered graph records as JSON.`;
  }
  function setupCanvasNavigation() {
    mapViewport.addEventListener('keydown',e=>{
      const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(!direction)return;
      e.preventDefault();
      const view=mapEl.viewBox.baseVal,step=e.shiftKey?.18:.08;
      mapPanX+=direction[0]*view.width*step;mapPanY+=direction[1]*view.height*step;applyMapViewBox();
      mapStatus.textContent=`Graph panned ${e.key.replace('Arrow','').toLowerCase()}.`;
    });
    mapViewport.addEventListener('wheel',e=>{
      e.preventDefault();const rect=mapViewport.getBoundingClientRect(),old=mapEl.viewBox.baseVal,fx=(e.clientX-rect.left)/rect.width,fy=(e.clientY-rect.top)/rect.height;
      const worldX=old.x+fx*old.width,worldY=old.y+fy*old.height,next=Math.round(Math.min(400,Math.max(45,mapZoom*(e.deltaY<0?1.12:.89))));
      const width=viewGeometry.width*(100/next),height=viewGeometry.height*(100/next);
      mapZoom=next;mapPanX=worldX-fx*width-(viewGeometry.cx-width/2);mapPanY=worldY-fy*height-(viewGeometry.cy-height/2);
      $('#map-zoom').value=String(mapZoom);$('#zoom-value').textContent=`${mapZoom}%`;applyMapViewBox();
    },{passive:false});
    mapViewport.addEventListener('pointerdown',e=>{
      if(e.button!==0||e.target.closest('[data-node],[data-doc],[data-edge]'))return;
      dragState={id:e.pointerId,x:e.clientX,y:e.clientY,panX:mapPanX,panY:mapPanY,moved:false};mapViewport.setPointerCapture(e.pointerId);
    });
    mapViewport.addEventListener('pointermove',e=>{
      if(!dragState||e.pointerId!==dragState.id)return;
      const dx=e.clientX-dragState.x,dy=e.clientY-dragState.y,rect=mapViewport.getBoundingClientRect(),view=mapEl.viewBox.baseVal;
      if(Math.abs(dx)+Math.abs(dy)>3)dragState.moved=true;
      if(!dragState.moved)return;
      mapPanX=dragState.panX-dx*view.width/rect.width;mapPanY=dragState.panY-dy*view.height/rect.height;applyMapViewBox();
    });
    const endDrag=e=>{if(dragState?.id===e.pointerId){if(dragState.moved)mapViewport.dataset.dragged='true';dragState=null;}};
    mapViewport.addEventListener('pointerup',endDrag);mapViewport.addEventListener('pointercancel',endDrag);
    mapViewport.addEventListener('click',e=>{if(mapViewport.dataset.dragged==='true'){e.preventDefault();e.stopPropagation();mapViewport.dataset.dragged='';}},true);
  }
  function setupSidebar() {
    const shell=$('.graph-shell'),sidebar=$('#graph-sidebar'),toggle=$('#sidebar-toggle'),mobile=()=>matchMedia('(max-width: 760px)').matches;
    function sync(){const open=mobile()?sidebar.classList.contains('is-open'):!shell.classList.contains('sidebar-collapsed');sidebar.inert=!open;toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Hide controls':'Controls';}
    toggle.addEventListener('click',()=>{if(mobile())sidebar.classList.toggle('is-open');else shell.classList.toggle('sidebar-collapsed');sync();});
    window.addEventListener('resize',sync);sync();
  }
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
  [versionFilter,gradeFilter,statusFilter,materialFilter].forEach(el=>el.addEventListener('change',()=>{updateResults();updateMap();}));
  $('#view-sources').addEventListener('click',()=>setView('sources'));
  $('#view-benchmarks').addEventListener('click',()=>setView('benchmarks'));
  $('#map-reset').addEventListener('click',()=>{mapPanX=0;mapPanY=0;sourceLayout='curated';$('#source-layout').value='curated';setZoom(100);selectedId=null;searchInput.value='';versionFilter.value='';gradeFilter.value='';statusFilter.value='';materialFilter.value='';mapChoices.querySelectorAll('input').forEach(x=>x.checked=defaultMapSources.has(x.value));updateResults();updateMap();});
  $('#center-map').addEventListener('click',()=>{mapPanX=0;mapPanY=0;applyMapViewBox();mapStatus.textContent='Centered the current graph view; filters and zoom are unchanged.';});
  $('#source-layout').addEventListener('change',e=>{sourceLayout=e.target.value;mapPanX=0;mapPanY=0;if(viewMode==='sources')renderSourceMap();});
  $('#map-zoom').addEventListener('input',e=>setZoom(e.target.value));
  $('#zoom-in').addEventListener('click',()=>setZoom(mapZoom+15));
  $('#zoom-out').addEventListener('click',()=>setZoom(mapZoom-15));
  $('#focus-depth').addEventListener('change',()=>updateMap());
  moreBtn.addEventListener('click',renderMore);
  document.querySelectorAll('[data-start]').forEach(b=>b.addEventListener('click',()=>runStartAction(b.dataset.start)));
  $('#export-svg').addEventListener('click',()=>exportSvg().catch(()=>{mapStatus.textContent='SVG export failed; try reloading the graph.';}));
  $('#export-png').addEventListener('click',()=>exportPng().catch(()=>{mapStatus.textContent='PNG export failed; try SVG export.';}));
  $('#export-filtered').addEventListener('click',exportFilteredData);
  setupCanvasNavigation();setupSidebar();
  init();
})();
