/* ==========================================================================
   Giga-Build — 9-step trucker-native configurator
   All state in one object. No backend, no framework, no build step.
   ========================================================================== */

(() => {
  'use strict';

  /* -------------------- STATIC DATA -------------------- */

  const FREIGHT_TYPES = [
    { id: 'daycab',    name: 'Day Cab / Straight Truck' },
    { id: 'sleeper',   name: 'Sleeper / OTR' },
    { id: 'flatbed',   name: 'Flatbed' },
    { id: 'reefer',    name: 'Reefer' },
    { id: 'tanker',    name: 'Tanker' },
    { id: 'dump',      name: 'Dump Truck' },
    { id: 'hotshot',   name: 'Hotshot' },
    { id: 'box',       name: 'Box Truck' },
    { id: 'autohaul',  name: 'Auto Hauler' },
    { id: 'other',     name: 'Other' },
  ];

  // Inline SVG icons — never reference external assets.
  const FREIGHT_ICONS = {
    daycab: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="20" height="14" rx="1"/><path d="M23 14h6l4 5v5h-10z"/><circle cx="9" cy="27" r="2.5"/><circle cx="27" cy="27" r="2.5"/></svg>`,
    sleeper: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 24V12c0-1 1-2 2-2h14v14z"/><path d="M19 14h6l4 5v5H19z"/><path d="M5 14h12M5 18h12"/><circle cx="9" cy="27" r="2.5"/><circle cx="27" cy="27" r="2.5"/></svg>`,
    flatbed: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21h22"/><path d="M24 13h5l4 4v4h-9z"/><path d="M6 21V14h18v7"/><circle cx="9" cy="25" r="2.5"/><circle cx="27" cy="25" r="2.5"/></svg>`,
    reefer:  `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="20" height="16" rx="1"/><path d="M23 13h6l4 5v7H23z"/><path d="M13 13v8M9 17h8M11 14l4 6M15 14l-4 6"/><circle cx="9" cy="28" r="2.5"/><circle cx="27" cy="28" r="2.5"/></svg>`,
    tanker:  `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18a8 4 0 0118 0 8 4 0 01-18 0z"/><path d="M5 18v4a8 4 0 0018 0v-4"/><path d="M23 14h6l4 5v5h-9"/><circle cx="9" cy="27" r="2.5"/><circle cx="27" cy="27" r="2.5"/></svg>`,
    dump:    `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22l4-10h12l4 10"/><path d="M24 18h5l4 4v3h-9"/><path d="M2 22h22"/><circle cx="9" cy="27" r="2.5"/><circle cx="27" cy="27" r="2.5"/></svg>`,
    hotshot: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V14h10l3 3h6v5"/><path d="M16 22h12v-3"/><path d="M22 17v-3h4l2 3"/><circle cx="9" cy="25" r="2.5"/><circle cx="22" cy="25" r="2.5"/></svg>`,
    box:     `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="24" height="16" rx="1"/><path d="M15 9v16M3 15h24"/><circle cx="9" cy="28" r="2.5"/><circle cx="24" cy="28" r="2.5"/></svg>`,
    autohaul:`<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 23h32"/><path d="M5 20l3-5h10l3 5"/><path d="M14 13l3-4h10l3 4"/><circle cx="9" cy="25" r="2"/><circle cx="20" cy="25" r="2"/><circle cx="28" cy="25" r="2"/></svg>`,
    other:   `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="11"/><path d="M14 14c0-2 2-3 4-3s4 1 4 3-4 3-4 6"/><circle cx="18" cy="24" r="0.8" fill="currentColor"/></svg>`,
  };

  const PAYMENT_METHODS = [
    { id: 'permile',    title: 'Per Mile',   desc: "Earn a fixed amount per mile driven", icon: '/:\\' },
    { id: 'percentage', title: 'Percentage', desc: "Earn a percentage of each load's value", icon: '%' },
    { id: 'flat',       title: 'Flat Rate',  desc: 'Earn a fixed amount per load',           icon: '$' },
  ];

  const PCT_BASES = [
    { id: 'gross',         title: 'Gross Revenue',     desc: '% of the full load value' },
    { id: 'afterFsc',      title: 'After Fuel Surcharge', desc: '% after fuel surcharge is deducted' },
    { id: 'afterFscTolls', title: 'After FSC + Tolls', desc: '% after FSC and tolls are deducted — common for expediters' },
  ];

  const VEHICLE_CLASSES = ['DOT Required', 'CDL Required', 'Non-DOT', 'Mixed Fleet'];

  const US_STATES = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
    'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
    'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  ];

  // Module catalog. `recommendedFor` lists freight ids that surface the module
  // first; 'all' means show for every operation.
  const MODULES = [
    {
      id: 'gigabooks',
      name: 'GigaBooks',
      desc: 'Bookkeeping, tax filing, and IRS-ready reports for trucking operators.',
      tiers: { basic: 29, pro: 79, enterprise: 149 },
      recommendedFor: ['all'],
    },
    {
      id: 'fleet',
      name: 'Fleet Management',
      desc: 'Drivers, trucks, trailers, dispatch, and maintenance tracking.',
      tiers: { basic: 39, pro: 99, enterprise: 199 },
      recommendedFor: ['all'],
    },
    {
      id: 'compliance',
      name: 'Compliance Engine',
      desc: 'FMCSA, DOT, IFTA, IRP, MCS-150 — automated 50-state coverage.',
      tiers: { basic: 49, pro: 119, enterprise: 229 },
      recommendedFor: ['all'],
    },
    {
      id: 'ifta',
      name: 'IFTA Reporting',
      desc: 'Quarterly IFTA calculations with state-by-state mileage and fuel.',
      tiers: { basic: 19, pro: 49, enterprise: 99 },
      recommendedFor: ['daycab','sleeper','flatbed','reefer','tanker','dump','hotshot','box','autohaul'],
    },
    {
      id: 'payroll',
      name: 'Payroll & HR',
      desc: 'Driver pay (per mile, %, flat), settlements, 1099s, W-2s.',
      tiers: { basic: 29, pro: 79, enterprise: 149 },
      recommendedFor: ['all'],
    },
    {
      id: 'onboarding',
      name: 'Driver Onboarding',
      desc: 'DQ files, drug & alcohol clearinghouse, MVRs, contract e-sign.',
      tiers: { basic: 19, pro: 59, enterprise: 119 },
      recommendedFor: ['all'],
    },
    {
      id: 'hazmat',
      name: 'Hazmat Compliance',
      desc: 'Hazmat manifest generation, placarding rules, route restrictions.',
      tiers: { basic: 39, pro: 89, enterprise: 169 },
      recommendedFor: ['tanker'],
    },
    {
      id: 'temp',
      name: 'Temperature Logs',
      desc: 'Reefer audit trail, temp alerts, FSMA-ready cold chain records.',
      tiers: { basic: 25, pro: 65, enterprise: 119 },
      recommendedFor: ['reefer'],
    },
    {
      id: 'securement',
      name: 'Load Securement Logs',
      desc: 'Chains, straps, photos — proof-of-securement for every flat load.',
      tiers: { basic: 19, pro: 49, enterprise: 99 },
      recommendedFor: ['flatbed','autohaul'],
    },
    {
      id: 'shipment',
      name: 'Digital Shipment Mgmt',
      desc: 'eBOL, POD capture, customer portal, detention tracking.',
      tiers: { basic: 29, pro: 79, enterprise: 149 },
      recommendedFor: ['all'],
    },
  ];

  const TIERS = ['basic','pro','enterprise'];
  const TIER_LABELS = { basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise' };

  /* -------------------- STATE -------------------- */

  const state = window.gigaBuild = {
    step: 1,

    // Step 2
    fullName: '',
    companyName: '',

    // Step 3
    freightType: null,

    // Step 4
    paymentMethod: null,
    ratePerMile: '',
    percentage: '',
    pctBase: null,
    flatRate: '',

    // Step 5
    avgMpg: '',
    weeklyFixed: '',

    // Step 6
    fleetSize: 1,
    homeState: 'TX',
    vehicleClass: 'DOT Required',
    driverCount: 1,

    // Step 7
    modules: {}, // id -> { enabled, tier }

    // Step 8
    billing: 'monthly',
  };

  const TOTAL_STEPS = 9;
  const VISIBLE_PROGRESS_STEPS = 7; // steps 2..8 count as "Step 1..7 of 7"

  /* -------------------- HELPERS -------------------- */

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const money = (n) => {
    const safe = Number.isFinite(n) ? n : 0;
    return '$' + safe.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  /* -------------------- NAVIGATION -------------------- */

  function show(stepNum) {
    state.step = stepNum;
    $$('.step').forEach((el) => {
      const n = Number(el.dataset.step);
      el.classList.toggle('active', n === stepNum);
    });

    // Header + progress only show for steps 2..8
    const showChrome = stepNum >= 2 && stepNum <= 8;
    $('#appHeader').hidden = !showChrome;
    $('#progressWrap').hidden = !showChrome;

    if (showChrome) {
      const sec = $(`.step[data-step="${stepNum}"]`);
      const num = Number(sec.dataset.stepNum);
      $('#stepIndicator').textContent = `Step ${num} of ${VISIBLE_PROGRESS_STEPS}`;
      $('#stepName').textContent = sec.dataset.stepLabel || '';
      $('#progressFill').style.width = `${(num / VISIBLE_PROGRESS_STEPS) * 100}%`;
    }

    // Sticky price bar only on modules step
    const sticky = $('#modulePriceBar');
    if (sticky) sticky.classList.toggle('visible', stepNum === 7);

    // Re-render anything step-specific
    if (stepNum === 7) renderModules();
    if (stepNum === 8) renderReview();
    if (stepNum === 9) renderDashboard();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function canAdvance(fromStep) {
    switch (fromStep) {
      case 2: return state.fullName.trim().length > 0;
      case 3: return !!state.freightType;
      case 4: {
        if (!state.paymentMethod) return false;
        if (state.paymentMethod === 'percentage' && !state.pctBase) return false;
        return true;
      }
      case 7: return Object.values(state.modules).some((m) => m.enabled);
      default: return true;
    }
  }

  function updateNextEnabled() {
    const map = {
      2: $('#step2Next'),
      3: $('#step3Next'),
      4: $('#step4Next'),
      7: $('#step7Next'),
    };
    Object.entries(map).forEach(([s, btn]) => {
      if (!btn) return;
      btn.disabled = !canAdvance(Number(s));
    });
  }

  function next() {
    if (!canAdvance(state.step)) return;
    if (state.step < TOTAL_STEPS) show(state.step + 1);
  }
  function back() {
    if (state.step > 1) show(state.step - 1);
  }

  /* -------------------- STEP 3: FREIGHT GRID -------------------- */

  function renderFreightGrid() {
    const grid = $('#freightGrid');
    grid.innerHTML = FREIGHT_TYPES.map((f) => `
      <button type="button" class="freight-card" data-freight="${f.id}">
        <span class="fc-icon">${FREIGHT_ICONS[f.id] || ''}</span>
        <span class="fc-name">${f.name}</span>
        <span class="fc-check">✓</span>
      </button>
    `).join('');

    $$('.freight-card', grid).forEach((card) => {
      card.addEventListener('click', () => {
        state.freightType = card.dataset.freight;
        $$('.freight-card', grid).forEach((c) => c.classList.toggle('active', c === card));
        // Pre-toggle recommended modules on first freight selection so users
        // see a sensible starter stack on Step 7.
        seedRecommendedModules();
        updateNextEnabled();
      });
    });
  }

  /* -------------------- STEP 4: PAYMENT -------------------- */

  function renderPaymentList() {
    const list = $('#payList');
    list.innerHTML = PAYMENT_METHODS.map((p) => `
      <button type="button" class="pay-card" data-pay="${p.id}">
        <span class="pc-icon">${p.icon}</span>
        <span class="pc-text">
          <span class="pc-title">${p.title}</span>
          <span class="pc-desc">${p.desc}</span>
        </span>
      </button>
    `).join('');

    $$('.pay-card', list).forEach((card) => {
      card.addEventListener('click', () => {
        state.paymentMethod = card.dataset.pay;
        $$('.pay-card', list).forEach((c) => c.classList.toggle('active', c === card));
        renderPctBase();
        toggleConditionals();
        updateNextEnabled();
      });
    });

    renderPctBase();
  }

  function renderPctBase() {
    const list = $('#pctBaseList');
    list.innerHTML = PCT_BASES.map((b) => `
      <button type="button" class="pct-base-option ${state.pctBase === b.id ? 'active' : ''}" data-base="${b.id}">
        <div class="pbo-title">${b.title}</div>
        <div class="pbo-desc">${b.desc}</div>
      </button>
    `).join('');

    $$('.pct-base-option', list).forEach((opt) => {
      opt.addEventListener('click', () => {
        state.pctBase = opt.dataset.base;
        $$('.pct-base-option', list).forEach((o) => o.classList.toggle('active', o === opt));
        updateNextEnabled();
      });
    });
  }

  function toggleConditionals() {
    $('#condPerMile').hidden    = state.paymentMethod !== 'permile';
    $('#condPercentage').hidden = state.paymentMethod !== 'percentage';
    $('#condFlat').hidden       = state.paymentMethod !== 'flat';
  }

  /* -------------------- STEP 6: FLEET -------------------- */

  function renderHomeStateDropdown() {
    const select = $('#homeState');
    select.innerHTML = US_STATES.map((s) => `<option value="${s}" ${s === state.homeState ? 'selected' : ''}>${s}</option>`).join('');
    select.addEventListener('change', () => { state.homeState = select.value; });
  }

  function renderVehicleClass() {
    const list = $('#vehicleClassList');
    list.innerHTML = VEHICLE_CLASSES.map((v) => `
      <button type="button" class="seg ${state.vehicleClass === v ? 'active' : ''}" data-vc="${v}">${v}</button>
    `).join('');
    $$('.seg', list).forEach((btn) => {
      btn.addEventListener('click', () => {
        state.vehicleClass = btn.dataset.vc;
        $$('.seg', list).forEach((b) => b.classList.toggle('active', b === btn));
      });
    });
  }

  function wireFleetInputs() {
    const slider = $('#fleetSize');
    const read = $('#fleetSizeRead');
    slider.value = state.fleetSize;
    read.textContent = state.fleetSize;
    slider.addEventListener('input', () => {
      state.fleetSize = Number(slider.value);
      read.textContent = state.fleetSize;
    });

    const driverInput = $('#driverCount');
    driverInput.value = state.driverCount;
    driverInput.addEventListener('input', () => {
      const v = Number(driverInput.value);
      state.driverCount = Number.isFinite(v) && v >= 0 ? v : 0;
    });
  }

  /* -------------------- STEP 7: MODULES -------------------- */

  function eligibleModules() {
    const ft = state.freightType;
    return MODULES.filter((m) =>
      m.recommendedFor.includes('all') || m.recommendedFor.includes(ft) || isExplicitlySelected(m.id)
    );
  }

  function isExplicitlySelected(id) {
    return !!(state.modules[id] && state.modules[id].enabled);
  }

  function seedRecommendedModules() {
    // Only seed if user hasn't touched modules yet
    if (Object.keys(state.modules).length > 0) return;
    ['gigabooks','compliance','fleet'].forEach((id) => {
      state.modules[id] = { enabled: true, tier: 'basic' };
    });
  }

  function renderModules() {
    const list = $('#modulesList');
    const mods = eligibleModules();

    list.innerHTML = mods.map((m) => {
      const sel = state.modules[m.id] || { enabled: false, tier: 'basic' };
      const isRecommended = m.recommendedFor.includes(state.freightType) && !m.recommendedFor.includes('all');
      return `
        <div class="module-card ${sel.enabled ? 'active' : ''}" data-mod="${m.id}">
          <div class="module-head">
            <div class="module-head-text">
              <div class="module-name">
                ${m.name}
                ${isRecommended ? '<span class="module-badge">Recommended</span>' : ''}
              </div>
              <p class="module-desc">${m.desc}</p>
            </div>
            <button type="button" class="module-toggle" data-toggle="${m.id}" aria-label="Toggle ${m.name}"></button>
          </div>
          <div class="tier-row">
            ${TIERS.map((t) => `
              <button type="button" class="tier-btn ${sel.tier === t ? 'active' : ''}" data-tier="${t}" data-mod="${m.id}">
                <span class="tier-name">${TIER_LABELS[t]}</span>
                <span class="tier-price">${money(m.tiers[t])}/mo</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    $$('.module-toggle', list).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.toggle;
        const cur = state.modules[id] || { enabled: false, tier: 'basic' };
        state.modules[id] = { enabled: !cur.enabled, tier: cur.tier };
        renderModules();
        updatePriceBar();
        updateNextEnabled();
      });
    });

    $$('.tier-btn', list).forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.mod;
        const tier = btn.dataset.tier;
        state.modules[id] = { enabled: true, tier };
        renderModules();
        updatePriceBar();
        updateNextEnabled();
      });
    });

    updatePriceBar();
  }

  function selectedModulesList() {
    return MODULES.filter((m) => state.modules[m.id] && state.modules[m.id].enabled)
      .map((m) => ({ ...m, tier: state.modules[m.id].tier, price: m.tiers[state.modules[m.id].tier] }));
  }

  function monthlyTotal() {
    return selectedModulesList().reduce((sum, m) => sum + m.price, 0);
  }

  function updatePriceBar() {
    $('#modulePriceMonthly').textContent = money(monthlyTotal());
  }

  /* -------------------- STEP 8: REVIEW -------------------- */

  function paymentSummary() {
    if (!state.paymentMethod) return '—';
    if (state.paymentMethod === 'permile') {
      return state.ratePerMile ? `Per Mile — $${state.ratePerMile}/mi` : 'Per Mile';
    }
    if (state.paymentMethod === 'percentage') {
      const base = PCT_BASES.find((b) => b.id === state.pctBase);
      const baseLabel = base ? ` of ${base.title}` : '';
      return state.percentage ? `${state.percentage}%${baseLabel}` : `Percentage${baseLabel}`;
    }
    if (state.paymentMethod === 'flat') {
      return state.flatRate ? `Flat Rate — $${state.flatRate}/load` : 'Flat Rate';
    }
    return '—';
  }

  function freightLabel() {
    const f = FREIGHT_TYPES.find((x) => x.id === state.freightType);
    return f ? f.name : '—';
  }

  function renderReview() {
    const card = $('#reviewSummary');
    const mods = selectedModulesList();
    const nameLine = state.fullName + (state.companyName ? ` · ${state.companyName}` : '');

    card.innerHTML = `
      <div class="review-block">
        <div class="review-label">Account</div>
        <div class="review-value">${nameLine || '—'}</div>
      </div>
      <div class="review-block">
        <div class="review-label">Freight type</div>
        <div class="review-value">${freightLabel()}</div>
      </div>
      <div class="review-block">
        <div class="review-label">How you're paid</div>
        <div class="review-value">${paymentSummary()}</div>
      </div>
      <div class="review-block">
        <div class="review-label">Fleet</div>
        <div class="review-value">${state.fleetSize} truck${state.fleetSize === 1 ? '' : 's'} · ${state.driverCount} driver${state.driverCount === 1 ? '' : 's'} · ${state.homeState} · ${state.vehicleClass}</div>
      </div>
      <div class="review-block">
        <div class="review-label">Modules (${mods.length})</div>
        <div class="review-modules">
          ${mods.length === 0
            ? '<div class="review-value">No modules selected</div>'
            : mods.map((m) => `
              <div class="review-module-row">
                <span>${m.name}</span>
                <span><span class="rm-tier">${TIER_LABELS[m.tier]}</span> &nbsp; ${money(m.price)}/mo</span>
              </div>
            `).join('')}
        </div>
      </div>
    `;

    updatePriceDisplay();
  }

  function updatePriceDisplay() {
    const monthly = monthlyTotal();
    const annual = Math.round(monthly * 12 * 0.85);
    const annualPerMonth = Math.round(annual / 12);

    if (state.billing === 'monthly') {
      $('#priceLabel').textContent = 'Total per month';
      $('#priceAmount').textContent = money(monthly);
      $('#priceNote').textContent = monthly > 0 ? `${money(monthly * 12)} per year` : '';
    } else {
      $('#priceLabel').textContent = 'Per month, billed annually';
      $('#priceAmount').textContent = money(annualPerMonth);
      $('#priceNote').textContent = `${money(annual)} billed once a year — save 15%`;
    }
  }

  function wireBillingToggle() {
    $$('.bt-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.billing = btn.dataset.billing;
        $$('.bt-option').forEach((b) => b.classList.toggle('active', b === btn));
        updatePriceDisplay();
      });
    });
  }

  /* -------------------- STEP 9: DASHBOARD -------------------- */

  function renderDashboard() {
    const greeting = $('#dashGreeting');
    const sub = $('#dashSub');
    const firstName = (state.fullName || '').trim().split(/\s+/)[0];

    greeting.textContent = firstName ? `Hey, ${firstName}` : 'Dashboard';
    const companyBit = state.companyName ? ` at ${state.companyName}` : '';
    sub.textContent = `Welcome to your sandbox${companyBit}.`;

    const pills = $('#modulesActive');
    const mods = selectedModulesList();
    pills.innerHTML = mods.length
      ? mods.map((m) => `<span class="ma-pill">${m.name} · ${TIER_LABELS[m.tier]}</span>`).join('')
      : '';
  }

  /* -------------------- GENERIC INPUT BINDING -------------------- */

  function bindTextInputs() {
    const bindings = [
      ['fullName',    (v) => { state.fullName    = v; updateNextEnabled(); }],
      ['companyName', (v) => { state.companyName = v; }],
      ['ratePerMile', (v) => { state.ratePerMile = v; }],
      ['percentage',  (v) => { state.percentage  = v; }],
      ['flatRate',    (v) => { state.flatRate    = v; }],
      ['avgMpg',      (v) => { state.avgMpg      = v; }],
      ['weeklyFixed', (v) => { state.weeklyFixed = v; }],
    ];
    bindings.forEach(([id, setter]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => setter(el.value));
    });
  }

  function wireNav() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-nav]');
      if (!btn) return;
      const dir = btn.dataset.nav;
      if (dir === 'next') next();
      if (dir === 'back') back();
    });
  }

  function wireRestart() {
    const btn = $('#dashRestart');
    if (!btn) return;
    btn.addEventListener('click', () => {
      Object.assign(state, {
        step: 1,
        fullName: '', companyName: '',
        freightType: null,
        paymentMethod: null, ratePerMile: '', percentage: '', pctBase: null, flatRate: '',
        avgMpg: '', weeklyFixed: '',
        fleetSize: 1, homeState: 'TX', vehicleClass: 'DOT Required', driverCount: 1,
        modules: {},
        billing: 'monthly',
      });

      $$('input[type="text"], input[type="number"], input[type="email"]').forEach((i) => { i.value = ''; });
      $('#fleetSize').value = 1;
      $('#fleetSizeRead').textContent = '1';
      $('#driverCount').value = 1;
      $('#homeState').value = 'TX';

      $$('.freight-card, .pay-card, .pct-base-option, .tier-btn').forEach((el) => el.classList.remove('active'));
      $$('#vehicleClassList .seg').forEach((b) => b.classList.toggle('active', b.dataset.vc === 'DOT Required'));
      $$('.bt-option').forEach((b, i) => b.classList.toggle('active', i === 0));

      $('#condPerMile').hidden = true;
      $('#condPercentage').hidden = true;
      $('#condFlat').hidden = true;

      updateNextEnabled();
      show(1);
    });
  }

  /* -------------------- INIT -------------------- */

  function init() {
    renderFreightGrid();
    renderPaymentList();
    renderHomeStateDropdown();
    renderVehicleClass();
    wireFleetInputs();
    wireBillingToggle();
    bindTextInputs();
    wireNav();
    wireRestart();

    toggleConditionals();
    updateNextEnabled();
    show(1);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
