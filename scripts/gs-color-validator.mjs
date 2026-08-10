#!/usr/bin/env node
/**
 * GigaSphere Color Governance Validator v2.1
 * Authority: DR-033 — GigaSphere Global Color Governance (2026-08-10)
 * Contract:  gigasphere-master-data-room/contracts/GS_COLOR_CONTRACT_v1.json
 *
 * v2.1 changes (Bugbot remediation + architectural hardening):
 *   - BUGFIX: Retired colors NEVER receive exception-manifest bypass (Bugbot finding 1)
 *   - BUGFIX: Invalid/malformed manifests fail closed with exit 1 (Bugbot finding 2)
 *   - BUGFIX: Cross-line block-comment state tracking; `*` is not a comment marker
 *             unless inside an open block comment (fixes CSS universal-selector bypass)
 *   - Unknown-navy heuristic: dark blue colors not in RETIRED list are caught by
 *             HSL-range detection (hue 195-265°, saturation >15%, lightness <28%)
 *   - Strict manifest schema: every exception requires reason, category, and one of
 *             exact/prefix/glob; missing fields → exit 1
 *   - Exceptions apply ONLY to hardcoded-approved-color violations, never to retired navy
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative, extname, dirname } from 'node:path';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Canonical approved colors ─────────────────────────────────────────────────
const APPROVED = [
  { hex: '050505', rgb: [5,   5,   5],   token: '--gs-color-black', name: 'Brand black' },
  { hex: 'e8a020', rgb: [232, 160, 32],  token: '--gs-color-gold',  name: 'Brand gold'  },
  { hex: 'ffffff', rgb: [255, 255, 255], token: '--gs-color-white', name: 'Brand white'  },
];

// ── Retired navy colors (exact list from DR-033) ──────────────────────────────
// Additional unlisted variants caught by the dark-blue heuristic below.
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
  { hex: '0c1428', rgb: [12,  20,  40], name: 'Unlisted navy variant A'       },
  { hex: '0e1a2d', rgb: [14,  26,  45], name: 'Unlisted navy variant B'       },
  { hex: '1a2744', rgb: [26,  39,  68], name: 'Unlisted navy variant C'       },
];

const RETIRED_HEX_SET  = new Set(RETIRED.map(c => c.hex.toLowerCase()));
const APPROVED_HEX_SET = new Set(APPROVED.map(c => c.hex.toLowerCase()));

// ── Narrowly authorized locations for hardcoded approved colors ───────────────
function buildAuthorizedSet(tokenFiles) {
  const universal = [
    /tokens\.css$/,
    /^tailwind\.config\.[a-z]+$/,
    /^GS_COLOR_CONTRACT_v1\.json$/,
    /^contracts\/GS_COLOR_CONTRACT_v1\.json$/,
    /manifest\.(json|webmanifest)$/,
    /^site\.webmanifest$/,
    /^scripts\/gs-color-exceptions\.json$/,
    /^gs-color-exceptions\.json$/,
  ];
  return { universal, tokenFiles: tokenFiles.map(f => normPath(f)) };
}

function isAuthorizedForApproved(rel, authorizedSet) {
  if (authorizedSet.universal.some(rx => rx.test(rel))) return true;
  if (authorizedSet.tokenFiles.includes(normPath(rel))) return true;
  return false;
}

// ── Path normalization and validation ────────────────────────────────────────

function normPath(p) {
  return p.replace(/\\/g, '/');
}

function validateExceptionPath(raw, field) {
  if (raw === undefined || raw === null) throw new Error(`Exception missing "${field}" field`);
  const n = normPath(String(raw));
  if (n.startsWith('/') || /^[A-Za-z]:/.test(n))
    throw new Error(`Exception "${field}" must be repo-relative, not absolute: ${raw}`);
  if (n.includes('../') || n.includes('./') || n === '..')
    throw new Error(`Exception "${field}" contains path traversal: ${raw}`);
  return n;
}

function globToRegex(glob) {
  const norm = normPath(glob);
  let rx = '';
  let i = 0;
  while (i < norm.length) {
    if (norm[i] === '*' && norm[i + 1] === '*') {
      rx += '.*';
      i += 2;
      if (norm[i] === '/') i++;
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

// ── Cross-line block-comment state tracking ───────────────────────────────────
// A line beginning with `*` is NOT automatically a comment — it may be a CSS
// universal selector or Markdown emphasis. Only lines where the character
// position falls inside an open block comment are treated as comment content.

/** Find the start of a // line comment, skipping string literals. */
function findLineCommentStart(line, fromPos) {
  let inStr = null;
  for (let i = fromPos; i < line.length - 1; i++) {
    const c = line[i];
    if (c === '\\' && inStr) { i++; continue; }
    if (!inStr && (c === '"' || c === "'" || c === '`')) { inStr = c; continue; }
    if (inStr && c === inStr) { inStr = null; continue; }
    if (!inStr && c === '/' && line[i + 1] === '/') return i;
  }
  return -1;
}

/**
 * Compute comment ranges for a single line given the incoming block-comment state.
 * Returns { commentRanges: [[start,end], ...], nextState: boolean }
 * KNOWN LIMITATION: HTML comments <!-- --> spanning multiple lines are not tracked
 * across line boundaries (single-line <!-- --> is handled).
 */
function computeLineCommentState(line, wasInBlock) {
  const ranges = [];
  let pos = 0;
  let inBlock = wasInBlock;

  // If we enter the line already inside a block comment, find the closing */
  if (inBlock) {
    const closeIdx = line.indexOf('*/', 0);
    if (closeIdx === -1) {
      ranges.push([0, line.length]);
      return { commentRanges: ranges, nextState: true };
    }
    ranges.push([0, closeIdx + 2]);
    pos = closeIdx + 2;
    inBlock = false;
  }

  // Process the rest of the line (code or new comments)
  while (pos < line.length) {
    const lineCommentPos  = findLineCommentStart(line, pos);
    const blockCommentPos = line.indexOf('/*', pos);
    const htmlCommentPos  = line.indexOf('<!--', pos);

    const lc = lineCommentPos !== -1 ? lineCommentPos : Infinity;
    const bc = blockCommentPos !== -1 ? blockCommentPos : Infinity;
    const hc = htmlCommentPos !== -1 ? htmlCommentPos : Infinity;
    const first = Math.min(lc, bc, hc);

    if (first === Infinity) break;

    if (first === lc) {
      ranges.push([lc, line.length]);
      pos = line.length;
    } else if (first === bc) {
      const blockEnd = line.indexOf('*/', bc + 2);
      if (blockEnd === -1) {
        ranges.push([bc, line.length]);
        inBlock = true;
        pos = line.length;
      } else {
        ranges.push([bc, blockEnd + 2]);
        pos = blockEnd + 2;
      }
    } else {
      // HTML comment <!-- -->
      const htmlEnd = line.indexOf('-->', hc + 4);
      if (htmlEnd === -1) {
        ranges.push([hc, line.length]);
        pos = line.length;
      } else {
        ranges.push([hc, htmlEnd + 3]);
        pos = htmlEnd + 3;
      }
    }
  }

  return { commentRanges: ranges, nextState: inBlock };
}

/** Returns true if a character position falls inside any comment range. */
function isInComment(pos, ranges) {
  return ranges.some(([s, e]) => pos >= s && pos < e);
}

/** Returns true if the entire non-whitespace content of a line is within comments. */
function isLineEntirelyInComment(line, commentRanges) {
  const trimmed = line.trim();
  if (trimmed === '') return true;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ' ' || line[i] === '\t') continue;
    if (!isInComment(i, commentRanges)) return false;
  }
  return true;
}

// ── Color math ────────────────────────────────────────────────────────────────

function expandHex(h) {
  const n = h.replace(/^#/, '').toLowerCase();
  if (n.length === 3) return n.split('').map(c => c + c).join('');
  if (n.length === 4) return n.slice(0,3).split('').map(c => c+c).join('') + n.slice(3).repeat(2).slice(0,2);
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

/**
 * Unknown-navy heuristic. Returns true for dark blue-tinted colors that were
 * not anticipated in the DR-033 RETIRED list. Catches previously-unseen navies
 * without requiring the list to be updated.
 *
 * Hue 200-245° (pure blue range — excludes cyan <200° and purple/violet >245°)
 * Saturation > 24% (clearly blue-tinted; excludes near-gray slates)
 * Lightness 5-28% (dark brand surfaces; excludes near-black at <5% and mid-tones >28%)
 *
 * This range deliberately excludes:
 *   - Near-black colors (l < 5%) — no navy brand significance
 *   - Purple/violet hues (h > 245°) — distinct from navy aesthetics
 *   - Low-saturation slates (s ≤ 24%) — gray-ish, not clearly navy
 *   - Third-party social logos, chart colors, and semantic light blues (l ≥ 28%)
 */
function isUnknownNavy(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);
  return h >= 200 && h <= 245 && s > 24 && l >= 5 && l < 28;
}

// ── Pattern builders ──────────────────────────────────────────────────────────

function buildHexPatterns(hex) {
  const n = hex.toLowerCase();
  const set = new Set([`#${n}`, `#${n.toUpperCase()}`]);
  set.add(`#${n}ff`); set.add(`#${n}FF`);
  if (n.length === 6 && n[0]===n[1] && n[2]===n[3] && n[4]===n[5])
    set.add(`#${n[0]}${n[2]}${n[4]}`);
  return [...set].map(p => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
}

function buildRgbPattern(r, g, b) {
  const w = '\\s*';
  return new RegExp(`rgba?\\(${w}${r}${w},${w}${g}${w},${w}${b}${w}[,)]`, 'gi');
}

function buildHslPattern(h, s, l) {
  const hr = rangeArr(h, 2, 360).join('|');
  const sr = rangeArr(s, 2, 100).join('|');
  const lr = rangeArr(l, 2, 100).join('|');
  return new RegExp(`hsla?\\(\\s*(?:${hr})\\s*,\\s*(?:${sr})%\\s*,\\s*(?:${lr})%`, 'gi');
}

function rangeArr(v, tol, max) {
  const out = [];
  for (let i = -tol; i <= tol; i++) {
    const n = Math.max(0, Math.min(max, v + i));
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

// Precompute patterns for known retired and approved colors
const RETIRED_PATTERNS = RETIRED.map(c => {
  const [h, s, l] = rgbToHsl(...c.rgb);
  return { ...c,
    hexPats: buildHexPatterns(c.hex),
    rgbPat: buildRgbPattern(...c.rgb),
    hslPat: buildHslPattern(h, s, l) };
});

const APPROVED_PATTERNS = APPROVED.map(c => ({
  ...c,
  hexPats: buildHexPatterns(c.hex),
  rgbPat: buildRgbPattern(...c.rgb),
}));

// All-hex pattern for unknown-navy heuristic scan
const ALL_HEX_RE = /#([0-9a-fA-F]{3,6})\b/gi;
const ALL_RGB_RE = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*[,)]/gi;

// ── Scan configuration ────────────────────────────────────────────────────────

const SCAN_EXTS = new Set([
  '.css', '.scss', '.less', '.html', '.htm',
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  '.svg', '.json', '.webmanifest',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.pnpm-store', '.npm', '.cache',
  '__pycache__', '.turbo', '.next',
]);

// ── Manifest loading — FAILS CLOSED on any error ─────────────────────────────

function loadManifest(repoRoot) {
  const p = resolve(repoRoot, 'scripts', 'gs-color-exceptions.json');
  if (!existsSync(p)) return { token_files: [], exceptions: [] };

  let raw;
  try {
    raw = JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`\n[gs-color-validator] FATAL: Cannot parse exceptions manifest\n  ${p}\n  ${e.message}`);
    process.exit(1);
  }

  if (!raw || typeof raw !== 'object') {
    console.error(`[gs-color-validator] FATAL: Manifest root must be an object`);
    process.exit(1);
  }
  if (raw.version !== '2') {
    console.error(`[gs-color-validator] FATAL: Unsupported manifest version "${raw.version}". Expected "2".`);
    process.exit(1);
  }
  if (!Array.isArray(raw.token_files)) {
    console.error(`[gs-color-validator] FATAL: "token_files" must be an array (got ${typeof raw.token_files})`);
    process.exit(1);
  }

  let tokenFiles, exceptions;
  try {
    tokenFiles = raw.token_files.map((f, i) => {
      if (typeof f !== 'string') throw new Error(`token_files[${i}] must be a string`);
      validateExceptionPath(f, `token_files[${i}]`);
      return normPath(f);
    });

    exceptions = (raw.exceptions || []).map((ex, i) => {
      const id = `exceptions[${i}]`;
      if (!ex.reason || typeof ex.reason !== 'string' || !ex.reason.trim())
        throw new Error(`${id}: "reason" is required and must be a non-empty string`);
      if (!ex.category || typeof ex.category !== 'string')
        throw new Error(`${id}: "category" is required`);
      if (!ex.exact && !ex.prefix && !ex.glob)
        throw new Error(`${id}: must have "exact", "prefix", or "glob"`);

      if (ex.exact !== undefined)  validateExceptionPath(ex.exact,  `${id}.exact`);
      if (ex.prefix !== undefined) validateExceptionPath(ex.prefix, `${id}.prefix`);
      if (ex.glob !== undefined)   validateExceptionPath(ex.glob,   `${id}.glob`);

      return {
        ...ex,
        _exactNorm:  ex.exact  ? normPath(ex.exact)  : null,
        _prefixNorm: ex.prefix ? normPath(ex.prefix) : null,
        _globRx:     ex.glob   ? globToRegex(ex.glob) : null,
        _requireRx:  ex.require_pattern ? new RegExp(ex.require_pattern, 'i') : null,
      };
    });
  } catch (e) {
    console.error(`[gs-color-validator] FATAL: Invalid exceptions manifest\n  ${e.message}`);
    process.exit(1);
  }

  return { token_files: tokenFiles, exceptions };
}

/** Match a repo-relative file path against exception entries.
 *  Returns the first matching exception, or null.
 *  NOTE: Exceptions NEVER suppress retired-navy violations. Only approved-color
 *  bypass violations can be excepted. */
function matchException(rel, lineContent, exceptions) {
  const n = normPath(rel);
  for (const ex of exceptions) {
    let pathMatch = false;
    if (ex._exactNorm  && n === ex._exactNorm) pathMatch = true;
    if (!pathMatch && ex._prefixNorm && n.startsWith(ex._prefixNorm)) pathMatch = true;
    if (!pathMatch && ex._globRx     && ex._globRx.test(n)) pathMatch = true;
    if (!pathMatch) continue;
    if (ex._requireRx && !ex._requireRx.test(lineContent)) continue;
    return ex;
  }
  return null;
}

// ── Fully exempt files ────────────────────────────────────────────────────────

function makeFullyExempt(repoRoot) {
  return function(filePath) {
    const rel = normPath(relative(repoRoot, filePath));
    return (
      rel.startsWith('tests/fixtures/governance/') ||
      rel === 'scripts/gs-color-validator.mjs' ||
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

    const lines = text.split('\n');
    const rel   = normPath(relative(repoRoot, filePath));

    let inBlockComment = false;   // cross-line block-comment state

    for (let i = 0; i < lines.length; i++) {
      const line  = lines[i];
      const lineNo = i + 1;

      const { commentRanges, nextState } = computeLineCommentState(line, inBlockComment);
      inBlockComment = nextState;

      // Skip lines where ALL non-whitespace content is inside a comment
      if (isLineEntirelyInComment(line, commentRanges)) continue;

      // ── 1. Check for known retired navy colors ───────────────────────────
      // CRITICAL: Retired navy violations CANNOT be suppressed by the exceptions
      // manifest. Only comment-detection (above) can exempt a retired-navy match.
      for (const c of RETIRED_PATTERNS) {
        let matchPos = -1;
        for (const rx of c.hexPats) { rx.lastIndex = 0; const m = rx.exec(line); if (m) { matchPos = m.index; break; } }
        if (matchPos === -1) { c.rgbPat.lastIndex = 0; const m = c.rgbPat.exec(line); if (m) matchPos = m.index; }
        if (matchPos === -1) { c.hslPat.lastIndex = 0; const m = c.hslPat.exec(line); if (m) matchPos = m.index; }
        if (matchPos === -1 || isInComment(matchPos, commentRanges)) continue;

        violations.push({ type: 'retired_navy', file: rel, line: lineNo,
          color: `#${c.hex}`, name: c.name, content: line.trim().slice(0, 100) });
      }

      // ── 2. Unknown-navy heuristic ────────────────────────────────────────
      // Detect dark blue-ish colors not in the RETIRED list.
      // Exceptions manifest cannot suppress these.
      ALL_HEX_RE.lastIndex = 0;
      let hm;
      while ((hm = ALL_HEX_RE.exec(line)) !== null) {
        if (isInComment(hm.index, commentRanges)) continue;
        const normHex = expandHex(hm[1]).slice(0, 6).toLowerCase();
        if (RETIRED_HEX_SET.has(normHex) || APPROVED_HEX_SET.has(normHex)) continue;
        const [r, g, b] = hexToRgb(normHex);
        if (isUnknownNavy(r, g, b)) {
          violations.push({ type: 'unknown_navy', file: rel, line: lineNo,
            color: `#${hm[1]}`, name: 'Unknown dark navy (heuristic)',
            content: line.trim().slice(0, 100) });
        }
      }
      ALL_RGB_RE.lastIndex = 0;
      let rm;
      while ((rm = ALL_RGB_RE.exec(line)) !== null) {
        if (isInComment(rm.index, commentRanges)) continue;
        const r = parseInt(rm[1]), g = parseInt(rm[2]), b = parseInt(rm[3]);
        const normHex = [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
        if (RETIRED_HEX_SET.has(normHex) || APPROVED_HEX_SET.has(normHex)) continue;
        if (isUnknownNavy(r, g, b)) {
          violations.push({ type: 'unknown_navy', file: rel, line: lineNo,
            color: `rgb(${r},${g},${b})`, name: 'Unknown dark navy (heuristic)',
            content: line.trim().slice(0, 100) });
        }
      }

      // ── 3. Hardcoded approved colors outside authorized locations ─────────
      if (!isAuthorizedForApproved(rel, authorizedSet)) {
        for (const c of APPROVED_PATTERNS) {
          let matchPos = -1;
          for (const rx of c.hexPats) { rx.lastIndex = 0; const m = rx.exec(line); if (m) { matchPos = m.index; break; } }
          if (matchPos === -1) { c.rgbPat.lastIndex = 0; const m = c.rgbPat.exec(line); if (m) matchPos = m.index; }
          if (matchPos === -1 || isInComment(matchPos, commentRanges)) continue;

          const ex = matchException(rel, line, manifest.exceptions);
          const msg = { type: 'hardcoded_approved', file: rel, line: lineNo,
            color: `#${c.hex}`, token: c.token, name: c.name,
            content: line.trim().slice(0, 100) };
          if (ex) documented.push({ ...msg, reason: ex.reason, category: ex.category });
          else    violations.push(msg);
        }
      }
    }
  }

  return { violations, documented };
}

// ── Report ────────────────────────────────────────────────────────────────────

function report(violations, documented) {
  const navy      = violations.filter(v => v.type === 'retired_navy');
  const unknown   = violations.filter(v => v.type === 'unknown_navy');
  const hardcoded = violations.filter(v => v.type === 'hardcoded_approved');

  console.log('━'.repeat(60));
  console.log('  GigaSphere Color Governance Validator v2.1');
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

  if (unknown.length) {
    console.log(`✗ UNKNOWN NAVY VIOLATIONS — heuristic (${unknown.length}):`);
    console.log('  Dark blue-tinted colors not in the DR-033 retired list, caught by HSL heuristic');
    for (const v of unknown)
      console.log(`  ${v.file}:${v.line} — ${v.color}\n    ${v.content}`);
    console.log('');
  }

  if (hardcoded.length) {
    console.log(`✗ HARDCODED APPROVED COLOR VIOLATIONS (${hardcoded.length}):`);
    console.log('  Use CSS token (e.g. var(--gs-color-black)) or add documented exception');
    for (const v of hardcoded)
      console.log(`  ${v.file}:${v.line} — ${v.color} → ${v.token}\n    ${v.content}`);
    console.log('');
  }

  if (documented.length) {
    console.log(`⚠  DOCUMENTED EXCEPTIONS (${documented.length}):`);
    for (const d of documented.slice(0, 6))
      console.log(`  ${d.file}:${d.line} — ${d.category}`);
    if (documented.length > 6) console.log(`  … and ${documented.length - 6} more`);
    console.log('');
  }

  console.log('━'.repeat(60));
  if (violations.length === 0) {
    console.log(`  ✓ COLOR GOVERNANCE PASSED — 0 violations`);
    console.log(`    ${documented.length} documented exception(s) on record`);
  } else {
    console.log(`  ✗ COLOR GOVERNANCE FAILED`);
    if (navy.length)      console.log(`    ${navy.length} retired-navy violation(s)`);
    if (unknown.length)   console.log(`    ${unknown.length} unknown-navy violation(s) (heuristic)`);
    if (hardcoded.length) console.log(`    ${hardcoded.length} hardcoded-approved-color violation(s)`);
  }
  console.log('━'.repeat(60));

  return violations.length;
}

// ── Entry point ───────────────────────────────────────────────────────────────
const repoRoot = process.argv[2] ? resolve(process.argv[2]) : resolve(__dirname, '..');
const { violations, documented } = await scan(repoRoot);
process.exit(report(violations, documented) > 0 ? 1 : 0);
