import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NumberInput } from "@/components/common/NumberInput";
import { SelectBox, type SelectBoxOption } from "@/components/common/SelectBox";
import type { ItemOptionResponse } from "@/api/master/Item";
import type { FiberSalesOrderLineResponse } from "@/api/sales/FiberSalesOrder";
import {
  FIBER_QTY_UNIT,
  calcPercent,
  createEmptyLine,
  formatKg,
  r2,
  sumAllocated,
  type FiberAllocationLine,
} from "@/utils/fiberSalesOrderAllocation";
import "@/pages/page/inpiSales/InpiSales.css";

/** 검증 실패 시 이 영역으로 스크롤하기 위한 element id */
export const FIBER_ALLOCATION_ELEMENT_ID = "fso-allocation";

/** 구간별 색상 개수 (CSS의 fsoSeg--0 ~ fsoSeg--3 과 맞춘다) */
const SEGMENT_COLOR_COUNT = 4;

// ── 공용 배분 막대 (수정 모드 / 상세 읽기 모드 공용) ───────────────────────────

/** 배분 막대 한 구간 */
export interface FiberAllocationSegment {
  key: string;
  /** 막대 안에 표시할 제품명 */
  label: string;
  /** 배분 원물(kg) */
  qty: number;
  /** 색상 번호 (라인 순서 기준, 라인 점 색과 맞춘다) */
  colorIndex: number;
}

interface FiberAllocationBarProps {
  segments: FiberAllocationSegment[];
  /** 투입원료 총량(kg) - 배분 합계와 비교한다 */
  totalQty: number | null;
}

/**
 * 배분 막대 + 합계/상태 문구
 * - 수정 모드와 상세 읽기 모드가 같은 컴포넌트를 쓰므로 모양과 막대 안 글자가 항상 같다.
 */
export function FiberAllocationBar({ segments, totalQty }: FiberAllocationBarProps) {
  const total = totalQty ?? 0;
  const sum = r2(segments.reduce((acc, seg) => acc + (seg.qty ?? 0), 0));

  // ---- 배분 상태 문구 ----
  let stateClass = "wait";
  let stateText = "투입원료 수량을 먼저 입력하세요";
  if (total > 0) {
    if (sum === r2(total)) {
      stateClass = "ok";
      stateText = "배분 완료 · 합계가 투입원료 수량과 같습니다";
    } else if (sum < total) {
      stateClass = "wait";
      stateText = `남은 원물 ${formatKg(r2(total - sum))} ${FIBER_QTY_UNIT}`;
    } else {
      stateClass = "bad";
      stateText = `${formatKg(r2(sum - total))} ${FIBER_QTY_UNIT} 초과 배분`;
    }
  }

  // 막대 기준 폭: 초과 배분이어도 막대가 넘치지 않도록 큰 쪽을 기준으로 한다
  const barBase = Math.max(total, sum) || 1;
  const isOver = total > 0 && sum > total;

  return (
    <>
      {/* 배분 막대 */}
      <div className={`fsoAllocBar${isOver ? " fsoAllocBar--over" : ""}`} aria-label="원물 배분 막대">
        {segments.map((seg) => {
          const qty = seg.qty ?? 0;
          if (qty <= 0) return null;
          const text = `${seg.label} ${formatKg(qty)}`;
          return (
            <div
              key={seg.key}
              className={`fsoAllocSeg fsoSeg--${seg.colorIndex % SEGMENT_COLOR_COUNT}`}
              style={{ width: `${(qty / barBase) * 100}%` }}
              title={text} // 구간이 좁아 글자가 잘릴 때 전체 내용 확인용
            >
              {text}
            </div>
          );
        })}
        {total > sum && (
          <div className="fsoAllocSeg fsoAllocSeg--rest" style={{ width: `${((total - sum) / barBase) * 100}%` }}>
            미배분 {formatKg(r2(total - sum))}
          </div>
        )}
      </div>

      {/* 합계 / 상태 */}
      <div className="fsoAllocMeta">
        <span>
          배분 <b>{formatKg(sum)}</b> / <b>{formatKg(total)}</b> {FIBER_QTY_UNIT}
        </span>
        <span className={`fsoAllocState fsoAllocState--${stateClass}`}>{stateText}</span>
      </div>
    </>
  );
}

// ── 제품별 원물 배분 편집 섹션 (등록/상세 수정 공용) ───────────────────────────

interface FiberSalesOrderAllocationSectionProps {
  /** form: 등록 화면(formCard), detail: 상세 수정 화면(detailSection) */
  variant?: "form" | "detail";
  /** 투입원료 총량(kg) - 배분 합계와 비교한다 */
  totalQty: number | null;
  /** 편집 중인 배분 라인 */
  lines: FiberAllocationLine[];
  /** 가공 요청 제품 옵션 (품목 옵션 API 결과) */
  productOptions: ItemOptionResponse[];
  onChange: (lines: FiberAllocationLine[]) => void;
  disabled?: boolean;
  /** 저장 시도 후 비어 있는 칸을 빨갛게 표시할지 여부 */
  showErrors?: boolean;
}

export function FiberSalesOrderAllocationSection({
  variant = "form",
  totalQty,
  lines,
  productOptions,
  onChange,
  disabled = false,
  showErrors = false,
}: FiberSalesOrderAllocationSectionProps) {
  const total = totalQty ?? 0;
  const sum = sumAllocated(lines);
  const usedCodes = new Set(lines.map((l) => l.productItemCode).filter(Boolean));

  // ---- 라인 조작 ----
  const updateLine = (key: string, patch: Partial<FiberAllocationLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) => onChange(lines.filter((l) => l.key !== key));

  const addLine = () => onChange([...lines, createEmptyLine()]);

  // 남은 원물(총량 - 다른 라인 합계)을 마지막 라인에 채운다
  const fillRest = () => {
    if (total <= 0 || lines.length === 0) return;
    const last = lines[lines.length - 1];
    const others = r2(sum - (last.allocatedInputQty ?? 0));
    updateLine(last.key, { allocatedInputQty: Math.max(0, r2(total - others)) });
  };

  // 다른 라인에서 이미 고른 제품은 제외하고, 현재 라인의 제품은 항상 포함
  const getSelectOptions = (line: FiberAllocationLine): SelectBoxOption[] => {
    const list: SelectBoxOption[] = productOptions
      .filter((opt) => opt.itemCode === line.productItemCode || !usedCodes.has(opt.itemCode))
      .map((opt) => ({
        value: opt.itemCode,
        label: opt.itemNm ?? opt.itemCode,
        description: opt.itemCode,
      }));
    // 옵션 목록에 없는 기존 제품(비활성 등)도 선택값이 보이도록 보정
    if (line.productItemCode && !list.some((o) => o.value === line.productItemCode)) {
      list.unshift({ value: line.productItemCode, label: line.productItemCode, description: "" });
    }
    return list;
  };

  const productName = (code: string) =>
    productOptions.find((opt) => opt.itemCode === code)?.itemNm ?? code;

  // 편집 중인 라인 → 공용 배분 막대 구간
  const segments: FiberAllocationSegment[] = lines.map((line, index) => ({
    key: line.key,
    label: line.productItemCode ? productName(line.productItemCode) : "미선택",
    qty: line.allocatedInputQty ?? 0,
    colorIndex: index,
  }));

  const body = (
    <>
      {/* 배분 막대 + 합계/상태 (상세 읽기 모드와 공용) */}
      <FiberAllocationBar segments={segments} totalQty={totalQty} />

      {/* 배분 라인 목록 */}
      <div className="fsoLineList">
        {lines.map((line, index) => {
          const qty = line.allocatedInputQty ?? 0;
          const productMissing = showErrors && !line.productItemCode;
          const qtyMissing = showErrors && !(qty > 0);
          return (
            <div className="fsoLineRow" key={line.key}>
              <span className={`fsoLineDot fsoSeg--${index % SEGMENT_COLOR_COUNT}`} aria-hidden="true" />

              <div className="fsoLineProduct">
                <SelectBox
                  id={`fso-line-product-${index}`}
                  value={line.productItemCode}
                  options={getSelectOptions(line)}
                  placeholder="제품 선택"
                  searchPlaceholder="제품명 또는 코드 검색"
                  searchable
                  disabled={disabled}
                  invalid={productMissing || undefined}
                  onChange={(v) => updateLine(line.key, { productItemCode: v })}
                />
              </div>

              <div className="fsoLineQty">
                <NumberInput
                  id={`fso-line-qty-${index}`}
                  className="formInput hasSuffix"
                  wrapClassName="formInputWrap"
                  suffix={<span className="formInputSuffix">{FIBER_QTY_UNIT}</span>}
                  placeholder="0"
                  decimalScale={2}
                  aria-invalid={qtyMissing || undefined}
                  value={line.allocatedInputQty}
                  disabled={disabled}
                  onValueChange={(v) => updateLine(line.key, { allocatedInputQty: v })}
                />
              </div>

              <span className="fsoLinePct">{calcPercent(qty, total)}%</span>

              <button
                type="button"
                className="fsoLineRemove"
                onClick={() => removeLine(line.key)}
                disabled={disabled || lines.length === 1}
              >
                삭제
              </button>
            </div>
          );
        })}
      </div>

      <div className="fsoAddLine">
        <button
          type="button"
          className="fsoDashedBtn"
          onClick={addLine}
          disabled={disabled || lines.length >= productOptions.length}
        >
          + 제품 추가
        </button>
        <button
          type="button"
          className="fsoDashedBtn"
          onClick={fillRest}
          disabled={disabled || total <= 0 || lines.length === 0}
        >
          남은 원물을 마지막 제품에 채우기
        </button>
      </div>

      <p className="fsoHint">
        예) 원물 <b>100kg</b> 중 <b>60kg은 솜</b>, <b>40kg은 슬라이버</b>로 만들어 달라는 요청이면 투입원료 수량 100,
        배분 솜 60 · 슬라이버 40으로 입력합니다.
      </p>
    </>
  );

  // 상세 수정 화면: 기존 detailSection 스타일에 맞춘다
  if (variant === "detail") {
    return (
      <div id={FIBER_ALLOCATION_ELEMENT_ID} className="detailSection detailSection--full fsoAlloc">
        <h3 className="detailSectionTitle">
          제품별 원물 배분 <span className="required" aria-hidden="true">*</span>
        </h3>
        <p className="fsoAllocDesc">
          원물 중 몇 kg을 어떤 제품으로 만들지 나눕니다. 합계가 투입원료 수량과 같아야 저장됩니다.
        </p>
        {body}
      </div>
    );
  }

  // 등록 화면: formCard 스타일
  return (
    <section id={FIBER_ALLOCATION_ELEMENT_ID} className="formCard fsoAlloc" aria-labelledby="fso-alloc-title">
      <div className="formCardHead">
        <div>
          <h2 className="formCardTitle" id="fso-alloc-title">
            제품별 원물 배분 <span className="required" aria-hidden="true">*</span>
          </h2>
          <p className="formCardDesc">
            원물 중 몇 kg을 어떤 제품으로 만들지 나눕니다. 수율 계산 없이 원물 중량 그대로 배분하고,
            합계가 투입원료 수량과 같아야 저장됩니다.
          </p>
        </div>
      </div>
      {body}
    </section>
  );
}

// ── 목록용: 제품별 배분 미니 막대 (한 줄 + 마우스 호버 툴팁) ───────────────────

interface FiberAllocationMiniBarProps {
  /** 배분 라인 (목록 응답에 없으면 undefined → "-" 표시) */
  lines?: Pick<FiberSalesOrderLineResponse, "productItemCode" | "productItemNm" | "allocatedInputQty">[] | null;
  /** 투입원료 총량(kg) - 막대 폭 계산 기준 */
  totalQty: number | null;
}

/** 툴팁 위치 (화면 기준 좌표) */
interface TooltipPos {
  x: number;
  y: number;
  /** true 면 막대 아래에 표시 (위쪽 공간이 부족할 때) */
  below: boolean;
}

export function FiberAllocationMiniBar({ lines, totalQty }: FiberAllocationMiniBarProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TooltipPos | null>(null);

  if (!lines || lines.length === 0) return <span>-</span>;

  const base = totalQty && totalQty > 0 ? totalQty : lines.reduce((acc, l) => acc + l.allocatedInputQty, 0) || 1;

  // 막대 위(공간이 없으면 아래)에 툴팁을 띄운다.
  // 테이블 래퍼가 overflow 로 잘라내므로 position: fixed + portal 로 body 에 그린다.
  const showTip = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = rect.top < 160;
    // 좌우로 화면 밖으로 나가지 않도록 중앙 좌표를 보정
    const x = Math.min(Math.max(rect.left + rect.width / 2, 140), window.innerWidth - 140);
    setTip({ x, y: below ? rect.bottom + 8 : rect.top - 8, below });
  };
  const hideTip = () => setTip(null);

  return (
    <div
      ref={wrapRef}
      className="fsoMiniBarWrap"
      tabIndex={0} // 키보드 포커스로도 확인 가능
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
      onFocus={showTip}
      onBlur={hideTip}
    >
      <div className="fsoMiniBar">
        {lines.map((line, index) => (
          <span
            key={`${line.productItemCode}-${index}`}
            className={`fsoSeg--${index % SEGMENT_COLOR_COUNT}`}
            style={{ width: `${(line.allocatedInputQty / base) * 100}%` }}
          />
        ))}
      </div>
      <span className="fsoMiniBarCount">{lines.length}종</span>

      {tip &&
        createPortal(
          <div
            className={`fsoTip${tip.below ? " fsoTip--below" : ""}`}
            style={{ left: tip.x, top: tip.y }}
            role="tooltip"
          >
            <div className="fsoTipTitle">제품별 원물 배분</div>
            {lines.map((line, index) => (
              <div className="fsoTipRow" key={`${line.productItemCode}-${index}`}>
                <span className={`fsoTipDot fsoSeg--${index % SEGMENT_COLOR_COUNT}`} aria-hidden="true" />
                <span className="fsoTipName">{line.productItemNm || line.productItemCode}</span>
                <span className="fsoTipQty">
                  {formatKg(line.allocatedInputQty)} {FIBER_QTY_UNIT}
                </span>
                <span className="fsoTipPct">{calcPercent(line.allocatedInputQty, base)}%</span>
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
