/**
 * mock-data.js
 * -----------------------------------------------------------------------
 * ALL sample/placeholder data for the app lives in this one file, under
 * the global `MOCK` object, organized by domain (home, internetTrends,
 * customerChats, socialMedia, competitors, generate).
 *
 * This is the ONLY file that should contain hardcoded content. When wiring
 * up the real backend, you generally do NOT need to touch this file —
 * instead go to js/api.js and replace each function body with a real
 * fetch() call. Keep the SAME return shape as documented in api.js and
 * the rest of the app (render/view layer) will keep working unmodified.
 *
 * Shapes below double as the informal contract for what each REST endpoint
 * should return — see README.md for the full write-up.
 * -----------------------------------------------------------------------
 */
const MOCK = {

  /* ---------------------------------------------------------------------
   * HOME — GET /api/home/summary
   * ------------------------------------------------------------------- */
  home: {
    kpis: [
      { label:'Total Views',       value:'11.8k', delta:'↑ 22% this month', icon:'eye',   style:'fill'  },
      { label:'Likes',             value:'1,420', delta:'↑ 5.9% avg. rate', icon:'heart', style:'plain' },
      { label:'Interactions',      value:'3.2k',  delta:'↑ 14% this month', icon:'msg',   style:'fill'  },
      { label:'Posts This Week',   value:'6',     delta:'2 scheduled',      icon:'doc',   style:'plain' }
    ],
    weeklySummary: [
      { type:'red',   tag:'ANOMALY',        title:'LinkedIn engagement dropped 31% this week', sub:'Below 3-week average — consider refreshing your B2B content angle.' },
      { type:'ora',   tag:'ACTION NEEDED',  title:'3 generated posts awaiting your approval', sub:'Added today, 8:45am.' },
      { type:'red',   tag:'ANOMALY',        title:'Competitor activity spike — BigBox Storage posted 4× this week', sub:'Research page updated · competitor analysis refreshed.' },
      { type:'ora',   tag:'ACTION NEEDED',  title:'"Before & after" format driving highest engagement — 9.2% this week', sub:'AI recommends 2 more posts in this format next week.' },
      { type:'green', tag:'WIN',            title:'"3 months free" promo post published — 2,140 views so far', sub:'Yesterday 9:00am · Instagram · top post this week.' }
    ]
  },

  /* ---------------------------------------------------------------------
   * RESEARCH SOURCE SELECTOR — GET /api/research/sources
   * ------------------------------------------------------------------- */
  researchSources: [
    { id:'tr', label:'Internet Trends',      img:'PAT_TREND',  col1:'#EE8A2E', col2:'#E8651A', desc:'Top Google search trends, keyword rankings, and AI-suggested posts.' },
    { id:'zo', label:'Customer Chats',       img:'PAT_CHAT',   col1:'#5AA6D6', col2:'#3F7FB8', desc:'ZOHO WhatsApp chat analysis — questions, service demand, AI patterns.' },
    { id:'so', label:'Social Media',         img:'PAT_SOCIAL', col1:'#3E9450', col2:'#2A6E38', desc:'Facebook, Instagram, and Google post performance & sentiment.' },
    { id:'cp', label:'Competitor Analysis',  img:'PAT_COMP',   col1:'#CB5142', col2:'#A93526', desc:'BigBox, StorePlus SG, SpaceUrban & SafeStore SG — posts, AI strategy.' }
  ],

  /* ---------------------------------------------------------------------
   * INTERNET TRENDS TAB — GET /api/research/internet-trends
   * ------------------------------------------------------------------- */
  internetTrends: {
    keywords: [
      { l:'Self storage Singapore',                    v:9800, chg:41,  tag:'up',    tagLbl:'Trending up',    desc:'Top-volume keyword. Direct-intent, highest priority.' },
      { l:'Cheap storage space near me Singapore',      v:7200, chg:63,  tag:'riser', tagLbl:'Fastest riser',  desc:'Fastest-growing keyword this week — hyperlocal, price-led.' },
      { l:'E-commerce fulfilment Singapore',             v:4900, chg:29,  tag:'up',    tagLbl:'Trending up',    desc:'B2B demand rising; underserved content angle.' },
      { l:'Storage unit size guide Singapore',           v:3100, chg:17,  tag:'up',    tagLbl:'Trending up',    desc:'Education-intent — good for undecided customers.' },
      { l:'Workspace rental Depot Road',                 v:2400, chg:-3,  tag:'dn',    tagLbl:'Trending down',  desc:'Only keyword trending down — monitor next week.' },
      { l:'Climate controlled storage Singapore',        v:1900, chg:34,  tag:'up',    tagLbl:'Trending up',    desc:'Smaller volume, strong growth — worth testing content.' }
    ],
    suggestedPosts: [
      { title:'Self storage Singapore — flexible monthly rental',        sub:'9,800 searches/wk, keyword #1' },
      { title:"Affordable storage near me — we've got you covered",      sub:'Fastest growing keyword at +63%' },
      { title:'E-commerce fulfilment for Singapore SMEs',                sub:'4,900 searches/wk' },
      { title:'What storage unit size do I need?',                      sub:'High intent, education-first content' }
    ],
    insights: [
      { tag:'AI ANALYSIS',       title:'Search demand for self storage is accelerating across Singapore',
        body:'Direct "self storage" searches remain the largest single demand pool at 9,800/wk, but hyperlocal price-led queries like "cheap storage space near me" are growing fastest (+63% w/w) — customers are actively comparison-shopping on price and proximity before they call.' },
      { tag:'AI RECOMMENDATION', title:'Strongest opportunity: hyperlocal, price-led content',
        body:'"Cheap storage space near me Singapore" is the fastest-rising keyword this week (+63%). Recommended angle: lead with visible, all-in pricing and proximity messaging to capture this intent before competitors do.',
        cta:'Generate this post', ctaPrompt:'Cheap storage space near me — all-in pricing, near you' }
    ]
  },

  /* ---------------------------------------------------------------------
   * CUSTOMER CHATS TAB — GET /api/research/customer-chats
   * ------------------------------------------------------------------- */
  customerChats: {
    meta: {
      source:"Analysed from Urban Space's WhatsApp Business chats linked via ZOHO CRM.",
      conversationsReviewed: 143,
      refreshCadence:'weekly'
    },
    questions: [
      'How much does a storage unit cost per month?',
      'Can I access my unit anytime?',
      'What sizes are available?',
      'Is there CCTV and how secure is it?',
      'Do you offer short-term rentals?'
    ],
    serviceAnalysis: [
      { label:'Self storage units',    pct:48 },
      { label:'24/7 access enquiries', pct:31 },
      { label:'Pricing & quotes',      pct:26 },
      { label:'Fulfilment / B2B',      pct:18 },
      { label:'Workspace rental',      pct:11 }
    ],
    patterns: [
      { title:'Price transparency is the #1 concern',   body:"71% ask for all-in quotes before committing — customers won't call for a price" },
      { title:'24/7 access is a dealbreaker',            body:'45% of chats mention access hours — after-hours access drives decisions' },
      { title:'SME & e-commerce demand rising fast',     body:'Business enquiries up 38% vs last month — B2B is an underserved content angle' },
      { title:'Security reassurance needed',             body:'CCTV and PIN access cited in 1 of 3 chats — customers need visual proof' }
    ],
    suggestedPosts: [
      { title:'All-in storage pricing — no surprise fees',              sub:'71% ask price upfront' },
      { title:'24/7 access to your unit — we never close',              sub:'Top concern in 45% of chats' },
      { title:'How we keep your belongings safe',                      sub:'Security cited in 1 of 3 conversations' },
      { title:'Business storage for startups & online sellers',        sub:'B2B enquiries up 38% this month' },
      { title:'Unit sizes explained — find yours in 60 seconds',       sub:'Top question from undecided customers' }
    ]
  },

  /* ---------------------------------------------------------------------
   * SOCIAL MEDIA TAB — GET /api/research/social-media
   * ------------------------------------------------------------------- */
  socialMedia: {
    facebook:  { name:'Facebook',  postsThisWeek:3, color:'#3E6FB0', previewImg:'FB_PREVIEW' },
    instagram: { name:'Instagram', postsThisWeek:3, color:'#C0392B', previewImg:'IG_PREVIEW' },
    ranking: [
      { title:'3 months free — move in this month', likes:218, views:3420 },
      { title:'Before & after: family declutter',    likes:218, views:2810 },
      { title:'Why sellers choose us',                likes:218, views:1640 }
    ],
    comments: {
      facebook: [
        { user:'jamielowsg',   text:'Finally a storage solution near Tanjong Pagar!' },
        { user:'rachellimmy',  text:'Do you have units for small businesses?' },
        { user:'kevin_ang91',  text:'Love the 24/7 access.' },
        { user:'maxtham4',     text:'Too expensive...' }
      ],
      instagram: [
        { user:'mrsleeluxe',       text:'This before & after is insane!! How do I book??' },
        { user:'derekheng.biz',    text:'Do you have climate controlled units?' },
        { user:'amytan_lifestyle', text:'Prices please! 😊' },
        { user:'henderyxoxo',      text:'Not enough space' }
      ],
      google: {
        rating: 4.7,
        count: 18,
        reviews: [
          { user:'Priya R.', stars:5, text:'Best storage in Singapore. Worth every cent.' },
          { user:'TanJW',    stars:5, text:'Very transparent pricing, no hidden fees.' },
          { user:'Lydia M.', stars:4, text:'Good location, friendly staff.' },
          { user:'Maria L.', stars:1, text:'Not good ventilation' }
        ]
      }
    },
    patterns: [
      { title:'Customers are satisfied — 76% positive sentiment',      body:'4.7-star Google rating. Praise: 24/7 access, clean facilities, transparent pricing.' },
      { title:'Pricing still the #1 comment trigger',                 body:'Commenters asking for prices publicly — push all-in pricing posts more.' },
      { title:'E-commerce / SME interest growing',                    body:'Shopee and inventory queries up — B2B-focused posts would capture this.' },
      { title:'Before & after drives highest comment volume',         body:'34 Instagram comments this week — 2× more than other formats.' }
    ],
    suggestedPosts: [
      { title:'Show your price upfront — all-in, no surprises',          sub:'Pricing questions dominate IG and FB' },
      { title:'Before & after: declutter + storage',                    sub:'Top comment-driving format at 9.2%' },
      { title:'E-commerce sellers: store inventory smarter',            sub:'SME interest rising in comments & reviews' },
      { title:'Customer spotlight — 6-month success story',            sub:'Testimonials resonating in Google reviews' },
      { title:'Climate-controlled units — electronics, wine, docs',    sub:'Requested in comments, not yet addressed' }
    ]
  },

  /* ---------------------------------------------------------------------
   * COMPETITOR ANALYSIS TAB
   * List:    GET /api/research/competitors
   * Detail:  GET /api/research/competitors/:id
   * ------------------------------------------------------------------- */
  competitors: [
    {
      id:'spaceship', name:'Spaceship Singapore', pill:'Spaceship Storage Space', avatar:'B',
      fb:{ likes:274, views:4213, comments:26,
        posts:['Before & after: family declutter','What to do with large amounts','Why sellers choose us'],
        top:[
          { user:'lim_xiaoming88',  text:'Prices not listed. Must call every time. Troublesome.' },
          { user:'user_tanjiakiat', text:'Access hours? Closes at 10pm — terrible for after work.' },
          { user:'lim_xiaoming88',  text:'Quite cheap, cheaper than others.' }
        ]},
      ig:{ likes:218, views:3420, comments:22,
        posts:['Before & after: family declutter','What to do with large amounts','Why sellers choose us'],
        top:[
          { user:'mrsleeluxe',      text:'This before & after is insane!! How do I book??' },
          { user:'derekheng.biz',   text:'Do you have climate controlled units?' },
          { user:'amytan_lifestyle',text:'Prices please! 😊' }
        ]},
      g:{ rating:4.7, count:18, reviews:[
          { user:'Priya R.', stars:5, text:'Best storage in Singapore. Worth every cent.' },
          { user:'TanJW',    stars:5, text:'Very transparent pricing, no hidden fees.' },
          { user:'Lydia M.', stars:4, text:'Good location, friendly staff.' },
          { user:'Maria L.', stars:1, text:'Not good ventilation' }
        ]},
      reco:[
        { title:'Pricing requires a phone call', body:'Comments mention no listed prices — counter with transparent, all-in pricing on every post.' },
        { title:'Access hours limited to 10pm', body:'Flagged as "terrible for after work" — reinforce Urban Space\'s 24/7 access.' },
        { title:'Climate control interest unanswered', body:'Customers ask about climate-controlled units with no response — make it a content pillar.' },
        { title:'Ventilation complaints in reviews', body:"A 1-star review cites poor ventilation — highlight Urban Space's well-ventilated facilities." }
      ],
      sugg:[
        { title:'All-in pricing — no calls needed', sub:'Spaceship customers frustrated by having to call for prices' },
        { title:'24/7 access — open after their 10pm cutoff', sub:'Access hours cited as a dealbreaker in their comments' },
        { title:'Climate-controlled units for wine, electronics, documents', sub:'Repeatedly requested, never addressed by Spaceship' },
        { title:'Fresh, well-ventilated storage you can trust', sub:'Ventilation complaint in their Google reviews' }
      ]
    },
    {
      id:'storefriendly', name:'Storefriendly Singapore', pill:'Storefriendly Singapore', avatar:'S',
      fb:{ likes:198, views:3105, comments:14,
        posts:['Warehouse racking solutions','Monthly promo: 10% off','Client spotlight: online seller'],
        top:[
          { user:'wendy.k',      text:'Do you have forklift access?' },
          { user:'choo_desmond', text:'Rates seem to change often.' }
        ]},
      ig:{ likes:165, views:2490, comments:12,
        posts:['Warehouse racking solutions','Monthly promo: 10% off','Client spotlight: online seller'],
        top:[
          { user:'ivan.tanx',   text:'Nice facility, is it far from CBD?' },
          { user:'grace_lim22', text:'Any student discount?' }
        ]},
      g:{ rating:4.3, count:52, reviews:[
          { user:'Marcus T.', stars:4, text:'Solid option, a bit far from town.' },
          { user:'Huda R.',   stars:5, text:'Staff were very helpful.' },
          { user:'Ben C.',    stars:3, text:'Booking process was confusing.' }
        ]},
      reco:[
        { title:'Location convenience is questioned', body:"Reviews note it's far from town — highlight Urban Space's central locations." },
        { title:'Booking process seen as confusing', body:"A 3-star review flags friction — promote Urban Space's simple online booking." }
      ],
      sugg:[
        { title:'Book your unit in under 2 minutes online', sub:'Booking friction cited in their reviews' },
        { title:'Centrally located — closer than you think', sub:'Distance is a recurring complaint' }
      ]
    },
    {
      id:'workstore', name:'Work + Store', pill:'Work + Store', avatar:'W',
      fb:{ likes:142, views:2210, comments:9,
        posts:['Coworking + storage bundle','New unit sizes available','Community event recap'],
        top:[
          { user:'felicia_ng', text:'Can I get a day pass?' },
          { user:'ryantoh_',   text:'Prices for the smallest unit?' }
        ]},
      ig:{ likes:131, views:1980, comments:10,
        posts:['Coworking + storage bundle','New unit sizes available','Community event recap'],
        top:[
          { user:'nadia.k', text:'Love the concept, is it 24hr?' },
          { user:'jon_teo', text:'Any B2B rates?' }
        ]},
      g:{ rating:4.1, count:9, reviews:[
          { user:'Alicia W.', stars:4, text:'Good hybrid concept.' },
          { user:'Farid S.',  stars:3, text:'Limited parking.' }
        ]},
      reco:[
        { title:'Hybrid concept resonates but access hours unclear', body:"Customers ask if it's 24hr — Urban Space can lead with confirmed 24/7 access." },
        { title:'Parking flagged as a limitation', body:"Highlight Urban Space's convenient access and parking in content." }
      ],
      sugg:[
        { title:'24/7, confirmed — no guessing required', sub:'Access hours ambiguity in their comments' },
        { title:'Hassle-free parking, every visit', sub:'Parking complaint in their reviews' }
      ]
    },
    {
      id:'lockstore', name:'Lock + Store', pill:'Lock + Store', avatar:'L',
      fb:{ likes:310, views:5120, comments:31,
        posts:['Biggest storage sale of the year','Security feature spotlight','Customer testimonial reel'],
        top:[
          { user:'samuel_g',    text:'How secure is the facility overnight?' },
          { user:'pearlyn_c',  text:'Rates for long-term (1yr+)?' },
          { user:'davidlim.sg', text:'Is insurance included?' }
        ]},
      ig:{ likes:289, views:4560, comments:27,
        posts:['Biggest storage sale of the year','Security feature spotlight','Customer testimonial reel'],
        top:[
          { user:'june.ho',   text:'Do you offer moving help?' },
          { user:'terence_w', text:'Great location!' },
          { user:'mich.tan',  text:'Any climate control?' }
        ]},
      g:{ rating:4.5, count:64, reviews:[
          { user:'Joel K.', stars:5, text:'Very secure, cameras everywhere.' },
          { user:'Rina P.', stars:4, text:'A bit pricier than others.' },
          { user:'Wayne S.',stars:5, text:'Great customer service.' }
        ]},
      reco:[
        { title:'Perceived as premium-priced', body:"Reviews note higher pricing — counter with Urban Space's transparent, competitive rates." },
        { title:'Insurance & moving help are common questions', body:'Unanswered add-on questions — Urban Space can promote bundled services if offered.' }
      ],
      sugg:[
        { title:'Same security, better value', sub:'Pricing perception gap in their reviews' },
        { title:'Your move, simplified — ask us how', sub:'Moving help queries unanswered by competitor' }
      ]
    },
    {
      id:'storhub', name:'Storhub Self Storage', pill:'Storhub Self Storage', avatar:'H',
      fb:{ likes:402, views:6780, comments:44,
        posts:['National storage day promo','Facility tour video','Storage tips for movers'],
        top:[
          { user:'wei_ling',   text:'Multiple locations — which is nearest to Depot Road?' },
          { user:'ashley_koh', text:'Do prices vary by branch?' },
          { user:'farhan.b',   text:'Great facility tour, thanks!' }
        ]},
      ig:{ likes:375, views:5920, comments:39,
        posts:['National storage day promo','Facility tour video','Storage tips for movers'],
        top:[
          { user:'clara.wong', text:'Beautiful facility!' },
          { user:'kelvin_ng',  text:'Is climate control extra?' },
          { user:'siti.rahman',text:'Any SME packages?' }
        ]},
      g:{ rating:4.4, count:210, reviews:[
          { user:'Zack T.', stars:5, text:'Best-in-class facilities.' },
          { user:'Nur A.',  stars:4, text:'Pricing not always clear online.' },
          { user:'Ong K.',  stars:3, text:'Long queue during peak hours.' }
        ]},
      reco:[
        { title:'Scale creates pricing confusion across branches', body:"Customers unsure which branch/price applies — Urban Space's single transparent rate is a clear differentiator." },
        { title:'Peak-hour congestion reported', body:"A 3-star review flags queues — highlight Urban Space's smooth, always-available access." }
      ],
      sugg:[
        { title:'One rate, no branch confusion', sub:'Multi-branch pricing confusion in their reviews' },
        { title:'Skip the queue — access anytime, no wait', sub:'Peak-hour congestion complaint' }
      ]
    },
    {
      id:'extraspace', name:'Extra Space Self Storage', pill:'Extra Space Self Storage', avatar:'E',
      fb:{ likes:356, views:5890, comments:37,
        posts:['Free trolley with every move-in','Business storage explainer','Referral rewards program'],
        top:[
          { user:'hannah_lee', text:'Do you have a referral program?' },
          { user:'boonkeat.t', text:'Is trolley really free?' },
          { user:'nurul.aini', text:'Business rates?' }
        ]},
      ig:{ likes:330, views:5100, comments:33,
        posts:['Free trolley with every move-in','Business storage explainer','Referral rewards program'],
        top:[
          { user:'zhiwei.ong', text:'Nice promo, how do I redeem?' },
          { user:'ct.raja',    text:'Any student rates?' },
          { user:'ming_hui',   text:'Great value overall' }
        ]},
      g:{ rating:4.6, count:88, reviews:[
          { user:'Aiden F.', stars:5, text:'Very convenient and clean.' },
          { user:'Suria M.', stars:4, text:'Occasionally hard to reach support.' },
          { user:'Yusof T.', stars:5, text:'Great referral deal.' }
        ]},
      reco:[
        { title:'Support responsiveness questioned', body:'A review cites difficulty reaching support — Urban Space can highlight fast, direct WhatsApp support.' },
        { title:'Referral/promo mechanics create questions', body:"Customers ask how to redeem — keep Urban Space's promos simple and clearly explained." }
      ],
      sugg:[
        { title:'Real humans, fast replies — chat us on WhatsApp', sub:'Support responsiveness complaint in their reviews' },
        { title:'Simple promos, no fine print', sub:'Promo redemption confusion in their comments' }
      ]
    }
  ],

  /* ---------------------------------------------------------------------
   * GENERATE PAGE
   * Drafts:          POST /api/generate  (body: form state)  -> 3 drafts
   * Saved drafts:    GET/POST/DELETE /api/generate/drafts
   * Recommendations: GET /api/generate/recommendations
   * ------------------------------------------------------------------- */
  generate: {
    defaultDrafts: [
      { plat:'Instagram', col:'#E8651A', txt:"Running out of space at home? Urban Space has climate-controlled units from $49/month. 24/7 access, no hidden fees. First 3 months free 👇", tags:'#UrbanSpaceSG #SelfStorage' },
      { plat:'Facebook',  col:'#4A87BE', txt:'Before & after: we helped this family reclaim their living room in one weekend. Secure storage, 24/7 access, CCTV monitored.', tags:'#UrbanSpaceSG #Family' },
      { plat:'LinkedIn',  col:'#2F7A3D', txt:"E-commerce sellers: stop paying for a warehouse you can't afford. Urban Space's Fulfilment Hub gives your business flexible space and 24/7 access.", tags:'#ecommerce #b2b' }
    ],
    savedDrafts: [
      { id:'sd1', title:'Running out of space at home? Urban Space has climate-controlled units from $49/month.', meta:'Instagram · Friendly · Short · Homeowners · Saved today, 8:43am', col:'#E8651A', plat:'Instagram' },
      { id:'sd2', title:'Before & after: we helped this family reclaim their living room in one weekend. Secure storage.', meta:'Facebook · Before/After · Medium · Homeowners · Saved today, 8:45am', col:'#4A87BE', plat:'Facebook' },
      { id:'sd3', title:"E-commerce sellers: stop paying for a warehouse you can't afford. Urban Space's Fulfilment Hub.", meta:'Instagram · Facebook · Product · Short · E-Commerce Sellers · Saved today, 8:47am', col:'#2F7A3D', plat:'Instagram · Facebook' }
    ],
    recommendations: [
      { title:'3 months free — move in before July',                      sub:'ZOHO: 108 enquiries this month — highest promo interest' },
      { title:'24/7 access — your unit is always ready',                   sub:'Trending concern in competitor comments this week' },
      { title:'Before & after: home declutter transformation',             sub:'Before/after = 9.2% engagement — highest format this month' },
      { title:'E-commerce fulfilment hub for Singapore SMEs',              sub:'LinkedIn B2B — online retailers and startups are target' },
      { title:'All-in pricing — no hidden fees, instant quote online',     sub:'Competitor pricing frustration spike — 38% increase in enquiries' }
    ]
  }
};
