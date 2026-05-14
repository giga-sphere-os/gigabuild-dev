# GigaBuild — Beta Sandbox Configurator

The customer-facing configurator that prospects walk through to design their Giga-Sphere platform before signing up. Deploys to **gigabuild.dev** (domain owned on Porkbun; Vercel hookup pending).

- **Stack:** static HTML/CSS/JS — no framework, no build step
- **State:** single in-memory `state` object on `window` (no backend)
- **Brand:** Navy `#0d1f35` / Gold `#e8a020` / White — Barlow Condensed (display) + Inter (body)
- **Theme:** dark, sticky header, animated progress bar, mobile-responsive

## Run locally

```bash
cd ~/gigabuild-dev
# Any static server works. Examples:
python3 -m http.server 5173
#   → open http://localhost:5173

# or
npx serve .
```

Or just double-click `index.html` — it works straight from the file system.

## File map

| File         | Role |
|--------------|------|
| `index.html` | Markup for all 8 steps, header, progress bar, footer |
| `styles.css` | Brand tokens, layout, step transitions, mock dashboard styles |
| `app.js`     | State, navigation, all data (freight types, modules, schemas), rendering, pricing math |

---

## The 8-step flow

Each step is a `<section class="step" data-step="N">`. Only the active step is visible; navigation animates a fade-up transition. The progress bar fills proportionally (`step / 8 * 100%`).

### Step 1 — Welcome / Freight type
- Hero: *"Build Your Compliance Operating System"*
- Card grid of 12 freight types (Straight, Dry Van, Reefer, Flatbed, Tanker, Hazmat, Dump, Hotshot, Auto Hauler, Intermodal, Last-Mile, Mixed)
- Selecting a card gives it a gold border + glow and enables **Next**
- Result captured to `state.freightType`

### Step 2 — About your fleet
- Range slider: fleet size 1–100 trucks (live read-out in gold)
- Vehicle classification dropdown (DOT / CDL / Non-DOT / Mixed)
- Home state dropdown (all 50 + DC, defaults to TX)
- Number-of-drivers input
- **Back** and **Next** buttons; data captured to `state.fleetSize / vehicleClass / homeState / driverCount`

### Step 3 — Choose your modules
- Two-column layout: module grid + sticky price card on the right
- 11 modules: GigaBooks, Fleet Management, Compliance Engine, IFTA Reporting, Payroll & HR, Driver Onboarding, Asset Manager, Domain & Hosting, Digital Shipment Management, Security & Chain of Custody, Compliance Education
- **Recommended** badge and pre-toggled-on for modules whose `recommendedFor` array includes the chosen freight type (or `'all'`)
- Each card has Basic / Pro / Enterprise tier buttons with live monthly pricing + an "Add this module" toggle
- Selecting a tier auto-toggles the module on
- Sticky price card updates in real time with subtotal + breakdown
- **Next** disabled until at least one module is selected
- State: `state.modules[id] = { enabled, tier }`

### Step 4 — Configure each module
- One mini-config panel rendered per selected module
- Schema-driven from `MODULE_CONFIG_SCHEMA` in `app.js` — 2–3 fields per module max
  - **GigaBooks:** filing status, entity type, industry
  - **Fleet Management:** truck types (checklist), maintenance schedule
  - **Compliance Engine:** endorsements held (checklist), freight types hauled (checklist)
  - Plus light schemas for IFTA, Payroll, Onboarding, Assets, Domain, Shipment, Security, Education
- Checklist items render as pill toggles
- All answers captured into `state.moduleConfig[moduleId][fieldKey]`

### Step 5 — Domain & branding
- Subdomain text input with live preview of `<subdomain>.gigasphere.app` (input is normalized to a-z 0-9 -)
- Toggle for custom domain → reveals a domain-name input
- Logo upload UI (visual placeholder — not wired to anything)
- 6-color accent picker; active swatch ringed in gold
- State: `state.subdomain / customDomainEnabled / customDomain / accentColor`

### Step 6 — Review & price
- Two-column layout: full configuration summary + big price card on the right
- Monthly / Annual toggle. Annual = 15% off the monthly stack, displayed as monthly-equivalent + annual total
- Three badges: 7-day free trial (card required), 30-day money-back guarantee, "Domain registration is non-refundable" note
- Summary blocks: Operation / Modules / Domain & Branding

### Step 7 — Sandbox preview (demo mode)
- Full-width mock tenant dashboard, dynamically built from selected modules
- Top bar shows `<subdomain>.gigasphere.app` and an avatar in the user's accent color
- Left sidebar shows their selected modules as nav items (Dashboard always pinned)
- Main area always renders KPIs (fleet size, drivers, on-duty, alerts)
- **GigaBooks selected** → sample monthly P&L with realistic line items
- **Fleet Management selected** → driver duty table + equipment table
- **Compliance Engine selected** → 6 status cards (green / yellow / red)
- **IFTA selected** → quarterly KPI strip
- **Payroll selected** → pay-period table
- Sample data uses driver names like J. Martinez, R. Thompson and company name "Your Fleet Co"

### Step 8 — Convert
- Final summary card with configuration, module count, subdomain, and monthly total in gold
- **Start Free Trial** → Calendly: `https://calendly.com/agbexar-gigasphere/product-walkthrough-giga-sphere-os`
- **Download your configuration** → downloads `state` as a JSON file
- **Talk to our team** → same Calendly link

---

## State shape

```js
state = {
  step: 1,
  freightType: 'dryvan',
  fleetSize: 5,
  vehicleClass: 'DOT Required',
  homeState: 'TX',
  driverCount: 5,
  modules: { gigabooks: { enabled: true, tier: 'pro' }, ... },
  moduleConfig: { gigabooks: { filingStatus: 'Single', ... }, ... },
  subdomain: 'yourfleet',
  customDomainEnabled: false,
  customDomain: '',
  accentColor: '#e8a020',
  billing: 'monthly'
}
```

The **Download your configuration** button on Step 8 dumps this exact object to a JSON file.

---

## Deployment

Not yet deployed. Plan:

1. Push repo to GitHub
2. Connect to Vercel (zero config — static)
3. Point Porkbun-owned `gigabuild.dev` at Vercel via DNS records

> Per repo canon: no Apps Script, no Drive MCP for >14 KB. This site doesn't write to any Giga-Sphere data plane — it's a pure marketing/configurator surface. No SA, no secrets, no backend.

## Adding a freight type, module, or config field

All three live in `app.js` constants:

- `FREIGHT_TYPES` — add `{ id, name, icon }`
- `MODULES` — add `{ id, name, icon, desc, tiers, recommendedFor }`
- `MODULE_CONFIG_SCHEMA` — add a `{ title, fields: [...] }` entry under the module id

Field types currently supported: `select`, `checklist`. Add new types in `renderField()` in `app.js`.

---

## Style guide

- **Display font:** Barlow Condensed (700/800) — all `h1`–`h4`, KPI values, brand mark
- **Body font:** Inter (400/500/600/700)
- **Gold (`#e8a020`)** is the constant accent in both light and dark mode (per `giga-sphere-brand` skill canon) — uses: CTAs, active tier buttons, price totals, focus rings, progress bar fill, brand mark first-letter, active step indicator
- **Cards** sit on Navy Mid (`#1a3a5c`) with a subtle border. Active/selected cards get a gold border + glow shadow
- **Animation budget:** 160ms for micro (hover, tier select) / 240ms for step transitions
- **Mobile breakpoint:** 640px — buttons stack, sticky cards drop to inline

---

## License & ownership

© Giga-Sphere OS, LLC. Not for redistribution.
