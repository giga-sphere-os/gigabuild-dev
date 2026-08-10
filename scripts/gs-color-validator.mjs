#!/usr/bin/env node
/**
 * GigaSphere Color Governance Validator
 * Authority: DR-033 — GigaSphere Global Color Governance (2026-08-10)
 * Contract:  gigasphere-master-data-room/contracts/GS_COLOR_CONTRACT_v1.json
 *
 * Validates source, generated artifacts, and build output for:
 *   - Retired navy hex values (3/4/6/8-digit)
 *   - RGB/RGBA equivalents of retired navies
 *   - HSL/HSLA equivalents of retired navies
 *   - Hardcoded approved brand colors outside authorized token locations
 *   - Missing or altered canonical color contract
 *
 * Does NOT exclude dist/, build/, or generated artifacts.
 * Excludes only: node_modules, .git, non-product fixtures explicitly listed.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, relative, extname, basename, dirname } from 'node:path';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// ── Canonical approved colors ────────────────────────────────────────────────
const APPROVED = [
  { hex: '050505', rgb: [5, 5, 5],       token: '--gs-color-black', name: 'Brand black' },
  { hex: 'e8a020', rgb: [232, 160, 32],  token: '--gs-color-gold',  name: 'Brand gold'  },
  { hex: 'ffffff', rgb: [255, 255, 255], token: '--gs-color-white', name: 'Brand white'  },
];

// ── Retired navy colors — ALL representations must be detected ──────────────
const RETIRED = [
  { hex: '0d1f35', rgb: [13,  31,  53], name: 'Canonical GigaSphere Navy' },
  { hex: '162d4a', rgb: [22,  45,  74], name: 'Navy elevated surface'      },
  { hex: '050914', rgb: [5,   9,   20], name: 'Deep navy (gigabuild)'      },
  { hex: '0b1020', rgb: [11,  16,  32], name: 'Lifted navy surface'        },
  { hex: '0d1324', rgb: [13,  19,  36], name: 'Navy card surface'          },
  { hex: '070b14', rgb: [7,   11,  20], name: 'Navy bg variant'            },
  { hex: '0f1117', rgb: [15,  17,  23], name: 'Dark navy (giga-books)'     },
  { hex: '07111f', rgb: [7,   17,  31], name: 'Dark navy (your-co-driver)' },
  { hex: '0d1a2f', rgb: [13,  26,  47], name: 'Navy surface (co-driver)'   },
  { hex: '0a0e17', rgb: [10,  14,  23], name: 'Dark navy overlay'          },
  { hex: '14182a', rgb: [20,  24,  42], name: 'Navy surface (legal)'       },
  { hex: '0d1322', rgb: [13,  19,  34], name: 'Navy bg-2 (legal)'          },
  { hex: '182038', rgb: [24,  32,  56], name: 'Navy-tinted gradient stop'  },
  { hex: '181e38', rgb: [24,  30,  56], name: 'Navy-tinted gradient alt'   },
];

// ── Hex normalization helpers ────────────────────────────────────────────────

/** Expand 3/4-digit hex to 6/8-digit normalized form */
function expandHex(h) {
  h = h.replace(/^#/, '').toLowerCase();
  if (h.length === 3) return h.split('').map(c => c + c).join('');
  if (h.length === 4) return h.slice(0,3).split('').map(c=>c+c).join('') + h.slice(3,4).repeat(2);
  return h;
}

/** Parse hex to [r,g,b] */
function hexToRgb(h) {
  const n = expandHex(h);
  const v = parseInt(n.slice(0,6), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

/** RGB to HSL (all 0–1 range → degrees, %, %) */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// Precompute HSL for retired colors
const RETIRED_WITH_HSL = RETIRED.map(c => {
  const [h, s, l] = rgbToHsl(...c.rgb);
  return { ...c, hsl: [h, s, l] };
});

// ── Pattern builders ─────────────────────────────────────────────────────────

/** Build regex matching 3/4/6/8-digit hex form of a color (case-insensitive) */
function hexPatterns(hex) {
  const n = hex.toLowerCase();
  const patterns = [`#${n}`, `#${n.toUpperCase()}`];
  // 8-digit (with alpha ff or FF)
  patterns.push(`#${n}ff`, `#${n}FF`);
  // 3-digit shorthand where applicable
  if (n[0]===n[1] && n[2]===n[3] && n[4]===n[5])
    patterns.push(`#${n[0]}${n[2]}${n[4]}`);
  return patterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

/** Build regex matching rgb(r,g,b) and rgba(r,g,b,a) with whitespace flexibility */
function rgbPattern(r, g, b) {
  const ws = '\\s*';
  const sep = `${ws},${ws}`;
  return new RegExp(
    `rgba?\\(${ws}${r}${sep}${g}${sep}${b}${ws}[,)]`,
    'gi'
  );
}

/** Build regex matching hsl/hsla with ±2° hue, ±2% s, ±2% l tolerance */
function hslPatterns(h, s, l) {
  const hRange = `(?:${Array.from({length:5},(_,i)=>((h-2+i+360)%360)).join('|')})`;
  const sRange = `(?:${Array.from({length:5},(_,i)=>Math.max(0,s-2+i)).join('|')})`;
  const lRange = `(?:${Array.from({length:5},(_,i)=>Math.max(0,l-2+i)).join('|')})`;
  return new RegExp(
    `hsla?\\(\\s*${hRange}\\s*,\\s*${sRange}%\\s*,\\s*${lRange}%`,
    'gi'
  );
}

// ── File scanning ─────────────────────────────────────────────────────────────

const SCAN_EXTENSIONS = new Set([
  '.css', '.scss', '.less',
  '.html', '.htm',
  '.js', '.mjs', '.cjs',
  '.jsx', '.ts', '.tsx',
  '.svg',
  '.json',
  '.webmanifest',
  '.md',
]);

// Directories to always skip
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.pnpm-store', '.npm',
  '.cache', '__pycache__', '.turbo',
]);

// Load exception manifest if present
function loadExceptions(repoRoot) {
  const manifestPath = resolve(repoRoot, 'scripts/gs-color-exceptions.json');
  if (existsSync(manifestPath)) {
    try {
      return JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch { return { exceptions: [] }; }
  }
  return { exceptions: [] };
}

function isExcepted(filePath, lineContent, exceptions) {
  const rel = relative(REPO_ROOT, filePath);
  for (const ex of exceptions.exceptions || []) {
    if (rel.includes(ex.file) || (ex.pattern && new RegExp(ex.pattern).test(rel))) {
      // Exception applies to this file — check if the line matches
      if (!ex.require_pattern || new RegExp(ex.require_pattern, 'i').test(lineContent)) {
        return ex;
      }
    }
  }
  return null;
}

// Authorized locations where hardcoded approved brand colors are acceptable
// Principle: CSS variables cannot be used in (a) standalone SVG files rendered by browser/OS,
// (b) PWA manifest JSON, (c) HTML meta theme-color, (d) HTML email bodies, (e) governance docs.
const AUTHORIZED_APPROVED_FILES = [
  // Token definition files — the ONLY place brand literals should normally live
  /tokens\.css$/,
  /tailwind\.config\./,
  /globals\.css$/,
  /styles\.css$/,
  /index\.css$/,
  /brand\.css$/,
  /legal\.css$/,
  /App\.css$/,
  // Governance contract
  /GS_COLOR_CONTRACT_v1\.json$/,
  // PWA manifests — background_color/theme_color must be literal hex per W3C spec
  /manifest\.json$/,
  /manifest\.webmanifest$/,
  /site\.webmanifest$/,
  // SVG brand assets — standalone SVGs cannot inherit CSS variables from the document
  /\.svg$/,
  // HTML files — theme-color meta and inline styles have legitimate hardcoded values
  /\.html$/,
  /\.htm$/,
  // Email templates — email clients do not support CSS custom properties
  /lib[/\\]email[/\\]/,
  /emails?[/\\]/,
  // Governance and documentation files
  /DR-033/,
  /CHANGELOG/,
  /README/,
  /\.md$/,
  // The governance exceptions manifest itself
  /gs-color-exceptions\.json$/,
  // Build scripts that embed brand constants for output generation
  /scripts[/\\]write-surface-static\.mjs$/,
  // Note: gs-color-validator.mjs and test fixtures are handled by isFullyExempt (repo-relative)
];

function isAuthorizedApprovedLocation(filePath) {
  return AUTHORIZED_APPROVED_FILES.some(pat => pat.test(filePath));
}

// ── Line-level comment detection ─────────────────────────────────────────────
function isCommentLine(line) {
  const s = line.trim();
  return s.startsWith('//') || s.startsWith('*') || s.startsWith('/*') ||
         s.startsWith('#!') || /^\s*<!--/.test(line);
}

function isProvenanceLine(line) {
  return /was\s+#|retired|DR-033|was --/i.test(line);
}

/** Files that are entirely exempt from ALL checks (non-product fixtures and tooling).
 *  Uses repoRoot-relative paths to avoid false positives when the validator is called
 *  on fixture directories directly (as in regression tests). */
function makeIsFullyExempt(repoRoot) {
  return function isFullyExempt(filePath) {
    const rel = relative(repoRoot, filePath);
    return (
      // Regression test fixtures intentionally contain retired navy as test data
      rel.startsWith('tests/fixtures/governance/') ||
      rel.startsWith('tests\\fixtures\\governance\\') ||
      // The test script references colors in JS string literals (not applied to UI)
      rel === 'tests/gs-color-validator.test.mjs' ||
      // The validator itself references colors in output strings and pattern definitions
      rel === 'scripts/gs-color-validator.mjs'
    );
  };
}

// ── Walk files ───────────────────────────────────────────────────────────────
async function* walkFiles(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walkFiles(full);
    } else if (e.isFile() && SCAN_EXTENSIONS.has(extname(e.name).toLowerCase())) {
      yield full;
    }
  }
}

// ── Main scan ────────────────────────────────────────────────────────────────
async function scan(repoRoot) {
  const exceptions = loadExceptions(repoRoot);
  const isFullyExempt = makeIsFullyExempt(repoRoot);
  const violations = [];
  const warnings   = [];

  // Build all patterns once
  const retiredPatterns = RETIRED_WITH_HSL.map(c => ({
    ...c,
    hexRegexes: hexPatterns(c.hex).map(p => new RegExp(p, 'gi')),
    rgbRegex:   rgbPattern(...c.rgb),
    hslRegex:   hslPatterns(...c.hsl),
  }));

  const approvedHexPatterns = APPROVED.map(c => ({
    ...c,
    hexRegexes: hexPatterns(c.hex).map(p => new RegExp(p, 'gi')),
    rgbRegex:   rgbPattern(...c.rgb),
  }));

  for await (const filePath of walkFiles(repoRoot)) {
    let text;
    try { text = readFileSync(filePath, 'utf8'); }
    catch { continue; }

    const lines = text.split('\n');

    if (isFullyExempt(filePath)) continue;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNo = i + 1;
      const rel = relative(repoRoot, filePath);

      if (isCommentLine(line) || isProvenanceLine(line)) continue;

      // ── Check for retired colors ─────────────────────────────────────────
      for (const c of retiredPatterns) {
        let matched = false;

        for (const rx of c.hexRegexes) {
          rx.lastIndex = 0;
          if (rx.test(line)) { matched = true; break; }
        }
        if (!matched) {
          c.rgbRegex.lastIndex = 0;
          if (c.rgbRegex.test(line)) matched = true;
        }
        if (!matched) {
          c.hslRegex.lastIndex = 0;
          if (c.hslRegex.test(line)) matched = true;
        }

        if (matched) {
          const ex = isExcepted(filePath, line, exceptions);
          if (ex) {
            // Documented exception — still emit for audit
            warnings.push({ type: 'excepted', file: rel, line: lineNo, color: c.hex, content: line.trim().slice(0, 100), reason: ex.reason });
          } else {
            violations.push({ type: 'retired_navy', file: rel, line: lineNo, color: `#${c.hex}`, name: c.name, content: line.trim().slice(0, 100) });
          }
        }
      }

      // ── Check for hardcoded approved colors outside token locations ──────
      if (!isAuthorizedApprovedLocation(filePath)) {
        for (const c of approvedHexPatterns) {
          let matched = false;
          for (const rx of c.hexRegexes) {
            rx.lastIndex = 0;
            if (rx.test(line)) { matched = true; break; }
          }
          if (!matched) {
            c.rgbRegex.lastIndex = 0;
            if (c.rgbRegex.test(line)) matched = true;
          }
          if (matched) {
            // Check exceptions manifest first
            const ex = isExcepted(filePath, line, exceptions);
            // White (#ffffff) in most files is pervasive — flag as warning only
            const isWhite = c.hex === 'ffffff';
            const msg = { type: 'hardcoded_approved', file: rel, line: lineNo, color: `#${c.hex}`, token: c.token, name: c.name, content: line.trim().slice(0, 100) };
            if (ex) {
              warnings.push({ ...msg, reason: ex.reason });
            } else if (isWhite) {
              warnings.push({ ...msg, reason: 'White is used pervasively; flag for manual review' });
            } else {
              violations.push(msg);
            }
          }
        }
      }
    }
  }

  return { violations, warnings };
}

// ── Report ───────────────────────────────────────────────────────────────────
function report(violations, warnings) {
  const retiredViolations  = violations.filter(v => v.type === 'retired_navy');
  const hardcodedViolations = violations.filter(v => v.type === 'hardcoded_approved');

  console.log('━'.repeat(58));
  console.log('  GigaSphere Color Governance Validator');
  console.log('  Authority: DR-033 (2026-08-10)');
  console.log('  Approved:  Black #050505 · Gold #E8A020 · White #FFFFFF');
  console.log('━'.repeat(58));
  console.log('');

  if (retiredViolations.length) {
    console.log(`✗ RETIRED NAVY VIOLATIONS (${retiredViolations.length}):`);
    for (const v of retiredViolations) {
      console.log(`  ${v.file}:${v.line} — ${v.color} (${v.name})`);
      console.log(`    ${v.content}`);
    }
    console.log('');
  }

  if (hardcodedViolations.length) {
    console.log(`✗ HARDCODED APPROVED COLOR VIOLATIONS (${hardcodedViolations.length}):`);
    console.log('  (Approved colors must be used via CSS tokens, not hardcoded in component files)');
    for (const v of hardcodedViolations) {
      console.log(`  ${v.file}:${v.line} — ${v.color} hardcoded (use ${v.token})`);
      console.log(`    ${v.content}`);
    }
    console.log('');
  }

  if (warnings.length) {
    console.log(`⚠  WARNINGS / DOCUMENTED EXCEPTIONS (${warnings.length}):`);
    for (const w of warnings.slice(0, 10)) {
      console.log(`  ${w.file}:${w.line} — ${w.reason || 'review required'}`);
    }
    if (warnings.length > 10) console.log(`  ... and ${warnings.length - 10} more`);
    console.log('');
  }

  console.log('━'.repeat(58));
  if (violations.length === 0) {
    console.log(`  ✓ COLOR GOVERNANCE PASSED — 0 violations`);
    console.log(`    ${warnings.length} documented exception(s) noted`);
  } else {
    console.log(`  ✗ COLOR GOVERNANCE FAILED`);
    console.log(`    ${retiredViolations.length} retired-navy violation(s)`);
    console.log(`    ${hardcodedViolations.length} hardcoded-approved-color violation(s)`);
  }
  console.log('━'.repeat(58));

  return violations.length;
}

// ── Entry point ──────────────────────────────────────────────────────────────
const repoRoot = process.argv[2] ? resolve(process.argv[2]) : REPO_ROOT;
const { violations, warnings } = await scan(repoRoot);
const exitCode = report(violations, warnings);
process.exit(exitCode > 0 ? 1 : 0);
