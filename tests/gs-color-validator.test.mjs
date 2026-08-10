/**
 * GigaSphere Color Governance Validator — Regression Tests v2.1
 * Authority: DR-033 — GigaSphere Global Color Governance (2026-08-10)
 *
 * 51 tests:
 *   T01–T20  Original suite
 *   T21–T24  Provenance bypass (Fix 1 from v2)
 *   T25–T28  Exact exception path matching (Fix 2 from v2)
 *   T29      Consistent scan root (Fix 3 from v2)
 *   T30–T34  All approved colors fail outside authorized locations (Fix 4 from v2)
 *   T35–T36  Unlisted navy variants (Fix 5 from v2)
 *   T37–T40  Retired navy never exempt via manifest (v2.1 Bugbot finding 1)
 *   T41–T46  Manifest errors fail closed with exit 1 (v2.1 Bugbot finding 2)
 *   T47–T50  CSS universal-selector and cross-line block-comment (v2.1 Fix 3)
 *   T51      Unknown navy heuristic catches unlisted dark navy (v2.1 Fix 4)
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname     = dirname(fileURLToPath(import.meta.url));
const VALIDATOR     = resolve(__dirname, '..', 'scripts', 'gs-color-validator.mjs');
const FIXTURE_BASE  = resolve(__dirname, 'fixtures', 'governance');

function setup(name, files) {
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

function run(dir) {
  try {
    const out = execSync(`node ${VALIDATOR} ${dir}`, { encoding: 'utf8', stdio: 'pipe' });
    return { pass: true, output: out };
  } catch (e) {
    return { pass: false, output: (e.stdout || '') + (e.stderr || '') };
  }
}

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

console.log('\nGigaSphere Color Governance v2.1 — Regression Tests\n');

// ══════════════════════════════════════════════════════════════════════════════
// T01–T36  Carried forward from v2
// ══════════════════════════════════════════════════════════════════════════════

test('T01 Rejects retired navy #0d1f35 (6-digit hex)', () => {
  assert.equal(run(setup('t01', { 'src/app.css': 'background: #0d1f35;' })).pass, false);
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
test('T12 Allows approved colors in tokens.css', () => {
  assert.equal(run(setup('t12', { 'src/styles/tokens.css': ':root { --gs-color-black: #050505; --gs-color-gold: #e8a020; }' })).pass, true);
});
test('T13 Allows approved colors in tailwind.config.ts', () => {
  assert.equal(run(setup('t13', { 'tailwind.config.ts': "colors: { black: '#050505', gold: '#e8a020' }" })).pass, true);
});
test('T14 Allows approved black in manifest.json (PWA)', () => {
  assert.equal(run(setup('t14', { 'public/manifest.json': '{"theme_color":"#050505"}' })).pass, true);
});
test('T15 Allows semantic error red #c53030', () => {
  assert.equal(run(setup('t15', { 'src/app.css': '--color-danger: #c53030;' })).pass, true);
});
test('T16 Scans dist/ directory', () => {
  assert.equal(run(setup('t16', { 'dist/index.html': '<style>body{background:#0d1f35}</style>' })).pass, false);
});
test('T17 Scans build/ directory', () => {
  assert.equal(run(setup('t17', { 'build/assets/app.css': 'background-color:#0d1f35' })).pass, false);
});
test('T18 Pure provenance comment → PASS', () => {
  assert.equal(run(setup('t18', { 'src/tokens.css': '/* was #0d1f35 — retired per DR-033 */\n--color-black: #050505;' })).pass, true);
});
test('T19 Documented exception suppresses hardcoded-APPROVED color violation', () => {
  // rgba(232,160,32,0.1) = gold at 10% opacity used in a data-visualization chart.
  // This triggers the hardcoded-approved-color violation (not retired navy).
  // A documented exception in the manifest should suppress it → PASS.
  const dir = setup('t19', {
    'src/chart.css': '.chart-bg { background: rgba(232, 160, 32, 0.1); }',
    'scripts/gs-color-exceptions.json': JSON.stringify({
      version: '2', authority: 'DR-033', token_files: [],
      exceptions: [{ exact: 'src/chart.css',
        reason: 'Data visualization chart — opacity-derived gold not suppressible via CSS var in this render context. DR-033 authority.',
        category: 'data_visualization_opacity_derived',
        require_pattern: 'rgba\\(232.*0\\.1\\)' }]
    })
  });
  assert.equal(run(dir).pass, true, 'Documented exception must suppress approved-color bypass violation');
});
test('T20 Fully compliant file with CSS tokens → PASS', () => {
  assert.equal(run(setup('t20', { 'src/app.css':
    ':root { --bg: var(--gs-color-black); }\nbody { background: var(--bg); }\n.error { color: #c53030; }' })).pass, true);
});
test('T21 Active declaration + DR-033 in comment → FAIL', () => {
  assert.equal(run(setup('t21', { 'src/app.css': 'background: #0d1f35; /* DR-033 era */' })).pass, false);
});
test('T22 Active declaration + "retired" in comment → FAIL', () => {
  assert.equal(run(setup('t22', { 'src/app.css': 'color: #0d1f35; /* retired navy */' })).pass, false);
});
test('T23 Active declaration + "was #" in comment → FAIL', () => {
  assert.equal(run(setup('t23', { 'src/app.css': 'background: #050914; /* was # old */' })).pass, false);
});
test('T24 Inline comment after active navy → FAIL (code portion)', () => {
  assert.equal(run(setup('t24', { 'styles.css': '--bg: #0d1f35; // was --gs-color-black' })).pass, false);
});
test('T25 Exception for art.css does NOT exempt chart.css', () => {
  const dir = setup('t25', {
    'src/chart.css': 'background: rgba(13, 31, 53, 0.1);',
    'scripts/gs-color-exceptions.json': JSON.stringify({ version: '2', authority: 'DR-033',
      token_files: [], exceptions: [{ exact: 'src/art.css', reason: 'Only art.css', category: 'test' }] })
  });
  assert.equal(run(dir).pass, false, 'art.css exception must not cover chart.css');
});
test('T26 Exception for components/Card.jsx does NOT exempt legacy/components/Card.jsx', () => {
  const dir = setup('t26', {
    'legacy/components/Card.jsx': "backgroundColor: '#0d1f35'",
    'scripts/gs-color-exceptions.json': JSON.stringify({ version: '2', authority: 'DR-033',
      token_files: [], exceptions: [{ exact: 'components/Card.jsx', reason: 'Test', category: 'test' }] })
  });
  assert.equal(run(dir).pass, false, 'Exact exception must not cover legacy/components/Card.jsx');
});
test('T27 Path traversal in exception → validator continues (reject path gracefully)', () => {
  const dir = setup('t27', {
    'src/app.css': '--color: #050505;',
    'scripts/gs-color-exceptions.json': JSON.stringify({ version: '2', authority: 'DR-033',
      token_files: [], exceptions: [{ exact: '../src/app.css', reason: 'Traversal', category: 'test' }] })
  });
  const r = run(dir);
  assert.equal(r.pass, false, 'Traversal path must not be accepted — must fail closed');
});
test('T28 Absolute path in exception → validator fails closed', () => {
  const dir = setup('t28', {
    'src/app.css': '--color: #050505;',
    'scripts/gs-color-exceptions.json': JSON.stringify({ version: '2', authority: 'DR-033',
      token_files: [], exceptions: [{ exact: '/absolute/path.css', reason: 'Absolute', category: 'test' }] })
  });
  const r = run(dir);
  assert.equal(r.pass, false, 'Absolute path must cause fail-closed');
});
test('T29 Isolated directory scan works correctly', () => {
  const dir = setup('t29', { 'src/colors.css': 'background: #0d1f35;' });
  assert.equal(run(dir).pass, false);
});
test('T30 Hardcoded #050505 fails in ordinary CSS', () => {
  assert.equal(run(setup('t30', { 'src/layout.css': 'body { background-color: #050505; }' })).pass, false);
});
test('T31 Hardcoded #E8A020 fails in HTML inline style', () => {
  assert.equal(run(setup('t31', { 'src/page.html': '<div style="color:#E8A020">text</div>' })).pass, false);
});
test('T32 Hardcoded #ffffff fails in JSX component', () => {
  assert.equal(run(setup('t32', { 'src/components/Hero.jsx': 'const s = { color: "#ffffff" };' })).pass, false);
});
test('T33 Hardcoded #050505 fails in JSX inline style', () => {
  assert.equal(run(setup('t33', { 'src/App.tsx': "const style = { background: '#050505' };" })).pass, false);
});
test('T34 Hardcoded #E8A020 fails in generated dist/', () => {
  assert.equal(run(setup('t34', { 'dist/styles.css': '.btn { background: #e8a020; }' })).pass, false);
});
test('T35 Unlisted navy #0c1428 fails', () => {
  assert.equal(run(setup('t35', { 'styles.css': 'background: #0c1428;' })).pass, false);
});
test('T36 Unlisted navy via rgb(14, 26, 45) fails', () => {
  assert.equal(run(setup('t36', { 'src/app.css': 'background: rgb(14, 26, 45);' })).pass, false);
});

// ══════════════════════════════════════════════════════════════════════════════
// T37–T40  Retired navy NEVER exempt via manifest (v2.1 Bugbot finding 1)
// ══════════════════════════════════════════════════════════════════════════════

test('T37 **/*.html glob exception does NOT suppress retired navy', () => {
  // The glob covers all HTML files, but a retired navy in any such file must still FAIL
  const dir = setup('t37', {
    'index.html': '<meta name="theme-color" content="#050505" />\n<style>body{background:#0d1f35}</style>',
    'scripts/gs-color-exceptions.json': JSON.stringify({ version: '2', authority: 'DR-033',
      token_files: [], exceptions: [{ glob: '**/*.html',
        reason: 'PWA theme-color technically required', category: 'html_pwa_theme_color' }] })
  });
  const r = run(dir);
  assert.equal(r.pass, false, 'Retired navy in HTML must fail even when a broad HTML exception exists');
});

test('T38 dist/index.html containing retired navy fails', () => {
  // Dist output is always scanned; retired navy there must fail
  assert.equal(run(setup('t38', {
    'dist/index.html': '<!DOCTYPE html><html><head><style>body{background:#0d1f35}</style></head></html>'
  })).pass, false);
});

test('T39 A theme-color exception does not exempt retired navy on another line in same file', () => {
  // Exception has require_pattern for "theme-color" — retired navy is on a different line
  const dir = setup('t39', {
    'index.html': [
      '<meta name="theme-color" content="#050505" />',
      '<style>.bg { background: #0d1f35; }</style>',
    ].join('\n'),
    'scripts/gs-color-exceptions.json': JSON.stringify({ version: '2', authority: 'DR-033',
      token_files: [], exceptions: [{ exact: 'index.html',
        reason: 'theme-color meta', category: 'html_pwa_theme_color',
        require_pattern: 'theme-color' }] })
  });
  const r = run(dir);
  assert.equal(r.pass, false, 'theme-color exception must not cover retired navy on another line');
});

test('T40 Standalone-SVG exception for approved literals does not exempt retired literals', () => {
  // Exception covers the SVG for approved colors; retired navy in same file must still fail
  const dir = setup('t40', {
    'assets/favicon.svg': [
      '<svg><rect fill="#050505"/>', // approved — should be excepted
      '<rect fill="#0d1f35"/></svg>', // retired navy — must FAIL regardless
    ].join('\n'),
    'scripts/gs-color-exceptions.json': JSON.stringify({ version: '2', authority: 'DR-033',
      token_files: [], exceptions: [{ exact: 'assets/favicon.svg',
        reason: 'Standalone brand SVG — approved literal technically required',
        category: 'standalone_svg_brand_asset' }] })
  });
  const r = run(dir);
  assert.equal(r.pass, false, 'SVG exception for approved colors must not exempt retired navy in same file');
});

// ══════════════════════════════════════════════════════════════════════════════
// T41–T46  Manifest errors fail closed (v2.1 Bugbot finding 2)
// ══════════════════════════════════════════════════════════════════════════════

test('T41 Missing reason → manifest rejected, validator exits 1', () => {
  const dir = setup('t41', {
    'src/app.css': '--color: var(--gs-color-black);',
    'scripts/gs-color-exceptions.json': JSON.stringify({ version: '2', authority: 'DR-033',
      token_files: [],
      exceptions: [{ exact: 'src/app.css', category: 'test' /* missing reason */ }]
    })
  });
  assert.equal(run(dir).pass, false, 'Missing reason must cause exit 1');
});

test('T42 Missing category → manifest rejected, validator exits 1', () => {
  const dir = setup('t42', {
    'src/app.css': '--color: var(--gs-color-black);',
    'scripts/gs-color-exceptions.json': JSON.stringify({ version: '2', authority: 'DR-033',
      token_files: [],
      exceptions: [{ exact: 'src/app.css', reason: 'Test' /* missing category */ }]
    })
  });
  assert.equal(run(dir).pass, false, 'Missing category must cause exit 1');
});

test('T43 Missing exact/prefix/glob → manifest rejected, exits 1', () => {
  const dir = setup('t43', {
    'src/app.css': '--color: var(--gs-color-black);',
    'scripts/gs-color-exceptions.json': JSON.stringify({ version: '2', authority: 'DR-033',
      token_files: [],
      exceptions: [{ reason: 'Test', category: 'test' /* no path selector */ }]
    })
  });
  assert.equal(run(dir).pass, false, 'No path selector must cause exit 1');
});

test('T44 Invalid JSON manifest → validator exits 1', () => {
  const dir = setup('t44', {
    'src/app.css': '--color: var(--gs-color-black);',
    'scripts/gs-color-exceptions.json': 'this is { not valid JSON ]['
  });
  assert.equal(run(dir).pass, false, 'Invalid JSON must cause exit 1');
});

test('T45 Unsupported manifest version → validator exits 1', () => {
  const dir = setup('t45', {
    'src/app.css': '--color: var(--gs-color-black);',
    'scripts/gs-color-exceptions.json': JSON.stringify({ version: '1', token_files: [], exceptions: [] })
  });
  assert.equal(run(dir).pass, false, 'Version "1" must cause exit 1');
});

test('T46 token_files that is not an array → validator exits 1', () => {
  const dir = setup('t46', {
    'src/app.css': '--color: var(--gs-color-black);',
    'scripts/gs-color-exceptions.json': JSON.stringify({ version: '2', authority: 'DR-033',
      token_files: 'styles.css', /* not an array */ exceptions: [] })
  });
  assert.equal(run(dir).pass, false, 'Non-array token_files must cause exit 1');
});

// ══════════════════════════════════════════════════════════════════════════════
// T47–T50  CSS universal-selector and cross-line comment (v2.1 Fix 3)
// ══════════════════════════════════════════════════════════════════════════════

test('T47 CSS universal selector * { ... } is NOT a comment — active code fails', () => {
  // `* { color: #0d1f35; }` must FAIL; the `*` is not a JSDoc comment marker here
  assert.equal(run(setup('t47', { 'src/app.css': '* { color: #0d1f35; }' })).pass, false);
});

test('T48 Multiline block comment with retired navy inside → PASS', () => {
  // The navy hex appears only inside a /* ... */ block spanning multiple lines
  const css = [
    '/*',
    ' * Historical: background was #0d1f35 (retired per DR-033)',
    ' */',
    '--color-black: #050505;',
  ].join('\n');
  assert.equal(run(setup('t48', { 'src/tokens.css': css })).pass, true);
});

test('T49 Active code after */ closing a block comment is scanned', () => {
  // After the block comment closes, the navy is in active code
  const css = '/* comment */ background: #0d1f35;';
  assert.equal(run(setup('t49', { 'src/app.css': css })).pass, false);
});

test('T50 Active code before /* provenance comment */ is scanned', () => {
  // Active navy before the inline comment must fail
  const css = 'background: #0d1f35; /* DR-033 — was valid, now retired */';
  assert.equal(run(setup('t50', { 'src/app.css': css })).pass, false);
});

// ══════════════════════════════════════════════════════════════════════════════
// T51  Unknown-navy heuristic (v2.1 Fix 4)
// ══════════════════════════════════════════════════════════════════════════════

test('T51 Unknown navy #13203a (not in RETIRED list) fails via heuristic', () => {
  // #13203a = rgb(19,32,58): hue ~216°, sat ~51%, lightness ~15% → isUnknownNavy()
  // This color is NOT in the validator's RETIRED list — caught purely by heuristic
  const r = run(setup('t51', { 'styles.css': 'background: #13203a;' }));
  assert.equal(r.pass, false, 'Unknown dark navy must be caught by heuristic without list update');
  assert.ok(r.output.includes('heuristic') || r.output.includes('unknown') || r.output.includes('13203a'),
    'Output must reference the heuristic detection');
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) { console.error('REGRESSION TESTS FAILED'); process.exit(1); }
else console.log('All regression tests passed.');
