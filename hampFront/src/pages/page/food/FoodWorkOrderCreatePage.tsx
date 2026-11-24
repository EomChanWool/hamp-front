import {
  Fragment, useCallback, useEffect, useMemo, useRef, useState,
  type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type SyntheticEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { WorkOrderApi } from "@/api/WorkOrder";
import { UserApi, type UserOptionResponse } from "@/api/User";
import {
  SalesOrderApi,
  type InstructQtyPreviewLineResponse,
  type InstructQtyPreviewResponse,
  type SalesOrderDetailResponse,
  type SalesOrderOptionResponse,
} from "@/api/sales/SalesOrder";
import "./Food.css";
import {
  BanknotesIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  InboxArrowDownIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import {
  EPS,
  calcDirectOutput,
  calcParkFromOil,
  isFullyUsed,
  isOverPool,
  round1,
  round3,
  sanitizeDecimal,
  splitByRatio,
  toNum,
  type ParkInfo,
} from "@/utils/workOrderCalc";

// toISOString()은 UTC 기준이라 한국 시간 00:00~09:00 사이에는 전날 날짜가 나와 로컬 기준으로 만든다
const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/* ───────────── 상수 / 유틸 ───────────── */

/**
 * 배분 그룹별 투입량 단위
 * - RAW 그룹: 수주의 투입원료 단위(orderDetail.unit) 를 따른다
 * - PARK 그룹: 건조헴프박 기준이며 항상 kg
 */
const PARK_UNIT = "KG";

/** 배분 그룹 키 → 화면 표시 이름 (모르는 그룹 키는 키 그대로 표시) */
const GROUP_LABEL: Record<string, string> = {
  RAW: "탈각씨드(RAW)",
  PARK: "헴프박(PARK)",
};

/** 수량 표시 (소수 1자리 고정) */
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 증감 표시 (+12.0 / -12.0) */
const fmtSigned = (n: number) => `${n > 0 ? "+" : ""}${fmt(n)}`;

/** 단위 표기 통일
 *  - 규칙: 리터는 대문자 L, 나머지는 소문자 (kg, g ...)
 */
const unitText = (u?: string | null) => {
  const s = (u ?? "").trim();
  return s.toUpperCase() === "L" ? "L" : s.toLowerCase();
};

/** 수량 + 단위 (숫자와 단위 사이 한 칸 띄움) */
const fmtQty = (n: number, u?: string | null) => `${fmt(n)} ${unitText(u)}`;

/** 계약 대비 증감 톤: 변동없음 / 증가 / 감소 (증가를 에러색으로 칠하지 않는다) */
type DeltaTone = "flat" | "up" | "down";
const deltaTone = (diff: number): DeltaTone => (Math.abs(diff) < 0.05 ? "flat" : diff < 0 ? "down" : "up");

/* ───────────── 타입 ───────────── */

/**
 * 투입량 계산 방식
 * - A: ① 원료 비율 유지      (서버 ratioKept*)
 * - B: ② 오일 목표 산출량 유지 (서버 targetYieldKept*)
 * - C: ③ 직접 입력           (프론트가 수율로 직접 계산)
 */
type Method = "A" | "B" | "C";
const METHOD_ORDER: Method[] = ["A", "B", "C"];

/** [정리] 카드 3개가 거의 같은 JSX 를 복붙하고 있어 설정 배열 + map 으로 줄였다 */
const METHOD_CARDS: { id: Method; name: string; desc: string }[] = [
  {
    id: "A",
    name: "① 원료 비율 유지",
    desc: "계약 때 정한 배분비율을 실제 입고량에 그대로 적용합니다. 라인들이 같이 비례해서 줄어(늘어)듭니다.",
  },
  {
    id: "B",
    name: "② 오일 목표 산출량 유지",
    desc: "수율이 확정된 라인(헴프오일)의 목표 산출량을 계약값 그대로 지키고, 남는 원료만 수율이 불확실한 라인(헴프씨드)이 떠안습니다.",
  },
  {
    id: "C",
    name: "③ 직접 입력",
    desc: "실제 입고량 기준 탈피씨드 전량 안에서 라인에 자유롭게 나눠줍니다. 아래 작업지시 라인에서 한쪽 투입량을 고치면 남은 수량이 다른 한쪽에 자동으로 들어갑니다. 오일 투입량에 따라 달라지는 헴프박 공급량 안에서 PARK 라인도 똑같이 나눌 수 있습니다.",
  },
];

/** 작업지시 라인 (수주 단건 조회의 산출 라인 + 지시수량 미리보기 라인) */
interface WorkOrderLine {
  salesOrderLineId: number;
  itemCode: string;
  itemNm: string;
  unit: string; // 산출 품목 단위 (예상 산출량 표시용)
  planQty: number | null; // 계약 기준 예정 산출수량 - 수율 미확정이면 null
  allocationGroup: string; // 배분 그룹 키 (RAW / PARK ...)
  allocationPercent: number | null; // 그룹 내 배분 비율(%)
  contractInputQty: number; // 수주에서 확정된 (계약 기준) 배분 투입량 - 방식별 증감 비교 기준
  inputUnit: string; // 투입량 단위
  preview: InstructQtyPreviewLineResponse | null; // 지시수량 미리보기 라인 (조회 실패 시 null)
}

/** 배분 그룹별 투입량 합계 (우측 요약용) */
interface GroupUsage {
  key: string;
  label: string;
  unit: string;
  total: number; // 그룹 내 지시수량 합계
  pool: number | null; // 그룹에서 쓸 수 있는 총량 (RAW=탈피씨드 가능량, PARK=건조헴프박 공급량)
  lineCount: number;
}

/** alert() 대신 쓰는 토스트 */
interface ToastState {
  kind: "success" | "error";
  message: string;
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
  /** true 면 목록 상단에 검색창이 생긴다 (label + description 에서 부분 일치) */
  searchable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}

function CustomSelect({
  id, labelId, value, options, placeholder, searchable, disabled, invalid, onChange,
}: CustomSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const keyNavRef = useRef(false); // 키보드로 이동할 때만 활성 옵션으로 스크롤 (마우스 hover 시 튀는 것 방지)
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState("");

  const listId = `${id}-list`;

  // 검색어로 걸러낸 옵션 (검색 모드가 아니면 전체)
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter((o) => `${o.label} ${o.description ?? ""}`.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const selected = options.find((o) => o.value === value) ?? null; // 트리거 표시용 (검색과 무관하게 전체에서 찾는다)
  const selectedIndex = visible.findIndex((o) => o.value === value);

  const closeList = (returnFocus = false) => {
    setOpen(false);
    setQuery("");
    if (returnFocus) triggerRef.current?.focus();
  };

  const openList = () => {
    if (disabled) return;
    keyNavRef.current = true;
    const idx = options.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : options.length > 0 ? 0 : -1);
    setQuery("");
    setOpen(true);
  };

  const selectOption = (index: number) => {
    const option = visible[index];
    if (!option) return;
    onChange(option.value);
    closeList(true);
  };

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  // 검색 모드: 열리면 검색창으로 포커스
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

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

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    moveActive(0); // 검색 결과가 바뀌면 첫 항목을 활성화
  };

  // 키 입력은 트리거/검색창 어느 쪽에서 발생해도 루트에서 한 번에 처리한다
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const inSearch = e.target === searchRef.current;
    const last = visible.length - 1;

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
        if (inSearch) break; // 검색창에서는 커서 이동에 쓴다
        e.preventDefault();
        moveActive(0);
        break;
      case "End":
        if (inSearch) break;
        e.preventDefault();
        moveActive(last);
        break;
      case "Enter":
        e.preventDefault();
        selectOption(activeIndex);
        break;
      case " ":
        if (inSearch) break; // 검색어에 공백 입력 허용
        e.preventDefault();
        selectOption(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        closeList(true);
        break;
      case "Tab":
        closeList();
        break;
      default:
        // 검색 모드가 아닐 때만: 첫 글자로 옵션 찾기
        if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const key = e.key.toLowerCase();
          const start = activeIndex + 1;
          const found = visible
            .map((_, i) => (i + start) % visible.length)
            .find((i) => visible[i].label.toLowerCase().startsWith(key));
          if (found !== undefined) moveActive(found);
        }
    }
  };

  const activeDescendant = open && visible[activeIndex] ? `${id}-opt-${activeIndex}` : undefined;

  return (
    <div className="woc-select" ref={rootRef} onKeyDown={handleKeyDown}>
      <div
        id={id}
        ref={triggerRef}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        className={`woc-input woc-select__trigger${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-activedescendant={searchable ? undefined : activeDescendant}
        aria-invalid={invalid}
        aria-disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
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
        <div ref={listRef} className="woc-select__list">
          {searchable && (
            <div className="woc-select__search">
              <input
                ref={searchRef}
                type="text"
                role="searchbox"
                className="woc-select__searchInput"
                placeholder="검색 (수주코드, 거래처)"
                aria-label={`${placeholder} 검색`}
                aria-controls={listId}
                aria-activedescendant={activeDescendant}
                autoComplete="off"
                value={query}
                onChange={handleSearchChange}
              />
            </div>
          )}

          <div id={listId} role="listbox" aria-labelledby={labelId} className="woc-select__listbox">
            {visible.length === 0 ? (
              <div role="presentation" className="woc-select__empty">
                {options.length === 0 ? "선택 가능한 항목이 없습니다" : "검색 결과가 없습니다"}
              </div>
            ) : (
              visible.map((option, i) => (
                <div
                  key={option.value}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === selectedIndex}
                  data-active={i === activeIndex}
                  className={`woc-select__option${i === activeIndex ? " is-active" : ""}${i === selectedIndex ? " is-selected" : ""}`}
                  onMouseDown={(e) => e.preventDefault()} // 트리거/검색창의 포커스 유지
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => selectOption(i)}
                >
                  <span className="woc-select__label">{option.label}</span>
                  {option.description && <span className="woc-select__desc">{option.description}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── 페이지 ───────────── */

export function FoodWorkOrderCreatePage() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLElement>(null);
  const reasonRef = useRef<HTMLParagraphElement>(null); // 저장 불가 사유 (포커스 이동 대상)
  const orderReqRef = useRef(0); // 수주 조회 요청 식별자 - 수주를 바꾸면 이전 응답은 무시한다
  const methodRefs = useRef<Partial<Record<Method, HTMLDivElement | null>>>({}); // 방향키 이동 시 포커스 대상
  const parkRatioRef = useRef<Record<number, number>>({}); // ③ 진입/직접수정 시점의 PARK 라인 비율
  const toastTimerRef = useRef<number | undefined>(undefined);
  const navTimerRef = useRef<number | undefined>(undefined);
  const leaveDialogRef = useRef<HTMLDialogElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttempt, setSubmitAttempt] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([]);
  const [orderOptionList, setOrderOptionList] = useState<SalesOrderOptionResponse[]>([]);

  const [form, setForm] = useState({
    workDate: todayStr(),
    managerId: "",
    orderCode: "",
  });

  const [orderDetail, setOrderDetail] = useState<SalesOrderDetailResponse | null>(null); // 선택한 수주의 단건 조회 결과
  const [preview, setPreview] = useState<InstructQtyPreviewResponse | null>(null); // 지시수량 미리보기 (실제 입고량 기준)
  const [previewFailed, setPreviewFailed] = useState(false); // 미리보기 조회 실패 시 계약 배분량으로 대체
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [lines, setLines] = useState<WorkOrderLine[]>([]);

  /** 선택한 투입량 계산 방식 (withinTolerance 이면 화면에서 선택 불가, 항상 ①) */
  const [method, setMethod] = useState<Method>("A");
  /**
   * ③ 직접입력 값 (salesOrderLineId → 입력 문자열)
   * - 숫자가 아니라 문자열로 들고 있어야 타이핑 중에 커서가 튀지 않는다
   * - 자동 계산해서 채우는 값은 항상 소수 1자리 (round1)
   */
  const [direct, setDirect] = useState<Record<number, string>>({});

  /* ───── 토스트 ───── */

  const showToast = (kind: ToastState["kind"], message: string, ms = 4000) => {
    window.clearTimeout(toastTimerRef.current);
    setToast({ kind, message });
    toastTimerRef.current = window.setTimeout(() => setToast(null), ms);
  };

  // 언마운트 시 타이머 정리
  useEffect(
    () => () => {
      window.clearTimeout(toastTimerRef.current);
      window.clearTimeout(navTimerRef.current);
    },
    [],
  );

  /* ───── 파생값: 방식 / 풀 / 헴프박 공급량 ───── */

  /**
   * 실제로 적용되는 방식
   * - 입고량이 계약 오차범위 이내(withinTolerance)이거나 미리보기가 없으면 ① 고정
   */
  const showMethodPanel = !!preview && !preview.raw.withinTolerance && lines.length > 0;
  const effMethod: Method = showMethodPanel ? method : "A";
  const isDirect = effMethod === "C";

  /** RAW 그룹에서 쓸 수 있는 탈피씨드 총량 (= 실제 입고 × 탈각 수율). 없으면 ③ 선택 불가 */
  const rawPool = preview?.raw.receivedSemiSeedQty != null ? round1(preview.raw.receivedSemiSeedQty) : null;

  /** 헴프박 부산물이 나오는 라인 (= 헴프오일) - byproductYieldPercent 가 내려오는 RAW 라인 */
  const oilLine = useMemo(
    () => lines.find((l) => l.allocationGroup === "RAW" && l.preview?.byproductYieldPercent != null) ?? null,
    [lines],
  );

  /**
   * 오일 투입량 → 헴프박 발생량 / 건조 후 공급량
   */
  const calcPark = useCallback(
    (oilQty: number): ParkInfo | null => calcParkFromOil(oilQty, oilLine?.preview, preview?.park),
    [oilLine, preview],
  );

  /**
   * PARK 라인 비율을 ref 에 고정한다.
   * - ③ 진입 시점 / PARK 라인을 직접 고친 시점의 비율을 기억해두고 그 비율로만 나눈다.
   */
  const captureParkRatio = (values: Record<number, string>) => {
    const parkLines = lines.filter((l) => l.allocationGroup === "PARK");
    if (parkLines.length === 0) return;
    const total = parkLines.reduce((s, l) => s + toNum(values[l.salesOrderLineId]), 0);
    const ratio: Record<number, number> = {};
    parkLines.forEach((l) => {
      ratio[l.salesOrderLineId] =
        total > 0
          ? toNum(values[l.salesOrderLineId]) / total
          : (l.allocationPercent ?? 100 / parkLines.length) / 100; // 전부 0 이면 계약 배분 비율로 대체
    });
    parkRatioRef.current = ratio;
  };

  /** 오일 투입량이 바뀌면 PARK 라인들을 고정해둔 비율 그대로 새 풀로 다시 나눈다 (전부 소수 1자리) */
  const redistributePark = (next: Record<number, string>) => {
    if (!oilLine) return;
    const newPark = calcPark(toNum(next[oilLine.salesOrderLineId]));
    const parkLines = lines.filter((l) => l.allocationGroup === "PARK");
    if (!newPark || parkLines.length === 0) return;

    const shares = parkLines.map((l) => parkRatioRef.current[l.salesOrderLineId] ?? 0);
    const values = splitByRatio(newPark.dry, shares); // 마지막 라인이 나머지를 가져가서 합계 = 풀
    parkLines.forEach((l, i) => {
      next[l.salesOrderLineId] = String(values[i]);
    });
  };

  /** 방식별 헴프박 발생량(건조 전)/공급량(건조 후) - PARK 그룹 풀 */
  const parkInfo = useMemo<ParkInfo | null>(() => {
    if (!preview) return null;
    const p = preview.park;
    if (effMethod === "A") return { byproduct: p.ratioKeptByproductQty, dry: p.ratioKeptDryQty };
    if (effMethod === "B") return { byproduct: p.targetYieldKeptByproductQty, dry: p.targetYieldKeptDryQty };
    return calcPark(oilLine ? toNum(direct[oilLine.salesOrderLineId]) : 0);
  }, [preview, effMethod, direct, oilLine, calcPark]);

  /** 그룹별 총량(풀) - RAW=탈피씨드 가능량, PARK=건조헴프박 공급량 */
  const poolOf = (group: string): number | null => {
    if (group === "RAW") return rawPool;
    if (group === "PARK") return parkInfo?.dry != null ? round1(parkInfo.dry) : null;
    return null;
  };

  /** ①/② 방식에서 서버가 내려준 라인 투입량 (보정 전 원본) */
  const serverQtyOf = (line: WorkOrderLine): number => {
    const p = line.preview;
    if (!p) return line.contractInputQty; // 미리보기가 없으면 계약 배분량 그대로
    return effMethod === "B" ? p.targetYieldKeptQty : p.ratioKeptQty;
  };

  /**
   * ①/② 방식의 합계 보정
   * - 서버는 라인별 투입량과 풀(건조헴프박 등)을 각각 반올림해서 계산하기 때문에
   *   라인 합계가 풀과 0.1 어긋날 수 있다 (예: 150.4 + 118.2 = 268.6 / 풀 268.7).
   * - 차이가 오차(EPS) 이내면 서버 값을 비율로 삼아 풀에 정확히 맞춰 다시 나눈다.
   *   (③ 과 같은 splitByRatio 를 쓰므로 합계 = 풀, 마지막 라인이 나머지를 가져간다)
   * - 차이가 크면 서버 값이 의도된 값(예: ② 에서 입고가 모자란 경우)이므로 건드리지 않는다.
   */
  const alignedQtyMap = (() => {
    const map = new Map<number, number>();
    if (effMethod === "C") return map;

    const byGroup = new Map<string, WorkOrderLine[]>();
    lines.forEach((l) => byGroup.set(l.allocationGroup, [...(byGroup.get(l.allocationGroup) ?? []), l]));

    byGroup.forEach((groupLines, key) => {
      const pool = poolOf(key);
      if (pool == null || groupLines.some((l) => !l.preview)) return;

      const server = groupLines.map(serverQtyOf);
      const gap = round3(pool - round3(server.reduce((s, v) => s + v, 0)));
      if (gap === 0 || Math.abs(gap) > EPS) return;

      const aligned = splitByRatio(pool, server);
      groupLines.forEach((l, i) => map.set(l.salesOrderLineId, aligned[i]));
    });
    return map;
  })();

  /** 라인의 현재 지시수량(= 투입량) - 선택한 방식에 따라 달라진다 */
  const qtyOf = (line: WorkOrderLine): number => {
    if (!line.preview) return line.contractInputQty;
    if (effMethod === "C") return toNum(direct[line.salesOrderLineId]);
    return alignedQtyMap.get(line.salesOrderLineId) ?? serverQtyOf(line);
  };

  /**
   * 라인의 예상 산출량 - 수율 미확정 라인은 null
   * ③ 과 보정된 ①/② 는 서버 값과 같은 투입량이면 서버 산출량을, 다르면 수율로 계산한다 (calcDirectOutput)
   */
  const outputOf = (line: WorkOrderLine): number | null => {
    const p = line.preview;
    if (!p) return line.planQty;
    if (effMethod === "C") return calcDirectOutput(p, qtyOf(line));
    if (p.outputYieldPercent == null) return null;
    if (qtyOf(line) !== serverQtyOf(line)) return calcDirectOutput(p, qtyOf(line)); // 합계 보정으로 값이 바뀐 라인
    return effMethod === "B" ? p.targetYieldKeptOutputQty : p.ratioKeptOutputQty;
  };

  /** 그룹별 투입량 합계 / 초과 그룹 / ③ 오류 문구 */
  const groupUsages: GroupUsage[] = (() => {
    const map = new Map<string, GroupUsage>();
    lines.forEach((line) => {
      const cur = map.get(line.allocationGroup) ?? {
        key: line.allocationGroup,
        label: GROUP_LABEL[line.allocationGroup] ?? line.allocationGroup,
        unit: line.inputUnit,
        total: 0,
        pool: poolOf(line.allocationGroup),
        lineCount: 0,
      };
      cur.total += qtyOf(line);
      cur.lineCount += 1;
      map.set(line.allocationGroup, cur);
    });
    return Array.from(map.values()).map((g) => ({ ...g, total: round3(g.total) }));
  })();

  /** 풀(총량)을 초과한 그룹 키 집합 - 빨간 표시는 이 그룹에만 건다 */
  const overGroups = new Set(
    groupUsages.filter((g) => g.pool != null && isOverPool(g.total, g.pool)).map((g) => g.key),
  );

  /** 그룹 순서를 유지한 채 라인을 그룹별로 묶는다 (그룹 배너 표시용) */
  const lineGroups = useMemo(() => {
    const map = new Map<string, WorkOrderLine[]>();
    lines.forEach((l) => map.set(l.allocationGroup, [...(map.get(l.allocationGroup) ?? []), l]));
    return Array.from(map.entries());
  }, [lines]);

  /** ③ 직접입력에서 풀(총량)을 넘긴 그룹이 있으면 저장을 막는다 */
  const directError = (() => {
    if (!isDirect) return "";
    const over = groupUsages.find((g) => g.pool != null && isOverPool(g.total, g.pool));
    return over ? `${over.label} 투입량 합계(${fmt(over.total)})가 사용 가능량(${fmt(over.pool!)})을 초과했습니다.` : "";
  })();

  const managerOptions = useMemo<SelectOption[]>(
    () => userOptions.map((user) => ({ value: user.userId, label: `${user.userNm} (${user.userId})` })),
    [userOptions],
  );

  /**
   * 수주 옵션에 납기일을 설명으로 붙인다.
   * - 옵션 응답에 dueDate 가 있을 때만 표시된다 (없으면 설명 없이 기존처럼 동작)
   */
  const orderOptions = useMemo<SelectOption[]>(
    () =>
      orderOptionList.map((order) => {
        const due = (order as { dueDate?: string }).dueDate;
        return {
          value: order.orderCode,
          label: `${order.orderCode} · ${order.bpNm}`,
          description: due ? `납기 ${due}` : undefined,
        };
      }),
    [orderOptionList],
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

  /**
   * 검증 실패 후 첫 번째 오류 입력칸으로 포커스 이동
   * 오류 입력칸이 없는 경우(라인 없음, 풀 초과 등)에는 사유 문구로 포커스를 보낸다
   */
  const focusFirstInvalid = () => {
    const el = rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (el ?? reasonRef.current)?.focus();
  };

  useEffect(() => {
    if (submitAttempt === 0) return;
    focusFirstInvalid();
  }, [submitAttempt]);

  /* ───── 이탈 방지 ───── */

  // 수주나 담당자를 건드렸으면 "작성 중"으로 본다 (작업일자는 기본값이 있어 제외)
  const isDirty = form.orderCode !== "" || form.managerId !== "";

  // 새로고침/탭 닫기 시 브라우저 기본 확인창 (저장 중/성공 후에는 끈다)
  useEffect(() => {
    if (!isDirty || isSubmitting) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, isSubmitting]);

  // <dialog> 열기/닫기 동기화 (Esc 로 닫히면 onClose 에서 state 를 되돌린다)
  useEffect(() => {
    const dialog = leaveDialogRef.current;
    if (!dialog) return;
    if (leaveOpen && !dialog.open) dialog.showModal();
    if (!leaveOpen && dialog.open) dialog.close();
  }, [leaveOpen]);

  /* ───── 핸들러 ───── */

  const handleChange = (key: "workDate" | "managerId", value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 수주 하나 = 작업지시 하나 - 수주를 고르면 단건 조회 + 지시수량 미리보기를 함께 가져온다
  const handleOrderChange = async (orderCode: string) => {
    const reqId = ++orderReqRef.current;

    setForm((prev) => ({ ...prev, orderCode }));
    setOrderDetail(null);
    setPreview(null);
    setPreviewFailed(false);
    setLines([]);
    setMethod("A");
    setDirect({});
    parkRatioRef.current = {};
    setSubmitted(false);

    if (!orderCode) return;

    setIsOrderLoading(true);
    try {
      // 미리보기가 실패해도 수주 자체는 쓸 수 있어야 하므로 미리보기만 따로 catch 한다
      const [detailRes, previewRes] = await Promise.all([
        SalesOrderApi.getDetail(orderCode),
        SalesOrderApi.getInstructQtyPreview(orderCode).catch((error) => {
          console.error("지시수량 미리보기 조회 실패:", error);
          return null;
        }),
      ]);
      if (reqId !== orderReqRef.current) return;

      const detail = detailRes.data;
      const pv = previewRes?.data ?? null;
      setOrderDetail(detail);
      setPreview(pv);
      setPreviewFailed(pv == null);

      const rawUnit = detail.unit ?? "KG"; // RAW 그룹 투입량 단위 = 수주 투입원료 단위

      // 미리보기 라인을 수주라인 ID 로 찾을 수 있게 맵으로 만든다 (RAW + PARK)
      const previewMap = new Map<number, InstructQtyPreviewLineResponse>();
      pv?.raw.lines.forEach((l) => previewMap.set(l.salesOrderLineId, l));
      pv?.park.lines.forEach((l) => previewMap.set(l.salesOrderLineId, l));

      const nextLines = detail.lines.flatMap((line): WorkOrderLine[] => {
        // 배분 그룹/배분량이 없는 라인은 "미사용 라인"이므로 작업지시 대상에서 제외한다
        if (line.allocationGroup == null || line.allocatedInputQty == null) return [];

        return [
          {
            salesOrderLineId: line.salesOrderLineId,
            itemCode: line.itemCode,
            itemNm: line.itemNm,
            unit: line.unit,
            planQty: line.planQty, // 수율 미확정이면 null
            allocationGroup: line.allocationGroup,
            allocationPercent: line.allocationPercent,
            contractInputQty: line.allocatedInputQty,
            inputUnit: line.allocationGroup === "PARK" ? PARK_UNIT : rawUnit,
            preview: previewMap.get(line.salesOrderLineId) ?? null,
          },
        ];
      });

      setLines(nextLines);
    } catch (error) {
      if (reqId !== orderReqRef.current) return;
      console.error("수주 단건 조회 실패:", error);
      const errorMessage = axios.isAxiosError(error) ? error.response?.data?.message : null;
      showToast("error", errorMessage || "수주 정보를 불러오는 중 오류가 발생했습니다.");
      setForm((prev) => ({ ...prev, orderCode: "" }));
    } finally {
      if (reqId === orderReqRef.current) setIsOrderLoading(false);
    }
  };

  /**
   * 투입량 계산 방식 선택
   * - ③ 으로 넘어갈 때는 지금 화면에 보이는 값(현재 방식 ①/②의 투입량)으로 시작해서 자유롭게 고치게 한다
   * - 진입 값은 소수 1자리로 맞춘다
   */
  const handleSelectMethod = (next: Method) => {
    if (next === method) return;
    if (next === "C") {
      if (rawPool == null) return; // 탈피씨드 가능량을 모르면 직접입력 불가
      const init: Record<number, string> = {};
      lines.forEach((l) => {
        init[l.salesOrderLineId] = String(round1(qtyOf(l)));
      });
      captureParkRatio(init);
      setDirect(init);
    }
    setMethod(next);
  };

  /**
   * 방식 카드 키보드 조작 (WAI-ARIA radiogroup)
   * - 방향키: 다음/이전 라디오로 이동 + 선택 (비활성 ③ 은 건너뜀)
   * - Enter/Space: 현재 카드 선택
   */
  const handleMethodKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>, current: Method) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelectMethod(current);
      return;
    }
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (dir === 0) return;
    e.preventDefault();

    const enabled = METHOD_ORDER.filter((m) => !(m === "C" && rawPool == null));
    const idx = enabled.indexOf(current);
    const nextMethod = enabled[(idx + dir + enabled.length) % enabled.length];
    handleSelectMethod(nextMethod);
    methodRefs.current[nextMethod]?.focus();
  };

  /**
   * ③ 직접입력 변경
   * - 소수 1자리까지만 입력받고, 그룹 총량(풀)을 넘지 않도록 자른다
   * - 그룹이 2라인이면 남은 수량을 나머지 라인에 자동 배정한다 (소수 1자리)
   * - RAW(오일)가 바뀌면 헴프박 공급량(= PARK 풀)이 바뀌므로, PARK 라인들은 고정해둔 비율로 새 풀을 다시 나눈다
   */
  const handleDirectChange = (lineId: number, text: string) => {
    const target = lines.find((l) => l.salesOrderLineId === lineId);
    if (!target) return;

    const clean = sanitizeDecimal(text); // 점 중복 / 음수 / e 표기 제거 + 소수 1자리

    const next: Record<number, string> = { ...direct };
    const groupLines = lines.filter((l) => l.allocationGroup === target.allocationGroup);

    const pool = poolOf(target.allocationGroup);
    const value = round1(toNum(clean));

    // 사용자가 타이핑 중인 칸은 입력 문자열을 최대한 그대로 유지 (풀 초과로 자른 경우만 값으로 교체)
    next[lineId] = pool != null && toNum(clean) > pool ? String(pool) : clean;
    const applied = pool != null && value > pool ? pool : value;

    // 그룹이 정확히 2라인이면 남은 수량을 다른 한쪽에 자동으로 넣는다
    if (pool != null && groupLines.length === 2) {
      const other = groupLines.find((l) => l.salesOrderLineId !== lineId)!;
      next[other.salesOrderLineId] = String(Math.max(0, round1(pool - applied)));
    }

    if (target.allocationGroup === "RAW") {
      redistributePark(next); // 오일 투입량이 바뀌면 PARK 풀이 바뀌므로 PARK 라인을 새 풀로 재배분
    } else if (target.allocationGroup === "PARK") {
      captureParkRatio(next); // PARK 를 직접 고쳤다면 그 비율을 새 기준으로 삼는다
    }

    setDirect(next);
  };

  /** 입력칸을 벗어날 때 "" / "12." 같은 중간 상태를 정규화 ("" → 0, "12." → 12) */
  const handleDirectBlur = (lineId: number) => {
    setDirect((prev) => ({ ...prev, [lineId]: String(round1(toNum(prev[lineId]))) }));
  };

  /** 작성 중이면 확인 다이얼로그, 아니면 바로 이동 */
  const handleCancel = () => {
    if (isDirty) setLeaveOpen(true);
    else navigate(-1);
  };

  /* ───── 검증 (오류 문구는 저장 시도 후부터) ───── */

  const fieldErrors = {
    workDate: form.workDate ? "" : "작업일자를 입력해주세요.",
    managerId: form.managerId ? "" : "담당자를 선택해주세요.",
    orderCode: form.orderCode ? "" : "수주를 선택해주세요.",
  };

  const noLines = !!orderDetail && !isOrderLoading && lines.length === 0;

  const hasError =
    Object.values(fieldErrors).some(Boolean) ||
    lines.length === 0 || // 배분된 산출 라인이 하나도 없으면 저장할 수 없다
    !!directError; // ③ 직접입력에서 풀 초과

  const showError = (msg: string) => (submitted ? msg : "");

  /**
   * 저장할 수 없는 이유 한 줄
   * 항상 액션바에 사유를 보여준다 (저장 시도 전·후 모두). 가장 먼저 해결할 것 하나만 보여준다.
   */
  const blockReason =
    fieldErrors.orderCode ||
    fieldErrors.workDate ||
    fieldErrors.managerId ||
    (noLines ? "배분된 산출 라인이 없어 저장할 수 없습니다." : "") ||
    directError ||
    "";

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (hasError) {
      setSubmitAttempt((n) => n + 1);
      return;
    }

    // instructQty = 투입량 기준 지시수량 (산출수량이 아님)
    // 화면에서 선택한 방식(①②③)으로 계산된 값을 그대로 보낸다
    const payload = {
      workDate: form.workDate,
      managerId: form.managerId,
      lines: lines.map((line) => ({
        salesOrderLineId: line.salesOrderLineId,
        instructQty: round3(qtyOf(line)),
      })),
    };

    setIsSubmitting(true);
    try {
      await WorkOrderApi.create(payload);
      showToast("success", "작업지시가 등록되었습니다.", 1500);
      navTimerRef.current = window.setTimeout(() => navigate("/food/work-orders"), 900);
    } catch (error) {
      console.error("작업지시 등록 실패:", error);
      const errorMessage = axios.isAxiosError(error) ? error.response?.data?.message : null;
      showToast("error", errorMessage || "작업지시 등록 중 오류가 발생했습니다.");
      setIsSubmitting(false); // 실패했을 때만 다시 활성화
    }
  };

  /* ───── 렌더 보조 ───── */

  const isBusy = isSubmitting || isOrderLoading;

  // 입고 현황 (계약 대비 실제 입고)
  const receivedQty = orderDetail?.receivedQty ?? preview?.raw.receivedQty ?? null;
  const contractQty = orderDetail?.orderQty ?? null;
  const receivedDiff = receivedQty != null && contractQty != null ? round3(receivedQty - contractQty) : 0;

  // 오차범위 이내(또는 계약과 동일)면 정상 입고 → 초록색
  // 미리보기가 없으면 계약과 정확히 같을 때만 정상으로 본다
  const receivedOk = preview ? preview.raw.withinTolerance : receivedDiff === 0;

  /** RAW 그룹 라인 (방식 카드 / 비교표에 사용) */
  const rawLines = lines.filter((l) => l.allocationGroup === "RAW" && l.preview);

  /** 방식 A/B 의 라인별 투입량/산출량 (비교 카드/표용 - 현재 선택과 무관하게 서버값을 그대로 쓴다) */
  const methodQty = (line: WorkOrderLine, m: "A" | "B") =>
    m === "A" ? line.preview!.ratioKeptQty : line.preview!.targetYieldKeptQty;
  const methodOut = (line: WorkOrderLine, m: "A" | "B") =>
    m === "A" ? line.preview!.ratioKeptOutputQty : line.preview!.targetYieldKeptOutputQty;

  /**
   * 계약 대비 증감 - 산출량을 알 수 있으면 산출량 기준(L 등), 모르면 투입량 기준
   * (예: 헴프오일은 산출량 -25.0L, 수율 미확정인 헴프씨드는 투입량 -39.0kg)
   * ③ 열도 같은 규칙으로 계산할 수 있게 (qty, out) 을 받는 함수로 일반화했다.
   */
  const calcDelta = (line: WorkOrderLine, qty: number, out: number | null) => {
    if (out != null && line.planQty != null) {
      return { diff: round3(out - line.planQty), unit: line.unit };
    }
    return { diff: round3(qty - line.contractInputQty), unit: line.inputUnit };
  };
  const methodDelta = (line: WorkOrderLine, m: "A" | "B") => calcDelta(line, methodQty(line, m), methodOut(line, m));

  /** 방식 카드 하단 요약 칩 */
  const renderDeltaChips = (m: "A" | "B") =>
    rawLines.map((line) => {
      const { diff, unit } = methodDelta(line, m);
      const tone = deltaTone(diff);
      return (
        <span key={line.salesOrderLineId} className={tone}>
          {line.itemNm} {tone === "flat" ? "변동없음" : `${fmtSigned(diff)}${unitText(unit)}`}
        </span>
      );
    });

  /** 비교표 셀 하나 (투입량 / 예상 산출 / 계약 대비) */
  const renderCmpCell = (
    key: string,
    cls: string,
    line: WorkOrderLine,
    qty: number,
    out: number | null,
    delta: { diff: number; unit: string },
  ) => {
    const tone = deltaTone(delta.diff);
    return (
      <td key={key} className={cls}>
        <span className="wocm-qty">{fmtQty(qty, line.inputUnit)}</span>
        <span className="wocm-out">{out != null ? `예상 산출 ${fmtQty(out, line.unit)}` : "예상 산출량 미정"}</span>
        <span className={`wocm-delta ${tone}`}>
          {tone === "flat" ? "계약과 동일" : `계약 대비 ${fmtSigned(delta.diff)}${unitText(delta.unit)}`}
        </span>
      </td>
    );
  };

  /** ③ 풀 사용 현황 문구 (카드 ③ 하단) */
  const rawGroup = groupUsages.find((g) => g.key === "RAW");
  const poolNote =
    rawPool == null
      ? "입고된 원료가 없거나 탈피씨드로 환산할 수 없어 직접 입력을 사용할 수 없습니다."
      : isDirect && rawGroup
        ? isFullyUsed(rawGroup.total, rawPool)
          ? `탈피씨드 풀 ${fmtQty(rawPool, "kg")} 전량 사용`
          : `탈피씨드 풀 ${fmtQty(rawPool, "kg")} 중 ${fmtQty(rawGroup.total, "kg")} 사용 · ${fmtQty(round3(rawPool - rawGroup.total), "kg")} 남음`
        : `탈피씨드 풀 ${fmtQty(rawPool, "kg")} 안에서 자유롭게 배분`;

  /** 라인 하나 렌더 */
  const renderLine = (line: WorkOrderLine) => {
    const id = line.salesOrderLineId;
    const groupTagCls = line.allocationGroup === "RAW" ? "raw" : line.allocationGroup === "PARK" ? "park" : "";
    const qty = qtyOf(line);
    const out = outputOf(line);

    // 그룹 내 현재 비율 (직접입력이면 사용자가 정한 비율, 아니면 수주 배분 비율과 같아진다)
    const groupTotal = groupUsages.find((g) => g.key === line.allocationGroup)?.total ?? 0;
    const percent = groupTotal > 0 ? round3((qty / groupTotal) * 100) : 0;

    // 직접 입력 가능한 라인: ③ 방식 + 그룹 풀을 알 수 있는 RAW/PARK 라인
    const editable = isDirect && poolOf(line.allocationGroup) != null && !!line.preview;
    const isOil = oilLine?.salesOrderLineId === id;

    return (
      <li key={id} className="woc-line">
        <div className="woc-line__head">
          <strong className="woc-line__name">{line.itemNm}</strong>
          <span className="woc-line__code">{line.itemCode}</span>
          <span className={`woc-tag ${groupTagCls}`}>{GROUP_LABEL[line.allocationGroup] ?? line.allocationGroup}</span>
          {/* 방식을 고를 수 있는 상태에서만 계산 주체 표시 */}
          {showMethodPanel && (
            <span className={`woc-tag ${editable ? "direct" : "system"}`}>{editable ? "직접 입력" : "시스템 계산값"}</span>
          )}
        </div>

        <div key={effMethod} className="woc-line__fields is-flash">
          {/* 지시수량 = 투입량 기준 */}
          <div className="woc-field">
            <label htmlFor={`wocQty-${id}`}>투입량 (= 지시수량)</label>
            <div className="woc-unitInput">
              {/* number → text + inputMode="decimal": 입력 중 값("12.") 유실, 휠로 값이 바뀌는 문제 방지 */}
              <input
                id={`wocQty-${id}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="woc-input"
                // 직접 입력 중에는 입력 문자열 그대로, 아니면 계산된 값을 표시
                value={editable ? (direct[id] ?? "") : qty.toFixed(1)}
                disabled={!editable || isSubmitting}
                // 풀을 초과한 그룹의 입력칸에만 빨간 표시
                aria-invalid={editable && overGroups.has(line.allocationGroup)}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleDirectChange(id, e.target.value)}
                onBlur={() => editable && handleDirectBlur(id)}
              />
              <span>{unitText(line.inputUnit)}</span>
            </div>
            <p className="woc-field__hint">
              {line.allocationGroup === "PARK" ? "건조헴프박" : "탈피씨드"} 투입 기준 (그룹 내 비율 {fmt(percent)}%)
              {editable
                ? " · 한쪽을 고치면 남은 수량이 나머지 라인에 자동으로 맞춰집니다"
                : showMethodPanel
                  ? " · 위에서 선택한 방식으로 자동 계산됩니다"
                  : " · 수주에서 배분된 투입량(실제 입고량 기준)"}
            </p>
          </div>

          {/* 예상 산출량 (수율 미확정이면 미정) */}
          <div className="woc-field">
            <span className="woc-field__label">예상 산출량</span>
            <div className={`woc-readonly${out == null ? " is-unknown" : ""}`}>
              <span>{out != null ? fmtQty(out, line.unit) : "미정"}</span>
              <span className="woc-readonly__tag">{out != null ? "참고용" : "수율 미확정"}</span>
            </div>
            {isOil && parkInfo && (
              <div>
                <span className="woc-tag park">
                  부산물 헴프박 <strong>{fmt(parkInfo.byproduct)}</strong>kg 발생
                </span>
              </div>
            )}
            <p className="woc-field__hint">
              {out != null
                ? "수율 기준 예정 산출수량 (참고용 추정치)"
                : "수율이 확정되지 않아 계산하지 않음 - 생산 후 실적으로 확정"}
            </p>
          </div>
        </div>
      </li>
    );
  };

  /* ───── 렌더 ───── */

  return (
    <section ref={rootRef} className="woc" data-method={effMethod.toLowerCase()}>
      <header className="woc-header">
        <div>
          <h1 className="woc-header__title">작업지시 등록</h1>
          <p className="woc-header__desc">
            수주를 선택하면 산출 품목과 공정이 자동으로 구성됩니다. 입고가 계약과 다르면 투입량 계산 방식을 먼저 정해주세요.
          </p>
        </div>
        <span className="woc-header__required">
          <em>*</em> 표시는 필수 입력 항목입니다
        </span>
      </header>

      {/* 브라우저 기본 검사가 먼저 막으면 사유 안내가 안 나와 직접 검증한다 */}
      <form onSubmit={handleSubmit} noValidate className="woc-layout">
        {/* ───── 좌측: 입력 영역 ───── */}
        <div className="woc-main">
          {/* ── 기본정보 ── */}
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
                  searchable
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
                  searchable
                  disabled={isBusy}
                  invalid={!!showError(fieldErrors.orderCode)}
                  onChange={handleOrderChange}
                />
                {showError(fieldErrors.orderCode) && <p className="woc-field__error">{fieldErrors.orderCode}</p>}
              </div>
            </div>

            {/* 로딩 텍스트 한 줄 → 스켈레톤 (카드가 나타날 자리를 미리 잡아 화면이 튀지 않게) */}
            {isOrderLoading && (
              <div className="woc-skeleton" role="status" aria-live="polite">
                <span className="woc-sr">수주 정보를 불러오는 중입니다</span>
                <div className="woc-skeleton__cards" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="woc-skeleton__bar" />
                  ))}
                </div>
              </div>
            )}

            {orderDetail && (
              // 카드 수를 data-count 로 넘겨, 2열일 때 마지막 카드가 혼자 남지 않게 CSS 에서 처리한다
              <ul className="woc-infocards" data-count={receivedQty != null ? 5 : 4}>
                {/* 계약 원물 */}
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

                {/* 실제 누적 입고 - 계약과 다르면 미만/초과 입고 표시 */}
                {receivedQty != null && (
                  <li className={`woc-infocard is-received${receivedOk ? " is-ok" : ""}`}>
                    <span className="woc-infocard__icon" aria-hidden="true">
                      <InboxArrowDownIcon />
                    </span>
                    <div className="woc-infocard__text">
                      <span className="woc-infocard__label">실제 누적 입고수량</span>
                      <strong className="woc-infocard__value">
                        {receivedQty.toLocaleString()}
                        <em>{orderDetail.unit ?? ""}</em>
                      </strong>
                      {receivedDiff !== 0 && (
                        <span className="woc-infocard__subtag">
                          {receivedDiff < 0 ? "미만입고" : "초과입고"} {fmtSigned(receivedDiff).replace(/\.0$/, "")}
                          {orderDetail.unit ?? ""}
                          {preview?.raw.withinTolerance ? " (오차범위 이내)" : ""}
                        </span>
                      )}
                    </div>
                  </li>
                )}

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

          {/* ── 투입량 계산 방식 (입고량이 오차범위를 벗어났을 때만 표시) ── */}
          {showMethodPanel && preview && (
            <section className="woc-panel" aria-labelledby="wocMethodTitle">
              <div className="woc-panel__head">
                <div>
                  <h2 id="wocMethodTitle" className="woc-panel__title" style={{ marginBottom: 4 }}>
                    투입량 계산 방식
                  </h2>
                  <p className="woc-panel__desc">
                    계약 원료({contractQty?.toLocaleString() ?? "-"}
                    {orderDetail?.unit})와 실제 입고({receivedQty?.toLocaleString() ?? "-"}
                    {orderDetail?.unit})가 오차범위를 벗어났습니다. 라인에 어떻게 나눠줄지 선택하세요 — 아래 작업지시
                    라인의 지시수량이 그대로 바뀝니다.
                  </p>
                </div>
              </div>

              {/* 카드 3개를 설정 배열(METHOD_CARDS)로 렌더 + roving tabindex / 방향키 */}
              <div className="wocm-grid" role="radiogroup" aria-label="투입량 계산 방식">
                {METHOD_CARDS.map((card) => {
                  const selected = method === card.id;
                  const locked = card.id === "C" && rawPool == null; // 탈피씨드 가능량을 모르면 ③ 선택 불가
                  return (
                    <div
                      key={card.id}
                      ref={(el) => {
                        methodRefs.current[card.id] = el;
                      }}
                      className={`wocm-card${selected ? " selected" : ""}`}
                      role="radio"
                      aria-checked={selected}
                      aria-disabled={locked}
                      tabIndex={selected ? 0 : -1} // 선택된 카드만 Tab 정지점 (나머지는 방향키로 이동)
                      onClick={() => handleSelectMethod(card.id)}
                      onKeyDown={(e) => handleMethodKeyDown(e, card.id)}
                    >
                      <div className="head">
                        <span className="radio" />
                        <span className="name">{card.name}</span>
                      </div>
                      <div className="desc">{card.desc}</div>
                      {card.id === "A" && <div className="delta">{renderDeltaChips("A")}</div>}
                      {card.id === "B" && <div className="delta">{renderDeltaChips("B")}</div>}
                      {card.id === "C" &&
                        (locked ? (
                          // 비활성 사유: 11px 회색 글씨 → 잠금 아이콘 + 경고 박스
                          <p className="wocm-lockNote">
                            <LockClosedIcon aria-hidden="true" />
                            <span>{poolNote}</span>
                          </p>
                        ) : (
                          <p className="wocm-capNote">{poolNote}</p>
                        ))}
                    </div>
                  );
                })}
              </div>

              {/* 방식 비교표 (RAW 라인) - ③ 선택 시 "내 입력값" 열이 라이브로 추가된다 */}
              {rawLines.length > 0 && (
                <div className="wocm-tableWrap">
                  <table className="wocm-cmp">
                    <thead>
                      <tr>
                        <th>산출 품목</th>
                        <th className="hA">① 원료 비율 유지</th>
                        <th className="hB">② 오일 목표 산출량 유지</th>
                        {isDirect && <th className="hC">③ 내 입력값</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rawLines.map((line) => (
                        <tr key={line.salesOrderLineId}>
                          <td className="item">
                            {line.itemNm}
                            <span className="code">
                              {line.itemCode} · {line.preview!.outputYieldPercent != null ? "수율 확정" : "수율 불확실"}
                            </span>
                          </td>
                          {(["A", "B"] as const).map((m) =>
                            renderCmpCell(
                              m,
                              m === "A" ? "colA" : "colB",
                              line,
                              methodQty(line, m),
                              methodOut(line, m),
                              methodDelta(line, m),
                            ),
                          )}
                          {isDirect &&
                            renderCmpCell(
                              "C",
                              "colC",
                              line,
                              qtyOf(line),
                              outputOf(line),
                              calcDelta(line, qtyOf(line), outputOf(line)),
                            )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="wocm-note">
                <span>⚠</span>
                <span>
                  <b>입고량이 더 적게 들어오면?</b> ②번 방식은 수율이 확정된 라인에 필요한 원물을 먼저 떼어주는 구조라,
                  실제 입고량이 그 필요량에도 못 미치면 나머지 라인은 0이 되고 입고된 원물 전부를 해당 라인이 가져갑니다 —
                  그래도 목표 산출량에는 못 미칠 수 있습니다.
                </span>
              </div>
            </section>
          )}

          {/* 오차범위 이내 → 방식 선택 UI 없이 ① 자동 적용 안내 */}
          {preview?.raw.withinTolerance && (
            <p className="woc-chain__state">
              실제 입고량이 계약 오차범위{preview.raw.toleranceRate != null ? `(±${preview.raw.toleranceRate}%)` : ""} 이내라
              원료 비율 유지 방식(①)으로 자동 계산됩니다.
            </p>
          )}

          {/* 미리보기 실패 → 계약 배분량 그대로 사용 중임을 알림 */}
          {previewFailed && orderDetail && (
            <p className="woc-chain__state error">
              지시수량 미리보기를 불러오지 못해 수주에 확정된 배분 투입량(계약 기준)을 그대로 사용합니다.
            </p>
          )}

          {/* ── 작업지시 라인 ── */}
          <section className="woc-panel" aria-labelledby="wocLineTitle">
            <div className="woc-panel__head">
              <h2 id="wocLineTitle" className="woc-panel__title">
                작업지시 라인 <em>*</em>
              </h2>
              <span className="woc-panel__count">총 {lines.length}개</span>
            </div>

            {lines.length === 0 ? (
              isOrderLoading ? (
                // 로딩 중에는 빈 안내 문구 대신 라인 모양의 스켈레톤
                <div className="woc-skeleton" aria-hidden="true">
                  <span className="woc-skeleton__bar is-line" />
                  <span className="woc-skeleton__bar is-line" />
                </div>
              ) : (
                <p className="woc-empty">
                  {orderDetail
                    ? "이 수주에는 배분된 산출 라인이 없습니다. 수주의 배분 그룹/비율을 확인해주세요."
                    : "수주를 선택하면 산출 품목과 공정이 여기에 표시됩니다."}
                </p>
              )
            ) : (
              <ul className="woc-lines">
                {lineGroups.map(([groupKey, groupLines]) => (
                  <Fragment key={groupKey}>
                    {/* 그룹 상단 투입 현황 배너 (미리보기가 있을 때만) */}
                    {groupKey === "RAW" && preview && rawPool != null && (
                      <li className="woc-groupBanner">
                        <span className="woc-groupBanner__title">RAW 그룹 투입 현황 (원물 → 탈피씨드)</span>
                        <div className="woc-groupBanner__stats">
                          <div className="woc-groupBanner__stat">
                            <span className="woc-groupBanner__label">실제 누적 입고수량</span>
                            <strong className="woc-groupBanner__value">
                              {fmt(preview.raw.receivedQty)}
                              <em>kg</em>
                            </strong>
                          </div>
                          <span className="woc-groupBanner__arrow">→</span>
                          <div className="woc-groupBanner__stat is-highlight">
                            <span className="woc-groupBanner__label">전처리(탈각) 후 탈피씨드</span>
                            <strong className="woc-groupBanner__value">
                              {fmt(rawPool)}
                              <em>kg</em>
                            </strong>
                          </div>
                        </div>
                      </li>
                    )}
                    {groupKey === "PARK" && parkInfo && (
                      <li className="woc-groupBanner is-park">
                        <span className="woc-groupBanner__title">PARK 그룹 투입 현황 (헴프박 → 건조헴프박)</span>
                        <div className="woc-groupBanner__stats">
                          <div className="woc-groupBanner__stat">
                            <span className="woc-groupBanner__label">예상 헴프박 수량(오일 부산물)</span>
                            <strong className="woc-groupBanner__value">
                              {fmt(parkInfo.byproduct)}
                              <em>kg</em>
                            </strong>
                          </div>
                          <span className="woc-groupBanner__arrow">→</span>
                          <div className="woc-groupBanner__stat is-highlight">
                            <span className="woc-groupBanner__label">건조 후 수량</span>
                            <strong className="woc-groupBanner__value">
                              {fmt(parkInfo.dry)}
                              <em>kg</em>
                            </strong>
                          </div>
                        </div>
                      </li>
                    )}
                    {groupLines.map(renderLine)}
                  </Fragment>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ───── 우측: 배분 그룹별 투입량 요약 ───── */}
        <aside className="woc-side" aria-label="투입원료 사용량">
          <div className="woc-usage">
            <h2 className="woc-usage__title">투입원료 사용량</h2>

            {groupUsages.length === 0 && <p className="woc-usage__empty">수주를 선택하면 그룹별 투입량이 표시됩니다.</p>}

            {groupUsages.map((group) => {
              const over = group.pool != null && isOverPool(group.total, group.pool);
              const full = group.pool != null && isFullyUsed(group.total, group.pool);
              const pct = group.pool ? (full ? 100 : Math.min(100, (group.total / group.pool) * 100)) : 0;
              const isPark = group.key === "PARK";
              const groupLines = lines.filter((l) => l.allocationGroup === group.key);

              return (
                <div key={group.key} className="woc-usage__group">
                  <div className="woc-usage__groupHead">
                    <span>{isPark ? "헴프박 공급/배분" : `${group.label} 투입`}</span>
                    <span>라인 {group.lineCount}개</span>
                  </div>

                  <p className="woc-usage__figure">
                    <strong>{fmt(group.total)}</strong>
                    <span>
                      {group.pool != null ? ` / ${fmt(group.pool)}` : ""} {unitText(group.unit)}
                    </span>
                  </p>

                  {group.pool != null && (
                    <>
                      <div className="woc-meter">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                      <p className="woc-usage__status" style={over ? { color: "var(--woc-error-dark)" } : undefined}>
                        {over
                          ? "사용 가능량을 초과했습니다"
                          : full
                            ? "전량이 라인에 배정됐습니다"
                            : `${fmtQty(round3(group.pool - group.total), group.unit)} 남음`}
                      </p>
                    </>
                  )}

                  {/* 라인별 투입량 + 그룹 내 비율 */}
                  <ul className="woc-usage__list">
                    {isPark && parkInfo && (
                      <li>
                        <span>공급(오일 부산물)</span>
                        <span>{fmtQty(parkInfo.byproduct, "kg")}</span>
                      </li>
                    )}
                    {groupLines.map((line) => {
                      const q = qtyOf(line);
                      const share = group.total > 0 ? round3((q / group.total) * 100) : 0;
                      return (
                        <li key={line.salesOrderLineId}>
                          <span>
                            {line.itemNm} 투입{isPark ? "" : "(탈피씨드)"}
                          </span>
                          <span>
                            {fmtQty(q, line.inputUnit)} ({fmt(share)}%)
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
          {/*
            액션바
            - 넓은 화면: 요약 패널 바로 아래 (우측 sticky 패널과 함께 따라다님)
            - 좁은 화면(≤1000px): CSS 로 하단 sticky
          */}
          <div className="woc-actionBar">
            <p
              ref={reasonRef}
              tabIndex={-1}
              role="status"
              aria-live="polite"
              className={`woc-actionBar__reason${blockReason && submitted ? " is-error" : ""}`}
            >
              {submitted ? blockReason : ""}
            </p>
            <div className="woc-actionBar__buttons">
              <button type="button" className="woc-btn ghost" onClick={handleCancel} disabled={isSubmitting}>
                취소
              </button>
              <button type="submit" className="woc-btn primary" disabled={isBusy}>
                {isSubmitting ? "저장 중..." : "작업지시 저장"}
              </button>
            </div>
          </div>
        </aside>
      </form>

      {/* 이탈 확인 다이얼로그 */}
      <dialog ref={leaveDialogRef} className="woc-dialog" onClose={() => setLeaveOpen(false)} aria-labelledby="wocLeaveTitle">
        <div className="woc-dialog__body is-center">
          <div className="woc-dialog__icon" aria-hidden="true">
            <ExclamationTriangleIcon width={24} height={24} />
          </div>
          <h2 id="wocLeaveTitle" className="woc-dialog__title">
            작성 중인 내용이 사라집니다
          </h2>
          <p className="woc-dialog__desc">저장하지 않고 나가면 입력한 내용이 모두 사라집니다. 나가시겠어요?</p>
          <div className="woc-dialog__actions">
            <button type="button" className="woc-btn ghost" onClick={() => setLeaveOpen(false)}>
              계속 작성
            </button>
            <button
              type="button"
              className="woc-btn danger"
              onClick={() => {
                setLeaveOpen(false);
                navigate(-1);
              }}
            >
              나가기
            </button>
          </div>
        </div>
      </dialog>

      {/* 토스트 (오류는 role="alert" 로 즉시 읽히게) */}
      {
        toast && (
          <div className={`woc-toast is-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
            <span>{toast.message}</span>
            <button type="button" className="woc-toast__close" aria-label="알림 닫기" onClick={() => setToast(null)}>
              ×
            </button>
          </div>
        )
      }
    </section >
  );
}
