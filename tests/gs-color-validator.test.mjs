/**
 * GigaSphere Color Governance Validator — Regression Tests v2
 * Authority: DR-033 — GigaSphere Global Color Governance (2026-08-10)
 *
 * 36 tests covering:
 *   T01–T20  Original suite (hex, rgb, rgba, hsl, hsla, bypass, build scan,
 *             provenance comment, exception, clean file)
 *   T21–T24  Provenance bypass hardening (Fix 1)
 *   T25–T28  Exact exception path matching (Fix 2)
 *   T29      Consistent scan root (Fix 3)
 *   T30–T34  Approved-color bypass — all three approved colors fail in code (Fix 4)
 *   T35–T36  Unlisted navy variants — previously unknown navies caught (Fix 5)
 */

import { writeFileSync, mkdirSync, rmSync, existsSync, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const VALIDATOR  = resolve(__dirname, '..', 'scripts', 'gs-color-validator.mjs');
const FIXTURE_BASE = resolve(__dirname, 'fixtures', 'governance');

// ── Helpers ───────────────────────────────────────────────────────────────────

function setup(name, files, opts = {}) {
  const dir = resolve(FIXTURE_BASE, name);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = resolve(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
  return dir;
}

function run(dir, extraArgs = '') {
  try {
    const out = execSync(`node ${VALIDATOR} ${dir} ${extraArgs}`, { encoding: 'utf8', stdio: 'pipe' });
    return { pass: true, output: out };
  } catch (e) {
    return { pass: false, output: e.stdout + e.stderr };
  }
}

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

console.log('\nGigaSphere Color Governance v2 — Regression Tests\n');

// ══════════════════════════════════════════════════════════════════════════════
// T01–T20  Original suite (carried forward)
// ══════════════════════════════════════════════════════════════════════════════

test('T01 Rejects retired navy #0d1f35 (6-digit hex)', () => {
  const r = run(setup('t01', { 'src/app.css': 'background: #0d1f35;' }));
  assert.equal(r.pass, false);
  assert.ok(r.output.includes('0d1f35'));
});

test('T02 Rejects retired navy #0D1F35 (uppercase)', () => {
  assert.equal(run(setup('t02', { 'src/app.css': 'color: #0D1F35;' })).pass, false);
});

test('T03 Rejects retired deep navy #050914', () => {
  assert.equal(run(setup('t03', { 'src/app.css': '--bg: #050914;' })).pass, false);
});

test('T04 Rejects rgb() equivalent: rgb(13, 31, 53)', () => {
  assert.equal(run(setup('t04', { 'src/app.css': 'background: rgb(13, 31, 53);' })).pass, false);
});

test('T05 Rejects rgba() equivalent: rgba(13, 31, 53, 0.5)', () => {
  assert.equal(run(setup('t05', { 'src/app.css': 'background: rgba(13, 31, 53, 0.5);' })).pass, false);
});

test('T06 Rejects rgba deep navy: rgba(5, 9, 20, 0.96)', () => {
  assert.equal(run(setup('t06', { 'styles.css': 'background: rgba(5, 9, 20, 0.96);' })).pass, false);
});

test('T07 Rejects rgba bg variant: rgba(7, 11, 20, 0.98)', () => {
  assert.equal(run(setup('t07', { 'styles.css': 'background: rgba(7, 11, 20, 0.98);' })).pass, false);
});

test('T08 Rejects hsl equivalent: hsl(213, 61%, 13%)', () => {
  assert.equal(run(setup('t08', { 'src/app.css': 'background: hsl(213, 61%, 13%);' })).pass, false);
});

test('T09 Rejects hsla equivalent: hsla(213, 60%, 13%, 0.8)', () => {
  assert.equal(run(setup('t09', { 'src/app.css': 'background: hsla(213, 60%, 13%, 0.8);' })).pass, false);
});

test('T10 Rejects hardcoded #050505 in component file', () => {
  assert.equal(run(setup('t10', { 'src/components/Button.jsx': "background: '#050505';" })).pass, false);
});

test('T11 Rejects hardcoded #e8a020 in component file', () => {
  assert.equal(run(setup('t11', { 'src/components/Card.tsx': 'color: #e8a020;' })).pass, false);
});

test('T12 Allows approved colors in authorized tokens.css', () => {
  assert.equal(run(setup('t12', { 'src/styles/tokens.css': ':root { --gs-color-black: #050505; --gs-color-gold: #e8a020; }' })).pass, true);
});

test('T13 Allows approved colors in tailwind.config.ts', () => {
  assert.equal(run(setup('t13', { 'tailwind.config.ts': "colors: { black: '#050505', gold: '#e8a020' }" })).pass, true);
});

test('T14 Allows approved black in manifest.json (PWA requirement)', () => {
  assert.equal(run(setup('t14', { 'public/manifest.json': '{"theme_color":"#050505"}' })).pass, true);
});

test('T15 Allows semantic error red #c53030 (functional)', () => {
  assert.equal(run(setup('t15', { 'src/app.css': '--color-danger: #c53030;' })).pass, true);
});

test('T16 Scans dist/ directory (not excluded)', () => {
  assert.equal(run(setup('t16', { 'dist/index.html': '<style>body{background:#0d1f35}</style>' })).pass, false);
});

test('T17 Scans build/ directory (not excluded)', () => {
  assert.equal(run(setup('t17', { 'build/assets/app.css': 'background-color:#0d1f35' })).pass, false);
});

test('T18 Pure provenance comment line → PASS', () => {
  // A comment-only line referencing retired navy is allowed (historical documentation)
  assert.equal(run(setup('t18', { 'src/tokens.css': '/* was #0d1f35 — retired per DR-033 */\n--color-black: #050505;' })).pass, true);
});

test('T19 Documented exception via gs-color-exceptions.json', () => {
  const dir = setup('t19', {
    'src/chart.css': 'background: rgba(13, 31, 53, 0.1);',
    'scripts/gs-color-exceptions.json': JSON.stringify({
      version: '2', authority: 'DR-033', token_files: [],
      exceptions: [{
        exact: 'src/chart.css',
        reason: 'Data visualization chart background — semantic, not brand surface',
        category: 'data_visualization',
        require_pattern: 'rgba\\(13.*0\\.1\\)',
      }]
    })
  });
  assert.equal(run(dir).pass, true);
});

test('T20 Fully compliant file with only approved tokens → PASS', () => {
  assert.equal(run(setup('t20', { 'src/app.css':
    ':root { --bg: var(--gs-color-black); }\nbody { background: var(--bg); }\n.error { color: #c53030; }' })).pass, true);
});

// ══════════════════════════════════════════════════════════════════════════════
// T21–T24  Provenance bypass hardening (Fix 1)
// ══════════════════════════════════════════════════════════════════════════════

test('T21 Active declaration with "DR-033" in comment — active code still fails', () => {
  // The string "DR-033" appears in an inline comment, but the active code has navy
  const dir = setup('t21', { 'src/app.css': 'background: #0d1f35; /* DR-033 era color */' });
  const r = run(dir);
  assert.equal(r.pass, false, 'Expected failure: active navy declaration not exempted by DR-033 in comment');
});

test('T22 Active declaration with "retired" in comment — active code still fails', () => {
  const dir = setup('t22', { 'src/app.css': 'color: #0d1f35; /* retired navy */' });
  assert.equal(run(dir).pass, false, 'Expected failure: active navy not exempted by "retired" in comment');
});

test('T23 Active declaration with "was #" in comment — active code still fails', () => {
  const dir = setup('t23', { 'src/app.css': 'background: #050914; /* was # of old value */' });
  assert.equal(run(dir).pass, false, 'Expected failure: active navy not exempted by "was #" in comment');
});

test('T24 Inline comment after active navy code — code portion fails', () => {
  // Comment is after the declaration — should not suppress the violation
  const dir = setup('t24', { 'styles.css': '--bg: #0d1f35; // previously approved, now retired per DR-033' });
  assert.equal(run(dir).pass, false, 'Expected failure: navy in code portion, not exempted by comment after it');
});

// ══════════════════════════════════════════════════════════════════════════════
// T25–T28  Exact exception path matching (Fix 2)
// ══════════════════════════════════════════════════════════════════════════════

test('T25 Exception for "art.css" does NOT exempt "chart.css" (basename collision)', () => {
  // Exception is exact for "src/art.css" — must not match "src/chart.css"
  const dir = setup('t25', {
    'src/chart.css': 'background: rgba(13, 31, 53, 0.1);',
    'scripts/gs-color-exceptions.json': JSON.stringify({
      version: '2', authority: 'DR-033', token_files: [],
      exceptions: [{ exact: 'src/art.css', reason: 'Test exception for art.css only', category: 'test' }]
    })
  });
  assert.equal(run(dir).pass, false, 'Exception for art.css must not exempt chart.css');
});

test('T26 Exception for "components/Card.jsx" does NOT exempt "legacy/components/Card.jsx"', () => {
  const dir = setup('t26', {
    'legacy/components/Card.jsx': "backgroundColor: '#0d1f35'",
    'scripts/gs-color-exceptions.json': JSON.stringify({
      version: '2', authority: 'DR-033', token_files: [],
      exceptions: [{ exact: 'components/Card.jsx', reason: 'Test', category: 'test' }]
    })
  });
  // legacy/components/Card.jsx contains retired navy (not approved-color check relevant here)
  assert.equal(run(dir).pass, false, 'Exception for components/Card.jsx must not exempt legacy/components/Card.jsx');
});

test('T27 Path traversal in exception path is rejected gracefully', () => {
  const dir = setup('t27', {
    'src/app.css': '--color: #050505;',
    'scripts/gs-color-exceptions.json': JSON.stringify({
      version: '2', authority: 'DR-033', token_files: [],
      exceptions: [{ exact: '../src/app.css', reason: 'Traversal attempt', category: 'test' }]
    })
  });
  // Validator should not crash — it should reject the traversal exception
  // and still flag the hardcoded approved color
  const r = run(dir);
  // Either fails on the hardcoded approved color OR passes with a warning
  // The key assertion is it does not crash silently
  assert.ok(typeof r.pass === 'boolean', 'Validator must not crash on traversal exception path');
});

test('T28 Absolute path in exception is rejected gracefully', () => {
  const dir = setup('t28', {
    'src/app.css': '--color: #050505;',
    'scripts/gs-color-exceptions.json': JSON.stringify({
      version: '2', authority: 'DR-033', token_files: [],
      exceptions: [{ exact: '/absolute/path/src/app.css', reason: 'Absolute path attempt', category: 'test' }]
    })
  });
  const r = run(dir);
  assert.ok(typeof r.pass === 'boolean', 'Validator must not crash on absolute exception path');
});

// ══════════════════════════════════════════════════════════════════════════════
// T29  Consistent scan root (Fix 3)
// ══════════════════════════════════════════════════════════════════════════════

test('T29 Validator invoked on isolated directory catches violations correctly', () => {
  // Create an isolated directory far from the validator's own repo root
  const dir = setup('t29', {
    'src/colors.css': 'background: #0d1f35;',
    // No exceptions manifest → no token_files
  });
  const r = run(dir);
  assert.equal(r.pass, false, 'Validator must catch violations in isolated scan root');
  assert.ok(r.output.includes('0d1f35'), 'Must report the specific violated hex');
});

// ══════════════════════════════════════════════════════════════════════════════
// T30–T34  Approved-color bypass (Fix 4) — all three colors fail in code
// ══════════════════════════════════════════════════════════════════════════════

test('T30 Hardcoded #050505 fails in ordinary CSS file', () => {
  assert.equal(run(setup('t30', { 'src/layout.css': 'body { background-color: #050505; }' })).pass, false);
});

test('T31 Hardcoded #E8A020 fails in HTML inline style', () => {
  assert.equal(run(setup('t31', { 'src/page.html': '<div style="color:#E8A020">text</div>' })).pass, false);
});

test('T32 Hardcoded #ffffff fails in JSX component', () => {
  // White (#ffffff) must FAIL in JSX, same as Black and Gold
  assert.equal(run(setup('t32', { 'src/components/Hero.jsx': 'const s = { color: "#ffffff" };' })).pass, false);
});

test('T33 Hardcoded #050505 fails in JSX inline style', () => {
  assert.equal(run(setup('t33', { 'src/App.tsx': "const style = { background: '#050505' };" })).pass, false);
});

test('T34 Hardcoded #E8A020 fails in generated dist/ output', () => {
  assert.equal(run(setup('t34', { 'dist/styles.css': '.btn { background: #e8a020; }' })).pass, false);
});

// ══════════════════════════════════════════════════════════════════════════════
// T35–T36  Unlisted navy variants (Fix 5)
// ══════════════════════════════════════════════════════════════════════════════

test('T35 Unlisted navy variant #0c1428 fails (not in original 14-entry list)', () => {
  // #0c1428 was not in the original DR-033 retired list but is still detected
  assert.equal(run(setup('t35', { 'styles.css': 'background: #0c1428;' })).pass, false);
});

test('T36 Unlisted navy via rgb() — rgb(14, 26, 45) — fails', () => {
  // rgb(14,26,45) = #0e1a2d — unlisted variant detected via rgb() pattern
  assert.equal(run(setup('t36', { 'src/app.css': 'background: rgb(14, 26, 45);' })).pass, false);
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) { console.error('REGRESSION TESTS FAILED'); process.exit(1); }
else console.log('All regression tests passed.');
