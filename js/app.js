/**
 * app.js
 * -----------------------------------------------------------------------
 * Application state, page rendering, and event handling. This is the view
 * layer: every render function fetches its data through js/api.js (never
 * straight from mock-data.js) and builds HTML from the response.
 *
 * You should not need to edit this file to wire up a real backend — see
 * js/api.js instead. You WOULD edit this file to change layout, add a
 * page, or change interaction behaviour.
 * -----------------------------------------------------------------------
 */

/* ============ CLIENT STATE ============
 * Everything in here is UI/session state only (which tab is open, what the
 * user has typed into the Generate form, etc). It is not "data" in the
 * backend sense — nothing here needs a database column.
 */
let sidebarCollapsed = false;
let resTabsEnabled = { tr:true, zo:true, so:true, cp:true };
let activeSubTab = 'tr';
let activeCompetitorId = null;
let competitorListCache = null; // [{id,name,pill,avatar}] - fetched once per Research visit
let genState = { platform:'Instagram', tone:'Friendly', length:'Short', audience:'Homeowners', style:'Before/After', prompt:'' };
let genDrafts = MOCK.generate.defaultDrafts.map(d => ({...d})); // seed with placeholder examples until the user generates
let savedDrafts = []; // populated from API.getSavedDrafts() when the Generate page loads

/* ============ SMALL UTILITIES ============ */
function escAttr(s){
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastT);
  window._toastT = setTimeout(() => t.classList.remove('show'), 2000);
}
function loadingHTML(msg){
  return `<div style="padding:60px 20px;text-align:center;color:var(--muted);font-size:13px">${msg || 'Loading…'}</div>`;
}
/** Wraps an API call: shows a toast and logs on failure instead of throwing into the UI. */
async function safeCall(promiseFn, fallbackMsg){
  try {
    return await promiseFn();
  } catch(err){
    console.error(err);
    toast(fallbackMsg || 'Something went wrong loading data');
    return null;
  }
}

function toggleSidebar(){
  sidebarCollapsed = !sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
}

/* ============ NAVIGATION ============ */
async function go(page){
  ['home','research','generate'].forEach(p=>{
    document.getElementById('nav-'+p).classList.toggle('on', p===page);
  });
  document.getElementById('main').scrollTop = 0;
  if(page==='home') await renderHome();
  else if(page==='research') await renderResearchSelector();
  else if(page==='generate') await renderGenerate();
}

async function goResearchTabs(){
  ['home','research','generate'].forEach(p=>{
    document.getElementById('nav-'+p).classList.toggle('on', p==='research');
  });
  document.getElementById('main').scrollTop = 0;
  const firstOn = ['tr','zo','so','cp'].find(id => resTabsEnabled[id]) || 'tr';
  activeSubTab = firstOn;
  await renderResearchTabs();
}

/* ============ HOME — GET /api/home/summary ============ */
async function renderHome(){
  document.getElementById('main').innerHTML = loadingHTML('Loading your dashboard…');
  const data = await safeCall(() => API.getHomeSummary(), "Couldn't load home summary");
  if(!data) return;

  document.getElementById('main').innerHTML = `
  <div class="pgwrap">
    <div>
      <div class="pg-title">Hello, Thomas.</div>
      <div class="pg-sub">Marketing overview for Urban Space Self Storage - this week.</div>
    </div>
    <div class="hero-grid">
      <div class="hero-card research" onclick="go('research')">
        <img class="hero-illust" src="${ASSET.RECT_RESEARCH}" alt="">
        <div class="hero-scrim"></div>
        <div class="hero-title">Research</div>
        <div class="hero-desc">Trends, ZOHO Chat Analysis, Social Accounts and Competitor Analysis</div>
        <div class="hero-btn" onclick="event.stopPropagation();go('research')">Go to Research ${ICO.arrowR}</div>
      </div>
      <div class="hero-card generate" onclick="go('generate')">
        <img class="hero-illust" src="${ASSET.RECT_GENERATE}" alt="">
        <div class="hero-scrim"></div>
        <div class="hero-title">Generate</div>
        <div class="hero-desc">Create Instagram &amp; LinkedIn posts with AI in Urban Space brand voice.</div>
        <div class="hero-btn" onclick="event.stopPropagation();go('generate')">Go to Generate ${ICO.arrowR}</div>
      </div>
    </div>
    <div class="bot-grid">
      <div class="card">
        <div class="card-hdr-row">
          <div class="card-ico" style="background:var(--ora-l);color:var(--ora)">${ICO.eye.replace(/width="12" height="12"/,'width="18" height="18"')}</div>
          <div><div class="card-title">KPI</div><div class="card-sub">Performance metrics for this week</div></div>
        </div>
        <div class="kpi-list">
          ${data.kpis.map(kpiTile).join('')}
        </div>
      </div>
      <div class="ai-card">
        <div class="ai-card-hdr">
          <div class="ai-card-title-row">
            <div class="ai-star-ico">${ICO.sparkle}</div>
            <div><div class="card-title">AI Weekly Summary</div><div class="card-sub">Auto-generated from this week's performance data</div></div>
          </div>
        </div>
        ${data.weeklySummary.map(aiRow).join('')}
      </div>
    </div>
  </div>`;
}

function kpiTile(k){
  return `<div class="ktile ${k.style}">
    <div><div class="kval">${k.value}</div><div class="klbl">${k.label}</div><div class="ksub">${k.delta}</div></div>
    <div class="kicowrap">${ICO[k.icon] || ''}</div>
  </div>`;
}

function aiRow(item){
  const cmap = { red:['var(--red)','var(--red-l)','var(--red-d)'], ora:['var(--ora)','var(--ora-l)','var(--ora-d)'], green:['var(--green)','var(--green-l)','var(--green-d)'] };
  const c = cmap[item.type];
  return `<div class="notif-row">
    <div class="notif-dot" style="background:${c[0]}"></div>
    <div style="flex:1">
      <span class="tag-pill" style="background:${c[1]};color:${c[2]}">${item.tag}</span>
      <div class="notif-title" style="margin-top:6px">${item.title}</div>
      <div class="notif-sub">${item.sub}</div>
    </div>
  </div>`;
}

/* ============ RESEARCH SOURCE SELECTOR — GET /api/research/sources ============ */
async function renderResearchSelector(){
  document.getElementById('main').innerHTML = loadingHTML('Loading research sources…');
  const sources = await safeCall(() => API.getResearchSources(), "Couldn't load research sources");
  if(!sources) return;

  let cards = '';
  sources.forEach(t=>{
    const on = resTabsEnabled[t.id];
    cards += `<div class="rs-card ${on?'':'off'}" style="background:linear-gradient(135deg,${t.col1},${t.col2})" onclick="toggleResTab('${t.id}')">
      <div class="rs-card-ico" style="background-image:url(${ASSET[t.img]})"></div>
      <div>
        <div class="rs-card-title">${t.label}</div>
        <div class="rs-card-desc">${t.desc}</div>
      </div>
      <div class="rs-check ${on?'on':''}" style="color:${t.col2}">${on?ICO.check:''}</div>
    </div>`;
  });
  const count = Object.values(resTabsEnabled).filter(Boolean).length;
  document.getElementById('main').innerHTML = `
  <div class="pgwrap">
    <div>
      <div class="pg-title" style="font-size:34px">Research</div>
      <div class="pg-sub">AI-powered market intelligence for Urban Space — updated weekly.</div>
    </div>
    <div class="rs-heading">What are we researching today, Thomas?</div>
    <div class="rs-banner">
      <div class="rs-banner-ico">${ICO.sparkle}</div>
      <div class="rs-banner-txt">Turn on the data sources relevant to your session. You can change this at any time.</div>
    </div>
    <div class="rs-grid">${cards}</div>
    <div class="rs-foot">
      <div style="display:flex;align-items:center;gap:14px">
        <span class="tag-pill" style="background:var(--ora-l);color:var(--ora-d);padding:7px 14px;font-size:11px">${count} of 4 sources selected</span>
        <button class="btn-underline" onclick="clearAllResTabs()">Clear all</button>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-white" onclick="go('home')">Cancel</button>
        <button class="btn btn-ora" onclick="goResearchTabs()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg> View Research</button>
      </div>
    </div>
  </div>`;
}

function toggleResTab(id){
  const enabledCount = Object.values(resTabsEnabled).filter(Boolean).length;
  if(resTabsEnabled[id] && enabledCount===1){ toast('At least one source must stay selected'); return; }
  resTabsEnabled[id] = !resTabsEnabled[id];
  renderResearchSelector();
}
function clearAllResTabs(){
  resTabsEnabled = {tr:true,zo:false,so:false,cp:false};
  renderResearchSelector();
}

/* ============ RESEARCH TABS SHELL ============ */
async function renderResearchTabs(){
  document.getElementById('main').innerHTML = `
  <div class="pgwrap">
    <div class="res-hdr-row">
      <div>
        <div class="pg-title" style="font-size:34px">Research</div>
        <div class="pg-sub">AI-powered market intelligence for Urban Space — updated weekly.</div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-white" onclick="renderResearchSelector()">${ICO.hand} Change Sources</button>
        <button class="btn btn-white" onclick="refreshResearch()">${ICO.refresh} Refresh</button>
      </div>
    </div>
    <div class="subtab-row" id="subtab-row">
      ${subtabBtn('tr','Internet Trends')}
      ${subtabBtn('zo','Customer Chats')}
      ${subtabBtn('so','Social Media')}
      ${subtabBtn('cp','Competitor Analysis')}
    </div>
    <div id="subtab-content">${loadingHTML('Loading research…')}</div>
  </div>`;
  await renderSubtabContent();
}
function subtabBtn(id,label){
  return `<button class="subtab ${activeSubTab===id?'on':''}" onclick="setSubTab('${id}')">${label}</button>`;
}
async function setSubTab(id){
  const btn = event.target;
  activeSubTab = id;
  document.querySelectorAll('.subtab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  await renderSubtabContent();
}
function refreshResearch(){
  toast('Research data refreshed');
  renderSubtabContent();
}

async function renderSubtabContent(){
  const el = document.getElementById('subtab-content');
  el.innerHTML = loadingHTML('Loading…');
  if(activeSubTab==='tr') el.innerHTML = await tabInternetTrends();
  else if(activeSubTab==='zo') el.innerHTML = await tabCustomerChats();
  else if(activeSubTab==='so') el.innerHTML = await tabSocialMedia();
  else if(activeSubTab==='cp') el.innerHTML = await tabCompetitor();
}

/* ============ Shared AI-card renderers (pure — take data, return HTML) ============ */
function suggBlock(title, sub, items){
  const rows = items.map((it,i)=>`<div class="sugg-row">
      <div class="sugg-num">${i+1}</div>
      <div style="flex:1"><div class="sugg-title">${it.title}</div><div class="sugg-sub">${it.sub}</div></div>
      <button class="btn btn-ai btn-sm" data-title="${escAttr(it.title)}" onclick="genFromSuggestion(this.dataset.title)">${ICO.pencil} Generate</button>
    </div>`).join('');
  return `<div class="ai-card">
    <div class="ai-card-hdr">
      <div class="ai-card-title-row"><div class="ai-star-ico">${ICO.sparkle}</div><div class="card-title" style="font-size:17px">${title}</div></div>
      <span class="tag-pill red">AI SUGGESTED POSTS</span>
    </div>
    <div class="card-sub" style="margin-bottom:6px">${sub}</div>
    ${rows}
  </div>`;
}
function patternBlock(title, sub, tag, items){
  const rows = items.map(it=>`<div class="insight-row" style="border-top:1px solid #F6E3DD">
      <div style="flex:1"><div class="insight-title">${it.title}</div><div class="insight-body">${it.body}</div></div>
    </div>`).join('');
  return `<div class="ai-card">
    <div class="ai-card-hdr"><div class="ai-card-title-row"><div class="ai-star-ico">${ICO.sparkle}</div><div class="card-title" style="font-size:17px">${title}</div></div><span class="tag-pill red">${tag}</span></div>
    <div class="card-sub" style="margin-bottom:4px">${sub}</div>
    ${rows}
  </div>`;
}

/* ============ INTERNET TRENDS — GET /api/research/internet-trends ============ */
async function tabInternetTrends(){
  const data = await safeCall(() => API.getInternetTrends(), "Couldn't load internet trends");
  if(!data) return loadingHTML("Couldn't load this tab. Try Refresh.");

  const mx = Math.max(...data.keywords.map(d=>d.v));
  const bars = data.keywords.map(d=>{
    const pct = Math.max(8, Math.round(100*d.v/mx));
    const col = d.chg<0 ? 'var(--red)' : 'var(--ora)';
    return `<div class="bar-row">
      <div class="bar-lbl">${d.l}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${col}"><span>${d.v.toLocaleString()}</span></div></div>
      <div class="bar-chg ${d.chg<0?'chg-dn':'chg-up'}">${d.chg>0?'+':''}${d.chg}%</div>
    </div>`;
  }).join('');

  const kw = data.keywords.map((d,i)=>`<div class="kw-row">
      <div class="kw-num">${i+1}</div>
      <div style="flex:1">
        <div class="kw-title-row"><span class="kw-title">${d.l}</span><span class="mini-tag ${d.tag}">${d.tagLbl}</span></div>
        <div class="kw-desc">${d.desc}</div>
      </div>
      <div class="kw-right"><div class="kw-val">${d.v.toLocaleString()}/wk</div><div class="kw-pct ${d.chg<0?'chg-dn':'chg-up'}">${d.chg>0?'+':''}${d.chg}%</div></div>
    </div>`).join('');

  const insightsHTML = data.insights.map(ins=>`
    <div class="insight-row">
      <div class="insight-ico">${ICO.target}</div>
      <div>
        <span class="tag-pill red">${ins.tag}</span>
        <div class="insight-title" style="margin-top:6px">${ins.title}</div>
        <div class="insight-body">${ins.body}</div>
        ${ins.cta ? `<button class="btn btn-ai btn-sm" style="margin-top:10px" data-title="${escAttr(ins.ctaPrompt)}" onclick="genFromSuggestion(this.dataset.title)">${ins.cta}</button>` : ''}
      </div>
    </div>`).join('');

  return `
  <div class="ct-card" style="margin-bottom:16px">
    <div class="ct-title">Weekly Search Volume in Singapore</div>
    <div class="ct-sub">Google search volume · self storage category · % change is week-over-week</div>
    ${bars}
  </div>
  <div class="ct-card" style="margin-bottom:16px">
    <div class="ct-title">Keyword ranking</div>
    <div class="ct-sub">Exact search volume and status for each tracked keyword</div>
    ${kw}
  </div>
  ${suggBlock('AI Suggested Posts', "Post ideas generated from this week&#39;s search trends", data.suggestedPosts)}
  <div class="ai-card" style="margin-top:16px">
    <div class="ai-card-hdr"><div class="ai-card-title-row"><div class="ai-star-ico">${ICO.sparkle}</div><div class="card-title" style="font-size:17px">AI Insights</div></div></div>
    <div class="card-sub" style="margin-bottom:10px">Analysis and recommended next steps for this week</div>
    ${insightsHTML}
  </div>`;
}

/* ============ CUSTOMER CHATS — GET /api/research/customer-chats ============ */
async function tabCustomerChats(){
  const data = await safeCall(() => API.getCustomerChats(), "Couldn't load customer chats");
  if(!data) return loadingHTML("Couldn't load this tab. Try Refresh.");

  const qrows = data.questions.map((q,i)=>`<div class="q-row"><span class="q-num">${i+1}.</span> ${q}</div>`).join('');
  const srows = data.serviceAnalysis.map(s=>`<div class="svc-row"><div class="svc-top"><span>${s.label}</span><span>${s.pct}%</span></div><div class="svc-track"><div class="svc-fill" style="width:${s.pct}%"></div></div></div>`).join('');

  return `
  <div class="rs-banner" style="margin-bottom:16px">
    <div class="rs-banner-ico">${ICO.sparkle}</div>
    <div class="rs-banner-txt"><b>About this data</b><br>${data.meta.source} ${data.meta.conversationsReviewed} conversations reviewed this month. Data refreshes ${data.meta.refreshCadence}.</div>
  </div>
  <div class="soc-grid" style="margin-bottom:16px">
    <div class="gold-card">
      <div class="ct-title-row"><span class="ct-title-ico">${ICO.question}</span><div><div class="ct-title" style="color:#4A3200">Common questions before booking</div><div class="ct-sub" style="color:#7A5A16;margin-bottom:0">Questions asked before booking is made throughout the week</div></div></div>
      <div class="q-scroll">${qrows}</div>
    </div>
    <div class="gold-card-dk">
      <div class="ct-title-row"><span class="ct-title-ico" style="color:#fff">${ICO.service}</span><div><div class="ct-title" style="color:#fff">Service Analysis</div><div class="ct-sub" style="color:#FFE9C2;margin-bottom:0">Top services requested across ${data.meta.conversationsReviewed} chats throughout the week</div></div></div>
      ${srows}
    </div>
  </div>
  ${patternBlock('AI Insights & Patterns','Recurring themes found in customer chats','AI PATTERNS',data.patterns)}
  <div style="height:16px"></div>
  ${suggBlock('AI Suggested Posts','Post ideas generated from customer chat patterns',data.suggestedPosts)}
  `;
}

/* ============ SOCIAL MEDIA — GET /api/research/social-media ============ */
async function tabSocialMedia(){
  const data = await safeCall(() => API.getSocialMedia(), "Couldn't load social media data");
  if(!data) return loadingHTML("Couldn't load this tab. Try Refresh.");

  const rankRows = () => data.ranking.map((r,i)=>`<div class="rank-row"><span class="rank-num">${i+1}</span><span class="rank-title">${r.title}</span><span class="rank-stat">${ICO.heart} ${r.likes}</span><span class="rank-stat">${ICO.eye} ${r.views.toLocaleString()}</span></div>`).join('');
  const commentList = (arr) => arr.map(c=>`<div class="cm-item"><span class="cm-name">${c.user}</span><div class="cm-txt">${c.text}</div></div>`).join('');
  const reviewList = (arr) => arr.map(r=>`<div class="cm-item"><span class="cm-name">${r.user}</span><span class="cm-stars">${'★'.repeat(r.stars)}</span><div class="cm-txt">${r.text}</div></div>`).join('');

  return `
  <div class="ct-title" style="margin-bottom:2px">Engagement</div>
  <div class="ct-sub" style="margin-bottom:14px">Views and likes of your posts this week.</div>
  <div class="soc-grid" style="margin-bottom:20px">
    <div class="soc-card">
      <div class="soc-hdr" style="background:${data.facebook.color}"><span>${data.facebook.name}</span><small>${data.facebook.postsThisWeek} posts</small></div>
      <div class="soc-preview-wrap" style="background:${data.facebook.color}"><img class="soc-preview-img" src="${ASSET[data.facebook.previewImg]}" alt="Facebook page preview"></div>
      <div class="soc-link" onclick="toast('Opening Facebook page...')">Click to visit your facebook page</div>
      <div class="rank-header"><span></span><span>Ranking</span><span>Likes</span><span>Views</span></div>
      ${rankRows()}
    </div>
    <div class="soc-card">
      <div class="soc-hdr" style="background:${data.instagram.color}"><span>${data.instagram.name}</span><small>${data.instagram.postsThisWeek} posts</small></div>
      <div class="soc-preview-wrap" style="background:${data.instagram.color}"><img class="soc-preview-img" src="${ASSET[data.instagram.previewImg]}" alt="Instagram profile preview"></div>
      <div class="soc-link" onclick="toast('Opening Instagram page...')">Click to visit your instagram page</div>
      <div class="rank-header"><span></span><span>Ranking</span><span>Likes</span><span>Views</span></div>
      ${rankRows()}
    </div>
  </div>
  <div class="ct-title" style="margin-bottom:2px">Comments</div>
  <div class="ct-sub" style="margin-bottom:14px">Comments and reviews from your Facebook, Instagram and Google Reviews</div>
  <div class="cm-grid" style="margin-bottom:20px">
    <div class="cm-card">
      <div class="cm-hdr" style="background:${data.facebook.color}"><span>Facebook</span><small>${data.comments.facebook.length} comments</small></div>
      <div class="cm-body">${commentList(data.comments.facebook)}</div>
    </div>
    <div class="cm-card">
      <div class="cm-hdr" style="background:${data.instagram.color}"><span>Instagram</span><small>${data.comments.instagram.length} comments</small></div>
      <div class="cm-body">${commentList(data.comments.instagram)}</div>
    </div>
    <div class="cm-card">
      <div class="cm-hdr" style="background:#2F7A3D"><span>Google</span><small>&#9733;${data.comments.google.rating} &middot; ${data.comments.google.count}</small></div>
      <div class="cm-body">${reviewList(data.comments.google.reviews)}</div>
    </div>
  </div>
  ${patternBlock('AI Insights & Patterns','Recurring themes found in customer chats','AI PATTERNS',data.patterns)}
  <div style="height:16px"></div>
  ${suggBlock('AI Suggested Posts','Post ideas generated from customer chat patterns',data.suggestedPosts)}
  `;
}

/* ============ COMPETITOR ANALYSIS ============
 * List:   GET /api/research/competitors
 * Detail: GET /api/research/competitors/:id
 */
async function tabCompetitor(){
  if(!competitorListCache){
    competitorListCache = await safeCall(() => API.getCompetitorList(), "Couldn't load competitor list");
    if(!competitorListCache) return loadingHTML("Couldn't load competitors. Try Refresh.");
  }
  if(!activeCompetitorId) activeCompetitorId = competitorListCache[0].id;

  const detail = await safeCall(() => API.getCompetitorDetail(activeCompetitorId), "Couldn't load competitor detail");
  if(!detail) return loadingHTML("Couldn't load competitor detail. Try Refresh.");

  const pills = competitorListCache.map(comp =>
    `<button class="comp-pill ${comp.id===activeCompetitorId?'on':''}" onclick="setCompetitor('${comp.id}')">${comp.pill}</button>`
  ).join('');

  const recoRows = detail.reco.map(r=>`<div class="insight-row" style="border-top:1px solid #F6E3DD"><div style="flex:1"><div class="insight-title">${r.title}</div><div class="insight-body">${r.body}</div></div></div>`).join('');
  const suggRows = detail.sugg.map((s,i)=>`<div class="sugg-row"><div class="sugg-num">${i+1}</div><div style="flex:1"><div class="sugg-title">${s.title}</div><div class="sugg-sub">${s.sub}</div></div><button class="btn btn-ai btn-sm" data-title="${escAttr(s.title)}" onclick="genFromSuggestion(this.dataset.title)">${ICO.pencil} Generate</button></div>`).join('');
  const postList = (posts) => posts.map(p=>`<div class="comp-post-title">${p}</div>`).join('');
  const commentList = (arr) => arr.map(t=>`<div class="comp-rev"><span class="cm-name">${t.user}</span><div class="cm-txt">${t.text}</div></div>`).join('');
  const reviewList = (arr) => arr.map(r=>`<div class="comp-rev"><span class="cm-name">${r.user}</span><span class="cm-stars">${'★'.repeat(r.stars)}</span><div class="cm-txt">${r.text}</div></div>`).join('');

  return `
  <div class="ct-title" style="margin-bottom:2px">Your Competitors</div>
  <div class="ct-sub" style="margin-bottom:14px">Views, likes and engagement of your competitors this week, extracted from Instagram, Facebook and Google Reviews</div>
  <div class="comp-pill-row" style="margin-bottom:16px">${pills}</div>
  <div class="comp-selected-banner" style="margin-bottom:18px">
    <div class="comp-selected-avatar">${detail.avatar}</div>
    <div class="comp-selected-name">${detail.name}</div>
  </div>
  <div class="comp-3grid" style="margin-bottom:20px">
    <div class="soc-card">
      <div class="soc-hdr" style="background:#3E6FB0"><span>Facebook</span><small>${detail.fb.comments} comments</small></div>
      <div class="comp-eng-row"><div class="comp-eng-stat"><b>${ICO.heart} ${detail.fb.likes}</b>Likes</div><div class="comp-eng-stat"><b>${ICO.eye} ${detail.fb.views.toLocaleString()}</b>Views</div></div>
      <div class="comp-section-lbl">Recent Posts</div>
      ${postList(detail.fb.posts)}
      <div class="comp-section-lbl">Top Comments</div>
      ${commentList(detail.fb.top)}
    </div>
    <div class="soc-card">
      <div class="soc-hdr" style="background:#C0392B"><span>Instagram</span><small>${detail.ig.comments} comments</small></div>
      <div class="comp-eng-row"><div class="comp-eng-stat"><b>${ICO.heart} ${detail.ig.likes}</b>Likes</div><div class="comp-eng-stat"><b>${ICO.eye} ${detail.ig.views.toLocaleString()}</b>Views</div></div>
      <div class="comp-section-lbl">Recent Posts</div>
      ${postList(detail.ig.posts)}
      <div class="comp-section-lbl">Top Comments</div>
      ${commentList(detail.ig.top)}
    </div>
    <div class="soc-card">
      <div class="soc-hdr" style="background:#2F7A3D"><span>Google</span><small>&#9733;${detail.g.rating} &middot; ${detail.g.count}</small></div>
      <div style="padding-top:6px">${reviewList(detail.g.reviews)}</div>
    </div>
  </div>
  <div class="ai-card" style="margin-bottom:16px">
    <div class="ai-card-hdr"><div class="ai-card-title-row"><div class="ai-star-ico">${ICO.sparkle}</div><div class="card-title" style="font-size:17px">AI Strategic Recommendations</div></div><span class="tag-pill red">AI RECOMMENDATIONS</span></div>
    <div class="card-sub" style="margin-bottom:4px">How to beat ${detail.name}, based on their reviews and comments</div>
    ${recoRows}
  </div>
  <div class="ai-card">
    <div class="ai-card-hdr"><div class="ai-card-title-row"><div class="ai-star-ico">${ICO.sparkle}</div><div class="card-title" style="font-size:17px">AI Suggested Posts</div></div><span class="tag-pill red">AI SUGGESTED POSTS</span></div>
    <div class="card-sub" style="margin-bottom:4px">Beat ${detail.name}, based on their reviews and comments</div>
    ${suggRows}
  </div>`;
}
async function setCompetitor(id){
  activeCompetitorId = id;
  document.getElementById('subtab-content').innerHTML = loadingHTML('Loading competitor…');
  document.getElementById('subtab-content').innerHTML = await tabCompetitor();
}

/* ============ GENERATE PAGE ============ */
async function renderGenerate(){
  document.getElementById('main').innerHTML = loadingHTML('Loading Generate…');

  const [recommendations, drafts] = await Promise.all([
    safeCall(() => API.getGenerateRecommendations(), "Couldn't load recommendations"),
    safeCall(() => API.getSavedDrafts(), "Couldn't load saved drafts")
  ]);
  savedDrafts = drafts || [];

  document.getElementById('main').innerHTML = `
  <div class="pgwrap">
    <div>
      <div class="pg-title" style="font-size:34px">Generate</div>
      <div class="pg-sub">Create a post — AI writes it in Urban Space's brand voice.</div>
    </div>
    <div class="card" id="genFormCard">${genFormHTML()}</div>
    <div id="genOptionsWrap">${genOptionsHTML()}</div>
    <div class="card sdraft-card">
      <div class="sdraft-card-hdr">Saved drafts</div>
      <div id="savedDraftsList">${savedDraftsHTML()}</div>
    </div>
    <div id="recoBlockWrap">${recoBlock(recommendations || [])}</div>
  </div>`;
}

function genFormHTML(){
  return `
  <div class="card-hdr-row" style="margin-bottom:18px">
    <div class="ai-star-ico" style="background:var(--blue)">${ICO.sparkle}</div>
    <div><div class="card-title" style="font-size:17px">What do you want to make?</div><div class="card-sub">AI drafts it in your brand voice</div></div>
  </div>
  <div class="gfield-block">
    <div class="gform-lbl">Platform</div>
    <div class="gchip-row">${chip('platform','Instagram')}${chip('platform','Facebook')}</div>
  </div>
  <div class="gfield-block">
    <div class="gform-lbl">Topic / Prompt</div>
    <textarea class="gprompt" id="promptBox" placeholder="e.g. 3 months free promo — move in before July and lock in our best rate" oninput="genState.prompt=this.value">${genState.prompt}</textarea>
  </div>
  <div class="g2col gfield-block">
    <div>
      <div class="gform-lbl">Tone</div>
      <div class="gchip-row">${chip('tone','Friendly')}${chip('tone','Professional')}${chip('tone','Urgent')}${chip('tone','Funny')}</div>
    </div>
    <div>
      <div class="gform-lbl">Length</div>
      <div class="gchip-row">${chip('length','Short')}${chip('length','Medium')}${chip('length','Long')}</div>
    </div>
  </div>
  <div class="g2col gfield-block">
    <div>
      <div class="gform-lbl">Target Audience</div>
      <div class="gchip-row">${chip('audience','Homeowners')}${chip('audience','E-commerce Sellers')}${chip('audience','Startups/SMEs')}${chip('audience','Businesses')}</div>
    </div>
    <div>
      <div class="gform-lbl">Visual Style</div>
      <div class="gchip-row">${chip('style','Before/After')}${chip('style','Product')}${chip('style','Lifestyle')}${chip('style','Text-forward')}</div>
    </div>
  </div>
  <button class="btn btn-blue" onclick="doGenerate()">${ICO.sparkle} Generate 3 options</button>
  `;
}
function chip(field,val){
  const on = genState[field]===val;
  return `<button class="gchip ${on?'on':''}" onclick="setGenField('${field}','${val}')">${val}</button>`;
}
function setGenField(field,val){
  genState[field] = val;
  document.getElementById('genFormCard').innerHTML = genFormHTML();
}

function genOptionsHTML(){
  const cards = genDrafts.map((d,i)=>`<div class="gdraft-card">
      <div class="gdraft-hdr" style="background:${d.col}">${ICO.camera}<div class="gdraft-hdr-lbl">Draft ${i+1} &middot; ${d.plat}</div></div>
      <div class="gdraft-body">
        <div class="gdraft-txt">${d.txt}</div>
        <div class="gdraft-tags">${d.tags}</div>
        <div class="gdraft-actions">
          <button class="btn btn-blue btn-sm" style="flex:1;justify-content:center" onclick="useDraft(${i})">Use this</button>
          <button class="btn btn-outline btn-sm" onclick="saveDraft(${i})">Save to draft</button>
          <button class="btn btn-outline btn-sm" onclick="toast('Opening in Canva...')">${ICO.canva} Canva</button>
        </div>
      </div>
    </div>`).join('');
  return `
  <div class="res-hdr-row" style="align-items:center">
    <div><div class="card-title" style="font-size:19px">Generated options</div><div class="card-sub">Save, or open in Canva to edit</div></div>
    <button class="btn btn-white btn-sm" onclick="doGenerate()">${ICO.refresh} Regenerate all</button>
  </div>
  <div class="gdraft-grid" style="margin-top:14px">${cards}</div>
  `;
}
function savedDraftsHTML(){
  if(savedDrafts.length===0) return `<div style="padding:24px;text-align:center;color:var(--faint);font-size:12.5px">No saved drafts yet. Generate posts and click "Save to draft" to store them here.</div>`;
  return savedDrafts.map((d,i)=>`<div class="sdraft-row" style="padding-left:22px;padding-right:22px">
    <div style="flex:1"><div class="sdraft-title">${d.title}</div><div class="sdraft-meta">${d.meta}</div></div>
    <button class="btn btn-blue-outline btn-sm" onclick="useSavedDraft(${i})">Use this</button>
    <button class="btn btn-outline btn-sm" onclick="deleteDraft('${d.id}')">${ICO.trash} Delete</button>
  </div>`).join('');
}
function recoBlock(items){
  const rows = items.map((it,i)=>`<div class="sugg-row" style="padding-left:22px;padding-right:22px">
    <div class="sugg-num">${i+1}</div>
    <div style="flex:1"><div class="sugg-title">${it.title}</div><div class="sugg-sub">${it.sub}</div></div>
    <button class="btn btn-ai btn-sm" data-title="${escAttr(it.title)}" onclick="genFromSuggestion(this.dataset.title)">${ICO.pencil} Generate</button>
  </div>`).join('');
  return `<div class="ai-card" style="padding:18px 0 6px">
    <div style="padding:0 22px"><div class="card-hdr-row" style="margin-bottom:2px"><div class="ai-star-ico">${ICO.sparkle}</div><div class="card-title" style="font-size:17px">AI Recommendations — one-click generate</div><span class="tag-pill red" style="margin-left:auto">AI SUGGESTED POSTS</span></div></div>
    <div style="height:8px"></div>
    ${rows}
  </div>`;
}

async function doGenerate(){
  const wrap = document.getElementById('genOptionsWrap');
  const prevHTML = wrap.innerHTML;
  wrap.innerHTML = loadingHTML('Generating 3 options…');
  const drafts = await safeCall(() => API.generatePosts(genState), "Couldn't generate posts");
  if(!drafts){ wrap.innerHTML = prevHTML; return; }
  genDrafts = drafts;
  wrap.innerHTML = genOptionsHTML();
  toast('Generated 3 new options');
}

function useDraft(i){
  const d = genDrafts[i];
  downloadPostPNG(d.txt, d.col, d.plat);
  toast('Downloading PNG…');
}
function useSavedDraft(i){
  const d = savedDrafts[i];
  downloadPostPNG(d.title, d.col || '#E8651A', d.plat || 'Urban Space');
  toast('Downloading PNG…');
}

async function saveDraft(i){
  const d = genDrafts[i];
  const draftPayload = { title:d.txt, meta:`${d.plat} · ${genState.tone} · ${genState.length} · ${genState.audience} · Saved just now`, col:d.col, plat:d.plat };
  const saved = await safeCall(() => API.saveDraft(draftPayload), "Couldn't save draft");
  if(!saved) return;
  savedDrafts.unshift(saved);
  document.getElementById('savedDraftsList').innerHTML = savedDraftsHTML();
  toast('Saved to drafts');
}
async function deleteDraft(id){
  const ok = await safeCall(() => API.deleteDraft(id), "Couldn't delete draft");
  if(ok === null) return;
  savedDrafts = savedDrafts.filter(d => d.id !== id);
  document.getElementById('savedDraftsList').innerHTML = savedDraftsHTML();
}

async function genFromSuggestion(title){
  genState.prompt = title;
  await go('generate');
  await doGenerate();
  document.getElementById('main').scrollTop = 0;
}

/* ============ PNG EXPORT (client-side only, no backend needed) ============ */
async function downloadPostPNG(text,color,platform){
  if(document.fonts && document.fonts.ready){ try{ await document.fonts.ready; }catch(e){} }
  const W=1080, H=1080;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if(!ctx){ toast('PNG export not supported in this browser'); return; }
  ctx.fillStyle = color;
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.beginPath(); ctx.arc(W-80,90,220,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '800 42px "DM Sans",sans-serif';
  ctx.fillText('URBAN SPACE', 64, 96);
  ctx.font = '700 24px "DM Sans",sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.fillText((platform||'').toUpperCase(), 64, 132);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 54px "DM Sans",sans-serif';
  wrapCanvasText(ctx, text, 64, 340, W-128, 66);
  ctx.font = '500 24px "DM Sans",sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.fillText('Self-Storage · Work · Fulfilment', 64, H-64);
  canvas.toBlob(function(blob){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'urbanspace-post-' + Date.now() + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
  }, 'image/png');
}
function wrapCanvasText(ctx,text,x,y,maxWidth,lineHeight){
  const words = String(text).split(' ');
  let line = '';
  let curY = y;
  for(let n=0;n<words.length;n++){
    const testLine = line + words[n] + ' ';
    if(ctx.measureText(testLine).width > maxWidth && n>0){
      ctx.fillText(line, x, curY);
      line = words[n] + ' ';
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, curY);
}

/* ============ INIT ============ */
document.addEventListener('DOMContentLoaded', function(){
  document.getElementById('main').style.backgroundImage = 'url(' + ASSET.BG_GRAD + ')';
  go('home');
});
