/* ==========================================================================
   GigaBuild — Configurator Logic
   - Single-page, 8-step flow
   - All state lives in window.state (no backend)
   ========================================================================== */

// ---------------- STATE ----------------
const state = {
  step: 1,
  freightType: null,
  fleetSize: 5,
  vehicleClass: 'DOT Required',
  homeState: 'TX',
  driverCount: 5,
  modules: {},     // { moduleId: { enabled: bool, tier: 'basic'|'pro'|'enterprise' } }
  moduleConfig: {}, // { moduleId: { fieldKey: value } }
  subdomain: '',
  customDomainEnabled: false,
  customDomain: '',
  accentColor: '#e8a020',
  billing: 'monthly'
};

// ---------------- DATA ----------------
const FREIGHT_TYPES = [
  { id: 'straight',  name: 'Straight Truck / Expedite', icon: '🚚' },
  { id: 'dryvan',    name: 'Dry Van (Long Haul)',       icon: '🚛' },
  { id: 'reefer',    name: 'Refrigerated (Reefer)',     icon: '🧊' },
  { id: 'flatbed',   name: 'Flatbed / Heavy Haul',      icon: '🏗️' },
  { id: 'tanker',    name: 'Tanker / Fuel',             icon: '🛢️' },
  { id: 'hazmat',    name: 'Hazmat',                    icon: '☣️' },
  { id: 'dump',      name: 'Dump Truck / Sand & Gravel',icon: '⛏️' },
  { id: 'hotshot',   name: 'Hotshot',                   icon: '⚡' },
  { id: 'autohaul',  name: 'Auto Hauler',               icon: '🚗' },
  { id: 'intermodal',name: 'Intermodal / Drayage',      icon: '🚢' },
  { id: 'lastmile',  name: 'Last-Mile Delivery',        icon: '📦' },
  { id: 'mixed',     name: 'Mixed / Other',             icon: '🔀' }
];

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],
  ['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],
  ['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],
  ['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],
  ['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],
  ['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],
  ['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],
  ['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],
  ['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],
  ['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']
];

const MODULES = [
  {
    id: 'gigabooks', name: 'GigaBooks', icon: '📒',
    desc: 'Accounting + tax engine built for trucking. P&L, schedule C, IFTA-ready ledgers.',
    tiers: { basic: 49, pro: 99, enterprise: 199 },
    recommendedFor: 'all'
  },
  {
    id: 'fleet', name: 'Fleet Management', icon: '🛻',
    desc: 'Truck records, maintenance scheduling, asset utilization.',
    tiers: { basic: 39, pro: 79, enterprise: 159 },
    recommendedFor: 'all'
  },
  {
    id: 'compliance', name: 'Compliance Engine', icon: '🛡️',
    desc: 'DOT, FMCSA, DVIR, log audits, endorsement tracking, expiration alerts.',
    tiers: { basic: 59, pro: 119, enterprise: 239 },
    recommendedFor: ['straight','dryvan','reefer','flatbed','tanker','hazmat','dump','hotshot','autohaul','intermodal','mixed']
  },
  {
    id: 'ifta', name: 'IFTA Reporting', icon: '⛽',
    desc: 'Quarterly fuel tax filings with auto-generated state-by-state mileage.',
    tiers: { basic: 29, pro: 59, enterprise: 119 },
    recommendedFor: ['straight','dryvan','reefer','flatbed','tanker','hazmat','dump','autohaul','intermodal','mixed']
  },
  {
    id: 'payroll', name: 'Payroll & HR', icon: '💼',
    desc: 'Driver pay (per-mile, hourly, percentage), settlement statements, W-2 / 1099.',
    tiers: { basic: 39, pro: 79, enterprise: 149 },
    recommendedFor: 'all'
  },
  {
    id: 'onboarding', name: 'Driver Onboarding', icon: '📝',
    desc: 'Application, MVR, drug screen, DQ file, e-sign — all in one workflow.',
    tiers: { basic: 29, pro: 69, enterprise: 129 },
    recommendedFor: 'all'
  },
  {
    id: 'assets', name: 'Asset Manager', icon: '📦',
    desc: 'Trailers, ELDs, chains, straps. Track location, condition, depreciation.',
    tiers: { basic: 25, pro: 55, enterprise: 99 },
    recommendedFor: ['flatbed','reefer','tanker','hazmat','dump','autohaul','intermodal','mixed']
  },
  {
    id: 'domain', name: 'Domain & Hosting', icon: '🌐',
    desc: 'Custom domain registration, SSL, hosted tenant portal.',
    tiers: { basic: 15, pro: 35, enterprise: 79 },
    recommendedFor: 'all'
  },
  {
    id: 'shipment', name: 'Digital Shipment Management', icon: '📑',
    desc: 'BOL, POD, e-Shipment, signatures, attachments, chain-of-custody.',
    tiers: { basic: 39, pro: 79, enterprise: 149 },
    recommendedFor: ['dryvan','reefer','flatbed','tanker','hazmat','autohaul','intermodal','lastmile','mixed']
  },
  {
    id: 'security', name: 'Security & Chain of Custody', icon: '🔐',
    desc: 'Tamper-evident logs, WORM evidence, audit trail for high-value or hazmat loads.',
    tiers: { basic: 49, pro: 99, enterprise: 199 },
    recommendedFor: ['tanker','hazmat','autohaul','intermodal']
  },
  {
    id: 'education', name: 'Compliance Education', icon: '🎓',
    desc: 'Driver-facing courses on DOT, hazmat, hours-of-service, defensive driving.',
    tiers: { basic: 19, pro: 39, enterprise: 79 },
    recommendedFor: 'all'
  }
];

// Per-module configuration form schemas (used in Step 4)
const MODULE_CONFIG_SCHEMA = {
  gigabooks: {
    title: 'GigaBooks',
    fields: [
      { key: 'filingStatus', label: 'Filing status', type: 'select',
        options: ['Single','Married filing jointly','Married filing separately','Head of household'] },
      { key: 'entityType', label: 'Entity type', type: 'select',
        options: ['Sole proprietorship','LLC (single-member)','LLC (multi-member)','S-Corp','C-Corp','Partnership'] },
      { key: 'industry', label: 'Industry', type: 'select',
        options: ['For-hire trucking','Private fleet','Owner-operator','Brokerage','Logistics / 3PL'] }
    ]
  },
  fleet: {
    title: 'Fleet Management',
    fields: [
      { key: 'truckTypes', label: 'Truck types', type: 'checklist',
        options: ['Day cab','Sleeper','Straight truck','Tractor','Van','Pickup'] },
      { key: 'maintSchedule', label: 'Maintenance schedule', type: 'select',
        options: ['Mileage-based','Time-based','Hybrid (whichever comes first)'] }
    ]
  },
  compliance: {
    title: 'Compliance Engine',
    fields: [
      { key: 'endorsements', label: 'Endorsements held', type: 'checklist',
        options: ['Hazmat (H)','Tanker (N)','Doubles/Triples (T)','Passenger (P)','School Bus (S)','X (HazMat + Tanker)'] },
      { key: 'freightTypes', label: 'Freight types hauled', type: 'checklist',
        options: ['General','Refrigerated','Hazmat','Heavy/Over-dimensional','Auto','Tanker (fuel)','Tanker (food)'] }
    ]
  },
  ifta: {
    title: 'IFTA Reporting',
    fields: [
      { key: 'baseState', label: 'Base jurisdiction', type: 'select', options: US_STATES.map(s => s[1]) },
      { key: 'fuelType', label: 'Primary fuel type', type: 'select', options: ['Diesel','Gasoline','CNG','LNG','Biodiesel','Electric'] }
    ]
  },
  payroll: {
    title: 'Payroll & HR',
    fields: [
      { key: 'payModel', label: 'Driver pay model', type: 'select',
        options: ['Per mile','Hourly','Percentage of load','Salary','Mixed'] },
      { key: 'payCycle', label: 'Pay cycle', type: 'select',
        options: ['Weekly','Bi-weekly','Semi-monthly','Monthly'] }
    ]
  },
  onboarding: {
    title: 'Driver Onboarding',
    fields: [
      { key: 'docs', label: 'Required documents', type: 'checklist',
        options: ['CDL','Medical card','MVR','Drug screen','Road test','References'] }
    ]
  },
  assets: {
    title: 'Asset Manager',
    fields: [
      { key: 'assetTypes', label: 'Track these assets', type: 'checklist',
        options: ['Trailers','ELDs','Chains/Straps','Tarps','Reefer units','Tools'] }
    ]
  },
  domain: {
    title: 'Domain & Hosting',
    fields: [
      { key: 'tld', label: 'Preferred TLD', type: 'select', options: ['.com','.co','.io','.net','.us','.app'] }
    ]
  },
  shipment: {
    title: 'Digital Shipment Management',
    fields: [
      { key: 'requireSig', label: 'Require POD signature', type: 'select', options: ['Always','When over $X value','Optional'] }
    ]
  },
  security: {
    title: 'Security & Chain of Custody',
    fields: [
      { key: 'evidenceLevel', label: 'Evidence retention', type: 'select', options: ['Standard (7 yrs)','Extended (10 yrs)','Indefinite (WORM)'] }
    ]
  },
  education: {
    title: 'Compliance Education',
    fields: [
      { key: 'courseTracks', label: 'Course tracks', type: 'checklist',
        options: ['DOT basics','Hours-of-service','Defensive driving','Hazmat handling','Customer service'] }
    ]
  }
};

const TOTAL_STEPS = 8;

// ---------------- INIT ----------------
document.addEventListener('DOMContentLoaded', () => {
  buildFreightGrid();
  buildStateDropdown();
  bindStep1();
  bindStep2();
  buildModulesPlaceholder(); // populated after step 1 selection
  bindStep3Sticky();
  bindStep5();
  bindBilling();
  bindBackButtons();
  bindStepNexts();
  bindDownload();
  updateProgress();
});

// ---------------- NAV / PROGRESS ----------------
function goToStep(n) {
  if (n < 1 || n > TOTAL_STEPS) return;

  // Lazy-build content as we move forward
  if (n === 3) buildModulesGrid();
  if (n === 4) buildConfigPanels();
  if (n === 6) buildReview();
  if (n === 7) buildSandbox();
  if (n === 8) buildConvertSummary();

  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const target = document.querySelector(`.step[data-step="${n}"]`);
  if (target) target.classList.add('active');

  state.step = n;
  document.getElementById('stepIndicator').textContent = `Step ${n} of ${TOTAL_STEPS}`;
  updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgress() {
  const pct = (state.step / TOTAL_STEPS) * 100;
  document.getElementById('progressFill').style.width = `${pct}%`;
}

function bindBackButtons() {
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => goToStep(state.step - 1));
  });
}

function bindStepNexts() {
  document.getElementById('step1Next').addEventListener('click', () => goToStep(2));
  document.getElementById('step2Next').addEventListener('click', () => {
    captureStep2();
    goToStep(3);
  });
  document.getElementById('step3Next').addEventListener('click', () => goToStep(4));
  document.getElementById('step4Next').addEventListener('click', () => {
    captureStep4();
    goToStep(5);
  });
  document.getElementById('step5Next').addEventListener('click', () => {
    captureStep5();
    goToStep(6);
  });
  document.getElementById('step6Next').addEventListener('click', () => goToStep(7));
  document.getElementById('step7Next').addEventListener('click', () => goToStep(8));
}

// ---------------- STEP 1 — FREIGHT ----------------
function buildFreightGrid() {
  const grid = document.getElementById('freightGrid');
  grid.innerHTML = FREIGHT_TYPES.map(f => `
    <div class="freight-card" data-freight="${f.id}">
      <span class="freight-icon">${f.icon}</span>
      <span class="freight-name">${f.name}</span>
    </div>
  `).join('');
}

function bindStep1() {
  const grid = document.getElementById('freightGrid');
  const nextBtn = document.getElementById('step1Next');
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.freight-card');
    if (!card) return;
    grid.querySelectorAll('.freight-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.freightType = card.dataset.freight;
    nextBtn.disabled = false;
  });
}

// ---------------- STEP 2 — FLEET ----------------
function buildStateDropdown() {
  const sel = document.getElementById('homeState');
  sel.innerHTML = US_STATES.map(([code,name]) =>
    `<option value="${code}"${code==='TX'?' selected':''}>${name}</option>`
  ).join('');
}

function bindStep2() {
  const fs = document.getElementById('fleetSize');
  const out = document.getElementById('fleetSizeOut');
  fs.addEventListener('input', () => { out.textContent = fs.value; });
}

function captureStep2() {
  state.fleetSize    = parseInt(document.getElementById('fleetSize').value, 10);
  state.vehicleClass = document.getElementById('vehicleClass').value;
  state.homeState    = document.getElementById('homeState').value;
  state.driverCount  = parseInt(document.getElementById('driverCount').value, 10) || 1;
}

// ---------------- STEP 3 — MODULES ----------------
function buildModulesPlaceholder() {
  // Wait — only build once we know freight type
}

function isRecommended(m) {
  if (m.recommendedFor === 'all') return true;
  return Array.isArray(m.recommendedFor) && m.recommendedFor.includes(state.freightType);
}

function buildModulesGrid() {
  const grid = document.getElementById('modulesGrid');

  // Sort: recommended first
  const sorted = [...MODULES].sort((a,b) => {
    const ar = isRecommended(a) ? 0 : 1;
    const br = isRecommended(b) ? 0 : 1;
    return ar - br;
  });

  grid.innerHTML = sorted.map(m => {
    const recommended = isRecommended(m);
    return `
    <div class="module-card${recommended ? ' recommended' : ''}" data-module="${m.id}">
      <div class="module-head">
        <h3 class="module-title"><span class="module-icon">${m.icon}</span>${m.name}</h3>
        ${recommended ? '<span class="module-recommended-pill">Recommended</span>' : ''}
      </div>
      <p class="module-desc">${m.desc}</p>
      <div class="tier-row" data-tiers="${m.id}">
        <button type="button" class="tier-btn" data-tier="basic">
          <span class="tier-name">Basic</span><span class="tier-price">$${m.tiers.basic}/mo</span>
        </button>
        <button type="button" class="tier-btn selected" data-tier="pro">
          <span class="tier-name">Pro</span><span class="tier-price">$${m.tiers.pro}/mo</span>
        </button>
        <button type="button" class="tier-btn" data-tier="enterprise">
          <span class="tier-name">Enterprise</span><span class="tier-price">$${m.tiers.enterprise}/mo</span>
        </button>
      </div>
      <label class="module-toggle">
        <input type="checkbox" class="module-enable" ${recommended ? 'checked' : ''}>
        <span>Add this module</span>
      </label>
    </div>`;
  }).join('');

  // Seed state for any module already toggled on
  sorted.forEach(m => {
    if (isRecommended(m) && !state.modules[m.id]) {
      state.modules[m.id] = { enabled: true, tier: 'pro' };
    } else if (!state.modules[m.id]) {
      state.modules[m.id] = { enabled: false, tier: 'pro' };
    }
  });
  syncModuleCardActive();
  recalcPrice();

  // Wire interactions
  grid.querySelectorAll('.module-card').forEach(card => {
    const id = card.dataset.module;

    card.querySelectorAll('.tier-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        card.querySelectorAll('.tier-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.modules[id].tier = btn.dataset.tier;
        // Selecting a tier turns the module on
        const cb = card.querySelector('.module-enable');
        if (!cb.checked) { cb.checked = true; state.modules[id].enabled = true; }
        syncModuleCardActive();
        recalcPrice();
      });
    });

    card.querySelector('.module-enable').addEventListener('change', (e) => {
      state.modules[id].enabled = e.target.checked;
      syncModuleCardActive();
      recalcPrice();
    });
  });
}

function syncModuleCardActive() {
  document.querySelectorAll('.module-card').forEach(card => {
    const id = card.dataset.module;
    card.classList.toggle('active', !!state.modules[id]?.enabled);
  });
}

function recalcPrice() {
  const breakdown = [];
  let total = 0;
  MODULES.forEach(m => {
    const s = state.modules[m.id];
    if (s && s.enabled) {
      const price = m.tiers[s.tier];
      total += price;
      breakdown.push({ name: m.name, tier: s.tier, price });
    }
  });

  const fmt = (n) => '$' + n.toLocaleString('en-US');

  document.getElementById('priceAmount').textContent = fmt(total);
  document.getElementById('priceSub').textContent =
    breakdown.length === 0
      ? '0 modules selected'
      : `${breakdown.length} module${breakdown.length===1?'':'s'} • per month`;

  document.getElementById('priceBreakdown').innerHTML = breakdown.map(b =>
    `<li><span>${b.name} <em style="color:var(--muted)">(${b.tier})</em></span><span>${fmt(b.price)}</span></li>`
  ).join('');

  document.getElementById('step3Next').disabled = breakdown.length === 0;
}

function bindStep3Sticky() {
  // (sticky positioning handled in CSS)
}

// ---------------- STEP 4 — CONFIGURE ----------------
function buildConfigPanels() {
  const stack = document.getElementById('configStack');
  const selected = MODULES.filter(m => state.modules[m.id]?.enabled);

  if (selected.length === 0) {
    stack.innerHTML = `<div class="config-empty">No modules selected. Go back and pick at least one.</div>`;
    return;
  }

  stack.innerHTML = selected.map(m => {
    const schema = MODULE_CONFIG_SCHEMA[m.id];
    if (!schema) return '';
    return `
      <div class="config-panel" data-module="${m.id}">
        <h3 class="config-panel-title"><span>${m.icon}</span>${schema.title}</h3>
        <div class="config-fields">
          ${schema.fields.map(f => renderField(m.id, f)).join('')}
        </div>
      </div>`;
  }).join('');

  // Bind checklist pill toggling for visual feedback
  stack.querySelectorAll('.chk-pill input').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.chk-pill').classList.toggle('checked', cb.checked);
    });
  });
}

function renderField(modId, f) {
  const id = `cfg-${modId}-${f.key}`;
  if (f.type === 'select') {
    return `
      <div class="field">
        <label for="${id}">${f.label}</label>
        <select id="${id}" data-modkey="${modId}|${f.key}">
          ${f.options.map(o => `<option>${o}</option>`).join('')}
        </select>
      </div>`;
  }
  if (f.type === 'checklist') {
    return `
      <div class="field full">
        <label>${f.label}</label>
        <div class="checkbox-list" data-modkey="${modId}|${f.key}">
          ${f.options.map((o,i) => `
            <label class="chk-pill">
              <input type="checkbox" value="${o}"> ${o}
            </label>
          `).join('')}
        </div>
      </div>`;
  }
  return '';
}

function captureStep4() {
  document.querySelectorAll('#configStack [data-modkey]').forEach(el => {
    const [modId, key] = el.dataset.modkey.split('|');
    state.moduleConfig[modId] = state.moduleConfig[modId] || {};
    if (el.tagName === 'SELECT') {
      state.moduleConfig[modId][key] = el.value;
    } else {
      const vals = Array.from(el.querySelectorAll('input:checked')).map(i => i.value);
      state.moduleConfig[modId][key] = vals;
    }
  });
}

// ---------------- STEP 5 — DOMAIN / BRANDING ----------------
function bindStep5() {
  const sd = document.getElementById('subdomain');
  const prev = document.getElementById('subdomainPreview');
  sd.addEventListener('input', () => {
    const v = sd.value.trim().toLowerCase().replace(/[^a-z0-9-]/g,'') || 'yourfleet';
    sd.value = sd.value.trim().toLowerCase().replace(/[^a-z0-9-]/g,'');
    prev.textContent = `${v}.gigasphere.app`;
  });

  const toggle = document.getElementById('customDomainToggle');
  const cd = document.getElementById('customDomain');
  toggle.addEventListener('change', () => cd.classList.toggle('hidden', !toggle.checked));

  document.getElementById('colorRow').addEventListener('click', (e) => {
    const sw = e.target.closest('.swatch');
    if (!sw) return;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    state.accentColor = sw.dataset.color;
  });
}

function captureStep5() {
  state.subdomain = (document.getElementById('subdomain').value || 'yourfleet').trim();
  state.customDomainEnabled = document.getElementById('customDomainToggle').checked;
  state.customDomain = document.getElementById('customDomain').value.trim();
}

// ---------------- STEP 6 — REVIEW ----------------
function getActiveModules() {
  return MODULES.filter(m => state.modules[m.id]?.enabled);
}

function monthlyTotal() {
  return getActiveModules().reduce((sum, m) => sum + m.tiers[state.modules[m.id].tier], 0);
}

function buildReview() {
  const freightName = FREIGHT_TYPES.find(f => f.id === state.freightType)?.name || '—';
  const stateName   = US_STATES.find(([c]) => c === state.homeState)?.[1] || state.homeState;
  const mods = getActiveModules();

  const summary = `
    <div class="review-block">
      <h3>Operation</h3>
      <div class="review-row"><span class="review-key">Freight type</span><span class="review-val">${freightName}</span></div>
      <div class="review-row"><span class="review-key">Fleet size</span><span class="review-val">${state.fleetSize} truck${state.fleetSize===1?'':'s'}</span></div>
      <div class="review-row"><span class="review-key">Drivers</span><span class="review-val">${state.driverCount}</span></div>
      <div class="review-row"><span class="review-key">Vehicle classification</span><span class="review-val">${state.vehicleClass}</span></div>
      <div class="review-row"><span class="review-key">Home state</span><span class="review-val">${stateName}</span></div>
    </div>

    <div class="review-block">
      <h3>Modules (${mods.length})</h3>
      ${mods.map(m => `
        <div class="review-row">
          <span class="review-key">${m.icon} ${m.name} <em style="color:var(--muted)">(${state.modules[m.id].tier})</em></span>
          <span class="review-val">$${m.tiers[state.modules[m.id].tier]}/mo</span>
        </div>
      `).join('') || '<div class="review-row"><span class="review-key">No modules selected</span><span></span></div>'}
    </div>

    <div class="review-block">
      <h3>Domain &amp; Branding</h3>
      <div class="review-row"><span class="review-key">Subdomain</span><span class="review-val">${state.subdomain || 'yourfleet'}.gigasphere.app</span></div>
      ${state.customDomainEnabled && state.customDomain
        ? `<div class="review-row"><span class="review-key">Custom domain</span><span class="review-val">${state.customDomain}</span></div>`
        : ''}
      <div class="review-row">
        <span class="review-key">Accent color</span>
        <span class="review-val"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${state.accentColor};vertical-align:middle;margin-right:6px;"></span>${state.accentColor}</span>
      </div>
    </div>
  `;
  document.getElementById('reviewSummary').innerHTML = summary;
  updateBigPrice();
}

function bindBilling() {
  document.querySelectorAll('.bt-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bt-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.billing = btn.dataset.billing;
      updateBigPrice();
    });
  });
}

function updateBigPrice() {
  const monthly = monthlyTotal();
  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
  if (state.billing === 'annual') {
    const annualMonthly = monthly * 0.85;
    document.getElementById('bigPriceAmount').textContent = fmt(annualMonthly);
    document.getElementById('bigPricePeriod').textContent = '/ month';
    document.getElementById('bigPriceSub').textContent =
      `Billed annually at ${fmt(annualMonthly * 12)} — you save ${fmt(monthly * 12 * 0.15)}/yr`;
  } else {
    document.getElementById('bigPriceAmount').textContent = fmt(monthly);
    document.getElementById('bigPricePeriod').textContent = '/ month';
    document.getElementById('bigPriceSub').textContent = 'Billed monthly. Cancel anytime.';
  }
}

// ---------------- STEP 7 — SANDBOX PREVIEW ----------------
function buildSandbox() {
  const frame = document.getElementById('sandboxFrame');
  const mods = getActiveModules();
  const subdomain = state.subdomain || 'yourfleet';
  const accent = state.accentColor;

  const navItems = [
    { label: 'Dashboard', icon: '🏠', always: true },
    ...mods.map(m => ({ label: m.name, icon: m.icon }))
  ];

  // Sample data
  const fakeDrivers = [
    { name: 'J. Martinez', truck: 'T-201', status: 'On duty',   miles: 412 },
    { name: 'R. Thompson', truck: 'T-204', status: 'Off duty',  miles: 0   },
    { name: 'D. Nguyen',   truck: 'T-207', status: 'On duty',   miles: 318 },
    { name: 'A. Patel',    truck: 'T-209', status: 'Available', miles: 0   },
    { name: 'M. Foster',   truck: 'T-212', status: 'On duty',   miles: 287 }
  ];

  const fakeTrucks = [
    { unit: 'T-201', year: 2022, make: 'Freightliner', miles: '218,402', next: 'PM-B in 1,200 mi' },
    { unit: 'T-204', year: 2021, make: 'Kenworth',     miles: '294,118', next: 'DOT inspection 2026-06-04' },
    { unit: 'T-207', year: 2023, make: 'Peterbilt',    miles: '142,001', next: 'PM-A in 4,800 mi' },
    { unit: 'T-209', year: 2020, make: 'Volvo',        miles: '388,750', next: 'Brake job overdue' }
  ];

  let mainHtml = `
    <div class="sb-section">
      <h3>Hello, Your Fleet Co</h3>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Fleet size</div><div class="kpi-value">${state.fleetSize}</div></div>
        <div class="kpi"><div class="kpi-label">Drivers</div><div class="kpi-value">${state.driverCount}</div></div>
        <div class="kpi"><div class="kpi-label">On duty now</div><div class="kpi-value good">${Math.min(3, state.driverCount)}</div></div>
        <div class="kpi"><div class="kpi-label">Alerts</div><div class="kpi-value warn">2</div></div>
      </div>
    </div>
  `;

  // GigaBooks → mini P&L
  if (state.modules.gigabooks?.enabled) {
    mainHtml += `
      <div class="sb-section">
        <h3>📒 GigaBooks — April P&amp;L</h3>
        <div class="kpi" style="padding:18px;">
          <div class="pnl-row"><span>Revenue</span><span>$ 184,250</span></div>
          <div class="pnl-row"><span>Fuel</span><span>$ (42,108)</span></div>
          <div class="pnl-row"><span>Driver pay</span><span>$ (58,420)</span></div>
          <div class="pnl-row"><span>Maintenance &amp; repair</span><span>$ (11,940)</span></div>
          <div class="pnl-row"><span>Insurance</span><span>$ (8,200)</span></div>
          <div class="pnl-row"><span>Tolls &amp; permits</span><span>$ (2,840)</span></div>
          <div class="pnl-row"><span>Other operating</span><span>$ (6,510)</span></div>
          <div class="pnl-row total"><span>Net operating income</span><span>$ 54,232</span></div>
        </div>
      </div>
    `;
  }

  // Fleet → drivers + trucks tables
  if (state.modules.fleet?.enabled) {
    mainHtml += `
      <div class="sb-section">
        <h3>🛻 Fleet — Drivers on duty today</h3>
        <table class="sb-table">
          <thead><tr><th>Driver</th><th>Truck</th><th>Status</th><th>Miles today</th></tr></thead>
          <tbody>
            ${fakeDrivers.slice(0, Math.min(5, Math.max(3, state.driverCount))).map(d => `
              <tr>
                <td>${d.name}</td>
                <td>${d.truck}</td>
                <td><span class="status-pill ${d.status==='On duty'?'status-green':d.status==='Available'?'status-yellow':'status-red'}">${d.status}</span></td>
                <td>${d.miles}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="sb-section">
        <h3>🛻 Fleet — Equipment status</h3>
        <table class="sb-table">
          <thead><tr><th>Unit</th><th>Year</th><th>Make</th><th>Miles</th><th>Next service</th></tr></thead>
          <tbody>
            ${fakeTrucks.slice(0, Math.min(4, state.fleetSize)).map(t => `
              <tr><td>${t.unit}</td><td>${t.year}</td><td>${t.make}</td><td>${t.miles}</td><td>${t.next}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Compliance → status cards
  if (state.modules.compliance?.enabled) {
    mainHtml += `
      <div class="sb-section">
        <h3>🛡️ Compliance — Status</h3>
        <div class="compliance-row">
          <div class="comp-card green">
            <div class="comp-name">DOT Authority</div>
            <div class="comp-status">Active • Renews 2027-02-14</div>
          </div>
          <div class="comp-card green">
            <div class="comp-name">UCR Registration</div>
            <div class="comp-status">Filed for 2026</div>
          </div>
          <div class="comp-card yellow">
            <div class="comp-name">Drug & Alcohol Program</div>
            <div class="comp-status">Random pool due in 21 days</div>
          </div>
          <div class="comp-card yellow">
            <div class="comp-name">Driver Medical Cards</div>
            <div class="comp-status">1 expires in 32 days (J. Martinez)</div>
          </div>
          <div class="comp-card red">
            <div class="comp-name">IFTA Q1 Filing</div>
            <div class="comp-status">Overdue — needs review</div>
          </div>
          <div class="comp-card green">
            <div class="comp-name">SAFER / SMS</div>
            <div class="comp-status">No alerts</div>
          </div>
        </div>
      </div>
    `;
  }

  // IFTA → quick KPI
  if (state.modules.ifta?.enabled) {
    mainHtml += `
      <div class="sb-section">
        <h3>⛽ IFTA — Q1 2026</h3>
        <div class="kpi-row">
          <div class="kpi"><div class="kpi-label">Total miles</div><div class="kpi-value">142,810</div></div>
          <div class="kpi"><div class="kpi-label">Taxable gallons</div><div class="kpi-value">21,508</div></div>
          <div class="kpi"><div class="kpi-label">Net tax due</div><div class="kpi-value warn">$ 3,184</div></div>
          <div class="kpi"><div class="kpi-label">Filing status</div><div class="kpi-value bad">Overdue</div></div>
        </div>
      </div>
    `;
  }

  // Payroll → simple snapshot
  if (state.modules.payroll?.enabled) {
    mainHtml += `
      <div class="sb-section">
        <h3>💼 Payroll — Current pay period</h3>
        <table class="sb-table">
          <thead><tr><th>Driver</th><th>Miles / Hours</th><th>Gross</th><th>Net</th></tr></thead>
          <tbody>
            <tr><td>J. Martinez</td><td>2,418 mi</td><td>$ 1,571.70</td><td>$ 1,202.30</td></tr>
            <tr><td>R. Thompson</td><td>1,890 mi</td><td>$ 1,228.50</td><td>$ 938.40</td></tr>
            <tr><td>D. Nguyen</td><td>2,205 mi</td><td>$ 1,433.25</td><td>$ 1,094.10</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  frame.innerHTML = `
    <div class="sandbox-topbar">
      <div class="sandbox-tenant"><em>${subdomain}</em>.gigasphere.app</div>
      <div class="sandbox-user">
        <span>Your Fleet Co</span>
        <span class="sandbox-avatar" style="background:${accent}">Y</span>
      </div>
    </div>
    <div class="sandbox-body">
      <aside class="sandbox-sidebar">
        <div class="sandbox-nav">
          ${navItems.map((n,i) => `
            <div class="sandbox-nav-item${i===0?' active':''}">
              <span>${n.icon}</span><span>${n.label}</span>
            </div>
          `).join('')}
        </div>
      </aside>
      <div class="sandbox-main">${mainHtml}</div>
    </div>
  `;
}

// ---------------- STEP 8 — CONVERT ----------------
function buildConvertSummary() {
  const mods = getActiveModules();
  const monthly = monthlyTotal();
  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const display = state.billing === 'annual' ? monthly * 0.85 : monthly;
  const freightName = FREIGHT_TYPES.find(f => f.id === state.freightType)?.name || '—';

  document.getElementById('convertSummary').innerHTML = `
    <div>
      <div class="cs-item-label">Configuration</div>
      <div class="cs-item-value">${freightName}</div>
    </div>
    <div>
      <div class="cs-item-label">Modules</div>
      <div class="cs-item-value">${mods.length} selected</div>
    </div>
    <div>
      <div class="cs-item-label">Subdomain</div>
      <div class="cs-item-value">${state.subdomain || 'yourfleet'}.gigasphere.app</div>
    </div>
    <div>
      <div class="cs-item-label">${state.billing === 'annual' ? 'Annual / month' : 'Monthly'}</div>
      <div class="cs-item-value gold">${fmt(display)}/mo</div>
    </div>
  `;
}

function bindDownload() {
  document.getElementById('downloadConfig').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gigabuild-config-${state.subdomain || 'yourfleet'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
