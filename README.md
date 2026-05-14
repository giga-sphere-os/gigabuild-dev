# Giga-Build — Beta Sandbox Configurator

Trucker-native onboarding flow for the Giga-Sphere platform. Prospects walk through 9 quick screens (name → freight → payment → costs → fleet → modules → review → dashboard preview) and end up with a configured stack and a sandbox they can poke at. Deploys to **gigabuild.dev** (domain owned on Porkbun; Vercel hookup pending).

- **Stack:** static HTML/CSS/JS — no framework, no build step
- **State:** single in-memory `state` object on `window.gigaBuild` (no backend)
- **Brand:** Navy `#0d1f35` / Gold `#e8a020` / White — Barlow Condensed (display) + Inter (body)
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
| `app.js`     | State, navigation, conditional logic, module pricing, all rendering |

---

## The 9-step flow

Each step is a `<section class="step" data-step="N">`. Only the active step is visible; navigation animates a fade-up transition. The progress bar fills proportionally to **Step X of 7** — only steps 2–8 show the header and progress bar. Step 1 (welcome) and Step 9 (dashboard) hide them.

### Step 1 — Welcome (no step counter)
- 60×60 gold "GS" logo tile
- Heading: *"Giga-Build"*
- Sub: *"Build your compliance operating system."*
- Three value props with gold checkmarks:
  - Configure your modules — pay only for what you need.
  - AI-powered setup — live in under 30 minutes.
  - 50-state compliance engine built in.
- Gold CTA: **Create Free Account** → advances to Step 2
- *"Already have an account? Sign In"* link below

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
- Two trust badges: 🛡️ 7-day free trial — card required · 🛡️ 30-day money-back guarantee
- Gold CTA: **Start Free Trial** → advances to Step 9 sandbox

### Step 9 — Your dashboard (sandbox preview, no progress chrome)
- Personalized header: *"Hey, {firstName}"* + *"Welcome to your sandbox at {Company}."*
- **This Week** KPI card: Net Profit (gold) / Revenue / Expenses / Loads (all $0 / 0 — empty sandbox)
- Two metric cards: Miles this week · Profit / mile
- **This Month** table: Revenue / Fuel / Fixed costs / Other / Net row in gold
- Quick Actions 2×2 grid: ＋ Add Load · ✓ View Compliance · 📊 Run Reports · ⚙ Settings
- Empty-state card with truck emoji + *"No loads yet — Add your first load to start tracking."* + gold Add Load button
- Pills under empty state list the selected modules with their tier (so the user sees their stack)
- Fixed bottom nav: Dashboard / Loads / Reports / Profile
- **Restart Demo** button (top-right) wipes state and returns to Step 1

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

State persists in memory only — navigating back and forth never loses prior answers, but a page refresh resets to Step 1. No backend, no localStorage.

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

Not yet deployed. Plan:

1. Push repo to GitHub (`giga-sphere-os/gigabuild-dev`)
2. Connect to Vercel (zero config — static)
3. Point Porkbun-owned `gigabuild.dev` at Vercel via DNS records

Per repo canon: no Apps Script, no Drive MCP for >14 KB. This site doesn't write to any Giga-Sphere data plane — it's a pure marketing/configurator surface. No service account, no secrets, no backend.

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
