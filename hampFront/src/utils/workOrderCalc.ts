/** 작업지시 등록 - 투입량/헴프박 계산 유틸 (순수 함수 모음) */
import type {
  InstructQtyPreviewLineResponse,
  InstructQtyPreviewResponse,
} from "@/api/sales/SalesOrder";

/* ───────────── 반올림 / 비교 ───────────── */

/** 풀(총량) 비교 시 허용하는 오차 (서버가 라인별로 소수 1자리 반올림하므로 합계가 0.1 어긋날 수 있다) */
export const EPS = 0.1;

/** 소수점 부동소수점 오차 방지용 반올림 (수량 계산용 - 소수 3자리) */
export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * 소수 1자리 반올림 - 서버(미리보기)가 단계마다 소수 1자리로 반올림하므로 프론트도 똑같이 맞춘다
 * EPSILON 보정: 282.75 같은 값이 부동소수점 때문에 282.7 로 내려가는 것을 막는다
 */
export const round1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;

/** 직접입력 문자열 → 숫자 (빈 값/음수/NaN 은 0) */
export const toNum = (s?: string) => {
  const n = parseFloat(s ?? "");
  return Number.isNaN(n) || n < 0 ? 0 : n;
};

/** 그룹 합계가 풀을 (오차 이상) 초과했는지 */
export const isOverPool = (total: number, pool: number) => round3(total - pool) > EPS;

/** 그룹 합계가 풀을 (오차 범위 안에서) 전부 사용했는지 */
export const isFullyUsed = (total: number, pool: number) => round3(pool - total) <= EPS;

/**
 * 소수 입력 정제
 * - 기존 정규식은 "1.2.3" 처럼 점이 두 번 들어간 입력을 걸러내지 못했다.
 * - 숫자/점만 남기고, 첫 번째 점만 인정하며, 소수는 1자리까지만 허용한다.
 * - "12." 처럼 입력 중인 값은 그대로 둔다 (타이핑 중 커서가 튀지 않도록)
 */
export const sanitizeDecimal = (text: string) => {
  const cleaned = text.replace(/[^\d.]/g, "");
  const [intPart, ...rest] = cleaned.split(".");
  if (rest.length === 0) return intPart;
  return `${intPart}.${rest.join("").slice(0, 1)}`;
};

/* ───────────── 서버 값 재사용 (② → ③ 소수점 불일치 해결의 핵심) ───────────── */

/** 투입량이 ①/② 서버 미리보기 값과 같으면 어느 쪽인지 알려준다. */
export const matchServerQty = (p: InstructQtyPreviewLineResponse, qty: number): "A" | "B" | null => {
  const v = round1(qty);
  if (round1(p.targetYieldKeptQty) === v) return "B";
  if (round1(p.ratioKeptQty) === v) return "A";
  return null;
};

/** 헴프박 발생량(건조 전) / 건조 후 공급량 */
export interface ParkInfo {
  byproduct: number;
  dry: number;
}

/** 오일 투입량(탈피씨드) → 헴프박 발생량 / 건조 후 공급량 */
export function calcParkFromOil(
  oilQty: number,
  oilPreview: InstructQtyPreviewLineResponse | null | undefined,
  park: InstructQtyPreviewResponse["park"] | null | undefined,
): ParkInfo | null {
  const bp = oilPreview?.byproductYieldPercent;
  const dryRate = park?.dryYieldPercent;
  if (!oilPreview || !park || bp == null || dryRate == null) return null;

  const matched = matchServerQty(oilPreview, oilQty);
  if (matched === "A") return { byproduct: park.ratioKeptByproductQty, dry: park.ratioKeptDryQty };
  if (matched === "B") return { byproduct: park.targetYieldKeptByproductQty, dry: park.targetYieldKeptDryQty };

  const byproduct = round1((oilQty * bp) / 100); // 건조 전 헴프박 발생량
  return { byproduct, dry: round1((byproduct * dryRate) / 100) }; // 건조 후 = PARK 그룹 투입 가능 풀
}

/**
 * ③ 직접입력 라인의 예상 산출량
 * - 서버 값(①/②)과 같은 투입량이면 서버 산출량을 그대로 쓴다
 * - 수율 미확정이면 null
 */
export function calcDirectOutput(p: InstructQtyPreviewLineResponse, qty: number): number | null {
  if (p.outputYieldPercent == null) return null;
  const matched = matchServerQty(p, qty);
  if (matched === "A") return p.ratioKeptOutputQty;
  if (matched === "B") return p.targetYieldKeptOutputQty;
  return round1((qty * p.outputYieldPercent) / 100);
}

/**
 * 총량(total)을 비율대로 나눈다 (전부 소수 1자리, 마지막 항목이 나머지를 가져가서 합계가 정확히 total)
 * - 비율 합이 0 이면 균등 분배
 */
export function splitByRatio(total: number, ratios: number[]): number[] {
  if (ratios.length === 0) return [];
  const sum = ratios.reduce((s, r) => s + r, 0);
  const weights = sum > 0 ? ratios.map((r) => r / sum) : ratios.map(() => 1 / ratios.length);

  let assigned = 0;
  return weights.map((w, i) => {
    const v = i === weights.length - 1 ? round1(total - assigned) : round1(total * w);
    assigned = round1(assigned + v);
    return Math.max(0, v);
  });
}
