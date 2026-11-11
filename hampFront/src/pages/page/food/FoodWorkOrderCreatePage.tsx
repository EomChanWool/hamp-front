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
import { WorkOrderApi } from "@/api/WorkOrder";
import { UserApi, type UserOptionResponse } from "@/api/User";
import "./Food.css";
import { BanknotesIcon, BuildingOffice2Icon, CalendarDaysIcon, CubeIcon } from "@heroicons/react/24/outline";

// toISOString()은 UTC 기준이라 한국 시간 00:00~09:00 사이에는 전날 날짜가 나와 로컬 기준으로 만든다
const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/* ───────────── 타입 ───────────── */

interface SalesOrderLine {
  salesOrderLineId: number;
  itemCode: string;
  itemNm: string;
  unit: string;
  planQty: number | null; // 계약 시점에 수량이 정해져 있으면 숫자, 미정이면 null
}

interface SalesOrder {
  orderCode: string;
  bpNm: string;
  dueDate: string;
  rawItemNm: string;
  rawQty: number;
  rawUnit: string;
  amount: number;
  lines: SalesOrderLine[];
}

interface WorkOrderLine extends SalesOrderLine {
  instructQty: number | "";
  rawInput: number | ""; // 예상 투입 원료(헴프박 연계 품목은 필요 헴프박) kg - 자동계산, 직접 수정 가능
}

interface ProcessStep {
  name: string;
  yieldText?: string;
  kind?: "output" | "byproduct";
  shared?: boolean; // 오일 라인과 공유하는 공정
}

interface ProcessFlowDef {
  steps: ProcessStep[];
  byproduct?: { name: string; yieldText: string; usedBy: string };
  sharedNote?: string;
}

interface RawSummary {
  rawTotal: number;
  committed: number;
  overRaw: boolean;
  overBy: number;
  items: { id: number; name: string; raw: number }[];
  parkSupply: number;
  parkDemand: number;
  hasOilLine: boolean;
  hasParkConsumer: boolean;
  parkShort: boolean;
  hasUnknown: boolean;
}

/* ───────────── 수주 데이터 (TODO: 수주 목록 API 연동 시 교체) ───────────── */

const SALES_ORDERS: SalesOrder[] = [
  {
    orderCode: "SO-0001",
    bpNm: "그린팜 영농조합",
    dueDate: "2026-11-20",
    rawItemNm: "헴프 원물",
    rawQty: 100,
    rawUnit: "kg",
    amount: 500000,
    lines: [
      { salesOrderLineId: 13, itemCode: "HEMP_OIL", itemNm: "헴프오일", unit: "L", planQty: 100 },
      { salesOrderLineId: 14, itemCode: "HEMP_POWDER", itemNm: "단백질파우더", unit: "kg", planQty: 10 },
      { salesOrderLineId: 15, itemCode: "HEMP_PARK_CONC", itemNm: "헴프박농축액", unit: "kg", planQty: 5 },
    ],
  },
  {
    orderCode: "SO-0002",
    bpNm: "한빛바이오",
    dueDate: "2026-11-25",
    rawItemNm: "헴프 원물",
    rawQty: 80,
    rawUnit: "kg",
    amount: 400000,
    lines: [
      { salesOrderLineId: 21, itemCode: "HEMP_SEED_PRODUCT", itemNm: "헴프씨드", unit: "kg", planQty: null },
      { salesOrderLineId: 22, itemCode: "HEMP_OIL", itemNm: "헴프오일", unit: "L", planQty: 50 },
    ],
  },
  {
    orderCode: "SO-0004",
    bpNm: "대한헴프",
    dueDate: "2026-12-01",
    rawItemNm: "헴프 원물",
    rawQty: 600,
    rawUnit: "kg",
    amount: 1500000,
    lines: [
      { salesOrderLineId: 41, itemCode: "HEMP_OIL", itemNm: "헴프오일", unit: "L", planQty: 100 },
      { salesOrderLineId: 42, itemCode: "HEMP_POWDER", itemNm: "단백질파우더", unit: "kg", planQty: 50 },
    ],
  },
];

/* ───────────── 공정 / 수율 ───────────── */

// 수율은 중간값 추정치(참고용)
const YIELD = {
  rawToSeed: 0.65, // 원료 → 탈피·선별 (63~68%)
  seedToOil: 0.275, // 착유 → 오일 (25~30%)
  seedToSeedProduct: 1.0, // 2차선별 → 씨드 (수율 미정이라 100% 가정)
  seedToPark: 0.725, // 착유 → 헴프박 (70~75%)
  parkToPowder: 0.9, // 헴프박 분쇄 → 파우더 (90%)
};

// 헴프박(오일 부산물)을 이어받아 만드는 품목 - 원물을 따로 투입하지 않는다
const PARK_DERIVED = new Set(["HEMP_POWDER", "HEMP_PARK_CONC"]);

const COMMON_STEPS: ProcessStep[] = [{ name: "원료" }, { name: "전처리" }, { name: "탈피" }, { name: "선별" }];
const asShared = (steps: ProcessStep[]): ProcessStep[] => steps.map((s) => ({ ...s, shared: true }));
// const SHARED_NOTE =
//   "원료~착유는 헴프오일 라인과 같은 공정입니다. 별도 원물 없이 오일 생산 중 나오는 헴프박을 이어받습니다.";

const PROCESS_FLOW: Record<string, ProcessFlowDef> = {
  HEMP_OIL: {
    steps: [...COMMON_STEPS, { name: "착유" }, { name: "헴프오일", kind: "output", yieldText: "25~30%" }],
    byproduct: { name: "헴프박", yieldText: "70~75%", usedBy: "단백질파우더·헴프박농축액" },
  },
  HEMP_SEED_PRODUCT: {
    steps: [...COMMON_STEPS, { name: "2차선별" }, { name: "헴프씨드", kind: "output", yieldText: "미정" }],
  },
  HEMP_POWDER: {
    steps: [
      ...asShared([...COMMON_STEPS, { name: "착유" }]),
      { name: "헴프박", kind: "byproduct" },
      { name: "분쇄" },
      { name: "단백질파우더", kind: "output", yieldText: "90%" },
    ],
    // sharedNote: SHARED_NOTE,
  },
  HEMP_PARK_CONC: {
    steps: [
      ...asShared([...COMMON_STEPS, { name: "착유" }]),
      { name: "헴프박", kind: "byproduct" },
      { name: "농축" },
      { name: "헴프박농축액", kind: "output", yieldText: "미정" },
    ],
    // sharedNote: SHARED_NOTE,
  },
};

// 산출수량 기준 예상 투입 원료(kg) 자동계산 - 계산 불가하면 ''
const calcAutoRaw = (itemCode: string, qty: number | ""): number | "" => {
  if (qty === "" || qty <= 0) return "";
  switch (itemCode) {
    case "HEMP_OIL":
      return round1(qty / YIELD.seedToOil / YIELD.rawToSeed);
    case "HEMP_SEED_PRODUCT":
      return round1(qty / YIELD.seedToSeedProduct / YIELD.rawToSeed);
    case "HEMP_POWDER":
      return round1(qty / YIELD.parkToPowder); // 필요한 헴프박(kg)
    default:
      return ""; // 헴프박농축액 등 수율 미확정
  }
};

const rawHint = (itemCode: string): string => {
  switch (itemCode) {
    case "HEMP_OIL":
      return "착유 27.5%, 원료→선별 65% 가정으로 자동계산";
    case "HEMP_SEED_PRODUCT":
      return "2차선별 100%(가정), 원료→선별 65% 가정으로 자동계산";
    case "HEMP_POWDER":
      return "분쇄 수율 90%로 자동계산 · 오일 부산물로 충당";
    default:
      return "수율 미확정이라 직접 입력 · 오일 부산물로 충당";
  }
};

// 투입원료 / 헴프박 수급 집계
const summarize = (lines: WorkOrderLine[], order: SalesOrder | null): RawSummary => {
  let rawTotal = 0;
  let parkSupply = 0;
  let parkDemand = 0;
  let hasOilLine = false;
  let hasParkConsumer = false;
  let hasUnknown = false;
  const items: RawSummary["items"] = [];

  lines.forEach((line) => {
    const has = typeof line.rawInput === "number" && line.rawInput > 0;
    const val = has ? Number(line.rawInput) : 0;

    if (PARK_DERIVED.has(line.itemCode)) {
      hasParkConsumer = true;
      if (has) parkDemand += val;
      else hasUnknown = true;
    } else if (has) {
      rawTotal += val;
      items.push({ id: line.salesOrderLineId, name: line.itemNm, raw: val });
      if (line.itemCode === "HEMP_OIL") {
        hasOilLine = true;
        parkSupply += val * YIELD.rawToSeed * YIELD.seedToPark;
      }
    } else {
      hasUnknown = true;
    }
  });

  const committed = order?.rawQty ?? 0;
  return {
    rawTotal,
    committed,
    overRaw: !!order && rawTotal > committed,
    overBy: Math.ceil(rawTotal - committed),
    items: items.sort((a, b) => b.raw - a.raw),
    parkSupply,
    parkDemand,
    hasOilLine,
    hasParkConsumer,
    parkShort: hasParkConsumer && parkDemand > parkSupply,
    hasUnknown,
  };
};

/* ───────────── 공정 스테퍼 ───────────── */

function ProcessStepper({ itemCode }: { itemCode: string }) {
  const flow = PROCESS_FLOW[itemCode];
  if (!flow) return null;

  return (
    <div className="woc-process">
      <ol className="woc-stepper" aria-label="공정 순서">
        {flow.steps.map((step, i) => {
          const cls = ["woc-stepper__step", step.kind, step.shared && "shared"].filter(Boolean).join(" ");
          return (
            <li key={`${step.name}-${i}`} className={cls}>
              <span className="woc-stepper__dot" aria-hidden="true" />
              <span className="woc-stepper__name">{step.name}</span>
              {step.yieldText && <span className="woc-stepper__yield">수율 {step.yieldText}</span>}
            </li>
          );
        })}
      </ol>
      {flow.byproduct && (
        <p className="woc-process__note byproduct">
          부산물 <strong>{flow.byproduct.name}</strong> 수율 {flow.byproduct.yieldText} · {flow.byproduct.usedBy}{" "}
          라인에서 사용
        </p>
      )}
      {flow.sharedNote && <p className="woc-process__note">{flow.sharedNote}</p>}
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

        <p className="woc-dialog__tip">지시수량이나 예상 투입 원료를 줄이면 저장할 수 있습니다.</p>

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
  const ackedTotalRef = useRef<number | null>(null); // 이미 경고를 보여준 소요량 - 같은 값이면 blur마다 다시 띄우지 않는다

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttempt, setSubmitAttempt] = useState(0);
  const [isOverDialogOpen, setIsOverDialogOpen] = useState(false);

  const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([]);

  const [form, setForm] = useState({
    workDate: todayStr(),
    managerId: "",
    orderCode: "",
  });

  const [lines, setLines] = useState<WorkOrderLine[]>([]);

  const selectedOrder = useMemo(
    () => SALES_ORDERS.find((o) => o.orderCode === form.orderCode) ?? null,
    [form.orderCode],
  );

  const summary = useMemo(() => summarize(lines, selectedOrder), [lines, selectedOrder]);

  const managerOptions = useMemo<SelectOption[]>(
    () => userOptions.map((user) => ({ value: user.userId, label: `${user.userNm} (${user.userId})` })),
    [userOptions],
  );

  const orderOptions = useMemo<SelectOption[]>(
    () =>
      SALES_ORDERS.map((order) => ({
        value: order.orderCode,
        label: `${order.orderCode} · ${order.bpNm}`,
        description: `납기 ${order.dueDate}`,
      })),
    [],
  );

  // 헴프박을 이어받는 라인은 오일 라인 바로 아래에 묶어서 보여준다
  const displayLines = useMemo(
    () => [...lines].sort((a, b) => Number(PARK_DERIVED.has(a.itemCode)) - Number(PARK_DERIVED.has(b.itemCode))),
    [lines],
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

  // 입력칸을 벗어날 때(blur) 초과 상태면 경고 - 타이핑 중간 값에는 반응하지 않는다
  const handleLineBlur = () => openOverDialog(summary);

  /* ───── 핸들러 ───── */

  const handleChange = (key: "workDate" | "managerId", value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 수주 하나 = 작업지시 하나 - 선택한 수주의 산출라인 전부가 작업지시 라인이 된다
  const handleOrderChange = (orderCode: string) => {
    const order = SALES_ORDERS.find((o) => o.orderCode === orderCode) ?? null;
    const nextLines: WorkOrderLine[] = (order?.lines ?? []).map((line) => {
      const instructQty = line.planQty ?? "";
      return { ...line, instructQty, rawInput: calcAutoRaw(line.itemCode, instructQty) };
    });

    setForm((prev) => ({ ...prev, orderCode }));
    setLines(nextLines);
    setSubmitted(false);
    ackedTotalRef.current = null;
    openOverDialog(summarize(nextLines, order));
  };

  // 산출수량이 바뀌면 예상 투입 원료를 다시 자동계산한다
  const handleQtyChange = (id: number, value: string) => {
    const qty = value === "" ? "" : Number(value);
    setLines((prev) =>
      prev.map((line) =>
        line.salesOrderLineId === id ? { ...line, instructQty: qty, rawInput: calcAutoRaw(line.itemCode, qty) } : line,
      ),
    );
  };

  const handleRawChange = (id: number, value: string) => {
    const raw = value === "" ? "" : Number(value);
    setLines((prev) => prev.map((line) => (line.salesOrderLineId === id ? { ...line, rawInput: raw } : line)));
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

  const rawUnit = selectedOrder?.rawUnit ?? "kg";
  const remaining = summary.committed - summary.rawTotal;
  const usagePct = summary.committed > 0 ? Math.min(100, (summary.rawTotal / summary.committed) * 100) : 0;

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
                  disabled={isSubmitting}
                  invalid={!!showError(fieldErrors.orderCode)}
                  onChange={handleOrderChange}
                />
                {showError(fieldErrors.orderCode) && <p className="woc-field__error">{fieldErrors.orderCode}</p>}
              </div>
            </div>

            {selectedOrder && (
              <ul className="woc-infocards">
                <li className="woc-infocard is-raw">
                  <span className="woc-infocard__icon" aria-hidden="true">
                    <CubeIcon />
                  </span>
                  <div className="woc-infocard__text">
                    <span className="woc-infocard__label">계약 투입원료 · {selectedOrder.rawItemNm}</span>
                    <strong className="woc-infocard__value">
                      {selectedOrder.rawQty.toLocaleString()}
                      <em>{selectedOrder.rawUnit}</em>
                    </strong>
                  </div>
                </li>

                <li className="woc-infocard">
                  <span className="woc-infocard__icon" aria-hidden="true">
                    <BuildingOffice2Icon />
                  </span>
                  <div className="woc-infocard__text">
                    <span className="woc-infocard__label">거래처</span>
                    <strong className="woc-infocard__value">{selectedOrder.bpNm}</strong>
                  </div>
                </li>

                <li className="woc-infocard">
                  <span className="woc-infocard__icon" aria-hidden="true">
                    <CalendarDaysIcon />
                  </span>
                  <div className="woc-infocard__text">
                    <span className="woc-infocard__label">납기일</span>
                    <strong className="woc-infocard__value">{selectedOrder.dueDate}</strong>
                  </div>
                </li>

                <li className="woc-infocard">
                  <span className="woc-infocard__icon" aria-hidden="true">
                    <BanknotesIcon />
                  </span>
                  <div className="woc-infocard__text">
                    <span className="woc-infocard__label">가공비</span>
                    <strong className="woc-infocard__value">{selectedOrder.amount.toLocaleString()}원</strong>
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
                  const isDerived = PARK_DERIVED.has(line.itemCode);
                  const qtyError = qtyErrors[id];
                  const qtyInvalid = submitted && !!qtyError;
                  const rawInvalid =
                    summary.overRaw && !isDerived && typeof line.rawInput === "number" && line.rawInput > 0;
                  const byproductKg =
                    line.itemCode === "HEMP_OIL" && typeof line.rawInput === "number" && line.rawInput > 0
                      ? Math.ceil(line.rawInput * YIELD.rawToSeed * YIELD.seedToPark)
                      : 0;

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
                              onBlur={handleLineBlur}
                            />
                            <span>{line.unit}</span>
                          </div>
                          {qtyInvalid && (
                            <p id={`wocQtyErr-${id}`} className="woc-field__error">
                              {qtyError}
                            </p>
                          )}
                        </div>

                        <div className="woc-field">
                          <label htmlFor={`wocRaw-${id}`}>{isDerived ? "필요 헴프박" : "예상 투입 원료"}</label>
                          <div className="woc-unitInput">
                            <input
                              id={`wocRaw-${id}`}
                              type="number"
                              min="0"
                              step="0.1"
                              inputMode="decimal"
                              className="woc-input"
                              value={line.rawInput}
                              placeholder="직접 입력"
                              disabled={isSubmitting}
                              aria-invalid={rawInvalid}
                              aria-describedby={rawInvalid ? `wocRawErr-${id}` : undefined}
                              onChange={(e) => handleRawChange(id, e.target.value)}
                              onBlur={handleLineBlur}
                            />
                            <span>kg</span>
                          </div>
                          {rawInvalid ? (
                            <p id={`wocRawErr-${id}`} className="woc-field__error">
                              계약 투입원료를 넘었습니다. 값을 줄여주세요.
                            </p>
                          ) : (
                            <p className="woc-field__hint">
                              {rawHint(line.itemCode)}
                              {byproductKg > 0 && ` · 헴프박 약 ${byproductKg.toLocaleString()}kg 발생`}
                            </p>
                          )}
                        </div>
                      </div>

                      <ProcessStepper itemCode={line.itemCode} />
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

            {selectedOrder ? (
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
              </div>
            ) : (
              <p className="woc-usage__empty">수주를 선택하면 계약 투입원료 대비 사용량이 표시됩니다.</p>
            )}
          </div>

          <div className="woc-actions">
            <button type="submit" className="woc-btn primary block" disabled={isSubmitting}>
              {isSubmitting ? "등록 중..." : "작업지시 저장"}
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
