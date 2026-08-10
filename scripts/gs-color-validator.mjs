#!/usr/bin/env node
/**
 * GigaSphere Color Governance Validator v2
 * Authority: DR-033 — GigaSphere Global Color Governance (2026-08-10)
 * Contract:  gigasphere-master-data-room/contracts/GS_COLOR_CONTRACT_v1.json
 *
 * v2 hardening (2026-08-10):
 *   - Comment-aware matching: provenance in comments ≠ provenance in active code
 *   - Exact exception path matching: no substring, no basename collision
 *   - All paths relative to scan root, not validator script root
 *   - #FFFFFF treated as FAIL outside authorized locations (same as Black/Gold)
 *   - Narrowed authorized locations (not all SVG, HTML, or MD files)
 *   - Extended retired list with unlisted navy variants
 *   - Exception manifest version 2 with exact/prefix/glob matching
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative, extname, basename, dirname, posix } from 'node:path';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Canonical approved colors ─────────────────────────────────────────────────
const APPROVED = [
  { hex: '050505', rgb: [5,   5,   5],   token: '--gs-color-black', name: 'Brand black' },
  { hex: 'e8a020', rgb: [232, 160, 32],  token: '--gs-color-gold',  name: 'Brand gold'  },
  { hex: 'ffffff', rgb: [255, 255, 255], token: '--gs-color-white', name: 'Brand white'  },
];

// ── Retired navy colors ───────────────────────────────────────────────────────
// Source: DR-033 canonical list + additional unlisted variants
// All representations (hex/rgb/rgba/hsl/hsla) are detected.
const RETIRED = [
  { hex: '0d1f35', rgb: [13,  31,  53], name: 'Canonical GigaSphere Navy'    },
  { hex: '162d4a', rgb: [22,  45,  74], name: 'Navy elevated surface'         },
  { hex: '050914', rgb: [5,   9,   20], name: 'Deep navy (gigabuild)'         },
  { hex: '0b1020', rgb: [11,  16,  32], name: 'Lifted navy surface'           },
  { hex: '0d1324', rgb: [13,  19,  36], name: 'Navy card surface'             },
  { hex: '070b14', rgb: [7,   11,  20], name: 'Navy bg variant'               },
  { hex: '0f1117', rgb: [15,  17,  23], name: 'Dark navy (giga-books)'        },
  { hex: '07111f', rgb: [7,   17,  31], name: 'Dark navy (your-co-driver)'    },
  { hex: '0d1a2f', rgb: [13,  26,  47], name: 'Navy surface (co-driver)'      },
  { hex: '0a0e17', rgb: [10,  14,  23], name: 'Dark navy overlay'             },
  { hex: '14182a', rgb: [20,  24,  42], name: 'Navy surface (legal)'          },
  { hex: '0d1322', rgb: [13,  19,  34], name: 'Navy bg-2 (legal)'             },
  { hex: '182038', rgb: [24,  32,  56], name: 'Navy-tinted gradient stop'     },
  { hex: '181e38', rgb: [24,  30,  56], name: 'Navy-tinted gradient alt'      },
  // Unlisted navy variants — proves unknown navies are not exempt
  { hex: '0c1428', rgb: [12,  20,  40], name: 'Unlisted navy variant A'       },
  { hex: '0e1a2d', rgb: [14,  26,  45], name: 'Unlisted navy variant B'       },
  { hex: '1a2744', rgb: [26,  39,  68], name: 'Unlisted navy variant C'       },
];

// ── Narrowly authorized locations for hardcoded approved colors ───────────────
// Only universal canonical token definition files and technically required manifests.
// Repo-specific primary CSS files (not named tokens.css) must be listed in
// scripts/gs-color-exceptions.json under "token_files".
// SVG, HTML, email, MD files must use the exceptions manifest.
function buildAuthorizedSet(tokenFiles) {
  const universal = [
    /tokens\.css$/,                            // canonical token CSS (any repo layout)
    /^tailwind\.config\.[a-z]+$/,             // tailwind.config.*
    /^GS_COLOR_CONTRACT_v1\.json$/,            // canonical contract
    /^contracts\/GS_COLOR_CONTRACT_v1\.json$/,
    /manifest\.(json|webmanifest)$/,           // PWA manifests (theme_color literal required)
    /^site\.webmanifest$/,
    /^scripts\/gs-color-exceptions\.json$/,    // exceptions manifest itself
    /^gs-color-exceptions\.json$/,
  ];
  return { universal, tokenFiles: tokenFiles.map(f => normPath(f)) };
}

function isAuthorizedForApproved(rel, authorizedSet) {
  if (authorizedSet.universal.some(rx => rx.test(rel))) return true;
  if (authorizedSet.tokenFiles.includes(normPath(rel))) return true;
  return false;
}

// ── Path normalization ────────────────────────────────────────────────────────

/** Normalize to forward-slash, lowercase for comparison */
function normPath(p) {
  return p.replace(/\\/g, '/');
}

/** Validate an exception path: no absolute paths, no traversal */
function validateExceptionPath(raw, field) {
  if (!raw) throw new Error(`Exception is missing "${field}" field`);
  const n = normPath(raw);
  if (n.startsWith('/') || /^[A-Za-z]:/.test(n))
    throw new Error(`Exception "${field}" must be repo-relative, not absolute: ${raw}`);
  if (n.includes('../') || n.includes('./') || n === '..')
    throw new Error(`Exception "${field}" contains path traversal: ${raw}`);
  return n;
}

/** Compile a glob pattern to an anchored RegExp.
 *  Only supports * (no slash) and ** (any chars including slash). */
function globToRegex(glob) {
  const norm = normPath(glob);
  let rx = '';
  let i = 0;
  while (i < norm.length) {
    if (norm[i] === '*' && norm[i + 1] === '*') {
      rx += '.*';
      i += 2;
      if (norm[i] === '/') i++; // skip trailing slash after **
    } else if (norm[i] === '*') {
      rx += '[^/]*';
      i++;
    } else {
      rx += norm[i].replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      i++;
    }
  }
  return new RegExp('^' + rx + '$');
}

// ── Comment-aware line analysis ───────────────────────────────────────────────

/** Returns true if the entire line is a comment (no active code). */
function isPureCommentLine(line) {
  const s = line.trim();
  return (
    s === '' ||
    s.startsWith('//') ||
    s.startsWith('*') ||
    s.startsWith('/*') ||
    /^\s*<!--/.test(line)
  );
}

/** Returns ranges [start, end) of comment regions within a line.
 *  Handles // line comments, /* block comments, <!-- html comments.
 *  KNOWN LIMITATION: comments spanning multiple lines are not tracked
 *  across line boundaries; only single-line comment regions are detected. */
function getCommentRanges(line) {
  const ranges = [];

  // --- Find // line comment start, accounting for string context ---
  let inStr = null;
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i];
    if (c === '\\' && inStr) { i++; continue; }
    if (!inStr && (c === '"' || c === "'" || c === '`')) { inStr = c; continue; }
    if (inStr && c === inStr) { inStr = null; continue; }
    if (!inStr && c === '/' && line[i + 1] === '/') {
      ranges.push([i, line.length]);
      break;
    }
  }

  // --- Find /* block comments on this line ---
  let pos = 0;
  while (pos < line.length) {
    const s = line.indexOf('/*', pos);
    if (s === -1) break;
    const e = line.indexOf('*/', s + 2);
    ranges.push([s, e === -1 ? line.length : e + 2]);
    pos = e === -1 ? line.length : e + 2;
  }

  // --- Find <!-- --> HTML comments on this line ---
  pos = 0;
  while (pos < line.length) {
    const s = line.indexOf('<!--', pos);
    if (s === -1) break;
    const e = line.indexOf('-->', s + 4);
    ranges.push([s, e === -1 ? line.length : e + 3]);
    pos = e === -1 ? line.length : e + 3;
  }

  return ranges;
}

/** Returns true if a character position falls inside any comment range. */
function isInComment(pos, ranges) {
  return ranges.some(([s, e]) => pos >= s && pos < e);
}

// ── Pattern builders ──────────────────────────────────────────────────────────

function expandHex(h) {
  const n = h.replace(/^#/, '').toLowerCase();
  if (n.length === 3) return n.split('').map(c => c + c).join('');
  if (n.length === 4) return n.slice(0, 3).split('').map(c => c + c).join('') + n.slice(3).repeat(2).slice(0, 2);
  return n.slice(0, 6);
}

function hexToRgb(h) {
  const n = expandHex(h);
  const v = parseInt(n, 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

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

/** Build regex matching 3/4/6/8-digit hex variations of a color. */
function buildHexPatterns(hex) {
  const n = hex.toLowerCase();
  const set = new Set([`#${n}`, `#${n.toUpperCase()}`]);
  set.add(`#${n}ff`); set.add(`#${n}FF`);
  const n3 = n.length === 6 && n[0] === n[1] && n[2] === n[3] && n[4] === n[5]
    ? `#${n[0]}${n[2]}${n[4]}` : null;
  if (n3) set.add(n3);
  return [...set].map(p => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
}

/** Build regex matching rgb(r,g,b) and rgba(r,g,b,a) with whitespace flexibility. */
function buildRgbPattern(r, g, b) {
  const w = '\\s*';
  return new RegExp(`rgba?\\(${w}${r}${w},${w}${g}${w},${w}${b}${w}[,)]`, 'gi');
}

/** Build regex matching hsl/hsla within ±2° hue, ±2% s/l tolerance. */
function buildHslPattern(h, s, l) {
  const hr = range(h, 2, 360).join('|');
  const sr = range(s, 2, 100).join('|');
  const lr = range(l, 2, 100).join('|');
  return new RegExp(`hsla?\\(\\s*(?:${hr})\\s*,\\s*(?:${sr})%\\s*,\\s*(?:${lr})%`, 'gi');
}

function range(v, tol, max) {
  const out = [];
  for (let i = -tol; i <= tol; i++) {
    const n = Math.max(0, Math.min(max, v + i));
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

// Precompute all patterns
const RETIRED_PATTERNS = RETIRED.map(c => {
  const [h, s, l] = rgbToHsl(...c.rgb);
  return { ...c, hexPats: buildHexPatterns(c.hex), rgbPat: buildRgbPattern(...c.rgb), hslPat: buildHslPattern(h, s, l) };
});

const APPROVED_PATTERNS = APPROVED.map(c => ({
  ...c, hexPats: buildHexPatterns(c.hex), rgbPat: buildRgbPattern(...c.rgb),
}));

// ── Scan configuration ────────────────────────────────────────────────────────

const SCAN_EXTS = new Set([
  '.css', '.scss', '.less', '.html', '.htm',
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  '.svg', '.json', '.webmanifest',
  // .md excluded: markdown is documentation text, not an executable brand surface.
  // Phase 4 requirements list source, CSS, JS/TS, SVG, HTML, manifests — not markdown.
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.pnpm-store', '.npm', '.cache',
  '__pycache__', '.turbo', '.next',
]);

// ── Exception manifest loading and matching ───────────────────────────────────

function loadManifest(repoRoot) {
  const p = resolve(repoRoot, 'scripts', 'gs-color-exceptions.json');
  if (!existsSync(p)) return { token_files: [], exceptions: [] };
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    // Validate and normalize token_files
    const tokenFiles = (raw.token_files || []).map(f => {
      validateExceptionPath(f, 'token_files entry');
      return normPath(f);
    });
    // Validate exception entries
    const exceptions = (raw.exceptions || []).map(ex => {
      if (ex.exact)   validateExceptionPath(ex.exact, 'exact');
      if (ex.prefix)  validateExceptionPath(ex.prefix, 'prefix');
      if (ex.glob)    validateExceptionPath(ex.glob, 'glob');
      return {
        ...ex,
        _exactNorm:  ex.exact  ? normPath(ex.exact)  : null,
        _prefixNorm: ex.prefix ? normPath(ex.prefix) : null,
        _globRx:     ex.glob   ? globToRegex(ex.glob) : null,
        _requireRx:  ex.require_pattern ? new RegExp(ex.require_pattern, 'i') : null,
      };
    });
    return { token_files: tokenFiles, exceptions };
  } catch (e) {
    process.stderr.write(`Warning: could not load exceptions manifest: ${e.message}\n`);
    return { token_files: [], exceptions: [] };
  }
}

/** Check if a repo-relative path + line content matches an exception entry. */
function matchException(rel, lineContent, exceptions) {
  const n = normPath(rel);
  for (const ex of exceptions) {
    let pathMatch = false;
    if (ex._exactNorm  && n === ex._exactNorm) pathMatch = true;
    if (ex._prefixNorm && n.startsWith(ex._prefixNorm)) pathMatch = true;
    if (ex._globRx     && ex._globRx.test(n)) pathMatch = true;
    if (!pathMatch) continue;
    if (ex._requireRx && !ex._requireRx.test(lineContent)) continue;
    return ex;
  }
  return null;
}

// ── Fully exempt files (non-product test fixtures and validator itself) ────────

function makeFullyExempt(repoRoot) {
  return function(filePath) {
    const rel = normPath(relative(repoRoot, filePath));
    return (
      // Governance regression test fixtures contain retired navy intentionally.
      // Exempt via repoRoot-relative check — safe when validator runs ON fixture dirs.
      rel.startsWith('tests/fixtures/governance/') ||
      // The validator script references color hex in output strings and patterns.
      rel === 'scripts/gs-color-validator.mjs' ||
      // Test source files that reference colors in assertions are non-product code.
      // Only test source files are exempt; test fixtures are handled above.
      (rel.startsWith('tests/') &&
       !rel.startsWith('tests/fixtures/') &&
       (rel.endsWith('.test.js') || rel.endsWith('.test.mjs') || rel.endsWith('.test.ts')))
    );
  };
}

// ── File walker ───────────────────────────────────────────────────────────────

async function* walkFiles(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walkFiles(full);
    } else if (e.isFile() && SCAN_EXTS.has(extname(e.name).toLowerCase())) {
      yield full;
    }
  }
}

// ── Main scan ─────────────────────────────────────────────────────────────────

async function scan(repoRoot) {
  const manifest      = loadManifest(repoRoot);
  const authorizedSet = buildAuthorizedSet(manifest.token_files);
  const isFullyExempt = makeFullyExempt(repoRoot);
  const violations    = [];
  const documented    = [];

  for await (const filePath of walkFiles(repoRoot)) {
    if (isFullyExempt(filePath)) continue;

    let text;
    try { text = readFileSync(filePath, 'utf8'); }
    catch { continue; }

    const lines    = text.split('\n');
    const rel      = normPath(relative(repoRoot, filePath));

    for (let i = 0; i < lines.length; i++) {
      const line  = lines[i];
      const lineNo = i + 1;

      // Pure comment lines have no active code — skip entirely
      if (isPureCommentLine(line)) continue;

      const commentRanges = getCommentRanges(line);

      // ── Check for retired navy colors ──────────────────────────────────────
      for (const c of RETIRED_PATTERNS) {
        let matchPos = -1;

        // Test hex patterns
        for (const rx of c.hexPats) {
          rx.lastIndex = 0;
          const m = rx.exec(line);
          if (m) { matchPos = m.index; break; }
        }
        // Test rgb pattern
        if (matchPos === -1) {
          c.rgbPat.lastIndex = 0;
          const m = c.rgbPat.exec(line);
          if (m) matchPos = m.index;
        }
        // Test hsl pattern
        if (matchPos === -1) {
          c.hslPat.lastIndex = 0;
          const m = c.hslPat.exec(line);
          if (m) matchPos = m.index;
        }

        if (matchPos === -1) continue;

        // If the match falls inside a comment → provenance reference, skip
        if (isInComment(matchPos, commentRanges)) continue;

        // Check exceptions manifest for documented semantic/technical exceptions
        const retiredEx = matchException(rel, line, manifest.exceptions);
        if (retiredEx) {
          documented.push({ type: 'retired_navy_excepted', file: rel, line: lineNo,
            color: `#${c.hex}`, reason: retiredEx.reason, category: retiredEx.category });
          continue;
        }

        // Active code violation
        violations.push({
          type: 'retired_navy', file: rel, line: lineNo,
          color: `#${c.hex}`, name: c.name,
          content: line.trim().slice(0, 100),
        });
      }

      // ── Check for hardcoded approved colors outside authorized locations ───
      if (!isAuthorizedForApproved(rel, authorizedSet)) {
        for (const c of APPROVED_PATTERNS) {
          let matchPos = -1;

          for (const rx of c.hexPats) {
            rx.lastIndex = 0;
            const m = rx.exec(line);
            if (m) { matchPos = m.index; break; }
          }
          if (matchPos === -1) {
            c.rgbPat.lastIndex = 0;
            const m = c.rgbPat.exec(line);
            if (m) matchPos = m.index;
          }

          if (matchPos === -1) continue;

          // Check if match is in a comment
          if (isInComment(matchPos, commentRanges)) continue;

          // Check exceptions manifest
          const ex = matchException(rel, line, manifest.exceptions);
          if (ex) {
            documented.push({ type: 'hardcoded_approved', file: rel, line: lineNo,
              color: `#${c.hex}`, reason: ex.reason, category: ex.category });
          } else {
            violations.push({
              type: 'hardcoded_approved', file: rel, line: lineNo,
              color: `#${c.hex}`, token: c.token, name: c.name,
              content: line.trim().slice(0, 100),
            });
          }
        }
      }
    }
  }

  return { violations, documented };
}

// ── Report ────────────────────────────────────────────────────────────────────

function report(violations, documented) {
  const navy      = violations.filter(v => v.type === 'retired_navy');
  const hardcoded = violations.filter(v => v.type === 'hardcoded_approved');

  console.log('━'.repeat(60));
  console.log('  GigaSphere Color Governance Validator v2');
  console.log('  Authority: DR-033 (2026-08-10)');
  console.log('  Approved:  Black #050505 · Gold #E8A020 · White #FFFFFF');
  console.log('━'.repeat(60));
  console.log('');

  if (navy.length) {
    console.log(`✗ RETIRED NAVY VIOLATIONS (${navy.length}):`);
    for (const v of navy)
      console.log(`  ${v.file}:${v.line} — ${v.color} (${v.name})\n    ${v.content}`);
    console.log('');
  }

  if (hardcoded.length) {
    console.log(`✗ HARDCODED APPROVED COLOR VIOLATIONS (${hardcoded.length}):`);
    console.log('  Use CSS token (e.g. var(--gs-color-black)) or add documented exception');
    for (const v of hardcoded)
      console.log(`  ${v.file}:${v.line} — ${v.color} (use ${v.token})\n    ${v.content}`);
    console.log('');
  }

  if (documented.length) {
    console.log(`⚠  DOCUMENTED EXCEPTIONS (${documented.length}):`);
    const shown = documented.slice(0, 8);
    for (const d of shown)
      console.log(`  ${d.file}:${d.line} — ${d.category || d.reason?.slice(0, 80)}`);
    if (documented.length > 8) console.log(`  … and ${documented.length - 8} more`);
    console.log('');
  }

  console.log('━'.repeat(60));
  if (violations.length === 0) {
    console.log(`  ✓ COLOR GOVERNANCE PASSED — 0 violations`);
    console.log(`    ${documented.length} documented exception(s) on record`);
  } else {
    console.log(`  ✗ COLOR GOVERNANCE FAILED`);
    console.log(`    ${navy.length} retired-navy violation(s)`);
    console.log(`    ${hardcoded.length} hardcoded-approved-color violation(s)`);
  }
  console.log('━'.repeat(60));

  return violations.length;
}

// ── Entry point ───────────────────────────────────────────────────────────────
const repoRoot = process.argv[2] ? resolve(process.argv[2]) : resolve(__dirname, '..');
const { violations, documented } = await scan(repoRoot);
process.exit(report(violations, documented) > 0 ? 1 : 0);
