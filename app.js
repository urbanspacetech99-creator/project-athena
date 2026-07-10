var ICO={
  wand:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5L7 21l-4-1-1-4L15 4z"/><path d="M18 1l1.5 1.5L18 4l-1.5-1.5L18 1z"/></svg>',
  ref:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0114.93-4M20 4v4h-4M20 12a8 8 0 01-14.93 4M4 20v-4h4"/></svg>',
  star:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M16.3 7.7l-2.1 2.1M7.8 16.2l-2.1 2.1"/><circle cx="12" cy="12" r="3"/></svg>',
  comp:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>'
};
 
// Tracks which research tabs the user has enabled (persists within session)
var resTabsEnabled={tr:true,zo:true,so:true,cp:true};
var resTabsConfigured=false;
 
function go(page){
  ['home','research','generate'].forEach(function(p){
    var b=document.getElementById('nb-'+p);
    if(b)b.classList.toggle('on',p===page);
  });
  document.querySelector('.main').scrollTop=0;
  if(page==='home')renderHome();
  else if(page==='research')renderResearchSelector();
  else if(page==='generate')renderGenerate();
}
 
function goResearchDirect(){
  ['home','research','generate'].forEach(function(p){
    var b=document.getElementById('nb-'+p);
    if(b)b.classList.toggle('on',p==='research');
  });
  document.querySelector('.main').scrollTop=0;
  renderResearch();
}
 
function spark(points,col){
  var w=64,h=26,pad=2;
  var mn=Math.min.apply(null,points),mx=Math.max.apply(null,points);
  var rng=(mx-mn)||1;
  var step=(w-pad*2)/(points.length-1);
  var pts=points.map(function(v,i){
    var x=pad+i*step;
    var y=pad+(h-pad*2)*(1-(v-mn)/rng);
    return x.toFixed(1)+','+y.toFixed(1);
  });
  var last=pts[pts.length-1].split(',');
  return '<svg class="kspark" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" fill="none">'+
    '<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+col+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'+
    '<circle cx="'+last[0]+'" cy="'+last[1]+'" r="1.8" fill="'+col+'"/>'+
  '</svg>';
}
 
function renderHome(){
  document.getElementById('mc').innerHTML=
  '<div class="pg">'+
    '<div class="row" style="justify-content:space-between">'+
      '<div><div class="pg-title">Good morning, Thomas.</div><div class="pg-sub">Marketing overview for Urban Space Self Storage — this week.</div></div>'+
      '<button class="btn btn-s">'+
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 11l4 4 4-4"/><path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2"/></svg>'+
        'Download report</button>'+
    '</div>'+
    '<div class="g2">'+
      '<div class="nc" onclick="go(\'research\')">'+
        '<div class="nc-ico" style="background:var(--nl)">'+
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>'+
        '</div>'+
        '<div><div class="nc-title">Research</div><div class="nc-sub">Trends, ZOHO chat analysis, social comments &amp; competitor analysis.</div></div>'+
        '<button class="btn btn-s btn-sm" style="align-self:flex-start" onclick="event.stopPropagation();go(\'research\')">Go to Research'+
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>'+
      '</div>'+
      '<div class="nc" onclick="go(\'generate\')">'+
        '<div class="nc-ico" style="background:var(--ol)">'+
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5L7 21l-4-1-1-4L15 4z"/><path d="M18 1l1.5 1.5L18 4l-1.5-1.5L18 1z"/></svg>'+
        '</div>'+
        '<div><div class="nc-title">Generate</div><div class="nc-sub">Create Instagram &amp; LinkedIn posts with AI in Urban Space brand voice.</div></div>'+
        '<button class="btn btn-g btn-sm" style="align-self:flex-start" onclick="event.stopPropagation();go(\'generate\')">Go to Generate'+
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>'+
      '</div>'+
    '</div>'+
    '<div class="card" style="padding:14px 16px">'+
      '<div class="row" style="justify-content:space-between;margin-bottom:4px">'+
        '<span class="sec-title">KPIs</span>'+
        '<span style="font-size:11px;color:var(--fnt)">This week</span>'+
      '</div>'+
      '<div style="font-size:11px;color:var(--mut);margin-bottom:12px">Overall performance across all platforms and posts this week.</div>'+
      '<div class="g4">'+
        '<div class="ktile">'+
          '<div class="kico" style="background:var(--nl)">'+
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--nvy)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12C3 7 7 4 12 4s9 3 11 8c-2 5-6 8-11 8S3 17 1 12z"/><circle cx="12" cy="12" r="3"/></svg>'+
          '</div>'+
          '<div><div class="kval">11.8k</div><div class="klbl">Total Views</div><div class="ksub ksub-up">&#8593; 22% this month</div></div>'+
          spark([6.2,7.1,6.8,8.4,9.1,8.7,10.2,11.8],'var(--nvy)')+
        '</div>'+
        '<div class="ktile">'+
          '<div class="kico" style="background:var(--ol)">'+
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ora)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>'+
          '</div>'+
          '<div><div class="kval">1,420</div><div class="klbl">Likes</div><div class="ksub ksub-up">&#8593; 5.9% avg. rate</div></div>'+
          spark([910,1020,980,1110,1190,1240,1305,1420],'var(--ora)')+
        '</div>'+
        '<div class="ktile">'+
          '<div class="kico" style="background:var(--gl)">'+
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--grn)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>'+
          '</div>'+
          '<div><div class="kval">3.2k</div><div class="klbl">Interactions</div><div class="ksub ksub-up">&#8593; 14% this month</div></div>'+
          spark([2.1,2.4,2.2,2.6,2.8,2.7,3.0,3.2],'var(--grn)')+
        '</div>'+
        '<div class="ktile">'+
          '<div class="kico" style="background:var(--pl)">'+
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pur)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 8h8M8 12h5M8 16h3"/></svg>'+
          '</div>'+
          '<div><div class="kval">6</div><div class="klbl">Posts This Week</div><div class="ksub" style="color:var(--mut)">2 scheduled</div></div>'+
          spark([4,5,3,6,5,4,7,6],'var(--pur)')+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="card">'+
      '<div class="row" style="justify-content:space-between;margin-bottom:12px">'+
        '<div class="row" style="gap:9px">'+
          '<div class="ai-badge">'+
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M16.3 7.7l-2.1 2.1M7.8 16.2l-2.1 2.1"/><circle cx="12" cy="12" r="3"/></svg>'+
          '</div>'+
          '<span class="sec-title">Weekly Summary</span>'+
        '</div>'+
        '<span style="font-size:11px;color:var(--fnt)">Updated just now</span>'+
      '</div>'+
      '<div class="notif"><span class="ndot" style="background:#E53935"></span><div class="flex1"><div class="ntitle">Anomaly: engagement dropped 31% on LinkedIn posts this week</div><div class="nsub">Below 3-week average — consider refreshing B2B content angle</div></div><button class="btn btn-s btn-sm">View</button></div>'+
      '<div class="notif"><span class="ndot" style="background:#E8651A"></span><div class="flex1"><div class="ntitle">3 generated posts awaiting your approval</div><div class="nsub">Added today, 8:45am</div></div><button class="btn btn-s btn-sm" onclick="go(\'generate\')">Review</button></div>'+
      '<div class="notif"><span class="ndot" style="background:#B07A10"></span><div class="flex1"><div class="ntitle">Competitor activity spike detected — BigBox Storage posted 4&times; this week</div><div class="nsub">Research page updated &middot; competitor analysis refreshed</div></div><button class="btn btn-s btn-sm" onclick="go(\'research\')">View</button></div>'+
      '<div class="notif"><span class="ndot" style="background:var(--grn)"></span><div class="flex1"><div class="ntitle">"Before &amp; after" format driving highest engagement — 9.2% this week</div><div class="nsub">AI recommends 2 more posts in this format next week</div></div></div>'+
      '<div class="notif"><span class="ndot" style="background:var(--grn)"></span><div class="flex1"><div class="ntitle">"3 months free" promo post published — 2,140 views so far</div><div class="nsub">Yesterday 9:00am &middot; Instagram &middot; top post this week</div></div></div>'+
    '</div>'+
  '</div>';
}
 
function bar(data,col){
  var mx=Math.max.apply(null,data.map(function(d){return d.v;}));
  var html='<div class="bchart">';
  data.forEach(function(d){
    var h=Math.round(60*d.v/mx);
    html+='<div class="bwrap">'+
      '<div style="width:100%;height:60px;background:'+col+'18;border-radius:3px 3px 0 0;position:relative;overflow:hidden;flex-shrink:0">'+
        '<div style="position:absolute;bottom:0;width:100%;background:'+col+';border-radius:3px 3px 0 0;height:'+h+'px"></div>'+
      '</div>'+
      '<div class="blbl">'+d.l+'</div>'+
    '</div>';
  });
  return html+'</div>';
}
function insRow(n,title,reason,nc,nb){
  return '<div class="ins-row">'+
    '<div class="ins-num" style="background:'+nb+';color:'+nc+'">'+n+'</div>'+
    '<div style="flex:1"><div class="ins-title">'+title+'</div><div class="ins-reason">'+reason+'</div></div>'+
    '<button class="btn btn-g btn-sm">'+ICO.wand+' Generate</button>'+
  '</div>';
}
 
var cpOpen=0;
function setCp(n){
  cpOpen=n;
  for(var i=0;i<4;i++){
    var el=document.getElementById('cp-c'+i);
    if(el)el.classList.toggle('hidden',i!==n);
    var btn=document.getElementById('cp-btn'+i);
    if(btn){btn.style.borderColor=i===n?'var(--ora)':'var(--brd)';btn.style.background=i===n?'var(--ol)':'var(--sur)';btn.style.color=i===n?'var(--od)':'var(--mut)';}
  }
}
 
function rT(t,btn){
  ['tr','zo','so','cp'].forEach(function(x){
    var el=document.getElementById('res-'+x);
    if(el)el.classList.toggle('hidden',x!==t);
  });
  document.querySelectorAll('#res-tabs .pill').forEach(function(b){b.classList.remove('on');});
  if(btn)btn.classList.add('on');
  if(t==='cp')setTimeout(function(){setCp(cpOpen);},10);
}
 
function renderResearchSelector(){
  var tabs=[
    {id:'tr',label:'Internet Trends',icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',desc:'Top Google search trends, keyword rankings, and AI-suggested posts for this week.',col:'var(--nvy)',bg:'var(--nl)'},
    {id:'zo',label:'Customer Chats',icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',desc:'ZOHO WhatsApp chat analysis — common questions, service demand, and AI patterns.',col:'var(--ora)',bg:'var(--ol)'},
    {id:'so',label:'Social Media',icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',desc:'Facebook, Instagram, and Google post performance, comments, and sentiment analysis.',col:'var(--pur)',bg:'var(--pl)'},
    {id:'cp',label:'Competitor Analysis',icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',desc:'BigBox Storage, StorePlus SG, SpaceUrban & SafeStore SG — posts, comments, AI strategy.',col:'#8B2FC9',bg:'#F3E8FF'}
  ];
 
  var cards='';
  tabs.forEach(function(t){
    var on=resTabsEnabled[t.id];
    cards+='<div id="sel-card-'+t.id+'" onclick="toggleResTab(\''+t.id+'\')" style="'+
      'background:'+(on?'var(--sur)':'#FAFAF7')+';'+
      'border:1.5px solid '+(on?t.col:'var(--brd)')+';'+
      'border-radius:12px;padding:18px 20px;cursor:pointer;'+
      'display:flex;align-items:flex-start;gap:14px;'+
      'transition:all .15s;position:relative;user-select:none;">'+
      '<div style="'+
        'width:42px;height:42px;border-radius:10px;'+
        'background:'+(on?t.bg:'#F0EDEA')+';'+
        'display:flex;align-items:center;justify-content:center;flex-shrink:0;'+
        'color:'+(on?t.col:'var(--fnt)')+'">'+t.icon+'</div>'+
      '<div style="flex:1">'+
        '<div style="font-size:14px;font-weight:700;color:'+(on?'var(--txt)':'var(--fnt)')+';margin-bottom:4px">'+t.label+'</div>'+
        '<div style="font-size:11px;color:var(--mut);line-height:1.55">'+t.desc+'</div>'+
      '</div>'+
      '<div id="sel-tog-'+t.id+'" style="'+
        'width:20px;height:20px;border-radius:50%;border:2px solid '+(on?t.col:'var(--brd)')+';'+
        'background:'+(on?t.col:'transparent')+';'+
        'display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;transition:all .15s">'+
        (on?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':'')+
      '</div>'+
    '</div>';
  });
 
  document.getElementById('mc').innerHTML=
  '<div class="pg">'+
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">'+
      '<div>'+
        '<div class="pg-title">Research</div>'+
        '<div class="pg-sub">Select the data sources you want to view before entering the research dashboard.</div>'+
      '</div>'+
    '</div>'+
 
    '<div style="background:var(--ol);border:1px solid #E8651A28;border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:10px">'+
      '<div class="ai-badge" style="flex-shrink:0">'+ICO.star+'</div>'+
      '<div style="font-size:12px;color:var(--txt);line-height:1.6">'+
        'Turn on the data sources relevant to your session. You can change this at any time by returning to this screen.'+
      '</div>'+
    '</div>'+
 
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+cards+'</div>'+
 
    '<div style="display:flex;align-items:center;justify-content:space-between;padding-top:4px">'+
      '<button onclick="toggleAllResTabs()" style="'+
        'background:transparent;border:none;font-size:12px;color:var(--mut);cursor:pointer;font-family:inherit;text-decoration:underline;text-underline-offset:2px">'+
        'Toggle all'+
      '</button>'+
      '<div style="display:flex;gap:8px">'+
        '<button class="btn btn-s" onclick="go(\'home\')">Cancel</button>'+
        '<button class="btn btn-p" onclick="startResearch()">'+
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>'+
          ' View Research'+
        '</button>'+
      '</div>'+
    '</div>'+
  '</div>';
}
 
function toggleResTab(id){
  // Must keep at least one tab on
  var enabled=Object.keys(resTabsEnabled).filter(function(k){return resTabsEnabled[k];});
  if(resTabsEnabled[id]&&enabled.length===1)return;
 
  resTabsEnabled[id]=!resTabsEnabled[id];
  var on=resTabsEnabled[id];
  var tabMeta={
    tr:{col:'var(--nvy)',bg:'var(--nl)'},
    zo:{col:'var(--ora)',bg:'var(--ol)'},
    so:{col:'var(--pur)',bg:'var(--pl)'},
    cp:{col:'#8B2FC9',bg:'#F3E8FF'}
  };
  var m=tabMeta[id];
 
  var card=document.getElementById('sel-card-'+id);
  if(card){
    card.style.background=on?'var(--sur)':'#FAFAF7';
    card.style.borderColor=on?m.col:'var(--brd)';
    var ico=card.querySelector('div>div:first-child');
    if(ico){ico.style.background=on?m.bg:'#F0EDEA';ico.style.color=on?m.col:'var(--fnt)';}
    var lbl=card.querySelector('div:nth-child(2) div:first-child');
    if(lbl)lbl.style.color=on?'var(--txt)':'var(--fnt)';
  }
  var tog=document.getElementById('sel-tog-'+id);
  if(tog){
    tog.style.borderColor=on?m.col:'var(--brd)';
    tog.style.background=on?m.col:'transparent';
    tog.innerHTML=on?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':'';
  }
}
 
function toggleAllResTabs(){
  var anyOff=Object.keys(resTabsEnabled).some(function(k){return !resTabsEnabled[k];});
  Object.keys(resTabsEnabled).forEach(function(k){resTabsEnabled[k]=anyOff;});
  // Re-render the selector to reflect changes
  renderResearchSelector();
}
 
function startResearch(){
  var anyOn=Object.keys(resTabsEnabled).some(function(k){return resTabsEnabled[k];});
  if(!anyOn){alert('Please enable at least one data source.');return;}
  resTabsConfigured=true;
  renderResearch();
}
 
function renderResearch(){
  var bNvy='#1A2E4A',bOra='#C04E0F',bPur='#5B3980',bComp='#8B2FC9';
 
  // Build only the enabled tabs in order
  var allTabDefs=[
    {id:'tr',label:'Internet Trends'},
    {id:'zo',label:'Customer Chats'},
    {id:'so',label:'Social Media'},
    {id:'cp',label:'Competitor Analysis'}
  ];
  var activeTabs=allTabDefs.filter(function(t){return resTabsEnabled[t.id];});
  var firstTab=activeTabs.length>0?activeTabs[0].id:'tr';
 
  var pillsHtml='';
  activeTabs.forEach(function(t,i){
    pillsHtml+='<button class="pill'+(i===0?' on':'')+'" onclick="rT(\''+t.id+'\',this)">'+t.label+'</button>';
  });
 
  document.getElementById('mc').innerHTML=
  '<div class="pg">'+
    '<div class="row" style="justify-content:space-between">'+
      '<div>'+
        '<div class="row" style="gap:10px;margin-bottom:4px">'+
          '<div class="pg-title">Research</div>'+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:10px">'+
          '<div class="pg-sub">AI-powered market intelligence for Urban Space — updated weekly.</div>'+
          '<button onclick="renderResearchSelector()" style="'+
            'background:transparent;border:none;font-size:11px;color:var(--ora);'+
            'cursor:pointer;font-family:inherit;font-weight:600;white-space:nowrap;'+
            'display:flex;align-items:center;gap:4px;padding:0">'+
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>'+
            'Change tabs'+
          '</button>'+
        '</div>'+
      '</div>'+
      '<button class="btn btn-s">'+ICO.ref+' Refresh</button>'+
    '</div>'+
 
    '<div class="tab-row" id="res-tabs">'+pillsHtml+'</div>'+
 
    '<div id="res-tr">'+
      '<div class="card" style="margin-bottom:12px">'+
        '<div class="sec-title">Top search trends</div>'+
        '<div class="sec-sub">Self storage searches &middot; Google Singapore &middot; Last 7 days</div>'+
        bar([{l:'Self Store',v:90},{l:'Fulfil',v:72},{l:'Workspace',v:58},{l:'Moving',v:48},{l:'Archive',v:35},{l:'Unit Size',v:29},{l:'Climate',v:22}],'#1A2E4A')+
      '</div>'+
      '<div class="card" style="margin-bottom:12px"><div class="sec-title" style="margin-bottom:8px">Keyword ranking</div>'+
        '<div class="trend-r"><div style="font-size:11px;color:var(--fnt);width:16px;text-align:right">1</div><div class="flex1" style="margin-left:8px"><div style="font-size:13px;font-weight:600">Self storage Singapore</div><div style="font-size:11px;color:var(--mut)">9,800/wk</div></div><span class="tag" style="background:var(--ol);color:var(--ora)">Hot</span><div style="font-size:12px;font-weight:700;color:var(--grn);margin-left:8px">&#8593;41%</div></div>'+
        '<div class="trend-r"><div style="font-size:11px;color:var(--fnt);width:16px;text-align:right">2</div><div class="flex1" style="margin-left:8px"><div style="font-size:13px;font-weight:600">Cheap storage space near me Singapore</div><div style="font-size:11px;color:var(--mut)">7,200/wk</div></div><span class="tag" style="background:var(--ol);color:var(--ora)">Hot</span><div style="font-size:12px;font-weight:700;color:var(--grn);margin-left:8px">&#8593;63%</div></div>'+
        '<div class="trend-r"><div style="font-size:11px;color:var(--fnt);width:16px;text-align:right">3</div><div class="flex1" style="margin-left:8px"><div style="font-size:13px;font-weight:600">E-commerce fulfilment Singapore</div><div style="font-size:11px;color:var(--mut)">4,900/wk</div></div><div style="font-size:12px;font-weight:700;color:var(--grn);margin-left:8px">&#8593;29%</div></div>'+
        '<div class="trend-r"><div style="font-size:11px;color:var(--fnt);width:16px;text-align:right">4</div><div class="flex1" style="margin-left:8px"><div style="font-size:13px;font-weight:600">Storage unit size guide Singapore</div><div style="font-size:11px;color:var(--mut)">3,100/wk</div></div><div style="font-size:12px;font-weight:700;color:var(--grn);margin-left:8px">&#8593;17%</div></div>'+
        '<div class="trend-r"><div style="font-size:11px;color:var(--fnt);width:16px;text-align:right">5</div><div class="flex1" style="margin-left:8px"><div style="font-size:13px;font-weight:600">Workspace rental Depot Road</div><div style="font-size:11px;color:var(--mut)">2,400/wk</div></div><div style="font-size:12px;font-weight:700;color:var(--red);margin-left:8px">&#8595;3%</div></div>'+
        '<div class="trend-r" style="border:none"><div style="font-size:11px;color:var(--fnt);width:16px;text-align:right">6</div><div class="flex1" style="margin-left:8px"><div style="font-size:13px;font-weight:600">Climate controlled storage Singapore</div><div style="font-size:11px;color:var(--mut)">1,900/wk</div></div><div style="font-size:12px;font-weight:700;color:var(--grn);margin-left:8px">&#8593;34%</div></div>'+
      '</div>'+
      '<div class="ins-box"><div class="ins-hdr" style="background:var(--nl)"><span class="ins-hdr-txt" style="color:var(--nvy)">AI-suggested posts</span></div>'+
        insRow(1,'Self storage Singapore — flexible monthly rental','9,800 searches/wk, keyword #1',bNvy,'#D8E8F5')+
        insRow(2,'Affordable storage near me — we\'ve got you covered','Fastest growing keyword at +63%',bNvy,'#D8E8F5')+
        insRow(3,'E-commerce fulfilment for Singapore SMEs','4,900 searches/wk',bNvy,'#D8E8F5')+
        insRow(4,'What storage unit size do I need?','High intent, education-first content',bNvy,'#D8E8F5')+
      '</div>'+
    '</div>'+
 
    '<div id="res-zo" class="hidden">'+
      '<div class="ai-block" style="margin-bottom:12px">'+
        '<div class="ai-head"><div class="ai-badge">'+ICO.star+'</div><span class="ai-title">About this data</span></div>'+
        '<div class="ai-body">Analysed from Urban Space\'s <strong>WhatsApp Business chats</strong> linked via ZOHO CRM. 143 conversations reviewed this month. Data refreshes weekly.</div>'+
      '</div>'+
      '<div class="g2" style="margin-bottom:12px">'+
        '<div class="card"><div class="sec-title" style="font-size:12px;margin-bottom:8px">Common questions before booking</div>'+
          '<div style="display:flex;gap:7px;padding:6px 0;border-bottom:1px solid var(--brd)"><span style="font-size:11px;color:var(--fnt);flex-shrink:0">1.</span><span style="font-size:12px;color:var(--txt)">How much does a storage unit cost per month?</span></div>'+
          '<div style="display:flex;gap:7px;padding:6px 0;border-bottom:1px solid var(--brd)"><span style="font-size:11px;color:var(--fnt);flex-shrink:0">2.</span><span style="font-size:12px;color:var(--txt)">Can I access my unit anytime?</span></div>'+
          '<div style="display:flex;gap:7px;padding:6px 0;border-bottom:1px solid var(--brd)"><span style="font-size:11px;color:var(--fnt);flex-shrink:0">3.</span><span style="font-size:12px;color:var(--txt)">What sizes are available?</span></div>'+
          '<div style="display:flex;gap:7px;padding:6px 0;border-bottom:1px solid var(--brd)"><span style="font-size:11px;color:var(--fnt);flex-shrink:0">4.</span><span style="font-size:12px;color:var(--txt)">Is there CCTV and how secure is it?</span></div>'+
          '<div style="display:flex;gap:7px;padding:6px 0"><span style="font-size:11px;color:var(--fnt);flex-shrink:0">5.</span><span style="font-size:12px;color:var(--txt)">Do you offer short-term rentals?</span></div>'+
        '</div>'+
        '<div class="card"><div class="sec-title" style="font-size:12px;margin-bottom:8px">Service Analysis</div>'+
          '<div style="font-size:11px;color:var(--mut);margin-bottom:8px">Top services requested across 143 chats</div>'+
          '<div style="padding:5px 0;border-bottom:1px solid var(--brd)"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;font-weight:500">Self storage units</span><span style="font-size:11px;color:var(--mut)">48%</span></div><div class="pb"><div class="pbf" style="width:48%;background:var(--ora)"></div></div></div>'+
          '<div style="padding:5px 0;border-bottom:1px solid var(--brd)"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;font-weight:500">24/7 access enquiries</span><span style="font-size:11px;color:var(--mut)">31%</span></div><div class="pb"><div class="pbf" style="width:31%;background:var(--ora)"></div></div></div>'+
          '<div style="padding:5px 0;border-bottom:1px solid var(--brd)"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;font-weight:500">Pricing &amp; quotes</span><span style="font-size:11px;color:var(--mut)">26%</span></div><div class="pb"><div class="pbf" style="width:26%;background:var(--ora)"></div></div></div>'+
          '<div style="padding:5px 0;border-bottom:1px solid var(--brd)"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;font-weight:500">Fulfilment / B2B</span><span style="font-size:11px;color:var(--mut)">18%</span></div><div class="pb"><div class="pbf" style="width:18%;background:var(--ora)"></div></div></div>'+
          '<div style="padding:5px 0"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;font-weight:500">Workspace rental</span><span style="font-size:11px;color:var(--mut)">11%</span></div><div class="pb"><div class="pbf" style="width:11%;background:var(--ora)"></div></div></div>'+
        '</div>'+
      '</div>'+
      '<div class="ins-box">'+
        '<div class="ins-hdr" style="background:var(--ol)"><span class="ins-hdr-txt" style="color:var(--od)">AI Analysis</span></div>'+
        '<div style="padding:9px 14px;border-bottom:1px solid var(--brd);background:#FFFAF6">'+
          '<div style="font-size:11px;font-weight:700;color:var(--od);margin-bottom:6px">AI Patterns</div>'+
          '<div style="padding:5px 0;border-bottom:1px solid var(--brd)"><div style="font-size:12px;font-weight:600;color:var(--txt)">Price transparency is the #1 concern</div><div style="font-size:11px;color:var(--mut);margin-top:1px">71% ask for all-in quotes before committing — customers won\'t call for a price</div></div>'+
          '<div style="padding:5px 0;border-bottom:1px solid var(--brd)"><div style="font-size:12px;font-weight:600;color:var(--txt)">24/7 access is a dealbreaker</div><div style="font-size:11px;color:var(--mut);margin-top:1px">45% of chats mention access hours — after-hours access drives decisions</div></div>'+
          '<div style="padding:5px 0;border-bottom:1px solid var(--brd)"><div style="font-size:12px;font-weight:600;color:var(--txt)">SME &amp; e-commerce demand rising fast</div><div style="font-size:11px;color:var(--mut);margin-top:1px">Business enquiries up 38% vs last month — B2B is an underserved content angle</div></div>'+
          '<div style="padding:5px 0"><div style="font-size:12px;font-weight:600;color:var(--txt)">Security reassurance needed</div><div style="font-size:11px;color:var(--mut);margin-top:1px">CCTV and PIN access cited in 1 of 3 chats — customers need visual proof</div></div>'+
        '</div>'+
        '<div style="padding:7px 14px;background:#FFFBF7;border-bottom:1px solid var(--brd)"><span style="font-size:11px;font-weight:700;color:var(--od)">AI Suggested Posts</span></div>'+
        insRow(1,'All-in storage pricing — no surprise fees','71% ask price upfront',bOra,'#FDEBD8')+
        insRow(2,'24/7 access to your unit — we never close','Top concern in 45% of chats',bOra,'#FDEBD8')+
        insRow(3,'How we keep your belongings safe','Security cited in 1 of 3 conversations',bOra,'#FDEBD8')+
        insRow(4,'Business storage for startups &amp; online sellers','B2B enquiries up 38% this month',bOra,'#FDEBD8')+
        insRow(5,'Unit sizes explained — find yours in 60 seconds','Top question from undecided customers',bOra,'#FDEBD8')+
      '</div>'+
    '</div>'+
 
    '<div id="res-so" class="hidden">'+
      '<div class="so-grid">'+
        '<div>'+
          '<div class="so-section-lbl">Engagement</div>'+
          '<div class="g2" style="margin-bottom:18px">'+
            '<div class="card" style="padding:0;overflow:hidden">'+
              '<div class="ins-hdr"><span class="ins-hdr-txt" style="color:var(--nvy)">Facebook</span><span style="font-size:10px;color:var(--fnt)">4 posts</span></div>'+
              '<div style="padding:0 14px">'+
                '<div class="post-row"><div style="flex:1"><div style="font-size:12px;font-weight:600">3 months free — move in this month</div></div><div style="display:flex;gap:12px;font-size:11px;color:var(--mut)"><span>&#128065; <strong style="color:var(--txt)">3,420</strong></span><span>&#10084; <strong style="color:var(--txt)">218</strong></span><span style="color:var(--grn);font-weight:700">8.4%</span></div></div>'+
                '<div class="post-row"><div style="flex:1"><div style="font-size:12px;font-weight:600">Before &amp; after: family declutter</div></div><div style="display:flex;gap:12px;font-size:11px;color:var(--mut)"><span>&#128065; <strong style="color:var(--txt)">2,810</strong></span><span>&#10084; <strong style="color:var(--txt)">176</strong></span><span style="color:var(--grn);font-weight:700">9.1%</span></div></div>'+
                '<div class="post-row"><div style="flex:1"><div style="font-size:12px;font-weight:600">Why e-commerce sellers choose us</div></div><div style="display:flex;gap:12px;font-size:11px;color:var(--mut)"><span>&#128065; <strong style="color:var(--txt)">1,640</strong></span><span>&#10084; <strong style="color:var(--txt)">94</strong></span><span style="color:var(--mut);font-weight:700">4.2%</span></div></div>'+
                '<div class="post-row" style="border:none"><div style="flex:1"><div style="font-size:12px;font-weight:600">Flexible workspace at Depot Close</div></div><div style="display:flex;gap:12px;font-size:11px;color:var(--mut)"><span>&#128065; <strong style="color:var(--txt)">980</strong></span><span>&#10084; <strong style="color:var(--txt)">41</strong></span><span style="color:var(--mut);font-weight:700">3.1%</span></div></div>'+
              '</div>'+
              '<div style="margin:0 14px 12px;padding:8px 12px;background:var(--nl);border-radius:8px;font-size:11px;color:var(--nvy);font-weight:600">&#128202; Facebook led traffic — 8,850 views</div>'+
            '</div>'+
            '<div class="card" style="padding:0;overflow:hidden">'+
              '<div class="ins-hdr"><span class="ins-hdr-txt" style="color:var(--ora)">Instagram</span><span style="font-size:10px;color:var(--fnt)">4 posts</span></div>'+
              '<div style="padding:0 14px">'+
                '<div class="post-row"><div style="flex:1"><div style="font-size:12px;font-weight:600">3 months free — move in this month</div></div><div style="display:flex;gap:12px;font-size:11px;color:var(--mut)"><span>&#128065; <strong style="color:var(--txt)">2,140</strong></span><span>&#10084; <strong style="color:var(--txt)">198</strong></span><span style="color:var(--grn);font-weight:700">8.1%</span></div></div>'+
                '<div class="post-row"><div style="flex:1"><div style="font-size:12px;font-weight:600">Before &amp; after: unit transformation</div></div><div style="display:flex;gap:12px;font-size:11px;color:var(--mut)"><span>&#128065; <strong style="color:var(--txt)">1,960</strong></span><span>&#10084; <strong style="color:var(--txt)">181</strong></span><span style="color:var(--grn);font-weight:700">9.2%</span></div></div>'+
                '<div class="post-row"><div style="flex:1"><div style="font-size:12px;font-weight:600">24/7 access — always ready</div></div><div style="display:flex;gap:12px;font-size:11px;color:var(--mut)"><span>&#128065; <strong style="color:var(--txt)">1,380</strong></span><span>&#10084; <strong style="color:var(--txt)">102</strong></span><span style="color:var(--mut);font-weight:700">5.6%</span></div></div>'+
                '<div class="post-row" style="border:none"><div style="flex:1"><div style="font-size:12px;font-weight:600">E-commerce fulfilment hub</div></div><div style="display:flex;gap:12px;font-size:11px;color:var(--mut)"><span>&#128065; <strong style="color:var(--txt)">1,140</strong></span><span>&#10084; <strong style="color:var(--txt)">79</strong></span><span style="color:var(--mut);font-weight:700">4.3%</span></div></div>'+
              '</div>'+
              '<div style="margin:0 14px 12px;padding:8px 12px;background:var(--ol);border-radius:8px;font-size:11px;color:var(--od);font-weight:600">&#128202; 9.2% on before/after — top format</div>'+
            '</div>'+
          '</div>'+
          '<div class="so-section-lbl">Comments</div>'+
          '<div class="g3">'+
            '<div class="card" style="padding:0;overflow:hidden">'+
              '<div class="ins-hdr"><span class="ins-hdr-txt" style="color:var(--nvy)">Facebook</span><span style="font-size:10px;color:var(--fnt)">22 comments</span></div>'+
              '<div style="padding:8px 14px">'+
                '<div class="comp-comment"><div class="comp-cdot" style="background:var(--nl);color:var(--nvy)">J</div><div><div class="comp-cname">jamielowsg</div><div class="comp-ctxt">Finally a storage solution near Tanjong Pagar! Booked a unit yesterday, very easy.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot" style="background:var(--nl);color:var(--nvy)">R</div><div><div class="comp-cname">rachellimmy</div><div class="comp-ctxt">Do you have units for small businesses? I sell on Shopee and need storage.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot" style="background:var(--nl);color:var(--nvy)">K</div><div><div class="comp-cname">kevin_ang91</div><div class="comp-ctxt">Love the 24/7 access. Came at 11pm last week, totally smooth.</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot" style="background:var(--nl);color:var(--nvy)">S</div><div><div class="comp-cname">sunita_rao_sg</div><div class="comp-ctxt">What is the minimum rental period? I need 2 months while I renovate.</div></div></div>'+
              '</div>'+
            '</div>'+
            '<div class="card" style="padding:0;overflow:hidden">'+
              '<div class="ins-hdr"><span class="ins-hdr-txt" style="color:var(--ora)">Instagram</span><span style="font-size:10px;color:var(--fnt)">34 comments</span></div>'+
              '<div style="padding:8px 14px">'+
                '<div class="comp-comment"><div class="comp-cdot">M</div><div><div class="comp-cname">mrsleeluxe</div><div class="comp-ctxt">This before &amp; after is insane!! How do I book??</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot">D</div><div><div class="comp-cname">derekheng.biz</div><div class="comp-ctxt">Do you have climate controlled units? Need to store wine and electronics.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot">A</div><div><div class="comp-cname">amytan_lifestyle</div><div class="comp-ctxt">Prices please! Can\'t find them on the website 😅</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot">N</div><div><div class="comp-cname">ngteckwee</div><div class="comp-ctxt">Just moved in last week. Staff were so helpful. Highly recommend!</div></div></div>'+
              '</div>'+
            '</div>'+
            '<div class="card" style="padding:0;overflow:hidden">'+
              '<div class="ins-hdr"><span class="ins-hdr-txt" style="color:#4A90D9">Google Reviews</span><span style="font-size:10px;color:var(--fnt)">&#9733; 4.7 &middot; 18</span></div>'+
              '<div style="padding:8px 14px">'+
                '<div class="comp-comment"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">P</div><div><div class="comp-cname">Priya R. &middot; &#9733;&#9733;&#9733;&#9733;&#9733;</div><div class="comp-ctxt">Best storage in Singapore. Clean, secure, 24/7 access. Worth every cent.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">T</div><div><div class="comp-cname">TanJW &middot; &#9733;&#9733;&#9733;&#9733;&#9733;</div><div class="comp-ctxt">Very transparent pricing, no hidden fees at all. Refreshing.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">L</div><div><div class="comp-cname">Lydia M. &middot; &#9733;&#9733;&#9733;&#9733;</div><div class="comp-ctxt">Good location and friendly staff. Perfect if they had a loading bay.</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">B</div><div><div class="comp-cname">BensonKoh &middot; &#9733;&#9733;&#9733;&#9733;&#9733;</div><div class="comp-ctxt">Used Urban Space 6 months for my Shopee inventory. Recommend for e-commerce.</div></div></div>'+
              '</div>'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<div>'+
          '<div class="so-section-lbl">AI Analysis</div>'+
          '<div class="ins-box">'+
            '<div class="ins-hdr" style="background:var(--pl)"><span class="ins-hdr-txt" style="color:var(--pur)">AI Analysis</span></div>'+
            '<div style="padding:9px 14px;border-bottom:1px solid var(--brd);background:#FAF7FF">'+
              '<div style="font-size:11px;font-weight:700;color:var(--pur);margin-bottom:6px">AI Patterns</div>'+
              '<div style="padding:5px 0;border-bottom:1px solid var(--brd)"><div style="font-size:12px;font-weight:600;color:var(--txt)">Customers are satisfied — 76% positive sentiment</div><div style="font-size:11px;color:var(--mut);margin-top:1px">4.7-star Google rating. Praise: 24/7 access, clean facilities, transparent pricing.</div></div>'+
              '<div style="padding:5px 0;border-bottom:1px solid var(--brd)"><div style="font-size:12px;font-weight:600;color:var(--txt)">Pricing still the #1 comment trigger</div><div style="font-size:11px;color:var(--mut);margin-top:1px">Commenters asking for prices publicly — push all-in pricing posts more.</div></div>'+
              '<div style="padding:5px 0;border-bottom:1px solid var(--brd)"><div style="font-size:12px;font-weight:600;color:var(--txt)">E-commerce / SME interest growing</div><div style="font-size:11px;color:var(--mut);margin-top:1px">Shopee and inventory queries up — B2B-focused posts would capture this.</div></div>'+
              '<div style="padding:5px 0"><div style="font-size:12px;font-weight:600;color:var(--txt)">Before &amp; after drives highest comment volume</div><div style="font-size:11px;color:var(--mut);margin-top:1px">34 Instagram comments this week — 2&times; more than other formats.</div></div>'+
            '</div>'+
            '<div style="padding:7px 14px;background:#FBF8FF;border-bottom:1px solid var(--brd)"><span style="font-size:11px;font-weight:700;color:var(--pur)">AI Suggested Posts</span></div>'+
            insRow(1,'Show your price upfront — all-in, no surprises','Pricing questions dominate IG and FB',bPur,'#E4D8F5')+
            insRow(2,'Before &amp; after: declutter + storage','Top comment-driving format at 9.2%',bPur,'#E4D8F5')+
            insRow(3,'E-commerce sellers: store inventory smarter','SME interest rising in comments &amp; reviews',bPur,'#E4D8F5')+
            insRow(4,'Customer spotlight — 6-month success story','Testimonials resonating in Google reviews',bPur,'#E4D8F5')+
            insRow(5,'Climate-controlled units — electronics, wine, docs','Requested in comments, not yet addressed',bPur,'#E4D8F5')+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>'+
 
    '<div id="res-cp" class="hidden">'+
      '<div class="ai-block" style="margin-bottom:12px;border-color:#8B2FC928;background:#F9F0FF">'+
        '<div class="ai-head"><div class="ai-badge" style="background:#8B2FC9">'+ICO.comp+'</div><span class="ai-title" style="color:#6A1FA8">AI Competitor Analysis</span></div>'+
        '<div class="ai-body">Competitors are losing customers over <strong>limited access hours</strong>, <strong>opaque pricing</strong>, and <strong>slow quote response</strong>. Urban Space\'s 24/7 access, transparent pricing, and climate-controlled units are clear wins across all 4 rivals.</div>'+
      '</div>'+
      '<div class="tab-row" style="margin-bottom:12px">'+
        '<button id="cp-btn0" class="pill" onclick="setCp(0)" style="border-color:var(--ora);background:var(--ol);color:var(--od)">BigBox Storage</button>'+
        '<button id="cp-btn1" class="pill" onclick="setCp(1)">StorePlus SG</button>'+
        '<button id="cp-btn2" class="pill" onclick="setCp(2)">SpaceUrban</button>'+
        '<button id="cp-btn3" class="pill" onclick="setCp(3)">SafeStore SG</button>'+
      '</div>'+
 
      '<div id="cp-c0">'+
        '<div class="g2" style="margin-bottom:12px">'+
          '<div>'+
            '<div class="comp-post-hdr" style="border-radius:10px 10px 0 0;border:1px solid var(--brd);border-bottom:none;background:#FAFAF7">'+
              '<div class="comp-avatar" style="background:#E53935">B</div>'+
              '<div><div class="comp-name">BigBox Storage SG</div><div class="comp-handle">@bigboxsg</div></div>'+
              '<span class="tag" style="background:#FDE8E8;color:#B03525;margin-left:auto">Competitor #1</span>'+
            '</div>'+
            '<div style="border:1px solid var(--brd);border-top:none;border-radius:0 0 10px 10px;overflow:hidden">'+
              '<div style="padding:10px 14px;border-bottom:1px solid var(--brd)">'+
                '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px"><span class="tag" style="background:var(--nl);color:var(--nvy)">Facebook</span></div>'+
                '<div class="comp-stats" style="padding:0;border:none;margin-bottom:7px"><span class="comp-stat">&#10084; <strong>312</strong></span><span class="comp-stat">&#128172; <strong>47</strong></span><span class="comp-stat">&#8594; <strong>28</strong></span></div>'+
                '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--fnt);margin-bottom:5px">Top comments</div>'+
                '<div class="comp-comment"><div class="comp-cdot">U1</div><div><div class="comp-cname">user_tanjiakiat</div><div class="comp-ctxt">Access hours? Your Buona Vista closes at 10pm — terrible for after work.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot">U2</div><div><div class="comp-cname">lim_xiaoming88</div><div class="comp-ctxt">Prices not listed on website. Every time must call and wait. Very troublesome.</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot">U3</div><div><div class="comp-cname">racheltaay</div><div class="comp-ctxt">Is it climate controlled? My documents got damp last time.</div></div></div>'+
              '</div>'+
              '<div style="padding:10px 14px;border-bottom:1px solid var(--brd)">'+
                '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px"><span class="tag" style="background:var(--ol);color:var(--ora)">Instagram</span></div>'+
                '<div class="comp-stats" style="padding:0;border:none;margin-bottom:7px"><span class="comp-stat">&#10084; <strong>198</strong></span><span class="comp-stat">&#128172; <strong>31</strong></span><span class="comp-stat">&#8594; <strong>14</strong></span></div>'+
                '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--fnt);margin-bottom:5px">Top comments</div>'+
                '<div class="comp-comment"><div class="comp-cdot">U4</div><div><div class="comp-cname">shopgirlsg</div><div class="comp-ctxt">Hi! Do you have units for small businesses? Selling online and need storage.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot">U5</div><div><div class="comp-cname">tomng_arch</div><div class="comp-ctxt">Prices? Can\'t find them anywhere on your IG or website 😅</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot">U6</div><div><div class="comp-cname">sarah.w.lim</div><div class="comp-ctxt">Can I access over Christmas? Last year I couldn\'t get in.</div></div></div>'+
              '</div>'+
              '<div style="padding:10px 14px">'+
                '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px"><span class="tag" style="background:#EAF3FB;color:#2563AA">Google Reviews</span><span style="font-size:11px;color:var(--mut)">&#9733; 3.9</span></div>'+
                '<div class="comp-comment"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">A</div><div><div class="comp-cname">Alex T. &middot; &#9733;&#9733;&#9733;</div><div class="comp-ctxt">Units are okay but access hours are very limited. Won\'t renew.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">B</div><div><div class="comp-cname">BeeHoon &middot; &#9733;&#9733;</div><div class="comp-ctxt">Quoted one price on phone, charged higher. Very disappointed.</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">C</div><div><div class="comp-cname">Clara &middot; &#9733;&#9733;&#9733;&#9733;</div><div class="comp-ctxt">Clean facility. Staff was helpful on move-in day.</div></div></div>'+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div style="display:flex;flex-direction:column;gap:12px">'+
            '<div class="ai-block" style="background:#F9F0FF;border-color:#8B2FC928">'+
              '<div class="ai-head"><div class="ai-badge" style="background:#8B2FC9">'+ICO.star+'</div><span class="ai-title" style="color:#6A1FA8">AI Strategic Recommendations</span></div>'+
              '<div class="ai-body"><strong style="color:#6A1FA8">Access hours:</strong> BigBox\'s biggest complaint — customers locked out after 10pm. Lead with "We never close." campaign.<br><br><strong style="color:#6A1FA8">Pricing transparency:</strong> Customers can\'t find prices. Counter with visible all-in pricing on all posts.<br><br><strong style="color:#6A1FA8">Climate control:</strong> Asked repeatedly, never answered by BigBox. Make this a content pillar.</div>'+
            '</div>'+
            '<div class="ins-box">'+
              '<div class="ins-hdr" style="background:#F5EAF9"><span class="ins-hdr-txt" style="color:#8B2FC9">AI Suggested Posts — beat BigBox</span></div>'+
              insRow(1,'24/7 access — unlike BigBox, we never close','#1 complaint in their comments','#8B2FC9','#F0D8FC')+
              insRow(2,'All-in pricing — no calls, no surprises','BigBox customers frustrated by hidden fees','#8B2FC9','#F0D8FC')+
              insRow(3,'Climate-controlled units — safe, dry, secure','Repeated BigBox comment complaint','#8B2FC9','#F0D8FC')+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
 
      '<div id="cp-c1" class="hidden">'+
        '<div class="g2" style="margin-bottom:12px">'+
          '<div>'+
            '<div class="comp-post-hdr" style="border-radius:10px 10px 0 0;border:1px solid var(--brd);border-bottom:none;background:#FAFAF7">'+
              '<div class="comp-avatar" style="background:#1565C0">S</div>'+
              '<div><div class="comp-name">StorePlus Singapore</div><div class="comp-handle">@storeplussg</div></div>'+
              '<span class="tag" style="background:var(--nl);color:var(--nvy);margin-left:auto">Competitor #2</span>'+
            '</div>'+
            '<div style="border:1px solid var(--brd);border-top:none;border-radius:0 0 10px 10px;overflow:hidden">'+
              '<div style="padding:10px 14px;border-bottom:1px solid var(--brd)">'+
                '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px"><span class="tag" style="background:var(--nl);color:var(--nvy)">Facebook</span></div>'+
                '<div class="comp-stats" style="padding:0;border:none;margin-bottom:7px"><span class="comp-stat">&#10084; <strong>188</strong></span><span class="comp-stat">&#128172; <strong>29</strong></span><span class="comp-stat">&#8594; <strong>11</strong></span></div>'+
                '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--fnt);margin-bottom:5px">Top comments</div>'+
                '<div class="comp-comment"><div class="comp-cdot">U1</div><div><div class="comp-cname">mdnorizan_r</div><div class="comp-ctxt">Can I access on weekends and public holidays? Hotline says different things.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot">U2</div><div><div class="comp-cname">jasperng_biz</div><div class="comp-ctxt">Waiting 3 days for quote. Is this normal? Very slow.</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot">U3</div><div><div class="comp-cname">sunflower_mama</div><div class="comp-ctxt">Do you have trolleys to borrow? My last place had none.</div></div></div>'+
              '</div>'+
              '<div style="padding:10px 14px;border-bottom:1px solid var(--brd)">'+
                '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px"><span class="tag" style="background:var(--ol);color:var(--ora)">Instagram</span></div>'+
                '<div class="comp-stats" style="padding:0;border:none;margin-bottom:7px"><span class="comp-stat">&#10084; <strong>142</strong></span><span class="comp-stat">&#128172; <strong>19</strong></span><span class="comp-stat">&#8594; <strong>7</strong></span></div>'+
                '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--fnt);margin-bottom:5px">Top comments</div>'+
                '<div class="comp-comment"><div class="comp-cdot">U4</div><div><div class="comp-cname">huiling_s</div><div class="comp-ctxt">Sizes? Can\'t find this info anywhere!</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot">U5</div><div><div class="comp-cname">biz_omar</div><div class="comp-ctxt">Do you cater to businesses? I need 50 sqft for stock.</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot">U6</div><div><div class="comp-cname">tammylee_sg</div><div class="comp-ctxt">Love the flexible plans! Just wish pricing was clearer online.</div></div></div>'+
              '</div>'+
              '<div style="padding:10px 14px">'+
                '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px"><span class="tag" style="background:#EAF3FB;color:#2563AA">Google Reviews</span><span style="font-size:11px;color:var(--mut)">&#9733; 3.6</span></div>'+
                '<div class="comp-comment"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">D</div><div><div class="comp-cname">Darren K. &middot; &#9733;&#9733;</div><div class="comp-ctxt">Took 5 days to get a quote. By then I had already gone elsewhere.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">F</div><div><div class="comp-cname">FionaM &middot; &#9733;&#9733;&#9733;</div><div class="comp-ctxt">Decent enough. Wish they had 24/7 access like some other places.</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">G</div><div><div class="comp-cname">GeoffTan &middot; &#9733;&#9733;&#9733;&#9733;</div><div class="comp-ctxt">Good value, friendly team. Access hours could be longer though.</div></div></div>'+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div style="display:flex;flex-direction:column;gap:12px">'+
            '<div class="ai-block" style="background:#F9F0FF;border-color:#8B2FC928">'+
              '<div class="ai-head"><div class="ai-badge" style="background:#8B2FC9">'+ICO.star+'</div><span class="ai-title" style="color:#6A1FA8">AI Strategic Recommendations</span></div>'+
              '<div class="ai-body"><strong style="color:#6A1FA8">Quote speed:</strong> StorePlus takes 3–5 days for a response. Counter with "get a quote online instantly — no waiting."<br><br><strong style="color:#6A1FA8">Access hours:</strong> Multiple Google reviews mention limited hours. Reinforce Urban Space\'s 24/7 promise.<br><br><strong style="color:#6A1FA8">Business units:</strong> B2B demand in comments is unmet. Run SME-focused content to capture this.</div>'+
            '</div>'+
            '<div class="ins-box">'+
              '<div class="ins-hdr" style="background:#F5EAF9"><span class="ins-hdr-txt" style="color:#8B2FC9">AI Suggested Posts — beat StorePlus</span></div>'+
              insRow(1,'Instant quote — no calls, no 5-day wait','StorePlus customers waiting days for a response','#8B2FC9','#F0D8FC')+
              insRow(2,'Business storage built for SMEs &amp; e-commerce','B2B demand unmet in StorePlus comments','#8B2FC9','#F0D8FC')+
              insRow(3,'24/7 access — we\'re open when they\'re not','Access hours complaint across their reviews','#8B2FC9','#F0D8FC')+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
 
      '<div id="cp-c2" class="hidden">'+
        '<div class="g2" style="margin-bottom:12px">'+
          '<div>'+
            '<div class="comp-post-hdr" style="border-radius:10px 10px 0 0;border:1px solid var(--brd);border-bottom:none;background:#FAFAF7">'+
              '<div class="comp-avatar" style="background:#2E7D32">U</div>'+
              '<div><div class="comp-name">SpaceUrban Storage</div><div class="comp-handle">@spaceurbansg</div></div>'+
              '<span class="tag" style="background:var(--gl);color:var(--grn);margin-left:auto">Competitor #3</span>'+
            '</div>'+
            '<div style="border:1px solid var(--brd);border-top:none;border-radius:0 0 10px 10px;overflow:hidden">'+
              '<div style="padding:10px 14px;border-bottom:1px solid var(--brd)">'+
                '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px"><span class="tag" style="background:var(--nl);color:var(--nvy)">Facebook</span></div>'+
                '<div class="comp-stats" style="padding:0;border:none;margin-bottom:7px"><span class="comp-stat">&#10084; <strong>142</strong></span><span class="comp-stat">&#128172; <strong>21</strong></span><span class="comp-stat">&#8594; <strong>9</strong></span></div>'+
                '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--fnt);margin-bottom:5px">Top comments</div>'+
                '<div class="comp-comment"><div class="comp-cdot">U1</div><div><div class="comp-cname">kevinlkw</div><div class="comp-ctxt">Climate controlled? Want to store electronics and guitars.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot">U2</div><div><div class="comp-cname">priyarajan_sg</div><div class="comp-ctxt">Do you have workspace? I need somewhere to work while sorting through things.</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot">U3</div><div><div class="comp-cname">hdbmum_ang</div><div class="comp-ctxt">Minimum rental period? I only need 2 months between moving.</div></div></div>'+
              '</div>'+
              '<div style="padding:10px 14px;border-bottom:1px solid var(--brd)">'+
                '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px"><span class="tag" style="background:var(--ol);color:var(--ora)">Instagram</span></div>'+
                '<div class="comp-stats" style="padding:0;border:none;margin-bottom:7px"><span class="comp-stat">&#10084; <strong>98</strong></span><span class="comp-stat">&#128172; <strong>14</strong></span><span class="comp-stat">&#8594; <strong>5</strong></span></div>'+
                '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--fnt);margin-bottom:5px">Top comments</div>'+
                '<div class="comp-comment"><div class="comp-cdot">U4</div><div><div class="comp-cname">yeoann.sg</div><div class="comp-ctxt">Do you have 24/7 access? The other place I used closed at 9pm.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot">U5</div><div><div class="comp-cname">terencechew_</div><div class="comp-ctxt">Price list? Can\'t find anywhere.</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot">U6</div><div><div class="comp-cname">mariam.hz</div><div class="comp-ctxt">Tried to book online but the form doesn\'t work on mobile 😢</div></div></div>'+
              '</div>'+
              '<div style="padding:10px 14px">'+
                '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px"><span class="tag" style="background:#EAF3FB;color:#2563AA">Google Reviews</span><span style="font-size:11px;color:var(--mut)">&#9733; 4.1</span></div>'+
                '<div class="comp-comment"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">H</div><div><div class="comp-cname">Henry L. &middot; &#9733;&#9733;&#9733;&#9733;</div><div class="comp-ctxt">Decent place. No workspace or amenities but storage itself is fine.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">J</div><div><div class="comp-cname">JoJo &middot; &#9733;&#9733;&#9733;</div><div class="comp-ctxt">Good location but they need more than basic storage — no trolleys, no workspace.</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">W</div><div><div class="comp-cname">WeiMing &middot; &#9733;&#9733;&#9733;&#9733;&#9733;</div><div class="comp-ctxt">Helpful staff. Would be 5 stars if they had 24/7 access.</div></div></div>'+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div style="display:flex;flex-direction:column;gap:12px">'+
            '<div class="ai-block" style="background:#F9F0FF;border-color:#8B2FC928">'+
              '<div class="ai-head"><div class="ai-badge" style="background:#8B2FC9">'+ICO.star+'</div><span class="ai-title" style="color:#6A1FA8">AI Strategic Recommendations</span></div>'+
              '<div class="ai-body"><strong style="color:#6A1FA8">Climate control:</strong> Their biggest unanswered question — make it a headline feature in all Urban Space posts.<br><br><strong style="color:#6A1FA8">Value-adds:</strong> Workspace, trolleys, pantry — things SpaceUrban doesn\'t have. Run a "more than storage" campaign.<br><br><strong style="color:#6A1FA8">24/7 access:</strong> Still unmatched by SpaceUrban. Continue leading with this differentiator.</div>'+
            '</div>'+
            '<div class="ins-box">'+
              '<div class="ins-hdr" style="background:#F5EAF9"><span class="ins-hdr-txt" style="color:#8B2FC9">AI Suggested Posts — beat SpaceUrban</span></div>'+
              insRow(1,'Climate-controlled units — electronics, guitars, docs safe','Top unanswered question in SpaceUrban comments','#8B2FC9','#F0D8FC')+
              insRow(2,'More than storage — workspace, trolleys, pantry included','Value-adds SpaceUrban customers wish they had','#8B2FC9','#F0D8FC')+
              insRow(3,'24/7 access — come in at midnight if you need to','Repeatedly mentioned as a want in their reviews','#8B2FC9','#F0D8FC')+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
 
      '<div id="cp-c3" class="hidden">'+
        '<div class="g2" style="margin-bottom:12px">'+
          '<div>'+
            '<div class="comp-post-hdr" style="border-radius:10px 10px 0 0;border:1px solid var(--brd);border-bottom:none;background:#FAFAF7">'+
              '<div class="comp-avatar" style="background:#6A1FA8">F</div>'+
              '<div><div class="comp-name">SafeStore Singapore</div><div class="comp-handle">@safestoresg</div></div>'+
              '<span class="tag" style="background:var(--pl);color:var(--pur);margin-left:auto">Competitor #4</span>'+
            '</div>'+
            '<div style="border:1px solid var(--brd);border-top:none;border-radius:0 0 10px 10px;overflow:hidden">'+
              '<div style="padding:10px 14px;border-bottom:1px solid var(--brd)">'+
                '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px"><span class="tag" style="background:var(--nl);color:var(--nvy)">Facebook</span></div>'+
                '<div class="comp-stats" style="padding:0;border:none;margin-bottom:7px"><span class="comp-stat">&#10084; <strong>104</strong></span><span class="comp-stat">&#128172; <strong>17</strong></span><span class="comp-stat">&#8594; <strong>6</strong></span></div>'+
                '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--fnt);margin-bottom:5px">Top comments</div>'+
                '<div class="comp-comment"><div class="comp-cdot">U1</div><div><div class="comp-cname">alicia_kk</div><div class="comp-ctxt">Do you allow 24/7 access? Your hours seem very limited.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot">U2</div><div><div class="comp-cname">boonleng99</div><div class="comp-ctxt">Price comparison between unit sizes please! Can\'t tell from the website.</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot">U3</div><div><div class="comp-cname">carla_moves</div><div class="comp-ctxt">Is there a lift? I have heavy furniture to move in.</div></div></div>'+
              '</div>'+
              '<div style="padding:10px 14px;border-bottom:1px solid var(--brd)">'+
                '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px"><span class="tag" style="background:var(--ol);color:var(--ora)">Instagram</span></div>'+
                '<div class="comp-stats" style="padding:0;border:none;margin-bottom:7px"><span class="comp-stat">&#10084; <strong>76</strong></span><span class="comp-stat">&#128172; <strong>11</strong></span><span class="comp-stat">&#8594; <strong>3</strong></span></div>'+
                '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--fnt);margin-bottom:5px">Top comments</div>'+
                '<div class="comp-comment"><div class="comp-cdot">U4</div><div><div class="comp-cname">nicoletan_x</div><div class="comp-ctxt">Smallest unit size? I just need something for 5 boxes.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot">U5</div><div><div class="comp-cname">jashua.ong</div><div class="comp-ctxt">Booking process online is confusing. Took me 3 tries.</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot">U6</div><div><div class="comp-cname">irene_hdb</div><div class="comp-ctxt">Do you have promotions for new customers? First month free?</div></div></div>'+
              '</div>'+
              '<div style="padding:10px 14px">'+
                '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px"><span class="tag" style="background:#EAF3FB;color:#2563AA">Google Reviews</span><span style="font-size:11px;color:var(--mut)">&#9733; 3.4</span></div>'+
                '<div class="comp-comment"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">R</div><div><div class="comp-cname">Raj S. &middot; &#9733;&#9733;</div><div class="comp-ctxt">Booking was confusing, staff not very helpful. Access hours are terrible.</div></div></div>'+
                '<div class="comp-comment"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">M</div><div><div class="comp-cname">MinLing &middot; &#9733;&#9733;&#9733;</div><div class="comp-ctxt">Okay for basic storage. Wish they were clearer about pricing upfront.</div></div></div>'+
                '<div class="comp-comment" style="border:none"><div class="comp-cdot" style="background:#EAF3FB;color:#2563AA">T</div><div><div class="comp-cname">ThomasW &middot; &#9733;&#9733;&#9733;&#9733;</div><div class="comp-ctxt">Good security. Would come back but location is a bit inconvenient.</div></div></div>'+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div style="display:flex;flex-direction:column;gap:12px">'+
            '<div class="ai-block" style="background:#F9F0FF;border-color:#8B2FC928">'+
              '<div class="ai-head"><div class="ai-badge" style="background:#8B2FC9">'+ICO.star+'</div><span class="ai-title" style="color:#6A1FA8">AI Strategic Recommendations</span></div>'+
              '<div class="ai-body"><strong style="color:#6A1FA8">Lowest rating (3.4&#9733;):</strong> SafeStore has the worst reputation of the 4. Run comparison posts that implicitly contrast Urban Space\'s 4.7&#9733; rating.<br><br><strong style="color:#6A1FA8">Access hours + pricing:</strong> Same weaknesses as others — Urban Space should double down on these as content pillars.<br><br><strong style="color:#6A1FA8">Booking experience:</strong> Confusing booking is a pain point — push Urban Space\'s simple, instant online booking.</div>'+
            '</div>'+
            '<div class="ins-box">'+
              '<div class="ins-hdr" style="background:#F5EAF9"><span class="ins-hdr-txt" style="color:#8B2FC9">AI Suggested Posts — beat SafeStore</span></div>'+
              insRow(1,'Book in 60 seconds — simple, instant, online','SafeStore\'s confusing process is driving customers away','#8B2FC9','#F0D8FC')+
              insRow(2,'4.7&#9733; on Google — here\'s what our customers say','SafeStore sits at 3.4&#9733;, a clear trust gap','#8B2FC9','#F0D8FC')+
              insRow(3,'All-in pricing, visible online — no guessing','SafeStore customers still asking for price lists','#8B2FC9','#F0D8FC')+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
 
    '</div>'+
  '</div>';
 
  // After render, hide all non-active tab content sections
  // Show only the first enabled tab
  ['tr','zo','so','cp'].forEach(function(x){
    var el=document.getElementById('res-'+x);
    if(el)el.classList.toggle('hidden',x!==firstTab||!resTabsEnabled[x]);
  });
  // Ensure cp accordion is set
  if(firstTab==='cp')setTimeout(function(){setCp(cpOpen);},10);
}
 
function chip(btn){
  var row=btn.closest('.chip-row');
  if(!row)return;
  row.querySelectorAll('.chip').forEach(function(b){b.classList.remove('on');});
  btn.classList.add('on');
}
function doGen(){
  var d=document.getElementById('drafts');
  if(d){d.classList.remove('hidden');d.scrollIntoView({behavior:'smooth',block:'start'});}
}
function renderGenerate(){
  document.getElementById('mc').innerHTML=
  '<div class="pg">'+
    '<div><div class="pg-title">Generate</div><div class="pg-sub">Create a post — AI writes it in Urban Space\'s brand voice.</div></div>'+
    '<div class="card">'+
      '<div class="row" style="justify-content:space-between;margin-bottom:14px">'+
        '<div class="row" style="gap:9px">'+
          '<div class="ai-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5L7 21l-4-1-1-4L15 4z"/><path d="M18 1l1.5 1.5L18 4l-1.5-1.5L18 1z"/></svg></div>'+
          '<span class="sec-title">What do you want to make?</span>'+
          '<span style="font-size:11px;color:var(--mut)">AI drafts it in your brand voice</span>'+
        '</div>'+
      '</div>'+
      '<div class="fld-lbl">Platform</div>'+
      '<div class="chip-row" style="margin-bottom:14px">'+
        '<button class="chip on" onclick="chip(this)">Instagram</button>'+
        '<button class="chip" onclick="chip(this)">Facebook</button>'+
        '<button class="chip" onclick="chip(this)">LinkedIn</button>'+
      '</div>'+
      '<div class="fld-lbl">Topic / Prompt</div>'+
      '<textarea rows="2" style="margin-bottom:14px" placeholder="e.g. 3 months free promo — move in before July and lock in our best rate for the whole year"></textarea>'+
      '<div class="g2" style="margin-bottom:14px">'+
        '<div><div class="fld-lbl">Tone</div><div class="chip-row">'+
          '<button class="chip on" onclick="chip(this)">Friendly</button>'+
          '<button class="chip" onclick="chip(this)">Professional</button>'+
          '<button class="chip" onclick="chip(this)">Urgent</button>'+
          '<button class="chip" onclick="chip(this)">Funny</button>'+
        '</div></div>'+
        '<div><div class="fld-lbl">Length</div><div class="chip-row">'+
          '<button class="chip on" onclick="chip(this)">Short</button>'+
          '<button class="chip" onclick="chip(this)">Medium</button>'+
          '<button class="chip" onclick="chip(this)">Long</button>'+
        '</div></div>'+
      '</div>'+
      '<div class="g2" style="margin-bottom:14px">'+
        '<div><div class="fld-lbl">Visual style</div><div class="chip-row">'+
          '<button class="chip on" onclick="chip(this)">Before / After</button>'+
          '<button class="chip" onclick="chip(this)">Clean product</button>'+
          '<button class="chip" onclick="chip(this)">Lifestyle</button>'+
          '<button class="chip" onclick="chip(this)">Text-forward</button>'+
        '</div></div>'+
        '<div><div class="fld-lbl">Target audience</div><div class="chip-row">'+
          '<button class="chip on" onclick="chip(this)">Homeowners</button>'+
          '<button class="chip" onclick="chip(this)">E-commerce sellers</button>'+
          '<button class="chip" onclick="chip(this)">Startups / SMEs</button>'+
          '<button class="chip" onclick="chip(this)">Businesses</button>'+
        '</div></div>'+
      '</div>'+
      '<div class="fld-lbl">Include in post</div>'+
      '<div class="chip-row" style="margin-bottom:14px">'+
        '<button class="chip multi on" onclick="this.classList.toggle(\'on\')"># Hashtags</button>'+
        '<button class="chip multi on" onclick="this.classList.toggle(\'on\')">AI image</button>'+
        '<button class="chip multi on" onclick="this.classList.toggle(\'on\')">Call to action</button>'+
        '<button class="chip multi" onclick="this.classList.toggle(\'on\')">Emoji</button>'+
        '<button class="chip multi" onclick="this.classList.toggle(\'on\')">Pricing info</button>'+
      '</div>'+
      '<div class="voice-box" style="margin-bottom:14px">'+
        '<div style="font-size:12px;color:var(--txt)">Voice: <strong>Warm &amp; Confident</strong> <span style="color:var(--mut)">&middot; learned from Urban Space\'s past posts</span></div>'+
        '<button class="btn btn-s btn-sm">Edit voice</button>'+
      '</div>'+
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">'+
        '<button class="btn btn-s"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l6 6L20 6"/></svg> Save as default</button>'+
        '<div class="row" style="gap:7px">'+
          '<button class="btn btn-s">&#8635; Surprise me</button>'+
          '<button class="btn btn-o" onclick="doGen()" style="min-width:148px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5L7 21l-4-1-1-4L15 4z"/><path d="M18 1l1.5 1.5L18 4l-1.5-1.5L18 1z"/></svg> Generate 3 options</button>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div id="drafts" class="hidden">'+
      '<div class="row" style="justify-content:space-between;margin-bottom:10px">'+
        '<div><div class="sec-title">Generated options</div><div class="sec-sub">Save, download as PDF, or open in Canva to edit</div></div>'+
        '<button class="btn btn-s btn-sm">&#8635; Regenerate all</button>'+
      '</div>'+
      '<div class="g3">'+
        '<div class="draft-c">'+
          '<div class="draft-img" style="background:#E8651A"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff55" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3l-4 4-4-4"/><circle cx="12" cy="14" r="3"/></svg><div style="font-size:9px;color:#ffffff66;font-weight:600">Option 1 · Instagram</div></div>'+
          '<div class="draft-body"><div style="font-size:12px;color:var(--txt);line-height:1.55">Running out of space at home? Urban Space has the solution — climate-controlled units from $49/month. 24/7 access, no hidden fees. First 3 months free 👇</div><div style="font-size:10px;color:var(--fnt)">#UrbanSpaceSG #SelfStorage #Singapore #HomeDeclutter</div><div class="row" style="gap:5px;flex-wrap:wrap"><button class="btn btn-p btn-sm" style="flex:1;justify-content:center">Use this</button><button class="btn btn-s btn-sm" style="color:var(--grn);border-color:var(--grn)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l6 6L20 6"/></svg> Save</button><button class="btn btn-s btn-sm">PDF</button><button class="btn btn-s btn-sm">&#9998; Canva</button></div></div>'+
        '</div>'+
        '<div class="draft-c">'+
          '<div class="draft-img" style="background:#1A2E4A"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff55" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3l-4 4-4-4"/><circle cx="12" cy="14" r="3"/></svg><div style="font-size:9px;color:#ffffff66;font-weight:600">Option 2 · Facebook</div></div>'+
          '<div class="draft-body"><div style="font-size:12px;color:var(--txt);line-height:1.55">Before &amp; after: we helped this family reclaim their living room in one weekend. Secure storage, 24/7 access, CCTV monitored. Get a free quote — link in bio.</div><div style="font-size:10px;color:var(--fnt)">#storage #declutter #beforeafter #urbanspace</div><div class="row" style="gap:5px;flex-wrap:wrap"><button class="btn btn-p btn-sm" style="flex:1;justify-content:center">Use this</button><button class="btn btn-s btn-sm" style="color:var(--grn);border-color:var(--grn)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l6 6L20 6"/></svg> Save</button><button class="btn btn-s btn-sm">PDF</button><button class="btn btn-s btn-sm">&#9998; Canva</button></div></div>'+
        '</div>'+
        '<div class="draft-c">'+
          '<div class="draft-img" style="background:#5B3980"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff55" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3l-4 4-4-4"/><circle cx="12" cy="14" r="3"/></svg><div style="font-size:9px;color:#ffffff66;font-weight:600">Option 3 · LinkedIn</div></div>'+
          '<div class="draft-body"><div style="font-size:12px;color:var(--txt);line-height:1.55">E-commerce sellers: stop paying for a warehouse you can\'t afford. Urban Space\'s Fulfilment Hub gives your business flexible space, pick-and-pack, and 24/7 access.</div><div style="font-size:10px;color:var(--fnt)">#ecommerce #fulfilment #b2b #urbanspace</div><div class="row" style="gap:5px;flex-wrap:wrap"><button class="btn btn-p btn-sm" style="flex:1;justify-content:center">Use this</button><button class="btn btn-s btn-sm" style="color:var(--grn);border-color:var(--grn)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l6 6L20 6"/></svg> Save</button><button class="btn btn-s btn-sm">PDF</button><button class="btn btn-s btn-sm">&#9998; Canva</button></div></div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="card" style="padding:0;overflow:hidden">'+
      '<div class="ins-hdr"><span class="ins-hdr-txt">Saved drafts</span><span style="font-size:10px;color:var(--fnt)">0 saved</span></div>'+
      '<div style="padding:20px;text-align:center;color:var(--fnt);font-size:12px">No saved drafts yet. Generate posts and click Save to store them here.</div>'+
    '</div>'+
    '<div class="card" style="padding:0;overflow:hidden">'+
      '<div class="ins-hdr"><span class="ins-hdr-txt">AI recommendations — one-click generate</span></div>'+
      '<div class="reco-r"><div class="reco-ic" style="background:var(--ol);color:var(--ora)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg></div><div class="flex1"><div style="font-size:13px;font-weight:600;color:var(--txt)">3 months free — move in before July</div><div style="font-size:11px;color:var(--mut);margin-top:2px">ZOHO: 108 enquiries this month — highest promo interest</div></div><button class="btn btn-g btn-sm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5L7 21l-4-1-1-4L15 4z"/><path d="M18 1l1.5 1.5L18 4l-1.5-1.5L18 1z"/></svg> Generate this</button></div>'+
      '<div class="reco-r"><div class="reco-ic" style="background:var(--ol);color:var(--ora)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg></div><div class="flex1"><div style="font-size:13px;font-weight:600;color:var(--txt)">24/7 access — your unit is always ready</div><div style="font-size:11px;color:var(--mut);margin-top:2px">Trending concern in competitor comments this week</div></div><button class="btn btn-g btn-sm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5L7 21l-4-1-1-4L15 4z"/><path d="M18 1l1.5 1.5L18 4l-1.5-1.5L18 1z"/></svg> Generate this</button></div>'+
      '<div class="reco-r"><div class="reco-ic" style="background:var(--ol);color:var(--ora)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg></div><div class="flex1"><div style="font-size:13px;font-weight:600;color:var(--txt)">Before &amp; after: home declutter transformation</div><div style="font-size:11px;color:var(--mut);margin-top:2px">Before/after = 9.2% engagement — highest format this month</div></div><button class="btn btn-g btn-sm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5L7 21l-4-1-1-4L15 4z"/><path d="M18 1l1.5 1.5L18 4l-1.5-1.5L18 1z"/></svg> Generate this</button></div>'+
      '<div class="reco-r"><div class="reco-ic" style="background:var(--nl);color:var(--nvy)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="M7 10v7M7 7v.5M11 10v7M11 13a3 3 0 016 0v4"/></svg></div><div class="flex1"><div style="font-size:13px;font-weight:600;color:var(--txt)">E-commerce fulfilment hub for Singapore SMEs</div><div style="font-size:11px;color:var(--mut);margin-top:2px">LinkedIn B2B — online retailers and startups are target</div></div><button class="btn btn-g btn-sm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5L7 21l-4-1-1-4L15 4z"/><path d="M18 1l1.5 1.5L18 4l-1.5-1.5L18 1z"/></svg> Generate this</button></div>'+
      '<div class="reco-r"><div class="reco-ic" style="background:var(--ol);color:var(--ora)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg></div><div class="flex1"><div style="font-size:13px;font-weight:600;color:var(--txt)">All-in pricing — no hidden fees, instant quote online</div><div style="font-size:11px;color:var(--mut);margin-top:2px">Competitor pricing frustration spike — 38% increase in enquiries</div></div><button class="btn btn-g btn-sm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5L7 21l-4-1-1-4L15 4z"/><path d="M18 1l1.5 1.5L18 4l-1.5-1.5L18 1z"/></svg> Generate this</button></div>'+
    '</div>'+
  '</div>';
}
 
document.addEventListener('DOMContentLoaded',function(){ go('home'); });