/**
 * api.js
 * -----------------------------------------------------------------------
 * THIS IS THE FILE BACKEND ENGINEERS EDIT.
 *
 * Every function below is the single seam between the UI (js/app.js) and
 * real data. Right now each one just returns mock data from mock-data.js
 * after a fake network delay, so the app is fully clickable with no
 * backend at all.
 *
 * To wire up a real backend:
 *   1. Replace the body of a function with a `fetch()` call to your
 *      real endpoint (a suggested REST route is documented above each
 *      function — feel free to adapt to your actual API/GraphQL schema).
 *   2. Keep the function `async` and keep returning a value in the SAME
 *      shape as the current mock return (documented in mock-data.js and
 *      README.md). Nothing in js/app.js needs to change as long as the
 *      shape matches.
 *   3. Errors: throw, or return a rejected promise, on failure. app.js
 *      wraps every call in try/catch and shows a toast on error — see
 *      `safeCall()` in app.js.
 *
 * None of these functions read or write MOCK directly except to hand back
 * a deep-cloned copy — this stops the running app from ever accidentally
 * mutating the seed data.
 * -----------------------------------------------------------------------
 */

/** Simulates network latency. Remove once real fetch() calls are in place. */
function _delay(ms){ return new Promise(res => setTimeout(res, ms)); }

/** Cheap deep clone so mock data can't be mutated by the UI layer. */
function _clone(obj){ return JSON.parse(JSON.stringify(obj)); }

const API = {

  // GET /api/home/summary
  // -> { kpis: [...], weeklySummary: [...] }  (see mock-data.js `MOCK.home`)
  async getHomeSummary(){
    await _delay(150);
    return _clone(MOCK.home);
  },

  // GET /api/research/sources
  // -> [{ id, label, img, col1, col2, desc }]
  async getResearchSources(){
    await _delay(100);
    return _clone(MOCK.researchSources);
  },

  // GET /api/research/internet-trends
  // -> { keywords: [...], suggestedPosts: [...], insights: [...] }
  async getInternetTrends(){
    await _delay(220);
    return _clone(MOCK.internetTrends);
  },

  // GET /api/research/customer-chats
  // -> { meta: {...}, questions: [...], serviceAnalysis: [...], patterns: [...], suggestedPosts: [...] }
  async getCustomerChats(){
    await _delay(220);
    return _clone(MOCK.customerChats);
  },

  // GET /api/research/social-media
  // -> { facebook: {...}, instagram: {...}, ranking: [...], comments: {...}, patterns: [...], suggestedPosts: [...] }
  async getSocialMedia(){
    await _delay(220);
    return _clone(MOCK.socialMedia);
  },

  // GET /api/research/competitors
  // -> [{ id, name, pill, avatar }]  (lightweight list for the pill bar)
  async getCompetitorList(){
    await _delay(150);
    return MOCK.competitors.map(c => ({ id:c.id, name:c.name, pill:c.pill, avatar:c.avatar }));
  },

  // GET /api/research/competitors/:id
  // -> { id, name, pill, avatar, fb:{...}, ig:{...}, g:{...}, reco:[...], sugg:[...] }
  async getCompetitorDetail(id){
    await _delay(200);
    const found = MOCK.competitors.find(c => c.id === id);
    if(!found) throw new Error('Competitor not found: ' + id);
    return _clone(found);
  },

  // POST /api/generate
  // body: { platform, tone, length, audience, style, prompt }
  // -> [{ plat, col, txt, tags }, { plat, col, txt, tags }, { plat, col, txt, tags }]
  //
  // Mock behaviour: produces 3 deterministic drafts based on form state.
  // A real implementation would call an LLM (e.g. the Anthropic API) with
  // the form state as the prompt and return generated post copy in the
  // same 3-item shape.
  async generatePosts(formState){
    await _delay(500);
    const p = formState.platform || 'Instagram';
    return [
      { plat:p, col:'#E8651A',
        txt:(formState.prompt || 'Running out of space at home? Urban Space has climate-controlled units from $49/month.') + ' 24/7 access, no hidden fees.',
        tags:'#UrbanSpaceSG #SelfStorage' },
      { plat: p === 'Instagram' ? 'Facebook' : 'Instagram', col:'#4A87BE',
        txt:'Before & after: we helped a family reclaim their living room in one weekend with Urban Space. Secure, CCTV monitored, 24/7 access.',
        tags:'#UrbanSpaceSG #Family' },
      { plat:'LinkedIn', col:'#2F7A3D',
        txt:"E-commerce sellers: stop paying for a warehouse you can't afford. Urban Space's Fulfilment Hub gives your business flexible space and 24/7 access.",
        tags:'#ecommerce #b2b' }
    ];
  },

  // GET /api/generate/recommendations
  // -> [{ title, sub }]
  async getGenerateRecommendations(){
    await _delay(180);
    return _clone(MOCK.generate.recommendations);
  },

  // GET /api/generate/drafts   (should be scoped to the logged-in user)
  // -> [{ id, title, meta, col, plat }]
  async getSavedDrafts(){
    await _delay(150);
    return _clone(MOCK.generate.savedDrafts);
  },

  // POST /api/generate/drafts
  // body: { title, meta, col, plat }
  // -> { id, title, meta, col, plat }   (server-assigned id)
  async saveDraft(draft){
    await _delay(200);
    const saved = { id:'sd_' + Date.now(), ...draft };
    // Mock persistence only — real backend should INSERT into the DB here.
    MOCK.generate.savedDrafts.unshift(saved);
    return _clone(saved);
  },

  // DELETE /api/generate/drafts/:id
  // -> { success: true }
  async deleteDraft(id){
    await _delay(150);
    MOCK.generate.savedDrafts = MOCK.generate.savedDrafts.filter(d => d.id !== id);
    return { success:true };
  }
};
