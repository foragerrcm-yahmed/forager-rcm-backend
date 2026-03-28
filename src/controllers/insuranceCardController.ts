/**
 * insuranceCardController.ts
 *
 * Handles insurance card photo upload and field extraction using
 * Tesseract.js OCR (free, no external API keys required).
 *
 * POST /api/insurance-policies/:id/card
 *   - Accepts a multipart image (field name: "card")
 *   - Saves the image to disk under uploads/insurance-cards/
 *   - Updates the policy's insuranceCardPath
 *   - Returns { success, data: { policy, cardUrl } }
 *
 * POST /api/insurance-policies/:id/parse-card
 *   - Accepts a multipart image (field name: "card")
 *   - Runs Tesseract.js OCR on the image
 *   - Applies multi-layout extraction to pull insurance card fields
 *   - Saves the image and updates insuranceCardPath
 *   - Returns { success, data: { extracted, cardUrl, rawText } }
 *
 * DELETE /api/insurance-policies/:id/card
 *   - Removes the stored card image and clears insuranceCardPath
 */

import { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { sendError, notFound, validationError } from '../utils/errors';
import { handlePrismaError } from '../utils/prismaErrors';
import { createWorker } from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const CARD_DIR = path.join(__dirname, '../../uploads/insurance-cards');
if (!fs.existsSync(CARD_DIR)) fs.mkdirSync(CARD_DIR, { recursive: true });

const ALLOWED_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Shared policy include ────────────────────────────────────────────────────

const POLICY_INCLUDE = {
  plan: {
    include: {
      payor: { select: { id: true, name: true, stediPayorId: true } },
    },
  },
  dependents: { orderBy: { createdAt: 'asc' as const } },
} as const;

function serializePolicy(p: any) {
  return {
    ...p,
    subscriberDob: p.subscriberDob != null ? Number(p.subscriberDob) : null,
    createdAt: Number(p.createdAt),
    updatedAt: Number(p.updatedAt),
    dependents: (p.dependents ?? []).map((d: any) => ({
      ...d,
      dateOfBirth: d.dateOfBirth != null ? Number(d.dateOfBirth) : null,
      createdAt: Number(d.createdAt),
      updatedAt: Number(d.updatedAt),
    })),
  };
}

// ─── OCR ─────────────────────────────────────────────────────────────────────

async function runOCR(imageBuffer: Buffer): Promise<string> {
  const worker = await createWorker('eng', 1, {
    logger: () => {}, // suppress verbose logging
  });
  try {
    const { data } = await worker.recognize(imageBuffer);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// ─── Known payor name fragments ───────────────────────────────────────────────

const KNOWN_PAYORS: Array<[RegExp, string]> = [
  [/blue\s*cross\s*blue\s*shield|bcbs/i, 'Blue Cross Blue Shield'],
  [/blue\s*cross(?!\s*blue)/i, 'Blue Cross'],
  [/blue\s*shield(?!\s*of)/i, 'Blue Shield'],
  [/aetna/i, 'Aetna'],
  [/united\s*health(?:care)?/i, 'UnitedHealthcare'],
  [/cigna/i, 'Cigna'],
  [/humana/i, 'Humana'],
  [/kaiser\s*permanente/i, 'Kaiser Permanente'],
  [/kaiser/i, 'Kaiser'],
  [/anthem/i, 'Anthem'],
  [/molina/i, 'Molina Healthcare'],
  [/centene/i, 'Centene'],
  [/wellcare/i, 'WellCare'],
  [/coventry/i, 'Coventry'],
  [/magellan/i, 'Magellan Health'],
  [/oscar\s*health/i, 'Oscar Health'],
  [/bright\s*health/i, 'Bright Health'],
  [/ambetter/i, 'Ambetter'],
  [/\bmedicaid\b/i, 'Medicaid'],
  [/\bmedicare\b/i, 'Medicare'],
  [/tricare/i, 'TRICARE'],
  [/champva/i, 'CHAMPVA'],
];

// ─── Layout detection ─────────────────────────────────────────────────────────
//
// We support three card layouts that produce distinct OCR line structures:
//
//  LAYOUT_LABELED  — label on one line, value on the next (BCBS, most physical cards)
//    "Enrollee Name"
//    "JOHN A DOE JR"
//    "Enrollee ID          RxBIN  004336"
//    "DZW920000000         RxGrp  RX4655"
//
//  LAYOUT_DIGITAL  — bare short ALL-CAPS labels, value on next line, multi-column
//    "ID EFFECTIVE"
//    "112461109 00 01/07/2026"
//    "GROUP"
//    "00632012"
//    "RX BIN RX PCN"
//    "017010 0518GWH"
//    "Yasir Ahmed"   ← name with NO label
//
//  LAYOUT_INLINE   — label: value on the same line (traditional printed cards)
//    "Member ID: XYZ123456789"
//    "Group #: 98765"
//    "Copay: $25"
//
// Detection is done by scoring each layout against the OCR lines.
// All three extractors run in sequence; later results only fill fields
// that earlier extractors left null.

type Layout = 'LABELED' | 'DIGITAL' | 'INLINE';

function detectLayout(lines: string[]): Layout {
  let labeledScore = 0;
  let digitalScore = 0;
  let inlineScore = 0;

  // Patterns that indicate labeled layout (label-above-value with qualifier words)
  const LABELED_LABEL_RE = /\b(?:enrollee|member|subscriber|insured|policy\s*holder|group\s*no|group\s*number|plan\s*name|rx\s*bin|rx\s*pcn|rx\s*grp|issuer|effective\s*date|copay|deductible)\b/i;
  // Patterns that indicate digital/wallet layout (bare short ALL-CAPS labels)
  const DIGITAL_LABEL_RE = /^(?:ID|GROUP|EFFECTIVE|RX\s*BIN|RX\s*PCN|RX\s*GRP|PLAN|NETWORK|COPAY|DEDUCTIBLE)(?:\s+(?:ID|GROUP|EFFECTIVE|RX\s*BIN|RX\s*PCN|RX\s*GRP|PLAN|NETWORK|COPAY|DEDUCTIBLE))*$/i;
  // Inline: label followed by colon then value on same line
  const INLINE_RE = /[A-Za-z\s]{3,30}:\s*[A-Z0-9\$]/;

  for (const line of lines) {
    if (LABELED_LABEL_RE.test(line) && line.length < 60) labeledScore++;
    if (DIGITAL_LABEL_RE.test(line.trim())) digitalScore += 2;
    if (INLINE_RE.test(line)) inlineScore++;
  }

  if (digitalScore >= 2 && digitalScore >= labeledScore) return 'DIGITAL';
  if (inlineScore > labeledScore) return 'INLINE';
  return 'LABELED'; // default — most physical cards
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function parseDollar(s: string): number | null {
  const cleaned = s.replace(/,/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseIsoDate(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(raw);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
}

/** Words that are never a person's name — used to reject false-positive name lines */
const NON_NAME_WORDS = new Set([
  'cigna', 'aetna', 'humana', 'anthem', 'kaiser', 'medicare', 'medicaid',
  'tricare', 'champva', 'healthcare', 'health', 'insurance', 'dental',
  'vision', 'pharmacy', 'network', 'plan', 'plus', 'open', 'access',
  'med', 'dntl', 'vis', 'rx', 'bin', 'pcn', 'grp', 'group', 'effective',
  'issuer', 'enrollee', 'member', 'subscriber', 'insured', 'policy',
  'holder', 'id', 'number', 'date', 'copay', 'deductible', 'out', 'pocket',
  'max', 'maximum', 'benefit', 'benefits', 'blue', 'cross', 'shield',
  'united', 'wellcare', 'coventry', 'oscar', 'bright', 'ambetter',
]);

function looksLikeName(line: string): boolean {
  // Must be 2-4 words, all letters (allow hyphen and apostrophe), no digits
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 2 || tokens.length > 4) return false;
  if (/\d/.test(line)) return false;
  for (const t of tokens) {
    if (!/^[A-Za-z][A-Za-z'\-\.]*$/.test(t)) return false;
    if (NON_NAME_WORDS.has(t.toLowerCase())) return false;
  }
  return true;
}

function splitNameParts(raw: string): { firstName: string | null; middleName: string | null; lastName: string | null; suffix: string | null } {
  const SUFFIXES = /\b(Jr\.?|Sr\.?|II|III|IV|V|MD|DO|PhD|Esq\.?)$/i;
  let workingName = raw.replace(/[^A-Za-z\s\-'\.]/g, '').trim();
  let suffix: string | null = null;
  const suffixMatch = SUFFIXES.exec(workingName);
  if (suffixMatch) {
    suffix = suffixMatch[1].replace(/\.$/, '');
    workingName = workingName.slice(0, suffixMatch.index).trim();
  }
  if (workingName.includes(',')) {
    const [lastPart, restPart] = workingName.split(',').map((s) => s.trim());
    const restTokens = (restPart || '').split(/\s+/).filter(Boolean);
    return {
      lastName: lastPart || null,
      firstName: restTokens[0] ?? null,
      middleName: restTokens.length > 1 ? restTokens.slice(1).join(' ') : null,
      suffix,
    };
  }
  const tokens = workingName.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) return { firstName: tokens[0], middleName: null, lastName: null, suffix };
  if (tokens.length === 2) return { firstName: tokens[0], middleName: null, lastName: tokens[1], suffix };
  return { firstName: tokens[0], middleName: tokens.slice(1, -1).join(' '), lastName: tokens[tokens.length - 1], suffix };
}

function toTitleCase(s: string): string {
  return s.replace(/\b([A-Z])([A-Z]+)\b/g, (_, first, rest) => first + rest.toLowerCase());
}

// ─── LAYOUT_LABELED extractor ─────────────────────────────────────────────────
//
// Strategy: for each field, look for a label line then take the value from
// the next line (preferred) or the same line after the label (fallback).
// The next-line path is preferred because it avoids multi-column bleed.

function extractLabeled(lines: string[], fullText: string, result: Record<string, any>): void {
  /**
   * Find the value that follows a label.
   * 1. Next-line path: label on one line (< 60 chars), value on the next.
   *    The next line must not itself look like a label.
   * 2. Same-line path: label followed by separator then value on the same line.
   *    Stops at the first run of 2+ spaces to avoid multi-column bleed.
   */
  function findAfterLabel(labelPattern: RegExp): string | null {
    // Next-line path (preferred)
    for (let i = 0; i < lines.length - 1; i++) {
      if (labelPattern.test(lines[i]) && lines[i].length < 60) {
        const next = lines[i + 1];
        // Reject if the next line itself looks like a label (short, ends with colon,
        // or matches common label words)
        const nextIsLabel = next.length < 40 && (
          /:\s*$/.test(next) ||
          /^(?:ID|GROUP|EFFECTIVE|RX\s*BIN|RX\s*PCN|PLAN|NETWORK|COPAY|DEDUCTIBLE|MEMBER|SUBSCRIBER|ENROLLEE|INSURED|POLICY|ISSUER|PHONE|ADDRESS|NAME|DATE|NUMBER|NO\.?|#)\b/i.test(next.trim())
        );
        if (!nextIsLabel && next && /[A-Z0-9]/i.test(next)) {
          return next;
        }
      }
    }
    // Same-line path (fallback)
    const wrapped = new RegExp('(?:' + labelPattern.source + ')', 'i');
    const combined = new RegExp(wrapped.source + '[:\\s#\\.]+([A-Z0-9][\\w\\-/]{0,30})', 'i');
    const m = combined.exec(fullText);
    if (m && m[1]) return m[1].trim();
    return null;
  }

  function findDollar(labelPattern: RegExp): number | null {
    const wrapped = new RegExp('(?:' + labelPattern.source + ')', 'i');
    const combined = new RegExp(wrapped.source + '[:\\s]+\\$?\\s*([\\d,]+(?:\\.\\d{2})?)', 'i');
    const m = combined.exec(fullText);
    if (m && m[1]) return parseDollar(m[1]);
    return null;
  }

  // Member ID
  if (!result.memberId) {
    const raw = findAfterLabel(/\benrollee\s*id\b|\bmember\s*id\b|\bsubscriber\s*id\b|\bpolicy\s*id\b|\binsured\s*id\b|\bid\s*number\b|\bmember\s*#\b/i);
    if (raw) {
      const token = raw.split(/\s+/)[0].replace(/[^A-Z0-9\-]/gi, '');
      if (token.length >= 4) result.memberId = token;
    }
  }

  // Group Number
  if (!result.groupNumber) {
    const raw = findAfterLabel(/\bgroup\s*(?:no\.?|number|#|num\.?)\b/i);
    if (raw) {
      const token = raw.split(/\s+/)[0].replace(/[^A-Z0-9\-]/gi, '');
      if (token.length >= 3) result.groupNumber = token;
    }
  }

  // Member Name
  if (!result.memberName) {
    const raw = findAfterLabel(/\benrollee\s*name\b|\bmember\s*name\b|\bsubscriber\s*name\b|\binsured\s*name\b|\bpatient\s*name\b|\bpolicy\s*holder\b/i);
    if (raw) {
      const cleaned = raw.replace(/[^A-Za-z\s\-'\.]/g, '').trim();
      if (cleaned.length >= 3 && /[A-Za-z]{2}/.test(cleaned)) {
        result.memberName = toTitleCase(cleaned);
        const parts = splitNameParts(cleaned);
        if (!result.firstName) result.firstName = parts.firstName ? toTitleCase(parts.firstName) : null;
        if (!result.middleName) result.middleName = parts.middleName ? toTitleCase(parts.middleName) : null;
        if (!result.lastName) result.lastName = parts.lastName ? toTitleCase(parts.lastName) : null;
        if (!result.suffix) result.suffix = parts.suffix;
      }
    }
  }

  // Plan Name
  if (!result.planName) {
    const m = /(?:plan\s*name|plan\s*type|product\s*name)[:\s]+([A-Za-z0-9][A-Za-z0-9 \-+]{2,40})/i.exec(fullText);
    if (m) result.planName = m[1].trim();
  }

  // RX BIN (always 6 digits; BCBS prints "RxBIN" no space)
  if (!result.rxBin) {
    const m = /rx\s*bin[:\s#]*(\d{6})/i.exec(fullText);
    if (m) result.rxBin = m[1];
  }

  // RX PCN
  if (!result.rxPcn) {
    const m = /\bpcn[:\s]+([A-Z0-9]{3,12})/i.exec(fullText);
    if (m) result.rxPcn = m[1];
  }

  // RxGrp (BCBS pharmacy group — store in rxPcn if pcn not found, also groupNumber)
  if (!result.rxPcn) {
    const m = /rx\s*grp[:\s]+([A-Z0-9]{2,12})/i.exec(fullText);
    if (m) result.rxPcn = m[1];
  }
  if (!result.groupNumber) {
    const m = /rx\s*grp[:\s]+([A-Z0-9]{2,12})/i.exec(fullText);
    if (m) result.groupNumber = m[1];
  }

  // Copays
  if (!result.copayPrimary) result.copayPrimary = findDollar(/\b(?:primary\s*care|pcp|office\s*visit)\b/i) ?? findDollar(/\bcopay\b/i);
  if (!result.copaySpecialist) result.copaySpecialist = findDollar(/\bspecialist\b/i);
  if (!result.copayUrgentCare) result.copayUrgentCare = findDollar(/\burgent\s*care\b/i);
  if (!result.copayER) result.copayER = findDollar(/\b(?:emergency\s*room|er\s*copay|emergency\s*care)\b/i);

  // Deductible / OOP
  if (!result.deductible) result.deductible = findDollar(/\bdeductible\b/i);
  if (!result.oopMax) result.oopMax = findDollar(/\bout[\s\-]*of[\s\-]*pocket\s*(?:max(?:imum)?)?|\boop\s*max\b/i);

  // Effective Date
  if (!result.effectiveDate) {
    const m = /(?:effective\s+date|eff\.?\s*date|coverage\s*date)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i.exec(fullText);
    if (m) result.effectiveDate = parseIsoDate(m[1]);
  }

  // Phone
  if (!result.insurerPhone) {
    const m = /(?:1[\s\-]?)?\(?\d{3}\)?[\s\-\.]\d{3}[\s\-\.]\d{4}/.exec(fullText);
    if (m) result.insurerPhone = m[0].trim();
  }
}

// ─── LAYOUT_DIGITAL extractor ─────────────────────────────────────────────────
//
// Digital/wallet cards (e.g. Cigna Google Wallet) use short ALL-CAPS label lines
// followed by value lines.  Multiple labels may appear on one line with their
// corresponding values on the next line in the same column order.
//
// Example OCR output:
//   "ID EFFECTIVE"
//   "112461109 00 01/07/2026"
//   "GROUP"
//   "00632012"
//   "RX BIN RX PCN"
//   "017010 0518GWH"
//   "Yasir Ahmed"   ← name with NO label

function extractDigital(lines: string[], fullText: string, result: Record<string, any>): void {
  // Bare label patterns (no qualifier words needed)
  const BARE_LABELS: Array<[RegExp, string]> = [
    [/^ID$/i, 'memberId'],
    [/^GROUP$/i, 'groupNumber'],
    [/^EFFECTIVE$/i, 'effectiveDate'],
    [/^RX\s*BIN$/i, 'rxBin'],
    [/^RX\s*PCN$/i, 'rxPcn'],
    [/^RX\s*GRP$/i, 'rxGrp_tmp'],
    [/^PLAN$/i, 'planName'],
    [/^NETWORK$/i, 'planName'],
    [/^COPAY$/i, 'copayPrimary'],
    [/^DEDUCTIBLE$/i, 'deductible'],
    [/^OOP\s*MAX$/i, 'oopMax'],
    [/^MEMBER\s*ID$/i, 'memberId'],
    [/^SUBSCRIBER\s*ID$/i, 'memberId'],
    [/^MEMBER\s*NAME$/i, 'memberName'],
    [/^SUBSCRIBER\s*NAME$/i, 'memberName'],
    [/^ENROLLEE\s*NAME$/i, 'memberName'],
    [/^ENROLLEE\s*ID$/i, 'memberId'],
    [/^INSURED\s*ID$/i, 'memberId'],
    [/^POLICY\s*ID$/i, 'memberId'],
  ];

  for (let i = 0; i < lines.length - 1; i++) {
    const labelLine = lines[i].trim();
    const valueLine = lines[i + 1]?.trim() ?? '';
    if (!valueLine) continue;

    // ── Identify label columns ────────────────────────────────────────────────
    // First try double-space split (Tesseract preserves columns with 2+ spaces).
    // If that yields only one token, try splitting at known label word boundaries.
    let labelParts = labelLine.split(/\s{2,}|\t/).map(t => t.trim()).filter(Boolean);
    if (labelParts.length === 1) {
      // Try to split a single-space label line (e.g. "ID EFFECTIVE", "RX BIN RX PCN")
      // into individual known label tokens by testing each word/phrase against BARE_LABELS.
      // We scan left-to-right, greedily consuming the longest matching label phrase.
      const words = labelLine.split(/\s+/);
      const matchedLabels: string[] = [];
      let wi = 0;
      while (wi < words.length) {
        let matched = false;
        // Try 3-word phrase, then 2-word, then 1-word
        for (let len = Math.min(3, words.length - wi); len >= 1; len--) {
          const phrase = words.slice(wi, wi + len).join(' ');
          for (const [pattern, field] of BARE_LABELS) {
            if (pattern.test(phrase)) {
              matchedLabels.push(phrase);
              wi += len;
              matched = true;
              break;
            }
          }
          if (matched) break;
        }
        if (!matched) wi++; // skip unrecognised word
      }
      if (matchedLabels.length > 1) labelParts = matchedLabels;
    }

    // ── Identify value columns ────────────────────────────────────────────────
    // First try double-space split. If that yields fewer tokens than labels,
    // fall back to single-space split and take the first N tokens.
    let valueParts = valueLine.split(/\s{2,}|\t/).map(t => t.trim()).filter(Boolean);
    if (valueParts.length < labelParts.length) {
      // Single-space split — take first token per label column
      const allTokens = valueLine.split(/\s+/).filter(Boolean);
      if (allTokens.length >= labelParts.length) {
        // Distribute: first token per label, last label gets the rest
        valueParts = labelParts.map((_, idx) => allTokens[idx] ?? '');
      }
    }

    // ── Pair labels with values ───────────────────────────────────────────────
    if (labelParts.length === valueParts.length && labelParts.length > 1) {
      for (let col = 0; col < labelParts.length; col++) {
        const lbl = labelParts[col];
        const val = valueParts[col];
        for (const [pattern, field] of BARE_LABELS) {
          if (pattern.test(lbl) && val) {
            applyDigitalField(result, field, val);
          }
        }
      }
    } else {
      // Single label (or couldn't pair) — take first token of value line
      for (const [pattern, field] of BARE_LABELS) {
        if (pattern.test(labelLine) && valueParts[0]) {
          applyDigitalField(result, field, valueParts[0]);
        }
      }
    }
  }

  // Name with no label: scan for lines that look like a person's name
  // (2-4 title-case words, no digits, no known non-name words)
  if (!result.memberName) {
    for (const line of lines) {
      if (looksLikeName(line)) {
        result.memberName = line.trim();
        const parts = splitNameParts(line.trim());
        if (!result.firstName) result.firstName = parts.firstName;
        if (!result.middleName) result.middleName = parts.middleName;
        if (!result.lastName) result.lastName = parts.lastName;
        if (!result.suffix) result.suffix = parts.suffix;
        break;
      }
    }
  }

  // Also run labeled + inline extraction as fallback for fields not yet found
  extractLabeled(lines, fullText, result);
  extractInline(lines, fullText, result);
}

function applyDigitalField(result: Record<string, any>, field: string, rawValue: string): void {
  if (field === 'rxGrp_tmp') {
    // RxGrp: store in rxPcn if not set, also groupNumber
    if (!result.rxPcn) result.rxPcn = rawValue.replace(/[^A-Z0-9\-]/gi, '');
    if (!result.groupNumber) result.groupNumber = rawValue.replace(/[^A-Z0-9\-]/gi, '');
    return;
  }
  if (result[field] !== null && result[field] !== undefined) return; // don't overwrite

  if (field === 'memberId') {
    const token = rawValue.split(/\s+/)[0].replace(/[^A-Z0-9\-]/gi, '');
    if (token.length >= 4) result.memberId = token;
  } else if (field === 'groupNumber') {
    const token = rawValue.split(/\s+/)[0].replace(/[^A-Z0-9\-]/gi, '');
    if (token.length >= 3) result.groupNumber = token;
  } else if (field === 'effectiveDate') {
    const m = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/.exec(rawValue);
    if (m) result.effectiveDate = parseIsoDate(m[1]);
  } else if (field === 'rxBin') {
    const m = /(\d{6})/.exec(rawValue);
    if (m) result.rxBin = m[1];
  } else if (field === 'rxPcn') {
    result.rxPcn = rawValue.replace(/[^A-Z0-9\-]/gi, '');
  } else if (field === 'planName') {
    result.planName = rawValue.trim();
  } else if (field === 'copayPrimary') {
    result.copayPrimary = parseDollar(rawValue.replace(/\$/g, ''));
  } else if (field === 'deductible') {
    result.deductible = parseDollar(rawValue.replace(/\$/g, ''));
  } else if (field === 'oopMax') {
    result.oopMax = parseDollar(rawValue.replace(/\$/g, ''));
  } else if (field === 'memberName') {
    const cleaned = rawValue.replace(/[^A-Za-z\s\-'\.]/g, '').trim();
    if (cleaned.length >= 3) {
      result.memberName = toTitleCase(cleaned);
      const parts = splitNameParts(cleaned);
      if (!result.firstName) result.firstName = parts.firstName ? toTitleCase(parts.firstName) : null;
      if (!result.middleName) result.middleName = parts.middleName ? toTitleCase(parts.middleName) : null;
      if (!result.lastName) result.lastName = parts.lastName ? toTitleCase(parts.lastName) : null;
      if (!result.suffix) result.suffix = parts.suffix;
    }
  }
}

// ─── LAYOUT_INLINE extractor ──────────────────────────────────────────────────
//
// Traditional printed cards: "Member ID: XYZ123456789"

function extractInline(lines: string[], fullText: string, result: Record<string, any>): void {
  function findInline(labelPattern: RegExp): string | null {
    const wrapped = new RegExp('(?:' + labelPattern.source + ')', 'i');
    const combined = new RegExp(wrapped.source + '[:\\s#\\.]+([A-Z0-9][\\w\\-/ ]{0,40})', 'i');
    const m = combined.exec(fullText);
    return m ? m[1].trim() : null;
  }
  function findDollarInline(labelPattern: RegExp): number | null {
    const wrapped = new RegExp('(?:' + labelPattern.source + ')', 'i');
    const combined = new RegExp(wrapped.source + '[:\\s]+\\$?\\s*([\\d,]+(?:\\.\\d{2})?)', 'i');
    const m = combined.exec(fullText);
    return m ? parseDollar(m[1]) : null;
  }

  if (!result.memberId) {
    const raw = findInline(/\bmember\s*(?:id|#|no\.?|number)\b|\bsubscriber\s*id\b|\bpolicy\s*id\b|\binsured\s*id\b/i);
    if (raw) {
      const token = raw.split(/\s+/)[0].replace(/[^A-Z0-9\-]/gi, '');
      if (token.length >= 4) result.memberId = token;
    }
  }
  if (!result.groupNumber) {
    // Note: \b does not work after '#' (non-word char), so use (?:[\s:#]|$) as terminator
    const raw = findInline(/\bgroup\s*(?:no\.?|number|num\.?|#)/i);
    if (raw) {
      const token = raw.split(/\s+/)[0].replace(/[^A-Z0-9\-]/gi, '');
      if (token.length >= 3) result.groupNumber = token;
    }
  }
  if (!result.memberName) {
    const raw = findInline(/\bmember\s*name\b|\bsubscriber\s*name\b|\binsured\s*name\b|\bpatient\s*name\b/i);
    if (raw) {
      const cleaned = raw.replace(/[^A-Za-z\s\-'\.]/g, '').trim();
      if (cleaned.length >= 3) {
        result.memberName = toTitleCase(cleaned);
        const parts = splitNameParts(cleaned);
        if (!result.firstName) result.firstName = parts.firstName ? toTitleCase(parts.firstName) : null;
        if (!result.middleName) result.middleName = parts.middleName ? toTitleCase(parts.middleName) : null;
        if (!result.lastName) result.lastName = parts.lastName ? toTitleCase(parts.lastName) : null;
        if (!result.suffix) result.suffix = parts.suffix;
      }
    }
  }
  if (!result.planName) {
    const raw = findInline(/\bplan\s*(?:name|type)\b|\bproduct\s*name\b/i);
    if (raw) result.planName = raw.trim();
  }
  if (!result.rxBin) {
    const m = /rx\s*bin[:\s#]*(\d{6})/i.exec(fullText);
    if (m) result.rxBin = m[1];
  }
  if (!result.rxPcn) {
    const m = /\bpcn[:\s]+([A-Z0-9]{3,12})/i.exec(fullText);
    if (m) result.rxPcn = m[1];
  }
  if (!result.copayPrimary) result.copayPrimary = findDollarInline(/\b(?:primary\s*care|pcp|office\s*visit)\b/i) ?? findDollarInline(/\bcopay\b/i);
  if (!result.copaySpecialist) result.copaySpecialist = findDollarInline(/\bspecialist\b/i);
  if (!result.copayUrgentCare) result.copayUrgentCare = findDollarInline(/\burgent\s*care\b/i);
  if (!result.copayER) result.copayER = findDollarInline(/\b(?:emergency\s*room|er\s*copay|emergency\s*care)\b/i);
  if (!result.deductible) result.deductible = findDollarInline(/\bdeductible\b/i);
  if (!result.oopMax) result.oopMax = findDollarInline(/\bout[\s\-]*of[\s\-]*pocket\s*(?:max(?:imum)?)?|\boop\s*max\b/i);
  if (!result.effectiveDate) {
    const m = /(?:effective\s*(?:date)?|eff\.?\s*date|coverage\s*date)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i.exec(fullText);
    if (m) result.effectiveDate = parseIsoDate(m[1]);
  }
  if (!result.insurerPhone) {
    const m = /(?:1[\s\-]?)?\(?\d{3}\)?[\s\-\.]\d{3}[\s\-\.]\d{4}/.exec(fullText);
    if (m) result.insurerPhone = m[0].trim();
  }
}

// ─── Main extractFields function ──────────────────────────────────────────────

export function extractFields(text: string): Record<string, any> {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const fullText = text;

  const result: Record<string, any> = {
    memberName: null,
    firstName: null,
    middleName: null,
    lastName: null,
    suffix: null,
    memberId: null,
    groupNumber: null,
    planName: null,
    payorName: null,
    rxBin: null,
    rxPcn: null,
    copayPrimary: null,
    copaySpecialist: null,
    copayUrgentCare: null,
    copayER: null,
    deductible: null,
    oopMax: null,
    coverageType: null,
    effectiveDate: null,
    subscriberName: null,
    insurerPhone: null,
    dependents: [] as Array<{ firstName: string; lastName: string; dateOfBirth: string | null; relationship: string | null }>,
  };

  // ── Detect layout and run the matching extractor ──────────────────────────
  const layout = detectLayout(lines);

  if (layout === 'DIGITAL') {
    extractDigital(lines, fullText, result);
  } else if (layout === 'INLINE') {
    extractInline(lines, fullText, result);
    // Also run labeled as fallback
    extractLabeled(lines, fullText, result);
  } else {
    // LABELED (default)
    extractLabeled(lines, fullText, result);
    // Also run inline as fallback for fields not found by labeled
    extractInline(lines, fullText, result);
  }

  // ── Fields that run regardless of layout ─────────────────────────────────

  // Coverage Type (PPO/HMO/etc. appear anywhere on the card)
  if (!result.coverageType) {
    const m = /\b(PPO|HMO|EPO|POS|HDHP|HSA|FSA)\b/.exec(fullText);
    if (m) result.coverageType = m[1].toUpperCase();
  }

  // Payor Name (match against known carrier list)
  if (!result.payorName) {
    for (const [pattern, name] of KNOWN_PAYORS) {
      if (pattern.test(fullText)) {
        result.payorName = name;
        break;
      }
    }
  }

  // Plan name from Cigna-style "Med/Dntl/Rx/Vis : Plan Name" header
  if (!result.planName) {
    const m = /(?:med|dntl|rx|vis)[\/\s]+(?:med|dntl|rx|vis)?[\/\s]*(?:med|dntl|rx|vis)?[\/\s]*(?:med|dntl|rx|vis)?[:\s]+([A-Za-z][A-Za-z0-9 \-+]{2,50})/i.exec(fullText);
    if (m) result.planName = m[1].trim();
  }

  // Dependents
  result.dependents = extractDependents(fullText, lines, result.memberName);

  return result;
}

// ─── Dependent extraction ─────────────────────────────────────────────────────

const RELATIONSHIP_KEYWORDS = /\b(spouse|child|son|daughter|domestic\s*partner|dependent|other)\b/i;
const RELATIONSHIP_MAP: Record<string, string> = {
  spouse: 'Spouse',
  child: 'Child',
  son: 'Child',
  daughter: 'Child',
  'domestic partner': 'Domestic Partner',
  dependent: 'Other',
  other: 'Other',
};

function normaliseRelationship(raw: string): string {
  const key = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  return RELATIONSHIP_MAP[key] ?? 'Other';
}

/**
 * Try to parse a date string in common formats (MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD)
 * and return an ISO date string (YYYY-MM-DD) or null.
 */
function parseDepDate(raw: string): string | null {
  return parseIsoDate(raw);
}

/**
 * Extract a list of dependents from the OCR text.
 * Handles three common card layouts:
 *
 * Layout A — inline list after a "Dependents:" header:
 *   Dependents: JANE DOE (Spouse), TOMMY DOE (Child)
 *
 * Layout B — tabular section where each row is:
 *   FIRSTNAME LASTNAME  [Relationship]  [MM/DD/YYYY]
 *   (detected by presence of a relationship keyword on the same line as a name)
 *
 * Layout C — numbered/bulleted list:
 *   1. JANE DOE - Spouse
 *   2. TOMMY DOE - Child
 */
function extractDependents(
  fullText: string,
  lines: string[],
  primaryName: string | null
): Array<{ firstName: string; lastName: string; dateOfBirth: string | null; relationship: string | null }> {
  const deps: Array<{ firstName: string; lastName: string; dateOfBirth: string | null; relationship: string | null }> = [];

  // ── Layout A: "Dependents: NAME (Rel), NAME (Rel)" ────────────────────────
  const sectionMatch = /(?:dependents?|covered\s*members?|other\s*insured)[:\s]+([^\n]{5,200})/i.exec(fullText);
  if (sectionMatch && sectionMatch[1]) {
    const section = sectionMatch[1];
    const entries = section.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    for (const entry of entries) {
      const relMatch = /\(([^)]+)\)/.exec(entry);
      const relationship = relMatch ? normaliseRelationship(relMatch[1]) : null;
      const namePart = entry.replace(/\([^)]*\)/g, '').trim();
      const nameParts = namePart.split(/\s+/).filter(Boolean);
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        if (primaryName && namePart.toLowerCase() === primaryName.toLowerCase()) continue;
        deps.push({ firstName, lastName, dateOfBirth: null, relationship });
      }
    }
    if (deps.length > 0) return deps;
  }

  // ── Layout B: tabular — lines containing a relationship keyword ───────────
  let inDependentSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(?:dependents?|covered\s*members?|other\s*insured)\s*:?$/i.test(line)) {
      inDependentSection = true;
      continue;
    }
    if (inDependentSection && /^(?:benefits?|coverage|deductible|copay|rx|plan|group|member|id|phone|address|network)/i.test(line)) {
      inDependentSection = false;
    }
    if (!inDependentSection) continue;
    const relMatch = RELATIONSHIP_KEYWORDS.exec(line);
    if (!relMatch) continue;
    const relationship = normaliseRelationship(relMatch[1]);
    const withoutRel = line.replace(RELATIONSHIP_KEYWORDS, '').trim();
    const dateMatch = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/.exec(withoutRel);
    const dateOfBirth = dateMatch ? parseDepDate(dateMatch[1]) : null;
    const namePart = withoutRel.replace(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/g, '').replace(/[-–—,]/g, ' ').trim();
    const nameParts = namePart.split(/\s+/).filter((p) => /^[A-Za-z]/.test(p));
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      if (primaryName && namePart.toLowerCase() === primaryName.toLowerCase()) continue;
      deps.push({ firstName, lastName, dateOfBirth, relationship });
    }
  }
  if (deps.length > 0) return deps;

  // ── Layout C: numbered list "1. NAME - Relationship" ─────────────────────
  const numberedPattern = /^\d+[.)\s]+([A-Za-z][A-Za-z\s\-']{3,40})\s*[-–—]\s*([A-Za-z\s]+)$/;
  for (const line of lines) {
    const m = numberedPattern.exec(line);
    if (!m) continue;
    const nameParts = m[1].trim().split(/\s+/);
    const relationship = RELATIONSHIP_KEYWORDS.test(m[2]) ? normaliseRelationship(m[2].trim()) : null;
    if (nameParts.length >= 2) {
      deps.push({ firstName: nameParts[0], lastName: nameParts.slice(1).join(' '), dateOfBirth: null, relationship });
    }
  }

  return deps;
}

// ─── Upload card ──────────────────────────────────────────────────────────────

export const uploadInsuranceCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const policy = await prisma.patientInsurance.findUnique({ where: { id } });
    if (!policy) {
      sendError(res, 404, notFound('INSURANCE_POLICY'), 'Insurance policy not found');
      return;
    }

    const file = (req as any).file;
    if (!file) {
      sendError(res, 400, validationError('INSURANCE_CARD'), 'No image file provided');
      return;
    }

    if (file.size > MAX_SIZE) {
      sendError(res, 400, validationError('INSURANCE_CARD'), 'Image exceeds 10 MB limit');
      return;
    }

    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (!ALLOWED_IMAGE_TYPES.includes(ext)) {
      sendError(res, 400, validationError('INSURANCE_CARD'), `File type .${ext} is not supported. Use JPG, PNG, or WebP.`);
      return;
    }

    // Remove old card if present
    if (policy.insuranceCardPath) {
      const oldPath = path.join(__dirname, '../../', policy.insuranceCardPath.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const fileName = `${id}-${Date.now()}.${ext}`;
    const filePath = path.join(CARD_DIR, fileName);
    fs.writeFileSync(filePath, file.buffer);
    const cardPath = `/uploads/insurance-cards/${fileName}`;

    const updated = await prisma.patientInsurance.update({
      where: { id },
      data: {
        insuranceCardPath: cardPath,
        updatedAt: BigInt(Math.floor(Date.now() / 1000)),
      },
      include: POLICY_INCLUDE,
    });

    res.status(200).json({
      success: true,
      data: {
        policy: serializePolicy(updated),
        cardUrl: cardPath,
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'INSURANCE_CARD');
  }
};

// ─── Delete card ──────────────────────────────────────────────────────────────

export const deleteInsuranceCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const policy = await prisma.patientInsurance.findUnique({ where: { id } });
    if (!policy) {
      sendError(res, 404, notFound('INSURANCE_POLICY'), 'Insurance policy not found');
      return;
    }

    if (policy.insuranceCardPath) {
      const filePath = path.join(__dirname, '../../', policy.insuranceCardPath.replace(/^\//, ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    const updated = await prisma.patientInsurance.update({
      where: { id },
      data: {
        insuranceCardPath: null,
        updatedAt: BigInt(Math.floor(Date.now() / 1000)),
      },
      include: POLICY_INCLUDE,
    });

    res.status(200).json({ success: true, data: serializePolicy(updated) });
  } catch (error) {
    handlePrismaError(res, error, 'INSURANCE_CARD');
  }
};

// ─── Parse card for new patient (no policy ID required) ─────────────────────

/**
 * POST /api/patients/parse-card
 * Accepts a card image, runs OCR, and returns extracted fields including
 * name parts (firstName, middleName, lastName, suffix). Used in the Add
 * Patient modal before any patient or policy record exists.
 */
export const parseCardForNewPatient = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = (req as any).file;
    if (!file) {
      sendError(res, 400, validationError('INSURANCE_CARD'), 'No image file provided');
      return;
    }

    if (file.size > MAX_SIZE) {
      sendError(res, 400, validationError('INSURANCE_CARD'), 'Image exceeds 10 MB limit');
      return;
    }

    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (!ALLOWED_IMAGE_TYPES.includes(ext)) {
      sendError(res, 400, validationError('INSURANCE_CARD'), `File type .${ext} is not supported. Use JPG, PNG, or WebP.`);
      return;
    }

    const rawText = await runOCR(file.buffer);
    const extracted = extractFields(rawText);

    res.status(200).json({
      success: true,
      data: { extracted, rawText },
    });
  } catch (error: any) {
    console.error('Insurance card parse error:', error?.message ?? error);
    sendError(res, 500, 'CARD_PARSE_FAILED', error?.message ?? 'Failed to parse insurance card');
  }
};

// ─── Parse card (Tesseract OCR + regex extraction) ────────────────────────────

export const parseInsuranceCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const policy = await prisma.patientInsurance.findUnique({ where: { id } });
    if (!policy) {
      sendError(res, 404, notFound('INSURANCE_POLICY'), 'Insurance policy not found');
      return;
    }

    const file = (req as any).file;
    if (!file) {
      sendError(res, 400, validationError('INSURANCE_CARD'), 'No image file provided');
      return;
    }

    if (file.size > MAX_SIZE) {
      sendError(res, 400, validationError('INSURANCE_CARD'), 'Image exceeds 10 MB limit');
      return;
    }

    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (!ALLOWED_IMAGE_TYPES.includes(ext)) {
      sendError(res, 400, validationError('INSURANCE_CARD'), `File type .${ext} is not supported.`);
      return;
    }

    // Run Tesseract OCR
    const rawText = await runOCR(file.buffer);

    // Extract structured fields from OCR text
    const extracted = extractFields(rawText);

    // Save the card image to disk
    if (policy.insuranceCardPath) {
      const oldPath = path.join(__dirname, '../../', policy.insuranceCardPath.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const fileName = `${id}-${Date.now()}.${ext}`;
    const filePath = path.join(CARD_DIR, fileName);
    fs.writeFileSync(filePath, file.buffer);
    const cardPath = `/uploads/insurance-cards/${fileName}`;

    await prisma.patientInsurance.update({
      where: { id },
      data: {
        insuranceCardPath: cardPath,
        updatedAt: BigInt(Math.floor(Date.now() / 1000)),
      },
    });

    res.status(200).json({
      success: true,
      data: { extracted, cardUrl: cardPath, rawText },
    });
  } catch (error: any) {
    console.error('Insurance card parse error:', error?.message ?? error);
    sendError(res, 500, 'CARD_PARSE_FAILED', error?.message ?? 'Failed to parse insurance card');
  }
};
