import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type SyntheticEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  WorkOrderApi,
  type WorkOrderMaterialEstimateLineResponse,
  type WorkOrderMaterialEstimateSummaryResponse,
} from "@/api/WorkOrder";
import { UserApi, type UserOptionResponse } from "@/api/User";
import {
  SalesOrderApi,
  type SalesOrderDetailResponse,
  type SalesOrderOptionResponse,
} from "@/api/sales/SalesOrder";
import { ItemApi, type ItemRoutingChainResponse, type ItemRoutingResponse } from "@/api/master/Item";
import "./Food.css";
import { BanknotesIcon, BuildingOffice2Icon, CalendarDaysIcon, CubeIcon } from "@heroicons/react/24/outline";

// toISOString()은 UTC 기준이라 한국 시간 00:00~09:00 사이에는 전날 날짜가 나와 로컬 기준으로 만든다
const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/* ───────────── 단위 변환 ───────────── */

/**
 * 단위 처리
 * - 서버 추정치 단위(SERVER_RAW_UNIT)와 수주 투입원료 단위(G, KG 등)를 맞춰서 변환한 뒤 사용한다
 */
// 서버 예상 투입원료 API(rawNeeded, parkSupply 등)가 내려주는 수량 단위 - 서버 단위가 다르면 여기만 바꾸면 된다
const SERVER_RAW_UNIT = "KG";
// 헴프박(부산물 기반 연계생산) 수량 단위 - 서버가 항상 kg 기준으로 내려준다
const PARK_UNIT = "KG";

// 단위별 g 환산 계수 (모르는 단위는 변환하지 않는다)
const UNIT_TO_G: Record<string, number> = { G: 1, KG: 1000, T: 1_000_000 };

const convertUnit = (value: number, from?: string | null, to?: string | null): number => {
  const f = UNIT_TO_G[(from ?? "").toUpperCase()];
  const t = UNIT_TO_G[(to ?? "").toUpperCase()];
  if (!f || !t || f === t) return value;
  return Math.round(((value * f) / t) * 1000) / 1000; // 부동소수점 오차 방지 (소수 3자리)
};

/* ───────────── 타입 ───────────── */

/** 작업지시 라인 (수주 단건 조회의 수주라인 + 사용자가 입력하는 지시수량) */
interface WorkOrderLine {
  salesOrderLineId: number;
  itemCode: string;
  itemNm: string;
  unit: string;
  planQty: number | null; // 계약 시점에 수량이 정해져 있으면 숫자, 미정이면 null
  instructQty: number | ""; // 산출수량 (= 지시수량)
}

/** 화면 표시용 투입원료 / 헴프박 수급 요약 (예상 투입원료 API 응답을 화면용으로 가공) */
interface RawSummary {
  rawTotal: number; // 독립 품목의 예상 원물 소요량 합계 (수주 투입원료 단위 기준)
  committed: number; // 수주에 계약된 투입원료 수량 (수주 투입원료 단위 기준)
  overRaw: boolean; // 계약 수량 초과 여부
  overBy: number; // 초과 수량
  items: { id: number; name: string; raw: number }[]; // 라인별 예상 원물 소요량 (큰 순)
  parkSupply: number; // 헴프오일 라인에서 나오는 헴프박(부산물) 공급량 (kg)
  parkDemand: number; // 헴프박 기반 연계생산 품목의 필요량 (kg)
  hasOilLine: boolean;
  hasParkConsumer: boolean;
  parkShort: boolean; // 헴프박 부족 여부
  hasUnknown: boolean; // 산출수량 미입력/수율 미확정으로 추정에서 빠진 라인 존재 여부
}

/** 예상 투입원료 계산 결과 (라인 ID 기준으로 매핑해 둔다) */
interface EstimateState {
  server: WorkOrderMaterialEstimateSummaryResponse; // 서버가 계산한 요약 원본 (직접 입력값은 반영되지 않음)
  byLineId: Record<number, WorkOrderMaterialEstimateLineResponse>;
}

/** 품목별 생산 체인 조회 상태 */
interface ChainState {
  status: "loading" | "done" | "error";
  data?: ItemRoutingChainResponse;
}

const EMPTY_SUMMARY: RawSummary = {
  rawTotal: 0,
  committed: 0,
  overRaw: false,
  overBy: 0,
  items: [],
  parkSupply: 0,
  parkDemand: 0,
  hasOilLine: false,
  hasParkConsumer: false,
  parkShort: false,
  hasUnknown: false,
};

/**
 * 라인에 실제로 적용할 예상 투입 원료
 * - 사용자가 직접 입력(수정)한 값이 있으면 그 값 (이미 화면 단위로 입력된 값이라 변환하지 않는다)
 * - 없으면 서버 추정치. 일반 품목은 서버 단위(kg) → 수주 투입원료 단위로 변환, 헴프박 연계 품목은 kg 그대로
 * - 서버가 추정하지 못했고(null) 직접 입력도 없으면 "" (미입력)
 */
const effectiveRaw = (
  estLine: WorkOrderMaterialEstimateLineResponse | undefined,
  override: number | "" | undefined,
  rawUnit: string,
): number | "" => {
  if (override !== undefined) return override;
  const server = estLine?.rawNeeded;
  if (server == null) return "";
  return estLine?.parkDerived ? server : convertUnit(server, SERVER_RAW_UNIT, rawUnit);
};

/**
 * 화면 표시용 투입원료 요약 계산
 * - 서버 추정치를 기본으로 하되, 사용자가 직접 입력한 값(수율 미확정 품목 등)을 반영해 합계/초과 여부를 다시 계산한다
 * - 헴프박 공급량(parkSupply)과 헴프오일 포함 여부는 서버 계산값을 그대로 쓴다
 * - rawTotal / committed 는 모두 수주 투입원료 단위(rawUnit) 기준으로 맞춘다
 */
const buildRawSummary = (
  estimate: EstimateState,
  lines: WorkOrderLine[],
  overrides: Record<number, number | "">,
  committedQty: number,
  rawUnit: string,
): RawSummary => {
  let rawTotal = 0;
  let parkDemand = 0;
  let hasParkConsumer = estimate.server.hasParkConsumer;
  let hasUnknown = false;
  const items: RawSummary["items"] = [];

  lines.forEach((line) => {
    const id = line.salesOrderLineId;
    const estLine = estimate.byLineId[id];
    const val = effectiveRaw(estLine, overrides[id], rawUnit);
    const has = typeof val === "number" && val > 0;

    if (estLine?.parkDerived) {
      // 헴프박 기반 연계생산 품목 - 원물이 아니라 필요한 헴프박(kg) 기준
      hasParkConsumer = true;
      if (has) parkDemand += val;
      else hasUnknown = true;
    } else if (has) {
      rawTotal += val;
      items.push({ id, name: line.itemNm, raw: val });
    } else {
      hasUnknown = true; // 서버도 추정 못 했고 직접 입력도 없는 라인
    }
  });

  // 계약 수량은 수주 단위 그대로 사용 (서버에는 변환해서 보냈으므로 서버 반환값을 다시 쓰지 않는다)
  const committed = committedQty;
  const parkSupply = estimate.server.parkSupply;
  return {
    rawTotal,
    committed,
    overRaw: Math.ceil(rawTotal) > committed,
    overBy: Math.ceil(rawTotal - committed),
    items: items.sort((a, b) => b.raw - a.raw),
    parkSupply,
    parkDemand,
    hasOilLine: estimate.server.hasOilLine,
    hasParkConsumer,
    parkShort: hasParkConsumer && Math.ceil(parkDemand) > parkSupply,
    hasUnknown,
  };
};

/* ───────────── 공정 체인 표시 (한 줄 스테퍼) ───────────── */

interface ChainStep {
  key: string;
  name: string;
  yieldText?: string;
  kind?: "output" | "byproduct";
  shared?: boolean;
}

/** 공정에서 "해당 품목" 자체가 산출되는 수율만 표시 (껍질 등 다른 부산물의 수율은 제외) */
const ownYieldText = (routing: ItemRoutingResponse, itemCode: string): string => {
  const out = routing.materials.find((m) => m.ioType === "OUT" && m.itemCode === itemCode && m.yieldRate != null);
  return out ? `수율 ${out.yieldRate}%` : "";
};

/** 부산물 원천 품목(헴프오일 등)의 이름 - 라우팅 자재에서 찾고, 없으면 코드로 대체 */
const findByproductSourceName = (node: ItemRoutingChainResponse): string => {
  const code = node.byproductOfItemCode;
  if (!code) return "";
  const found = node.routings.flatMap((r) => r.materials).find((m) => m.itemCode === code);
  return found?.itemNm ?? code;
};

/**
 * 생산 체인 트리를 한 줄 스테퍼용 단계 목록으로 펼친다
 * - 투입 자재 체인(inputChains)을 먼저 처리해 가장 안쪽(원물)부터 최종 품목 순서로 쌓는다
 * - 부산물 품목(헴프박): 부산물이 실제로 나오는 공정(착유)까지만 넣고, 그 뒤에 "헴프박" 부산물 표시 단계를 붙인다
 *   (이후 착유포집/여과/오일저장은 오일 라인 공정이라 표시하지 않는다)
 * - 공정이 없는 원물: 원물 이름으로 한 단계만 넣는다
 */
const buildChainSteps = (root: ItemRoutingChainResponse): { steps: ChainStep[]; notes: string[][] } => {
  const steps: ChainStep[] = [];
  const notes: string[][] = []; // [부산물 이름, 원천 품목 이름]
  const seen = new Set<string>();

  const walk = (node: ItemRoutingChainResponse) => {
    node.inputChains.forEach(walk);

    if (seen.has(node.itemCode)) return;
    seen.add(node.itemCode);

    const routings = [...node.routings].sort((a, b) => a.operSeq - b.operSeq);

    if (node.byproductOfItemCode) {
      const idx = routings.findIndex((r) =>
        r.materials.some((m) => m.ioType === "OUT" && m.itemCode === node.itemCode),
      );
      const visible = idx >= 0 ? routings.slice(0, idx + 1) : routings;
      visible.forEach((r) => steps.push({ key: `r-${r.routingId}`, name: r.operNm ?? r.operCode ?? "" }));

      const last = visible[visible.length - 1];
      steps.push({
        key: `bp-${node.itemCode}`,
        name: node.itemNm ?? node.itemCode,
        kind: "byproduct",
        yieldText: last ? ownYieldText(last, node.itemCode) : "",
      });
      notes.push([node.itemNm, findByproductSourceName(node)]);
      return;
    }

    if (routings.length === 0) {
      steps.push({ key: `raw-${node.itemCode}`, name: node.itemNm ?? node.itemCode }); // 공정 없는 원물
      return;
    }

    routings.forEach((r) =>
      steps.push({ key: `r-${r.routingId}`, name: r.operNm ?? r.operCode ?? "", yieldText: ownYieldText(r, node.itemCode) }),
    );
  };

  walk(root);

  // 부산물 지점 이전 구간은 다른 품목 라인과 공유하는 공정이라 점선/회색으로 표시
  let lastByproductIdx = -1;
  steps.forEach((s, i) => {
    if (s.kind === "byproduct") lastByproductIdx = i;
  });
  steps.forEach((s, i) => {
    if (i < lastByproductIdx) s.shared = true;
  });

  // 마지막 단계 = 최종 품목 산출 (부산물이 마지막이면 그대로 둔다)
  const tail = steps[steps.length - 1];
  if (tail && !tail.kind) tail.kind = "output";

  return { steps, notes };
};

/** 품목 생산 체인 영역 (조회 상태별 안내 포함) */
function RoutingChainView({ state }: { state?: ChainState }) {
  if (!state || state.status === "loading") {
    return <p className="woc-chain__state">생산 체인을 불러오는 중입니다...</p>;
  }
  if (state.status === "error" || !state.data) {
    return <p className="woc-chain__state error">생산 체인을 불러오지 못했습니다.</p>;
  }

  const { steps, notes } = buildChainSteps(state.data);
  if (steps.length === 0) return null;

  return (
    <div className="woc-process woc-chain">
      <ol className="woc-stepper" aria-label="공정 순서">
        {steps.map((step, index) => {
          const cls = ["woc-stepper__step", step.kind, step.shared && "shared"].filter(Boolean).join(" ");
          return (
            <li key={step.key} className={cls}>
              <span className="woc-stepper__dot" aria-hidden="true" />
              <span className="woc-stepper__name">{step.name}</span>
              {index === steps.length - 1 && step.yieldText && (
                <span className="woc-stepper__yield">
                  {step.yieldText}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* 점선 구간 안내: 부산물을 어떤 품목 생산 공정에서 이어받는지 */}
      {notes.map(([byproductNm, sourceNm]) => (
        <p key={byproductNm} className="woc-process__note">
          점선 구간은 <strong>{sourceNm}</strong> 생산 공정과 같은 공정입니다. 별도 원물 없이 해당 공정에서 나오는{" "}
          {byproductNm}을(를) 이어받습니다.
        </p>
      ))}
    </div>
  );
}

/* ───────────── 초과 경고 팝업 ───────────── */

function OverDialog({
  open,
  summary,
  unit,
  onClose,
}: {
  open: boolean;
  summary: RawSummary;
  unit: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // 네이티브 dialog: 포커스 가둠, ESC 닫기, 스크린리더 알림을 브라우저가 처리
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="woc-dialog"
      role="alertdialog"
      aria-labelledby="wocOverTitle"
      aria-describedby="wocOverDesc"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <div className="woc-dialog__body">
        <span className="woc-dialog__icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </span>
        <h2 id="wocOverTitle" className="woc-dialog__title">
          투입원료 수량을 초과했습니다
        </h2>
        <p id="wocOverDesc" className="woc-dialog__desc">
          예상 원물 소요량은 약{" "}
          <strong>
            {Math.ceil(summary.rawTotal).toLocaleString()}
            {unit}
          </strong>
          로 계약된 투입원료 {summary.committed.toLocaleString()}
          {unit}보다{" "}
          <strong className="over">
            {summary.overBy.toLocaleString()}
            {unit}
          </strong>{" "}
          많습니다.
        </p>

        <ul className="woc-dialog__list">
          {summary.items.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <span>
                {item.raw.toLocaleString()}
                {unit}
              </span>
            </li>
          ))}
        </ul>

        <p className="woc-dialog__tip">지시수량을 줄이면 저장할 수 있습니다.</p>

        <button type="button" className="woc-btn primary block" onClick={() => ref.current?.close()}>
          수량 수정하기
        </button>
      </div>
    </dialog>
  );
}

/* ───────────── 커스텀 셀렉트 (div 기반, WAI-ARIA select-only combobox 패턴) ───────────── */

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface CustomSelectProps {
  id: string;
  labelId: string;
  value: string;
  options: SelectOption[];
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}

function CustomSelect({ id, labelId, value, options, placeholder, disabled, invalid, onChange }: CustomSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const keyNavRef = useRef(false); // 키보드로 이동할 때만 활성 옵션으로 스크롤 (마우스 hover 시 튀는 것 방지)
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const listId = `${id}-list`;
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const openList = () => {
    if (disabled) return;
    keyNavRef.current = true;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : options.length > 0 ? 0 : -1);
    setOpen(true);
  };

  const selectOption = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  };

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  // 활성 옵션이 목록 안에 보이도록 스크롤
  useEffect(() => {
    if (!open || !keyNavRef.current) return;
    keyNavRef.current = false;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const moveActive = (next: number) => {
    keyNavRef.current = true;
    setActiveIndex(next);
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const last = options.length - 1;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveActive(Math.min(last, activeIndex + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        moveActive(Math.max(0, activeIndex - 1));
        break;
      case "Home":
        e.preventDefault();
        moveActive(0);
        break;
      case "End":
        e.preventDefault();
        moveActive(last);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        selectOption(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        // 첫 글자로 옵션 찾기
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const key = e.key.toLowerCase();
          const start = activeIndex + 1;
          const found = options
            .map((_, i) => (i + start) % options.length)
            .find((i) => options[i].label.toLowerCase().startsWith(key));
          if (found !== undefined) moveActive(found);
        }
    }
  };

  return (
    <div className="woc-select" ref={rootRef}>
      <div
        id={id}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        className={`woc-input woc-select__trigger${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-activedescendant={open && options[activeIndex] ? `${id}-opt-${activeIndex}` : undefined}
        aria-invalid={invalid}
        aria-disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
      >
        <span className={`woc-select__value${selected ? "" : " is-placeholder"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className="woc-select__chevron"
          viewBox="0 0 20 20"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </div>

      {open && (
        <div ref={listRef} id={listId} role="listbox" aria-labelledby={labelId} className="woc-select__list">
          {options.length === 0 ? (
            <div role="presentation" className="woc-select__empty">
              선택 가능한 항목이 없습니다
            </div>
          ) : (
            options.map((option, i) => (
              <div
                key={option.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === selectedIndex}
                data-active={i === activeIndex}
                className={`woc-select__option${i === activeIndex ? " is-active" : ""}${i === selectedIndex ? " is-selected" : ""}`}
                onMouseDown={(e) => e.preventDefault()} // 트리거의 포커스 유지
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => selectOption(i)}
              >
                <span className="woc-select__label">{option.label}</span>
                {option.description && <span className="woc-select__desc">{option.description}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────── 페이지 ───────────── */

export function FoodWorkOrderCreatePage() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLElement>(null);
  const ackedTotalRef = useRef<number | null>(null); // 이미 경고를 보여준 소요량 - 같은 값이면 다시 띄우지 않는다
  const orderReqRef = useRef(0); // 수주 단건 조회/체인 조회 요청 식별자 - 수주를 바꾸면 이전 응답은 무시한다
  const estimateReqRef = useRef(0); // 예상 투입원료 계산 요청 식별자 - 최신 요청의 응답만 반영한다

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttempt, setSubmitAttempt] = useState(0);
  const [isOverDialogOpen, setIsOverDialogOpen] = useState(false);

  const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([]);
  const [orderOptionList, setOrderOptionList] = useState<SalesOrderOptionResponse[]>([]);

  const [form, setForm] = useState({
    workDate: todayStr(),
    managerId: "",
    orderCode: "",
  });

  const [orderDetail, setOrderDetail] = useState<SalesOrderDetailResponse | null>(null); // 선택한 수주의 단건 조회 결과
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [lines, setLines] = useState<WorkOrderLine[]>([]);

  const [chains, setChains] = useState<Record<string, ChainState>>({}); // 품목코드별 생산 체인
  const [estimate, setEstimate] = useState<EstimateState | null>(null); // 예상 투입원료 계산 결과
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateFailed, setEstimateFailed] = useState(false);
  // 사용자가 직접 입력(수정)한 예상 투입 원료 - 라인 ID 기준, 지시수량을 바꾸면 해당 라인은 다시 서버 추정치를 따른다
  const [rawOverrides, setRawOverrides] = useState<Record<number, number | "">>({});

  // 투입원료 단위: 수주(계약 투입원료)의 단위를 기준으로 한다
  const rawUnit = orderDetail?.unit ?? SERVER_RAW_UNIT;

  // 서버 추정치 + 직접 입력값을 합친 화면용 요약
  const summary = useMemo(
    () =>
      estimate
        ? buildRawSummary(estimate, lines, rawOverrides, orderDetail?.orderQty ?? 0, rawUnit)
        : EMPTY_SUMMARY,
    [estimate, lines, rawOverrides, orderDetail, rawUnit],
  );

  const managerOptions = useMemo<SelectOption[]>(
    () => userOptions.map((user) => ({ value: user.userId, label: `${user.userNm} (${user.userId})` })),
    [userOptions],
  );

  const orderOptions = useMemo<SelectOption[]>(
    () =>
      orderOptionList.map((order) => ({
        value: order.orderCode,
        label: `${order.orderCode} · ${order.bpNm}`,
      })),
    [orderOptionList],
  );

  // 헴프박을 이어받는(연계생산) 라인은 아래쪽에 묶어서 보여준다 - 예상 투입원료 결과가 있어야 구분 가능
  const displayLines = useMemo(
    () =>
      [...lines].sort(
        (a, b) =>
          Number(!!estimate?.byLineId[a.salesOrderLineId]?.parkDerived) -
          Number(!!estimate?.byLineId[b.salesOrderLineId]?.parkDerived),
      ),
    [lines, estimate],
  );

  // 회원 옵션 데이터 조회
  useEffect(() => {
    const fetchUserOptions = async () => {
      try {
        const res = await UserApi.getOptions();
        if (res && res.data) {
          setUserOptions(res.data);
        }
      } catch (error) {
        console.error("회원 옵션 조회 실패:", error);
      }
    };

    fetchUserOptions();
  }, []);

  // 수주 옵션 데이터 조회 - 작업지시가 아직 배정되지 않은 수주만 가져온다
  useEffect(() => {
    const fetchOrderOptions = async () => {
      try {
        const res = await SalesOrderApi.getOptions({ unassignedOnly: true });
        if (res && res.data) {
          setOrderOptionList(res.data);
        }
      } catch (error) {
        console.error("수주 옵션 조회 실패:", error);
      }
    };

    fetchOrderOptions();
  }, []);

  // 검증 실패 후 첫 번째 오류 입력칸으로 포커스 이동
  const focusFirstInvalid = () => {
    rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  };

  useEffect(() => {
    if (submitAttempt === 0) return;
    focusFirstInvalid();
  }, [submitAttempt]);

  /* ───── 초과 경고 ───── */

  const openOverDialog = (next: RawSummary, force = false) => {
    if (!next.overRaw) return;
    const total = Math.ceil(next.rawTotal);
    if (!force && ackedTotalRef.current === total) return;
    ackedTotalRef.current = total;
    setIsOverDialogOpen(true);
  };

  const closeOverDialog = () => {
    setIsOverDialogOpen(false);
    window.setTimeout(focusFirstInvalid, 0);
  };

  /* ───── 예상 투입원료(estimate) 계산 ───── */

  // 지시수량이 바뀌면(디바운스 400ms) 서버에서 예상 투입원료를 다시 계산한다
  useEffect(() => {
    if (!orderDetail || lines.length === 0) return;

    const reqId = ++estimateReqRef.current;
    const snapshot = lines; // 응답을 라인 ID로 매핑할 때 쓸 요청 시점의 라인

    const timer = window.setTimeout(async () => {
      setIsEstimating(true);
      try {
        const res = await WorkOrderApi.estimateRawMaterial({
          // 요청 순서 = 응답 순서이므로 산출수량이 없는 라인도 outputQty=null 로 함께 보낸다 (서버가 추정에서 제외)
          lines: snapshot.map((line) => ({
            itemCode: line.itemCode,
            outputQty: typeof line.instructQty === "number" && line.instructQty > 0 ? line.instructQty : null,
          })),
          // 계약 투입원료를 서버 추정 단위(kg)로 변환해서 보낸다 (수주 단위가 G인데 숫자만 그대로 비교되던 문제)
          committedRawQty:
            orderDetail.orderQty != null
              ? convertUnit(orderDetail.orderQty, orderDetail.unit, SERVER_RAW_UNIT)
              : null,
        });
        if (reqId !== estimateReqRef.current) return;

        const data = res.data;
        const byLineId: EstimateState["byLineId"] = {};
        data.lines.forEach((estLine, i) => {
          const line = snapshot[i];
          if (line) byLineId[line.salesOrderLineId] = estLine;
        });

        setEstimate({ server: data.summary, byLineId });
        setEstimateFailed(false);
      } catch (error) {
        if (reqId !== estimateReqRef.current) return;
        console.error("예상 투입원료 계산 실패:", error);
        setEstimateFailed(true);
      } finally {
        if (reqId === estimateReqRef.current) setIsEstimating(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [lines, orderDetail]);

  // 서버 계산 결과가 새로 도착했을 때, 직접 입력값까지 반영한 합계가 계약 수량을 넘으면 경고
  useEffect(() => {
    if (estimate) openOverDialog(summary);
  }, [estimate]);

  // 예상 투입 원료 입력칸을 벗어날 때(blur) 초과 상태면 경고 - 타이핑 중간 값에는 반응하지 않는다
  const handleLineBlur = () => openOverDialog(summary);

  /* ───── 생산 체인 조회 ───── */

  // 수주라인의 품목별로 생산 체인(투입 자재의 생산 공정까지)을 조회한다
  const loadChains = async (itemCodes: string[], reqId: number) => {
    const codes = Array.from(new Set(itemCodes));
    const initial: Record<string, ChainState> = {};
    codes.forEach((code) => {
      initial[code] = { status: "loading" };
    });
    setChains(initial);

    await Promise.all(
      codes.map(async (code) => {
        try {
          const res = await ItemApi.getRoutingChain(code);
          if (reqId !== orderReqRef.current) return;
          setChains((prev) => ({ ...prev, [code]: { status: "done", data: res.data } }));
        } catch (error) {
          if (reqId !== orderReqRef.current) return;
          console.error(`생산 체인 조회 실패 (${code}):`, error);
          setChains((prev) => ({ ...prev, [code]: { status: "error" } }));
        }
      }),
    );
  };

  /* ───── 핸들러 ───── */

  const handleChange = (key: "workDate" | "managerId", value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 수주 하나 = 작업지시 하나 - 수주를 고르면 단건 조회로 산출라인을 가져오고, 생산 체인/예상 투입원료도 함께 불러온다
  const handleOrderChange = async (orderCode: string) => {
    const reqId = ++orderReqRef.current;
    estimateReqRef.current += 1; // 진행 중이던 이전 수주의 계산 응답은 버린다

    setForm((prev) => ({ ...prev, orderCode }));
    setOrderDetail(null);
    setLines([]);
    setChains({});
    setEstimate(null);
    setRawOverrides({});
    setEstimateFailed(false);
    setIsEstimating(false);
    setSubmitted(false);
    ackedTotalRef.current = null;

    if (!orderCode) return;

    setIsOrderLoading(true);
    try {
      const res = await SalesOrderApi.getDetail(orderCode);
      if (reqId !== orderReqRef.current) return;

      const detail = res.data;
      setOrderDetail(detail);
      setLines(
        detail.lines.map((line) => ({
          salesOrderLineId: line.salesOrderLineId,
          itemCode: line.itemCode,
          itemNm: line.itemNm,
          unit: line.unit,
          planQty: line.planQty,
          instructQty: line.planQty ?? "", // 계약수량이 정해져 있으면 그 값으로 시작
        })),
      );
      // 라인이 세팅되면 위의 estimate effect 가 자동으로 예상 투입원료를 계산한다
      loadChains(
        detail.lines.map((line) => line.itemCode),
        reqId,
      );
    } catch (error) {
      if (reqId !== orderReqRef.current) return;
      console.error("수주 단건 조회 실패:", error);
      const errorMessage = axios.isAxiosError(error) ? error.response?.data?.message : null;
      alert(errorMessage || "수주 정보를 불러오는 중 오류가 발생했습니다.");
      setForm((prev) => ({ ...prev, orderCode: "" }));
    } finally {
      if (reqId === orderReqRef.current) setIsOrderLoading(false);
    }
  };

  // 지시수량이 바뀌면 그 라인은 직접 입력값을 버리고 새 서버 추정치를 따른다
  const handleQtyChange = (id: number, value: string) => {
    const qty = value === "" ? "" : Number(value);
    setLines((prev) => prev.map((line) => (line.salesOrderLineId === id ? { ...line, instructQty: qty } : line)));
    setRawOverrides((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // 예상 투입 원료 직접 입력 - 서버가 추정하지 못한 품목(수율 미확정 등)은 여기서 입력한다
  const handleRawChange = (id: number, value: string) => {
    const raw = value === "" ? "" : Number(value);
    setRawOverrides((prev) => ({ ...prev, [id]: raw }));
  };

  const handleCancel = () => {
    navigate(-1);
  };

  /* ───── 검증 (오류 문구는 저장 시도 후부터, 원료 초과는 실시간) ───── */

  const fieldErrors = {
    workDate: form.workDate ? "" : "작업일자를 입력해주세요.",
    managerId: form.managerId ? "" : "담당자를 선택해주세요.",
    orderCode: form.orderCode ? "" : "수주를 선택해주세요.",
  };

  const qtyErrors = useMemo(() => {
    const result: Record<number, string> = {};
    lines.forEach((line) => {
      const qty = line.instructQty;
      if (qty === "" || qty <= 0) result[line.salesOrderLineId] = "0보다 큰 수량을 입력해주세요.";
      else if (!Number.isInteger(qty)) result[line.salesOrderLineId] = "정수로 입력해주세요.";
    });
    return result;
  }, [lines]);

  const hasError = Object.values(fieldErrors).some(Boolean) || Object.keys(qtyErrors).length > 0 || summary.overRaw;

  const showError = (msg: string) => (submitted ? msg : "");

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (hasError) {
      if (summary.overRaw) {
        openOverDialog(summary, true);
      } else {
        setSubmitAttempt((n) => n + 1);
      }
      return;
    }

    const payload = {
      workDate: form.workDate,
      managerId: form.managerId,
      lines: lines.map((line) => ({
        salesOrderLineId: line.salesOrderLineId,
        instructQty: Number(line.instructQty),
      })),
    };

    setIsSubmitting(true);
    try {
      await WorkOrderApi.create(payload);
      alert("작업지시가 성공적으로 등록되었습니다.");
      navigate("/food/work-orders");
    } catch (error) {
      console.error("작업지시 등록 실패:", error);
      const errorMessage = axios.isAxiosError(error) ? error.response?.data?.message : null;
      alert(errorMessage || "작업지시 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ───── 렌더 ───── */

  const remaining = summary.committed - summary.rawTotal;
  const usagePct = summary.committed > 0 ? Math.min(100, (summary.rawTotal / summary.committed) * 100) : 0;
  const isBusy = isSubmitting || isOrderLoading;

  return (
    <section ref={rootRef} className="woc">
      <header className="woc-header">
        <div>
          <h1 className="woc-header__title">작업지시 등록</h1>
          <p className="woc-header__desc">수주를 선택하면 산출 품목과 공정이 자동으로 구성됩니다.</p>
        </div>
        <span className="woc-header__required">
          <em>*</em> 표시는 필수 입력 항목입니다
        </span>
      </header>

      {/* 브라우저 기본 검사가 먼저 막으면 사유 안내가 안 나와 직접 검증한다 */}
      <form onSubmit={handleSubmit} noValidate className="woc-layout">
        {/* ───── 좌측: 입력 영역 ───── */}
        <div className="woc-main">
          <section className="woc-panel" aria-labelledby="wocBasicTitle">
            <h2 id="wocBasicTitle" className="woc-panel__title">
              기본정보
            </h2>

            <div className="woc-grid3">
              <div className="woc-field">
                <label htmlFor="wocWorkDate">
                  작업일자 <em>*</em>
                </label>
                <input
                  id="wocWorkDate"
                  type="date"
                  className="woc-input"
                  value={form.workDate}
                  disabled={isSubmitting}
                  aria-invalid={!!showError(fieldErrors.workDate)}
                  onChange={(e) => handleChange("workDate", e.target.value)}
                />
                {showError(fieldErrors.workDate) && <p className="woc-field__error">{fieldErrors.workDate}</p>}
              </div>

              <div className="woc-field">
                <span id="wocManagerLabel" className="woc-field__label">
                  담당자 <em>*</em>
                </span>
                <CustomSelect
                  id="wocManagerId"
                  labelId="wocManagerLabel"
                  value={form.managerId}
                  options={managerOptions}
                  placeholder="담당자 선택"
                  disabled={isSubmitting}
                  invalid={!!showError(fieldErrors.managerId)}
                  onChange={(v) => handleChange("managerId", v)}
                />
                {showError(fieldErrors.managerId) && <p className="woc-field__error">{fieldErrors.managerId}</p>}
              </div>

              <div className="woc-field">
                <span id="wocOrderLabel" className="woc-field__label">
                  수주 <em>*</em>
                </span>
                <CustomSelect
                  id="wocOrderCode"
                  labelId="wocOrderLabel"
                  value={form.orderCode}
                  options={orderOptions}
                  placeholder="수주를 선택해주세요"
                  disabled={isBusy}
                  invalid={!!showError(fieldErrors.orderCode)}
                  onChange={handleOrderChange}
                />
                {showError(fieldErrors.orderCode) && <p className="woc-field__error">{fieldErrors.orderCode}</p>}
              </div>
            </div>

            {isOrderLoading && <p className="woc-chain__state">수주 정보를 불러오는 중입니다...</p>}

            {orderDetail && (
              <ul className="woc-infocards">
                <li className="woc-infocard is-raw">
                  <span className="woc-infocard__icon" aria-hidden="true">
                    <CubeIcon />
                  </span>
                  <div className="woc-infocard__text">
                    <span className="woc-infocard__label">계약 투입원료 · {orderDetail.itemNm ?? "-"}</span>
                    <strong className="woc-infocard__value">
                      {orderDetail.orderQty != null ? orderDetail.orderQty.toLocaleString() : "-"}
                      <em>{orderDetail.unit ?? ""}</em>
                    </strong>
                  </div>
                </li>

                <li className="woc-infocard">
                  <span className="woc-infocard__icon" aria-hidden="true">
                    <BuildingOffice2Icon />
                  </span>
                  <div className="woc-infocard__text">
                    <span className="woc-infocard__label">거래처</span>
                    <strong className="woc-infocard__value">{orderDetail.bpNm}</strong>
                  </div>
                </li>

                <li className="woc-infocard">
                  <span className="woc-infocard__icon" aria-hidden="true">
                    <CalendarDaysIcon />
                  </span>
                  <div className="woc-infocard__text">
                    <span className="woc-infocard__label">납기일</span>
                    <strong className="woc-infocard__value">{orderDetail.dueDate}</strong>
                  </div>
                </li>

                <li className="woc-infocard">
                  <span className="woc-infocard__icon" aria-hidden="true">
                    <BanknotesIcon />
                  </span>
                  <div className="woc-infocard__text">
                    <span className="woc-infocard__label">가공비</span>
                    <strong className="woc-infocard__value">
                      {orderDetail.orderAmount != null ? `${orderDetail.orderAmount.toLocaleString()}원` : "-"}
                    </strong>
                  </div>
                </li>
              </ul>
            )}
          </section>

          <section className="woc-panel" aria-labelledby="wocLineTitle">
            <div className="woc-panel__head">
              <h2 id="wocLineTitle" className="woc-panel__title">
                작업지시 라인 <em>*</em>
              </h2>
              <span className="woc-panel__count">총 {lines.length}개</span>
            </div>

            {displayLines.length === 0 ? (
              <p className="woc-empty">수주를 선택하면 산출 품목과 공정이 여기에 표시됩니다.</p>
            ) : (
              <ul className="woc-lines">
                {displayLines.map((line) => {
                  const id = line.salesOrderLineId;
                  const est = estimate?.byLineId[id]; // 이 라인의 예상 투입원료 계산 결과
                  const isDerived = !!est?.parkDerived;
                  const rawNeeded = est?.rawNeeded ?? null; // 서버 추정치 (null 이면 직접 입력 필요)
                  const rawValue = effectiveRaw(est, rawOverrides[id], rawUnit); // 화면에 보이는 값 (직접 입력 우선, 수주 단위로 변환됨)
                  const qtyError = qtyErrors[id];
                  const qtyInvalid = submitted && !!qtyError;
                  const rawInvalid = summary.overRaw && !isDerived && typeof rawValue === "number" && rawValue > 0;

                  // 입력칸 단위: 일반 품목은 수주 투입원료 단위, 헴프박 연계 품목은 헴프박 단위(kg)
                  const rawFieldUnit = isDerived ? PARK_UNIT : rawUnit;
                  // 자동계산 안내문에 단위를 붙인다 (예: "1,000KG 산출 기준 약 1,538G")
                  const calcText =
                    typeof line.instructQty === "number" &&
                      line.instructQty > 0 &&
                      typeof rawValue === "number" &&
                      rawOverrides[id] === undefined
                      ? `${line.instructQty.toLocaleString()}${line.unit} 산출 기준 약 ${rawValue.toLocaleString()}${rawFieldUnit}`
                      : "";

                  return (
                    <li key={id} className={`woc-line${isDerived ? " is-derived" : ""}`}>
                      <div className="woc-line__head">
                        <strong className="woc-line__name">{line.itemNm}</strong>
                        <span className="woc-line__code">{line.itemCode}</span>
                        <span className={`woc-tag${line.planQty != null ? " fixed" : ""}`}>
                          {line.planQty != null ? "계약수량 확정" : "계약수량 미정"}
                        </span>
                        {isDerived && <span className="woc-tag park">헴프박 연계</span>}
                      </div>

                      <div className="woc-line__fields">
                        <div className="woc-field">
                          <label htmlFor={`wocQty-${id}`}>산출수량 (= 지시수량)</label>
                          <div className="woc-unitInput">
                            <input
                              id={`wocQty-${id}`}
                              type="number"
                              min="1"
                              step="1"
                              inputMode="numeric"
                              className="woc-input"
                              value={line.instructQty}
                              placeholder="직접 입력"
                              disabled={isSubmitting}
                              aria-invalid={qtyInvalid}
                              aria-describedby={qtyInvalid ? `wocQtyErr-${id}` : undefined}
                              onChange={(e) => handleQtyChange(id, e.target.value)}
                            />
                            <span>{line.unit}</span>
                          </div>
                          {qtyInvalid && (
                            <p id={`wocQtyErr-${id}`} className="woc-field__error">
                              {qtyError}
                            </p>
                          )}
                        </div>

                        {/* 예상 투입 원료: 서버 추정치가 기본값, 추정 불가(null)이거나 다르게 잡고 싶으면 직접 입력 */}
                        <div className="woc-field">
                          <label htmlFor={`wocRaw-${id}`}>{isDerived ? "필요 헴프박" : "예상 투입 원료"}</label>
                          <div className="woc-unitInput">
                            <input
                              id={`wocRaw-${id}`}
                              type="number"
                              min="0"
                              // G 단위는 정수 단위로, kg 등은 0.1 단위로 입력
                              step={rawFieldUnit.toUpperCase() === "G" ? "1" : "0.1"}
                              inputMode="decimal"
                              className="woc-input"
                              value={rawValue}
                              placeholder={isEstimating && !est ? "계산 중..." : "직접 입력"}
                              disabled={isSubmitting}
                              aria-invalid={rawInvalid}
                              aria-describedby={rawInvalid ? `wocRawErr-${id}` : undefined}
                              onChange={(e) => handleRawChange(id, e.target.value)}
                              onBlur={handleLineBlur}
                            />
                            {/* kg 고정 → 수주 투입원료 단위 (헴프박 연계 품목은 kg) */}
                            <span>{rawFieldUnit}</span>
                          </div>
                          {rawInvalid ? (
                            <p id={`wocRawErr-${id}`} className="woc-field__error">
                              계약 투입원료를 넘었습니다. 값을 줄여주세요.
                            </p>
                          ) : (
                            est && (
                              <p className="woc-field__hint">
                                {rawNeeded == null && "서버에서 추정할 수 없어 직접 입력이 필요합니다. "}
                                {calcText && `${calcText}. `}
                                {est.note}
                                {est.byproducts.length > 0 &&
                                  /* 부산물 수량에 단위 추가 (응답에 unit 이 있으면 그 값, 없으면 서버 기준 단위) */
                                  ` · 부산물 ${est.byproducts
                                    .map(
                                      (b) =>
                                        `${b.itemNm} 약 ${b.qty.toLocaleString()}${(b as { unit?: string }).unit ?? SERVER_RAW_UNIT}`,
                                    )
                                    .join(", ")} 발생`}
                              </p>
                            )
                          )}
                        </div>
                      </div>

                      {/* 생산 체인: 원물부터 이 품목까지 공정 전체를 한 줄 스테퍼로 보여준다 */}
                      <RoutingChainView state={chains[line.itemCode]} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* ───── 우측: 투입원료 요약 + 저장 ───── */}
        <aside className="woc-side" aria-label="투입원료 사용량">
          <div className={`woc-usage${summary.overRaw ? " is-over" : ""}`}>
            <h2 className="woc-usage__title">투입원료 사용량</h2>

            {orderDetail ? (
              estimateFailed && !estimate ? (
                <p className="woc-usage__msg warn">예상 투입원료를 계산하지 못했습니다. 지시수량을 다시 입력해 보세요.</p>
              ) : !estimate ? (
                <p className="woc-usage__empty">예상 투입원료를 계산하는 중입니다...</p>
              ) : (
                <div aria-live="polite">
                  <p className="woc-usage__figure">
                    <strong>{Math.ceil(summary.rawTotal).toLocaleString()}</strong>
                    <span>
                      {" "}
                      / {summary.committed.toLocaleString()}
                      {rawUnit}
                    </span>
                  </p>
                  <div className="woc-meter" aria-hidden="true">
                    <span style={{ width: `${usagePct}%` }} />
                  </div>
                  <p className="woc-usage__status">
                    {summary.overRaw
                      ? `계약 수량을 ${summary.overBy.toLocaleString()}${rawUnit} 초과했습니다`
                      : `${Math.floor(remaining).toLocaleString()}${rawUnit} 여유가 있습니다`}
                  </p>

                  {summary.items.length > 0 && (
                    <ul className="woc-usage__list">
                      {summary.items.map((item) => (
                        <li key={item.id}>
                          <span>{item.name}</span>
                          <span>
                            {item.raw.toLocaleString()}
                            {rawUnit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {summary.hasParkConsumer && (
                    <div className="woc-usage__park">
                      <span>헴프박 공급 / 수요</span>
                      <span>
                        {Math.floor(summary.parkSupply).toLocaleString()}kg / 약{" "}
                        {Math.ceil(summary.parkDemand).toLocaleString()}kg
                      </span>
                    </div>
                  )}

                  {summary.hasParkConsumer && !summary.hasOilLine && (
                    <p className="woc-usage__msg warn">
                      헴프오일 라인이 없어 헴프박 공급원이 없습니다. 재고 헴프박으로 충당하는지 확인하세요.
                    </p>
                  )}
                  {summary.hasOilLine && summary.parkShort && (
                    <p className="woc-usage__msg warn">
                      오일 부산물(헴프박)만으로는 부족합니다. 재고 헴프박이 추가로 필요할 수 있습니다.
                    </p>
                  )}
                  {summary.hasUnknown && (
                    <p className="woc-usage__msg muted">수율 데이터가 없는 품목은 추정에서 제외됩니다.</p>
                  )}
                  {estimateFailed && (
                    <p className="woc-usage__msg warn">최근 계산에 실패해 이전 추정치를 보여주고 있습니다.</p>
                  )}
                </div>
              )
            ) : (
              <p className="woc-usage__empty">수주를 선택하면 계약 투입원료 대비 사용량이 표시됩니다.</p>
            )}
          </div>

          <div className="woc-actions">
            <button type="submit" className="woc-btn primary block" disabled={isBusy || isEstimating}>
              {isSubmitting ? "등록 중..." : isEstimating ? "추정치 계산 중..." : "작업지시 저장"}
            </button>
            <button type="button" className="woc-btn ghost block" onClick={handleCancel} disabled={isSubmitting}>
              취소
            </button>
          </div>
        </aside>
      </form>

      <OverDialog open={isOverDialogOpen} summary={summary} unit={rawUnit} onClose={closeOverDialog} />
    </section>
  );
}
