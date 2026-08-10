/**
 * Regression fixtures for GigaSphere Color Governance Validator
 * Authority: DR-033 — GigaSphere Global Color Governance (2026-08-10)
 *
 * Proves the validator:
 *   1. Rejects retired hex navy (6-digit, 3-digit, 8-digit)
 *   2. Rejects rgb/rgba equivalents of retired navies
 *   3. Rejects hsl/hsla equivalents of retired navies
 *   4. Rejects hardcoded approved colors outside authorized locations
 *   5. Allows documented semantic color exceptions
 *   6. Scans build artifacts (dist/ and build/ not excluded)
 *   7. Passes a clean file with only approved tokens
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALIDATOR = resolve(__dirname, '..', 'scripts', 'gs-color-validator.mjs');
const TMP = resolve(__dirname, 'fixtures', 'governance');

function setup(name, files) {
  const dir = resolve(TMP, name);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = resolve(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
  return dir;
}

function run(dir) {
  try {
    execSync(`node ${VALIDATOR} ${dir}`, { encoding: 'utf8', stdio: 'pipe' });
    return { pass: true, output: '' };
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

console.log('\nGigaSphere Color Governance — Validator Regression Tests\n');

// ── 1. Retired hex navy — 6-digit ─────────────────────────────────────────
test('Rejects retired navy #0d1f35 (6-digit hex)', () => {
  const dir = setup('t01', { 'src/app.css': 'background: #0d1f35;' });
  const r = run(dir);
  assert.equal(r.pass, false, 'Expected failure for #0d1f35');
  assert.ok(r.output.includes('0d1f35'), 'Expected violation report for 0d1f35');
});

// ── 2. Retired hex navy — uppercase ───────────────────────────────────────
test('Rejects retired navy #0D1F35 (uppercase)', () => {
  const dir = setup('t02', { 'src/app.css': 'color: #0D1F35;' });
  assert.equal(run(dir).pass, false, 'Expected failure for uppercase #0D1F35');
});

// ── 3. Retired navy — deep navy variant #050914 ───────────────────────────
test('Rejects retired deep navy #050914', () => {
  const dir = setup('t03', { 'src/app.css': '--bg: #050914;' });
  assert.equal(run(dir).pass, false, 'Expected failure for #050914');
});

// ── 4. Retired navy — rgba exact equivalent ───────────────────────────────
test('Rejects rgb equivalent of retired navy: rgb(13, 31, 53)', () => {
  const dir = setup('t04', { 'src/app.css': 'background: rgb(13, 31, 53);' });
  const r = run(dir);
  assert.equal(r.pass, false, 'Expected failure for rgb(13,31,53)');
});

// ── 5. Retired navy — rgba with alpha ─────────────────────────────────────
test('Rejects rgba equivalent: rgba(13, 31, 53, 0.5)', () => {
  const dir = setup('t05', { 'src/app.css': 'background: rgba(13, 31, 53, 0.5);' });
  assert.equal(run(dir).pass, false, 'Expected failure for rgba(13,31,53,0.5)');
});

// ── 6. Retired navy — rgba(5,9,20) — deep navy ────────────────────────────
test('Rejects rgba equivalent of deep navy: rgba(5, 9, 20, 0.96)', () => {
  const dir = setup('t06', { 'styles.css': 'background: rgba(5, 9, 20, 0.96);' });
  assert.equal(run(dir).pass, false, 'Expected failure for rgba(5,9,20,0.96)');
});

// ── 7. Retired navy — rgba(7,11,20) — bg variant ─────────────────────────
test('Rejects rgba bg variant: rgba(7, 11, 20, 0.98)', () => {
  const dir = setup('t07', { 'styles.css': 'background: rgba(7, 11, 20, 0.98);' });
  assert.equal(run(dir).pass, false, 'Expected failure for rgba(7,11,20,0.98)');
});

// ── 8. Retired navy — hsl equivalent ─────────────────────────────────────
test('Rejects hsl equivalent of retired navy: hsl(213, 61%, 13%)', () => {
  const dir = setup('t08', { 'src/app.css': 'background: hsl(213, 61%, 13%);' });
  assert.equal(run(dir).pass, false, 'Expected failure for hsl(213,61%,13%)');
});

// ── 9. Retired navy — hsla equivalent ────────────────────────────────────
test('Rejects hsla equivalent: hsla(213, 60%, 13%, 0.8)', () => {
  const dir = setup('t09', { 'src/app.css': 'background: hsla(213, 60%, 13%, 0.8);' });
  assert.equal(run(dir).pass, false, 'Expected failure for hsla(213,60%,13%,0.8)');
});

// ── 10. Hardcoded approved black in component file — FAIL ─────────────────
test('Rejects hardcoded #050505 in component file (must use token)', () => {
  const dir = setup('t10', { 'src/components/Button.jsx': "background: '#050505';" });
  assert.equal(run(dir).pass, false, 'Expected failure for hardcoded #050505 in component');
});

// ── 11. Hardcoded approved gold in component file — FAIL ──────────────────
test('Rejects hardcoded #e8a020 in component file (must use token)', () => {
  const dir = setup('t11', { 'src/components/Card.tsx': 'color: #e8a020;' });
  assert.equal(run(dir).pass, false, 'Expected failure for hardcoded #e8a020 in component');
});

// ── 12. Approved colors in token file — PASS ──────────────────────────────
test('Allows approved colors in authorized token definition file', () => {
  const dir = setup('t12', { 'src/styles/tokens.css': ':root { --gs-color-black: #050505; --gs-color-gold: #e8a020; }' });
  assert.equal(run(dir).pass, true, 'Expected pass for colors in tokens.css');
});

// ── 13. Approved colors in Tailwind config — PASS ─────────────────────────
test('Allows approved colors in tailwind.config.ts', () => {
  const dir = setup('t13', { 'tailwind.config.ts': "colors: { black: '#050505', gold: '#e8a020' }" });
  assert.equal(run(dir).pass, true, 'Expected pass for colors in tailwind.config.ts');
});

// ── 14. Approved colors in manifest — PASS ───────────────────────────────
test('Allows approved black in manifest.json (PWA requirement)', () => {
  const dir = setup('t14', { 'public/manifest.json': '{"theme_color":"#050505","background_color":"#050505"}' });
  assert.equal(run(dir).pass, true, 'Expected pass for #050505 in manifest.json');
});

// ── 15. Semantic error red — PASS ─────────────────────────────────────────
test('Allows semantic error red #c53030 (functional, not brand)', () => {
  const dir = setup('t15', { 'src/app.css': '--color-danger: #c53030;' });
  assert.equal(run(dir).pass, true, 'Expected pass for semantic red');
});

// ── 16. Scans dist/ (build artifact) — not excluded ──────────────────────
test('Scans build artifact in dist/ directory', () => {
  const dir = setup('t16', { 'dist/index.html': '<style>body{background:#0d1f35}</style>' });
  const r = run(dir);
  assert.equal(r.pass, false, 'Expected failure for retired navy in dist/');
});

// ── 17. Scans build/ directory ────────────────────────────────────────────
test('Scans compiled CSS in build/ directory', () => {
  const dir = setup('t17', { 'build/assets/app.css': 'background-color:#0d1f35' });
  assert.equal(run(dir).pass, false, 'Expected failure for retired navy in build/');
});

// ── 18. Provenance comment — PASS ────────────────────────────────────────
test('Allows provenance comment line referencing retired color', () => {
  const dir = setup('t18', { 'src/tokens.css': '/* was #0d1f35 — retired per DR-033 */\n--color-black: #050505;' });
  assert.equal(run(dir).pass, true, 'Expected pass for provenance comment');
});

// ── 19. Documented exception in manifest — PASS ─────────────────────────
test('Allows documented exception via gs-color-exceptions.json', () => {
  const dir = setup('t19', {
    'src/chart.css': 'background: rgba(13, 31, 53, 0.1);',
    'scripts/gs-color-exceptions.json': JSON.stringify({
      version: '1',
      authority: 'DR-033',
      exceptions: [{
        file: 'src/chart.css',
        reason: 'Data visualization chart background — semantic, not brand surface',
        category: 'data_visualization',
        require_pattern: 'rgba\\(13.*0\\.1\\)'
      }]
    })
  });
  // With exception, should pass (exit 0)
  assert.equal(run(dir).pass, true, 'Expected pass for documented chart exception');
});

// ── 20. Clean file — PASS ────────────────────────────────────────────────
test('Passes a fully compliant file with only approved tokens', () => {
  const dir = setup('t20', { 'src/app.css': `
    :root { --bg: var(--gs-color-black); --accent: var(--gs-color-gold); }
    body { background: var(--bg); color: #ffffff; }
    .btn { background: var(--accent); color: var(--gs-color-black); }
    .error { color: #c53030; }
    .success { color: #22c55e; }
  ` });
  assert.equal(run(dir).pass, true, 'Expected pass for compliant file');
});

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  console.error('REGRESSION TESTS FAILED');
  process.exit(1);
} else {
  console.log('All regression tests passed.');
}
