/**
 * parseJapaneseDate
 *
 * 以下のフォーマットをすべて "YYYY-MM-DD" に変換します。
 * - 既にISO形式          : "2025-04-20"     → "2025-04-20"
 * - スラッシュ区切り     : "2025/04/20"     → "2025-04-20"
 * - ドット区切り         : "2025.4.20"      → "2025-04-20"
 * - 8桁数字              : "20250420"        → "2025-04-20"
 * - 令和短縮（英字）     : "R7.4.20"        → "2025-04-20"
 * - 令和短縮（英字）     : "R7年4月20日"    → "2025-04-20"
 * - 令和漢字フル         : "令和7年4月20日" → "2025-04-20"
 *
 * 変換できない場合は null を返します。
 */

const REIWA_BASE = 2018; // 令和元年 = 2019 = (1 + 2018)

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toISO(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseJapaneseDate(input: string): string | null {
  const s = input.trim();
  if (!s) return null;

  // ── 1. 既にYYYY-MM-DD ───────────────────────────────
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // ── 2. 8桁数字 "20250420" ─────────────────────────────
  if (/^\d{8}$/.test(s)) {
    const y = parseInt(s.slice(0, 4), 10);
    const m = parseInt(s.slice(4, 6), 10);
    const d = parseInt(s.slice(6, 8), 10);
    return toISO(y, m, d);
  }

  // ── 3. YYYY/M/D or YYYY.M.D ───────────────────────────
  const slashDot = s.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})$/);
  if (slashDot) {
    return toISO(
      parseInt(slashDot[1], 10),
      parseInt(slashDot[2], 10),
      parseInt(slashDot[3], 10)
    );
  }

  // ── 4. 令和漢字フル "令和7年4月20日" ─────────────────
  const reiwaKanji = s.match(/^令和(\d+)年(\d+)月(\d+)日?$/);
  if (reiwaKanji) {
    return toISO(
      parseInt(reiwaKanji[1], 10) + REIWA_BASE,
      parseInt(reiwaKanji[2], 10),
      parseInt(reiwaKanji[3], 10)
    );
  }

  // ── 5. 令和英字短縮 "R7年4月20日" ───────────────────
  const reiwaKanjiEn = s.match(/^[Rr](\d+)年(\d+)月(\d+)日?$/);
  if (reiwaKanjiEn) {
    return toISO(
      parseInt(reiwaKanjiEn[1], 10) + REIWA_BASE,
      parseInt(reiwaKanjiEn[2], 10),
      parseInt(reiwaKanjiEn[3], 10)
    );
  }

  // ── 6. 令和英字ドット "R7.4.20" ─────────────────────
  const reiwaShort = s.match(/^[Rr](\d+)[\/\.](\d{1,2})[\/\.](\d{1,2})$/);
  if (reiwaShort) {
    return toISO(
      parseInt(reiwaShort[1], 10) + REIWA_BASE,
      parseInt(reiwaShort[2], 10),
      parseInt(reiwaShort[3], 10)
    );
  }

  // ── 7. 一般的な "YYYY年M月D日" ──────────────────────
  const westernKanji = s.match(/^(\d{4})年(\d+)月(\d+)日?$/);
  if (westernKanji) {
    return toISO(
      parseInt(westernKanji[1], 10),
      parseInt(westernKanji[2], 10),
      parseInt(westernKanji[3], 10)
    );
  }

  return null;
}
