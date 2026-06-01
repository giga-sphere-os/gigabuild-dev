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
      code: 'GSO-MOD-BOOKS',
      name: 'GigaBooks',
      desc: 'Bookkeeping, tax filing, and IRS-ready reports for trucking operators.',
      status: 'live',
      tiers: { basic: 29, pro: 79, enterprise: 149 },
      recommendedFor: ['all'],
    },
    {
      id: 'fleet',
      code: 'GSO-MOD-FLEET',
      name: 'Fleet Management',
      desc: 'Drivers, trucks, trailers, dispatch, and maintenance tracking.',
      status: 'live',
      tiers: { basic: 39, pro: 99, enterprise: 199 },
      recommendedFor: ['all'],
    },
    {
      id: 'compliance',
      code: 'GSO-MOD-COMP',
      name: 'Compliance Engine',
      desc: 'FMCSA/DOT tracking, renewal workflows, document proof, and WORM evidence records.',
      status: 'live',
      tiers: { basic: 49, pro: 119, enterprise: 229 },
      recommendedFor: ['all'],
    },
    {
      id: 'compliance_calendar',
      code: 'GSO-MOD-CAL',
      name: 'Compliance Calendar',
      desc: 'DOT, FMCSA, permits, filings, renewals, and due dates in one audit-ready calendar.',
      status: 'live',
      tiers: { basic: 19, pro: 49, enterprise: 99 },
      recommendedFor: ['all'],
    },
    {
      id: 'dynamic_reminder_calendar',
      code: 'GSO-MOD-REM',
      name: 'Dynamic Reminder Calendar',
      desc: 'Automated reminders that surface upcoming, overdue, and high-risk compliance work.',
      status: 'live',
      tiers: { basic: 19, pro: 49, enterprise: 99 },
      recommendedFor: ['all'],
    },
    {
      id: 'document_vault',
      code: 'GSO-MOD-VAULT',
      name: 'Document Vault',
      desc: 'Centralized document storage for registrations, permits, driver files, and audit packets.',
      status: 'live',
      tiers: { basic: 19, pro: 49, enterprise: 99 },
      recommendedFor: ['all'],
    },
    {
      id: 'invoice_capture',
      code: 'GSO-MOD-INVCAP',
      name: 'Invoice Capture',
      desc: 'Capture invoices, receipts, and expense proof into the customer workspace.',
      status: 'live',
      tiers: { basic: 19, pro: 49, enterprise: 99 },
      recommendedFor: ['all'],
    },
    {
      id: 'ifta',
      code: 'GSO-MOD-IFTA',
      name: 'IFTA Reporting',
      desc: 'Quarterly IFTA calculations with state-by-state mileage and fuel.',
      status: 'comingSoon',
      tiers: { basic: 19, pro: 49, enterprise: 99 },
      recommendedFor: ['daycab','sleeper','flatbed','reefer','tanker','dump','hotshot','box','autohaul'],
    },
    {
      id: 'payroll',
      code: 'GSO-MOD-PAYHR',
      name: 'Payroll & HR',
      desc: 'Driver pay (per mile, %, flat), settlements, 1099s, W-2s.',
      status: 'comingSoon',
      tiers: { basic: 29, pro: 79, enterprise: 149 },
      recommendedFor: ['all'],
    },
    {
      id: 'onboarding',
      code: 'GSO-MOD-DRVONB',
      name: 'Driver Onboarding',
      desc: 'DQ files, drug & alcohol clearinghouse, MVRs, contract e-sign.',
      status: 'comingSoon',
      tiers: { basic: 19, pro: 59, enterprise: 119 },
      recommendedFor: ['all'],
    },
    {
      id: 'repair_work_orders',
      code: 'GSO-MOD-REPAIR',
      name: 'Repair Work Orders',
      desc: 'Repair tickets, service status, safety-critical flags, authorization, and closeout tracking.',
      status: 'live',
      tiers: { basic: 29, pro: 79, enterprise: 149 },
      recommendedFor: ['all'],
    },
    {
      id: 'inventory_center',
      code: 'GSO-MOD-INVCTR',
      name: 'Inventory Center',
      desc: 'Parts, tires, reorder points, vendor inventory, and fleet maintenance stock controls.',
      status: 'live',
      tiers: { basic: 29, pro: 79, enterprise: 149 },
      recommendedFor: ['all'],
    },
    {
      id: 'warranty_tracking',
      code: 'GSO-MOD-WARR',
      name: 'Warranty Tracking',
      desc: 'Warranty windows tied to repairs, parts, invoices, vendors, and renewal reminders.',
      status: 'live',
      tiers: { basic: 19, pro: 49, enterprise: 99 },
      recommendedFor: ['all'],
    },
    {
      id: 'vendor_directory',
      code: 'GSO-MOD-VENDOR',
      name: 'Vendor Directory',
      desc: 'Approved shops, vendors, contacts, warranty providers, and service history.',
      status: 'comingSoon',
      tiers: { basic: 19, pro: 49, enterprise: 99 },
      recommendedFor: ['all'],
    },
    {
      id: 'reporting_dashboard',
      code: 'GSO-MOD-RPT',
      name: 'Reporting Dashboard',
      desc: 'Operational and compliance reporting for owners who need fast oversight.',
      status: 'live',
      tiers: { basic: 29, pro: 79, enterprise: 149 },
      recommendedFor: ['all'],
    },
    {
      id: 'driver_assistant',
      code: 'GSO-MOD-DRVAI',
      name: 'Driver Assistant',
      desc: 'Driver-facing assistant for compliance tasks, document requests, and operational guidance.',
      status: 'live',
      tiers: { basic: 49, pro: 119, enterprise: 229 },
      recommendedFor: ['all'],
    },
    {
      id: 'driver_updates',
      code: 'GSO-MOD-DRVUPD',
      name: 'Driver Updates / Newsletter',
      desc: 'Tenant-ready driver update stream for compliance reminders, operating notices, and newsletters.',
      status: 'comingSoon',
      tiers: { basic: 29, pro: 79, enterprise: 149 },
      recommendedFor: ['all'],
    },
    {
      id: 'route_readiness',
      code: 'GSO-MOD-ROUTE',
      name: 'Route Compliance Readiness',
      desc: 'Route-aware compliance checks for permits, inspections, roadside readiness, and audit exposure.',
      status: 'comingSoon',
      tiers: { basic: 49, pro: 119, enterprise: 229 },
      recommendedFor: ['hazmat','tanker','reefer','flatbed','autohaul','daycab','sleeper'],
    },
    {
      id: 'onboarding_progress',
      code: 'GSO-MOD-ONBSTAT',
      name: 'Client Onboarding Progress Link',
      desc: 'Shareable onboarding status view for customers, admins, counsel, and stakeholders.',
      status: 'live',
      tiers: { basic: 29, pro: 79, enterprise: 149 },
      recommendedFor: ['all'],
    },
    {
      id: 'hazmat',
      code: 'GSO-MOD-HAZ',
      name: 'Hazmat Compliance',
      desc: 'Hazmat manifest generation, placarding rules, route restrictions.',
      status: 'comingSoon',
      tiers: { basic: 39, pro: 89, enterprise: 169 },
      recommendedFor: ['tanker'],
    },
    {
      id: 'temp',
      code: 'GSO-MOD-TEMP',
      name: 'Temperature Logs',
      desc: 'Reefer audit trail, temp alerts, FSMA-ready cold chain records.',
      status: 'comingSoon',
      tiers: { basic: 25, pro: 65, enterprise: 119 },
      recommendedFor: ['reefer'],
    },
    {
      id: 'securement',
      code: 'GSO-MOD-SECURE',
      name: 'Load Securement Logs',
      desc: 'Chains, straps, photos — proof-of-securement for every flat load.',
      status: 'comingSoon',
      tiers: { basic: 19, pro: 49, enterprise: 99 },
      recommendedFor: ['flatbed','autohaul'],
    },
    {
      id: 'shipment',
      code: 'GSO-MOD-SHIP',
      name: 'Digital Shipment Mgmt',
      desc: 'eBOL, POD capture, customer portal, detention tracking.',
      status: 'comingSoon',
      tiers: { basic: 29, pro: 79, enterprise: 149 },
      recommendedFor: ['all'],
    },
  ];

  const TIERS = ['basic','pro','enterprise'];
  const TIER_LABELS = { basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise' };
  const LAUNCH_PLANS = {
    operator: { code: 'GSO-PLAN-OL', name: 'Operator Launch', base: 199, included: 1, extra: 29 },
    fleet: { code: 'GSO-PLAN-FP', name: 'Fleet Pro', base: 499, included: 5, extra: 49 },
    command: { code: 'GSO-PLAN-CC', name: 'Compliance Command', base: 1250, included: 10, extra: 79 },
  };
  const STORAGE_KEY = 'gigaBuildConfiguration';
  const DRAFT_KEY = 'gigaBuildDraft';
  const LANG_STORAGE_KEY = 'gigasphere.lang';
  const SUPPORTED_LANGS = new Set(['en', 'es-MX', 'zh-CN', 'tl', 'vi', 'ar', 'hi']);
  const SALES_EMAIL = 'armando@gigasphere.io';
  const WALKTHROUGH_URL = 'https://scheduler.zoom.us/armando-galvan-holbrook/product-walkthrough-giga-sphere-os';
  const NATIVE_TEST_PARAM = 'native-app';

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

    // Checkout
    domain: '',
    termsAccepted: false,
  };

  const TOTAL_STEPS = 9;
  const VISIBLE_PROGRESS_STEPS = 7; // steps 2..8 count as "Step 1..7 of 7"

  /* -------------------- HELPERS -------------------- */

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  let autosaveTimer = 0;
  let draftLoaded = false;

  const money = (n) => {
    const safe = Number.isFinite(n) ? n : 0;
    return '$' + safe.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const todayLabel = () => new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  function isNativeApp() {
    const cap = window.Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
    try {
      return new URLSearchParams(window.location.search).has(NATIVE_TEST_PARAM);
    } catch (_) {
      return false;
    }
  }

  function applyRuntimeMode() {
    const native = isNativeApp();
    document.body.classList.toggle('gb-native', native);
    $$('[data-web-commerce-only]').forEach((el) => { el.hidden = native; });
    $$('[data-native-commerce-note]').forEach((el) => { el.hidden = !native; });
  }

  function activationId() {
    const source = `${state.fullName}|${state.companyName}|${state.freightType}|${monthlyTotal()}|${selectedModulesList().map((m) => m.id + m.tier).join('-')}`;
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = ((hash << 5) - hash) + source.charCodeAt(i);
      hash |= 0;
    }
    return `GB-${Math.abs(hash).toString(36).toUpperCase().slice(0, 6)}`;
  }

  function savedState() {
    return {
      step: state.step,
      fullName: state.fullName,
      companyName: state.companyName,
      freightType: state.freightType,
      paymentMethod: state.paymentMethod,
      ratePerMile: state.ratePerMile,
      percentage: state.percentage,
      pctBase: state.pctBase,
      flatRate: state.flatRate,
      avgMpg: state.avgMpg,
      weeklyFixed: state.weeklyFixed,
      fleetSize: state.fleetSize,
      homeState: state.homeState,
      vehicleClass: state.vehicleClass,
      driverCount: state.driverCount,
      modules: { ...state.modules },
      billing: state.billing,
      domain: state.domain,
      termsAccepted: state.termsAccepted,
    };
  }

  function hasMeaningfulDraft(snapshot = state) {
    return Boolean(
      snapshot.step > 1 ||
      snapshot.fullName ||
      snapshot.companyName ||
      snapshot.freightType ||
      snapshot.paymentMethod ||
      Object.keys(snapshot.modules || {}).length ||
      snapshot.domain
    );
  }

  function saveDraft() {
    if (!hasMeaningfulDraft()) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        version: 2,
        savedAt: new Date().toISOString(),
        state: savedState(),
      }));
    } catch (_) {}
  }

  function scheduleDraftSave() {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(saveDraft, 120);
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
  }

  function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
  }

  function syncDomFromState() {
    setInputValue('fullName', state.fullName);
    setInputValue('companyName', state.companyName);
    setInputValue('ratePerMile', state.ratePerMile);
    setInputValue('percentage', state.percentage);
    setInputValue('flatRate', state.flatRate);
    setInputValue('avgMpg', state.avgMpg);
    setInputValue('weeklyFixed', state.weeklyFixed);
    setInputValue('customDomain', state.domain);

    const fleet = $('#fleetSize');
    const fleetRead = $('#fleetSizeRead');
    if (fleet) fleet.value = state.fleetSize;
    if (fleetRead) fleetRead.textContent = String(state.fleetSize);
    setInputValue('driverCount', state.driverCount);
    const home = $('#homeState');
    if (home) home.value = state.homeState;
    const terms = $('#termsAccepted');
    if (terms) terms.checked = !!state.termsAccepted;

    $$('.freight-card').forEach((el) => el.classList.toggle('active', el.dataset.freight === state.freightType));
    $$('.pay-card').forEach((el) => el.classList.toggle('active', el.dataset.pay === state.paymentMethod));
    $$('.pct-base-option').forEach((el) => el.classList.toggle('active', el.dataset.base === state.pctBase));
    $$('#vehicleClassList .seg').forEach((el) => el.classList.toggle('active', el.dataset.vc === state.vehicleClass));
    $$('.bt-option').forEach((el) => el.classList.toggle('active', el.dataset.billing === state.billing));
    toggleConditionals();
    updateNextEnabled();
  }

  function maybeOfferResume() {
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) {}
    if (!draft?.state || !hasMeaningfulDraft(draft.state)) return;

    const banner = $('#resumeBanner');
    if (!banner) return;
    const savedAt = draft.savedAt ? new Date(draft.savedAt) : null;
    const meta = $('#resumeMeta');
    if (meta && savedAt && !Number.isNaN(savedAt.getTime())) {
      meta.textContent = `Last saved ${savedAt.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`;
    }
    banner.hidden = false;

    $('#resumeDraft')?.addEventListener('click', () => {
      Object.assign(state, draft.state, {
        modules: { ...(draft.state.modules || {}) },
        step: Math.max(1, Math.min(TOTAL_STEPS, Number(draft.state.step || 1))),
      });
      draftLoaded = true;
      banner.hidden = true;
      syncDomFromState();
      show(state.step);
    }, { once: true });

    $('#discardDraft')?.addEventListener('click', () => {
      clearDraft();
      banner.hidden = true;
    }, { once: true });
  }

  /* -------------------- NAVIGATION -------------------- */

  function show(stepNum) {
    state.step = stepNum;
    document.body.classList.toggle('gb-form-step', stepNum > 1 && stepNum < 9);
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

    if (draftLoaded || stepNum > 1) scheduleDraftSave();
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
      case 7: return selectedModulesList().length > 0;
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
    if (state.step === 8) {
      show(9);
      persistConfiguration();
      return;
    }
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
        scheduleDraftSave();
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
        scheduleDraftSave();
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
        scheduleDraftSave();
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
    select.addEventListener('change', () => {
      state.homeState = select.value;
      scheduleDraftSave();
    });
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
        scheduleDraftSave();
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
      scheduleDraftSave();
    });

    const driverInput = $('#driverCount');
    driverInput.value = state.driverCount;
    driverInput.addEventListener('input', () => {
      const v = Number(driverInput.value);
      state.driverCount = Number.isFinite(v) && v >= 0 ? v : 0;
      scheduleDraftSave();
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
      const isLive = m.status === 'live';
      return `
        <div class="module-card ${sel.enabled && isLive ? 'active' : ''} ${!isLive ? 'coming-soon' : ''}" data-mod="${m.id}">
          ${!isLive ? '<div class="module-coming-banner">Coming soon</div>' : ''}
          <div class="module-head">
            <div class="module-head-text">
              <div class="module-name">
                ${m.name}
                ${isRecommended ? '<span class="module-badge">Recommended</span>' : ''}
              </div>
              <p class="module-desc">${m.desc}</p>
            </div>
            <button type="button" class="module-toggle" data-toggle="${m.id}" aria-label="Toggle ${m.name}" ${!isLive ? 'disabled aria-disabled="true"' : ''}></button>
          </div>
          <div class="tier-row">
            ${TIERS.map((t) => `
              <button type="button" class="tier-btn ${sel.tier === t && isLive ? 'active' : ''}" data-tier="${t}" data-mod="${m.id}" ${!isLive ? 'disabled aria-disabled="true"' : ''}>
                <span class="tier-name">${TIER_LABELS[t]}</span>
                <span class="tier-price">${isLive ? 'Included' : 'Coming soon'}</span>
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
        const mod = MODULES.find((m) => m.id === id);
        if (!mod || mod.status !== 'live') return;
        const cur = state.modules[id] || { enabled: false, tier: 'basic' };
        state.modules[id] = { enabled: !cur.enabled, tier: cur.tier };
        renderModules();
        updatePriceBar();
        updateNextEnabled();
        scheduleDraftSave();
      });
    });

    $$('.tier-btn', list).forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.mod;
        const mod = MODULES.find((m) => m.id === id);
        if (!mod || mod.status !== 'live') return;
        const tier = btn.dataset.tier;
        state.modules[id] = { enabled: true, tier };
        renderModules();
        updatePriceBar();
        updateNextEnabled();
        scheduleDraftSave();
      });
    });

    updatePriceBar();
  }

  function selectedModulesList() {
    return MODULES.filter((m) => state.modules[m.id] && state.modules[m.id].enabled)
      .filter((m) => m.status === 'live')
      .map((m) => ({ ...m, tier: state.modules[m.id].tier, price: m.tiers[state.modules[m.id].tier] }));
  }

  function launchPlan() {
    const mods = selectedModulesList();
    const highRiskModules = new Set([
      'compliance',
      'hazmat',
      'temp',
      'securement',
      'shipment',
      'repair_work_orders',
      'inventory_center',
      'warranty_tracking',
      'reporting_dashboard',
      'driver_assistant',
      'driver_updates',
      'route_readiness',
      'onboarding_progress',
    ]);
    const highRiskCount = mods.filter((m) => highRiskModules.has(m.id)).length;
    if (state.fleetSize >= 10 || mods.length >= 6 || highRiskCount >= 3) return LAUNCH_PLANS.command;
    if (state.fleetSize >= 3 || mods.length >= 3 || highRiskCount >= 2) return LAUNCH_PLANS.fleet;
    return LAUNCH_PLANS.operator;
  }

  function monthlyTotal() {
    const plan = launchPlan();
    return plan.base + Math.max(0, Number(state.fleetSize || 1) - plan.included) * plan.extra;
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

  function billingSummary() {
    if (state.billing === 'annual') {
      const annual = Math.round(monthlyTotal() * 12 * 0.85);
      return `Annual (${money(annual)} billed yearly)`;
    }
    return 'Monthly';
  }

  function configurationPacketText() {
    const mods = selectedModulesList();
    const lines = [
      'GigaBuild Activation Packet',
      `Activation ID: ${activationId()}`,
      `Generated: ${todayLabel()}`,
      '',
      `Name: ${state.fullName || 'Not provided'}`,
      `Company: ${state.companyName || 'Not provided'}`,
      `Freight Type: ${freightLabel()}`,
      `Payment Model: ${paymentSummary()}`,
      `Fleet: ${state.fleetSize} truck${state.fleetSize === 1 ? '' : 's'} | ${state.driverCount} driver${state.driverCount === 1 ? '' : 's'} | ${state.homeState} | ${state.vehicleClass}`,
      `Average MPG: ${state.avgMpg || 'Not provided'}`,
      `Weekly Fixed Costs: ${state.weeklyFixed ? '$' + state.weeklyFixed : 'Not provided'}`,
      `Billing Preference: ${billingSummary()}`,
      `Launch Plan: ${launchPlan().name}`,
      `Launch Plan Code: ${launchPlan().code}`,
      `Configured Monthly Stack: ${money(monthlyTotal())}/mo`,
      `Requested Domain: ${state.domain || 'Not provided'}`,
      'Refund Terms: 30-day money-back guarantee applies to subscription fees. Domain registration and custom build work are non-refundable once started.',
      '',
      'Selected Modules:',
      ...mods.map((m) => `- ${m.name}: ${TIER_LABELS[m.tier]}`),
      '',
      'Requested next step:',
      'Convert this configuration into an active Giga-Sphere OS workspace and walkthrough plan.',
    ];
    return lines.join('\n');
  }

  function persistConfiguration() {
    try {
      const record = {
        savedAt: new Date().toISOString(),
        activationId: activationId(),
        state: { ...state },
        packet: configurationPacketText(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 2, savedAt: record.savedAt, state: savedState() }));
    } catch (_) {
      // localStorage can be unavailable in strict privacy modes; the packet still renders.
    }
  }

  function renderReview() {
    const card = $('#reviewSummary');
    const mods = selectedModulesList();
    const nameLine = state.fullName + (state.companyName ? ` · ${state.companyName}` : '');

    card.replaceChildren();

    const addBlock = (label, value) => {
      const block = document.createElement('div');
      block.className = 'review-block';
      const labelEl = document.createElement('div');
      labelEl.className = 'review-label';
      labelEl.textContent = label;
      const valueEl = document.createElement('div');
      valueEl.className = 'review-value';
      valueEl.textContent = value || '—';
      block.append(labelEl, valueEl);
      card.appendChild(block);
    };

    addBlock('Account', nameLine || '—');
    addBlock('Freight type', freightLabel());
    addBlock("How you're paid", paymentSummary());
    addBlock('Fleet', `${state.fleetSize} truck${state.fleetSize === 1 ? '' : 's'} · ${state.driverCount} driver${state.driverCount === 1 ? '' : 's'} · ${state.homeState} · ${state.vehicleClass}`);

    const moduleBlock = document.createElement('div');
    moduleBlock.className = 'review-block';
    const moduleLabel = document.createElement('div');
    moduleLabel.className = 'review-label';
    moduleLabel.textContent = `Modules (${mods.length})`;
    const moduleList = document.createElement('div');
    moduleList.className = 'review-modules';
    if (!mods.length) {
      const empty = document.createElement('div');
      empty.className = 'review-value';
      empty.textContent = 'No modules selected';
      moduleList.appendChild(empty);
    } else {
      mods.forEach((m) => {
        const row = document.createElement('div');
        row.className = 'review-module-row';
        const name = document.createElement('span');
        name.textContent = m.name;
        const tier = document.createElement('span');
        const tierName = document.createElement('span');
        tierName.className = 'rm-tier';
        tierName.textContent = TIER_LABELS[m.tier];
        tier.append(tierName, document.createTextNode('  Included'));
        row.append(name, tier);
        moduleList.appendChild(row);
      });
    }
    moduleBlock.append(moduleLabel, moduleList);
    card.appendChild(moduleBlock);

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
        scheduleDraftSave();
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
    sub.textContent = `Your Giga-Sphere OS configuration is ready${companyBit}.`;

    $('#activationId').textContent = activationId();
    $('#packetDate').textContent = todayLabel();
    $('#dashMonthly').textContent = `${money(monthlyTotal())}/mo`;
    $('#dashModuleCount').textContent = String(selectedModulesList().length);
    $('#dashFleetSize').textContent = String(state.fleetSize);
    $('#dashBilling').textContent = state.billing === 'annual' ? 'Annual' : 'Monthly';
    $('#dashFreight').textContent = freightLabel();
    $('#dashState').textContent = state.homeState;
    $('#packetAccount').textContent = state.companyName || state.fullName || '—';
    $('#packetPayment').textContent = paymentSummary();
    $('#packetVehicleClass').textContent = state.vehicleClass;
    $('#packetDrivers').textContent = String(state.driverCount);
    $('#packetPrice').textContent = `${money(monthlyTotal())}/mo`;
    $('#activationNextStep').textContent = isNativeApp()
      ? `Packet ${activationId()} is ready under ${launchPlan().name}. Book a walkthrough to finalize workspace launch outside the native app.`
      : `Packet ${activationId()} is ready under ${launchPlan().name}. Confirm the workspace domain, accept the refund/non-refundable terms, then launch through secure Stripe checkout.`;

    const pills = $('#modulesActive');
    const mods = selectedModulesList();
    pills.replaceChildren();
    mods.forEach((m) => {
      const pill = document.createElement('span');
      pill.className = 'ma-pill';
      pill.textContent = `${m.name} · ${TIER_LABELS[m.tier]}`;
      pills.appendChild(pill);
    });
  }

  function downloadPacket() {
    const blob = new Blob([configurationPacketText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activationId()}-giga-build-activation-packet.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyPacket(btn) {
    const packet = configurationPacketText();
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(packet);
    } else {
      const ta = document.createElement('textarea');
      ta.value = packet;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    flashAction(btn, 'Copied');
  }

  function emailPacket() {
    const subject = encodeURIComponent(`GigaBuild Activation Packet ${activationId()}`);
    const body = encodeURIComponent(configurationPacketText());
    window.location.href = `mailto:${SALES_EMAIL}?subject=${subject}&body=${body}`;
  }

  function checkoutStatus(message, isError = false) {
    const el = $('#checkoutStatus');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = isError ? '#ffb4a8' : 'var(--gold)';
  }

  function checkoutPayload() {
    const mods = selectedModulesList();
    return {
      fullName: state.fullName,
      companyName: state.companyName,
      domain: state.domain,
      freightType: state.freightType,
      homeState: state.homeState,
      vehicleClass: state.vehicleClass,
      fleetSize: state.fleetSize,
      driverCount: state.driverCount,
      billing: state.billing,
      launchPlan: launchPlan().name,
      monthlyTotal: monthlyTotal(),
      modules: mods.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        tier: m.tier,
        price: 0,
      })),
      refundTermsAccepted: state.termsAccepted,
    };
  }

  async function createCheckout(btn) {
    if (isNativeApp()) {
      checkoutStatus('Workspace payment and launch are completed outside the native app. Book a walkthrough to continue.');
      window.open(WALKTHROUGH_URL, '_blank', 'noopener');
      return;
    }

    if (!state.domain.trim()) {
      checkoutStatus('Enter the domain where this workspace should launch.', true);
      $('#customDomain')?.focus();
      return;
    }
    if (!state.termsAccepted) {
      checkoutStatus('Confirm the subscription refund and non-refundable domain/custom-build terms.', true);
      $('#termsAccepted')?.focus();
      return;
    }

    const labelEl = btn?.querySelector('.qa-label, .bn-label') || btn;
    const original = labelEl?.textContent;
    if (labelEl) labelEl.textContent = 'Opening checkout...';
    if (btn) btn.disabled = true;
    checkoutStatus('Opening secure Stripe checkout...');

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutPayload()),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.checkoutUrl) {
        throw new Error(result.message || result.error || 'Checkout could not be created.');
      }
      window.location.href = result.checkoutUrl;
    } catch (err) {
      checkoutStatus(err.message || 'Checkout is not available yet.', true);
      if (labelEl && original) labelEl.textContent = original;
      if (btn) btn.disabled = false;
    }
  }

  function flashAction(btn, label) {
    if (!btn) return;
    const labelEl = btn.querySelector('.qa-label, .bn-label') || btn;
    const original = labelEl.textContent;
    labelEl.textContent = label;
    window.setTimeout(() => { labelEl.textContent = original; }, 1400);
  }

  function wireActivationActions() {
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'download') downloadPacket();
      if (action === 'email') emailPacket();
      if (action === 'book') window.open(WALKTHROUGH_URL, '_blank', 'noopener');
      if (action === 'edit') show(7);
      if (action === 'checkout') createCheckout(btn);
      if (action === 'copy') {
        try {
          await copyPacket(btn);
        } catch (_) {
          flashAction(btn, 'Copy failed');
        }
      }
    });
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
      ['customDomain', (v) => { state.domain = v; }],
    ];
    bindings.forEach(([id, setter]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        setter(el.value);
        scheduleDraftSave();
      });
    });

    const terms = document.getElementById('termsAccepted');
    if (terms) {
      terms.addEventListener('change', () => {
        state.termsAccepted = terms.checked;
        scheduleDraftSave();
      });
    }
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
        domain: '',
        termsAccepted: false,
      });

      $$('input[type="text"], input[type="number"], input[type="email"]').forEach((i) => { i.value = ''; });
      $('#fleetSize').value = 1;
      $('#fleetSizeRead').textContent = '1';
      $('#driverCount').value = 1;
      $('#homeState').value = 'TX';
      const terms = $('#termsAccepted');
      if (terms) terms.checked = false;
      checkoutStatus('');

      $$('.freight-card, .pay-card, .pct-base-option, .tier-btn').forEach((el) => el.classList.remove('active'));
      $$('#vehicleClassList .seg').forEach((b) => b.classList.toggle('active', b.dataset.vc === 'DOT Required'));
      $$('.bt-option').forEach((b, i) => b.classList.toggle('active', i === 0));

      $('#condPerMile').hidden = true;
      $('#condPercentage').hidden = true;
      $('#condFlat').hidden = true;

      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      clearDraft();
      updateNextEnabled();
      show(1);
    });
  }

  function wireLanguageSelector() {
    const select = $('#lang-switch');
    if (!select) return;

    let stored = 'en';
    try {
      const value = localStorage.getItem(LANG_STORAGE_KEY);
      if (value && SUPPORTED_LANGS.has(value)) stored = value;
    } catch (_) {}

    const applyLang = (lang) => {
      const next = SUPPORTED_LANGS.has(lang) ? lang : 'en';
      document.documentElement.lang = next === 'en' ? 'en' : next;
      document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
      select.value = next;
      try { localStorage.setItem(LANG_STORAGE_KEY, next); } catch (_) {}
    };

    select.addEventListener('change', (event) => applyLang(event.target.value));
    applyLang(stored);
  }

  function wireIdentityLinks() {
    const links = $$('[data-identity-return-current]');
    if (!links.length) return;
    let returnTo = 'https://www.gigabuild.dev/';
    try {
      returnTo = window.location.href;
    } catch (_) {}
    links.forEach((link) => {
      link.href = `https://gigabooks.app/app?return_to=${encodeURIComponent(returnTo)}`;
    });
  }

  /* -------------------- INIT -------------------- */

  function init() {
    applyRuntimeMode();
    renderFreightGrid();
    renderPaymentList();
    renderHomeStateDropdown();
    renderVehicleClass();
    wireFleetInputs();
    wireBillingToggle();
    bindTextInputs();
    wireNav();
    wireRestart();
    wireActivationActions();
    wireLanguageSelector();
    wireIdentityLinks();

    toggleConditionals();
    updateNextEnabled();
    maybeOfferResume();
    show(1);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

(() => {
  const panel = document.getElementById('gb-ai-panel');
  const log = document.getElementById('gb-ai-log');
  const quick = document.getElementById('gb-ai-quick');
  const form = document.getElementById('gb-ai-form');
  const input = document.getElementById('gb-ai-input');
  const title = document.getElementById('gb-ai-title');
  const dock = panel.closest('.gb-ai-dock');
  const tabs = Array.from(document.querySelectorAll('[data-gb-ai-mode]'));
  const openers = Array.from(document.querySelectorAll('[data-gb-ai-open]'));
  const close = document.querySelector('[data-gb-ai-close]');
  if (!panel || !log || !quick || !form || !input) return;

  const modes = {
    configurator: {
      name: 'Gigasphere AI',
      greeting: 'I am Gigasphere AI. I configure service stacks, modules, launch paths, and operating workflows. Tell me what you want to build and I will keep the setup lean.',
      placeholder: 'Ask Gigasphere AI to configure services...',
      quick: ['Recommend my first modules', 'Explain the launch packet', 'What should I configure first?'],
    },
    support: {
      name: 'Giganaut AI',
      greeting: 'I am Giganaut AI. I handle customer service, checkout questions, account help, and support issue routing.',
      placeholder: 'Ask Giganaut AI for support...',
      quick: ['Checkout help', 'I need human support', 'Report a build issue'],
    },
  };
  const escalationWords = ['checkout', 'billing', 'refund', 'cancel', 'private data', 'wrong account', 'legal', 'human', 'broken', 'error', 'failed'];
  const adversarialWords = [
    'ignore previous instructions',
    'ignore all previous instructions',
    'system prompt',
    'hidden prompt',
    'developer message',
    'jailbreak',
    'api key',
    'secret key',
    'print your instructions',
    'reveal your instructions',
    'another user',
    "another user's",
    'other customer',
    'cross tenant',
    'cross-tenant',
  ];
  const refusal = 'I cannot help with requests to bypass instructions, reveal hidden prompts, expose API keys, unlock paid modules, or access another customer account. I opened a security support case for human review.';
  let mode = 'configurator';
  let messages = [];

  function isAdversarial(message) {
    const text = String(message || '').toLowerCase();
    return adversarialWords.some((word) => text.includes(word));
  }

  function redactSensitiveText(value) {
    return String(value || '')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')
      .replace(/\b(?:\d[ -]*?){13,19}\b/g, (match) => {
        const digits = match.replace(/\D/g, '');
        return digits.length >= 13 && digits.length <= 19 ? '[REDACTED_CARD]' : match;
      })
      .replace(/\b(password|passcode|pin|secret)\s*(is|=|:)\s*([^\s,;]{4,})/gi, '$1 $2 [REDACTED_PASSWORD]')
      .replace(/\b(api[_-]?key|access_token|account_token|bank_token|plaid_token|processor_token|routing_number|account_number)\s*(=|:|is)\s*([A-Za-z0-9._-]{6,})/gi, '$1 $2 [REDACTED_TOKEN]');
  }

  function supportCase(message) {
    const text = message.toLowerCase();
    if (!escalationWords.some((word) => text.includes(word)) && !isAdversarial(message)) return null;
    const issue = {
      id: `GBUILD-CS-${Date.now().toString(36).toUpperCase()}`,
      source: window.location.hostname,
      assistant: 'Giganaut AI',
      status: 'needs_human_review',
      message: redactSensitiveText(message),
      createdAt: new Date().toISOString(),
    };
    let saved = [];
    try {
      saved = JSON.parse(sessionStorage.getItem('gbuild_support_cases_v1') || '[]');
      if (!Array.isArray(saved)) saved = [];
    } catch (_) {}
    try {
      sessionStorage.setItem('gbuild_support_cases_v1', JSON.stringify([issue, ...saved].slice(0, 50)));
    } catch (_) {}
    return issue;
  }

  function reply(message) {
    const text = message.toLowerCase();
    if (isAdversarial(message)) {
      supportCase(message);
      mode = 'support';
      return refusal;
    }
    const issue = supportCase(message);
    if (issue && mode === 'configurator') {
      mode = 'support';
      return `This is a customer service issue, so I switched it to Giganaut AI and opened support case ${issue.id}. Checkout, billing, refunds, private data, legal, account, and broken-flow issues need human review.`;
    }
    if (mode === 'support') {
      if (issue) return `Support case ${issue.id} opened. Giganaut AI marked it for human review because checkout, billing, refunds, private data, legal, account, and broken-flow issues need a person.`;
      return 'Giganaut AI can help with checkout, account questions, build packet questions, and routing. Anything involving money, private data, or a broken workflow gets escalated.';
    }
    if (text.includes('first') || text.includes('lean')) {
      return 'Gigasphere AI recommends starting with the smallest paid module set that protects revenue and proof: core workspace, document capture, compliance calendar, and only the modules needed for the first launch. It cannot bypass checkout or unlock modules without payment.';
    }
    if (text.includes('checkout') || text.includes('launch')) {
      return 'Finish the activation packet, confirm the workspace domain, accept terms, then launch through secure checkout. Gigasphere AI cannot alter checkout status, payment checks, or tenant provisioning rules.';
    }
    return 'Gigasphere AI guides the build by matching business type, operating risk, selected modules, fleet size, billing preference, and launch readiness. Final module access still depends on secure checkout and backend provisioning.';
  }

  function render() {
    title.textContent = modes[mode].name;
    input.placeholder = modes[mode].placeholder;
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.gbAiMode === mode));
    log.replaceChildren();
    messages.forEach((message) => {
      const bubble = document.createElement('div');
      bubble.className = `gb-ai-message ${message.role === 'user' ? 'user' : 'assistant'}`;
      bubble.textContent = message.text;
      log.appendChild(bubble);
    });

    quick.replaceChildren();
    modes[mode].quick.forEach((label) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.gbAiPrompt = label;
      button.textContent = label;
      quick.appendChild(button);
    });
    log.scrollTop = log.scrollHeight;
  }

  function setMode(nextMode) {
    mode = nextMode === 'support' ? 'support' : 'configurator';
    messages = [{ role: 'assistant', text: modes[mode].greeting }];
    render();
  }

  function send(text) {
    const clean = String(text || '').trim();
    if (!clean) return;
    messages.push({ role: 'user', text: redactSensitiveText(clean) });
    messages.push({ role: 'assistant', text: reply(clean) });
    input.value = '';
    render();
  }

  openers.forEach((button) => {
    button.addEventListener('click', () => {
      setMode(button.dataset.gbAiOpen);
      panel.hidden = false;
      dock?.classList.add('is-open');
      input.focus();
    });
  });
  close?.addEventListener('click', () => {
    panel.hidden = true;
    dock?.classList.remove('is-open');
  });
  tabs.forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.gbAiMode)));
  quick.addEventListener('click', (event) => {
    const button = event.target.closest('[data-gb-ai-prompt]');
    if (button) send(button.dataset.gbAiPrompt);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    send(input.value);
  });

  setMode('configurator');
})();
