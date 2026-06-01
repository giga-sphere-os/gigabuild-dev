# Giga-Build — Production Configurator

Trucker-native onboarding flow for the Giga-Sphere platform. Prospects walk through 9 quick screens (name → freight → payment → costs → fleet → modules → review → activation workspace) and end with a configured stack, a downloadable activation packet, an email-ready build summary, and a direct walkthrough booking path. Deploys to **gigabuild.dev** on Vercel.

- **Stack:** static HTML/CSS/JS — no framework, no build step
- **State:** single `state` object on `window.gigaBuild`, continuous local draft autosave for resume, plus a saved activation packet for completed configurations
- **Brand:** Giga-Sphere command-center shell with dark grid field, gold accent, and PWA install support
- **Theme:** dark, mobile-first, animated progress bar, one question per screen
- **Inspiration:** Load Ledger's onboarding UX — built for phones, in the truck cab

## Run locally

```bash
cd ~/gigabuild-dev
python3 -m http.server 5173
#   → open http://localhost:5173

# or
npx serve .
```

Or just double-click `index.html` — it works straight from the file system.

## File map

| File         | Role |
|--------------|------|
| `index.html` | Markup for all 9 steps + progress header + dashboard preview |
| `styles.css` | Brand tokens, layout, step transitions, dashboard styles |
| `app.js`     | State, navigation, autosave/resume, conditional logic, module pricing, all rendering |
| `api/create-checkout.js` | Server-side Stripe Checkout creation, order storage, domain uniqueness checks |
| `api/stripe-webhook.js` | Signed Stripe webhook handling, payment validation, DNS-gated domain provisioning |
| `privacy.html` | Privacy policy path for app-store and web readiness |
| `delete-account.html` | Account/data deletion request path for app-store readiness |

---

## The 9-step flow

Each step is a `<section class="step" data-step="N">`. Only the active step is visible; navigation animates a fade-up transition. The progress bar fills proportionally to **Step X of 7** — only steps 2–8 show the header and progress bar. Step 1 (welcome) and Step 9 (dashboard) hide them.

### Step 1 — Welcome (no step counter)
- Giga-Sphere style command rail, sticky glass nav, grid field, and amber AI headline
- Primary CTA: **Create Free Account** → advances to Step 2
- Secondary CTA: **View Sales Page** → opens `gigasphere.io`
- Capability proof row: 13 modules · 50 states · 7 languages · WORM evidence

### Step 2 — About you (Step 1 of 7)
- Gold user-silhouette icon
- *"What's your name?"* heading
- Full Name input (required — Continue stays disabled until filled)
- Company Name input (optional, tagged as such)
- Back / Continue
- Captured to `state.fullName` / `state.companyName`

### Step 3 — What do you haul? (Step 2 of 7)
- Blue truck icon
- 10 visual cards in a 2-column grid (3-col on desktop): Day Cab/Straight, Sleeper/OTR, Flatbed, Reefer, Tanker, Dump, Hotshot, Box Truck, Auto Hauler, Other
- Each card has an inline SVG silhouette — no external image deps
- Selecting a card gives it a gold border + glow + checkmark, and seeds a starter module set (`gigabooks` + `compliance` + `fleet` on Basic) for Step 7
- Captured to `state.freightType`

### Step 4 — How do you get paid? (Step 3 of 7)
- Green dollar-coin icon
- Three full-width option cards: Per Mile / Percentage / Flat Rate
- **Conditional fields** revealed below the selection:
  - **Per Mile** → "Your rate per mile" input (e.g. `0.65`)
  - **Percentage** → percentage input + three sub-options for the calc base: Gross Revenue / After Fuel Surcharge / After FSC + Tolls
  - **Flat Rate** → "Average flat rate per load" input (e.g. `850`)
- Continue is gated until method + (if percentage) a base option are picked
- Captured to `state.paymentMethod`, `state.ratePerMile`, `state.percentage`, `state.pctBase`, `state.flatRate`

### Step 5 — Your regular costs (Step 4 of 7)
- Red fuel-pump icon
- *Both fields optional — skip anything you don't know yet.*
- Average MPG input (e.g. `6.5`) with hint "Used to estimate fuel cost per load"
- Weekly Fixed Costs ($ prefix, e.g. `850`) with hint "Truck payment, insurance, phone — anything you pay every week regardless of loads"
- Gold tip box: 💡 *"You can always update these later in your Profile settings."*
- Captured to `state.avgMpg` / `state.weeklyFixed`

### Step 6 — Your fleet (Step 5 of 7)
- Purple truck-fleet icon
- Fleet size slider 1–100 with gold live read-out and tick labels (1 / 25 / 50 / 75 / 100)
- Home state dropdown (all 50 + DC, defaults to TX)
- Vehicle classification — segmented 2×2 grid: DOT Required / CDL Required / Non-DOT / Mixed Fleet
- Number of drivers input
- Captured to `state.fleetSize` / `state.homeState` / `state.vehicleClass` / `state.driverCount`

### Step 7 — Build your stack (Step 6 of 7)
- *"Select the modules you need. Your price updates in real time."*
- Modules **pre-filtered by Step 3 freight type** — only the catalog entries whose `recommendedFor` includes the selected freight (or `'all'`) appear. Already-enabled modules also remain visible even if filtered out by a later freight change.
- Each module card: name + one-line description + 3 tier buttons (Basic / Pro / Enterprise) with prices + on/off switch
- Selecting a tier auto-toggles the module on. Toggle off removes it from the price total.
- Freight-specific badges flag modules that aren't on the `'all'` list (e.g. Reefer triggers *Temperature Logs* with a **Recommended** badge)
- Sticky navy/gold price bar fixed to the bottom of the viewport with live monthly subtotal
- Continue gated until ≥1 module is enabled
- State: `state.modules[id] = { enabled, tier }`

### Step 8 — Review (Step 7 of 7)
- *"Review your build."*
- Monthly / Annual billing toggle (annual = 15% off; shown as $/mo equivalent + total billed once a year)
- Summary card lists: Account · Freight · Payment method · Fleet line · Modules with tiers and per-line $/mo
- Big gold price block (label + amount + secondary note)
- Two readiness notes explaining that the activation packet is generated immediately and can be downloaded, emailed, and booked from the next screen
- Gold CTA: **Generate Activation Packet** → advances to Step 9

### Step 9 — Activation workspace (no progress chrome)
- Personalized header: *"Hey, {firstName}"* + readiness copy for the generated configuration
- **Build Summary** KPI card: monthly stack price, module count, fleet size, billing preference
- Metric cards: freight type and home state
- **Activation Packet** table: account, payment model, vehicle class, drivers, configured price
- Working quick actions:
  - **Download Packet** creates a text activation packet in-browser
  - **Email Build** opens a prefilled email to Giga-Sphere
  - **Book Walkthrough** opens the product walkthrough scheduler
  - **Edit Build** returns to the module-selection step
- Copy Packet Text action uses the clipboard where available, with a fallback copy path
- Fixed bottom nav mirrors the same working actions for mobile
- **Start Over** wipes state and returns to Step 1

---

## State shape

```js
window.gigaBuild = {
  step: 1,
  fullName: 'Alex Rivera',
  companyName: 'Rivera Trucking LLC',
  freightType: 'reefer',
  paymentMethod: 'percentage',  // 'permile' | 'percentage' | 'flat'
  ratePerMile: '',
  percentage: '75',
  pctBase: 'afterFsc',          // 'gross' | 'afterFsc' | 'afterFscTolls'
  flatRate: '',
  avgMpg: '6.5',
  weeklyFixed: '850',
  fleetSize: 5,
  homeState: 'TX',
  vehicleClass: 'DOT Required',
  driverCount: 5,
  modules: {
    gigabooks: { enabled: true, tier: 'pro' },
    compliance: { enabled: true, tier: 'basic' },
    temp: { enabled: true, tier: 'pro' },
  },
  billing: 'monthly',            // 'monthly' | 'annual'
};
```

State persists locally while the user moves through the configurator. Draft progress is saved under `gigaBuildDraft` after meaningful changes so a 30-45 minute setup can survive refreshes, app switches, and accidental tab closes. On activation, the generated packet is also saved to `localStorage` under `gigaBuildConfiguration`.

---

## Module catalog

Defined in `app.js` → `MODULES`. Each entry:

```js
{
  id: 'temp',
  name: 'Temperature Logs',
  desc: '…',
  tiers: { basic: 25, pro: 65, enterprise: 119 },
  recommendedFor: ['reefer'],   // or ['all'] to surface for every freight type
}
```

Current modules:

| ID | Name | Recommended for |
|----|------|-----------------|
| gigabooks | GigaBooks | all |
| fleet | Fleet Management | all |
| compliance | Compliance Engine | all |
| ifta | IFTA Reporting | every commercial truck type |
| payroll | Payroll & HR | all |
| onboarding | Driver Onboarding | all |
| hazmat | Hazmat Compliance | tanker |
| temp | Temperature Logs | reefer |
| securement | Load Securement Logs | flatbed, autohaul |
| shipment | Digital Shipment Mgmt | all |

To add a module: append an entry to `MODULES`. Filtering and pricing pick it up automatically.

---

## Deployment

Production deploy target: **https://www.gigabuild.dev**

Static Vercel deployment plus Vercel API routes. No build command is required.

Per repo canon: no Apps Script, no Drive MCP for >14 KB. Checkout and provisioning use server-side environment variables only; never expose Stripe, Supabase service-role, or Vercel tokens in frontend JavaScript.

### Supabase Migration

Before deploying the checkout/webhook hardening, apply the GigaBuild security migration:

For a brand-new GigaBuild Supabase project, run `supabase/bootstrap-production.sql` first. It creates the production tables, indexes, and row-level security policies from scratch.

1. Run `supabase/preflight-gigabuild-security-hardening.sql` in Supabase SQL Editor.
2. Confirm it returns zero rows. If it returns duplicate domains, resolve those order records first.
3. Run `supabase/migrations/20260601080000_gigabuild_security_hardening.sql`.

CLI option:

```bash
SUPABASE_DB_URL='postgresql://...' npm run migrate:prod
```

The CLI migration runner checks for duplicate domains first and stops before applying the migration if any exist.

The migration adds `stripe_event_id`, `domain_verification_token`, a unique domain index, and a unique non-null Stripe event index for webhook replay protection.

## Mobile Commerce Posture

Current posture is web/PWA checkout through Stripe. Do not ship this payment flow inside native iOS or Android wrappers until the commerce model is decided: web-only purchase, native in-app purchase, or a documented policy-qualified exception.

---

## Style guide

- **Display font:** Barlow Condensed (700/800) — all `h1`–`h4`, KPI values, brand mark, tier names
- **Body font:** Inter (400/500/600/700)
- **Gold (`#e8a020`)** is the constant accent: CTAs, active tier buttons, price totals, focus rings, progress bar fill, brand logo, active step indicator. Per `giga-sphere-brand` skill canon, gold stays the same in both light and dark mode.
- **Cards** sit on Navy Mid (`#14304f`) with subtle border. Active/selected cards get a gold border + soft glow.
- **Animation budget:** 160ms for micro (hover, tier select) / 240ms for step transitions.
- **Mobile breakpoint:** 720px — desktop expands freight grid to 3 columns and the dashboard to a wider canvas.
- **Designed mobile-first** for phones (used in the truck cab) and scales up on tablet/desktop.

---

## License & ownership

© Giga-Sphere OS, LLC. Not for redistribution.
