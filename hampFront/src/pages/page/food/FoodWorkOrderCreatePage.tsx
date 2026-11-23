import {
  Fragment, useEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type SyntheticEvent,
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
  InboxArrowDownIcon,
} from "@heroicons/react/24/outline";

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

/** 소수점 부동소수점 오차 방지용 반올림 (수량 계산용) */
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** 수량 표시 (소수 1자리 고정) */
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 증감 표시 (+12.0 / -12.0) */
const fmtSigned = (n: number) => `${n > 0 ? "+" : ""}${fmt(n)}`;

/** 직접입력 문자열 → 숫자 (빈 값/음수/NaN 은 0) */
const toNum = (s?: string) => {
  const n = parseFloat(s ?? "");
  return Number.isNaN(n) || n < 0 ? 0 : n;
};

/** 풀(총량) 비교 시 허용하는 오차 */
const EPS = 0.1;

/** 그룹 합계가 풀을 (오차 이상) 초과했는지 */
const isOverPool = (total: number, pool: number) => round3(total - pool) > EPS;

/** 그룹 합계가 풀을 (오차 범위 안에서) 전부 사용했는지 */
const isFullyUsed = (total: number, pool: number) => round3(pool - total) <= EPS;

/* ───────────── 타입 ───────────── */

/**
 * 투입량 계산 방식
 * - A: ① 원료 비율 유지      (서버 ratioKept*)
 * - B: ② 오일 목표 산출량 유지 (서버 targetYieldKept*)
 * - C: ③ 직접 입력           (프론트가 수율로 직접 계산)
 */
type Method = "A" | "B" | "C";

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
  const orderReqRef = useRef(0); // 수주 조회 요청 식별자 - 수주를 바꾸면 이전 응답은 무시한다

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttempt, setSubmitAttempt] = useState(0);

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
   */
  const [direct, setDirect] = useState<Record<number, string>>({});

  /* ───── 파생값: 방식 / 풀 / 헴프박 공급량 ───── */

  /**
   * 실제로 적용되는 방식
   * - 입고량이 계약 오차범위 이내(withinTolerance)이거나 미리보기가 없으면 ① 고정
   */
  const showMethodPanel = !!preview && !preview.raw.withinTolerance && lines.length > 0;
  const effMethod: Method = showMethodPanel ? method : "A";
  const isDirect = effMethod === "C";

  /** RAW 그룹에서 쓸 수 있는 탈피씨드 총량 (= 실제 입고 × 탈각 수율). 없으면 ③ 선택 불가 */
  const rawPool = preview?.raw.receivedSemiSeedQty ?? null;

  /** 헴프박 부산물이 나오는 라인 (= 헴프오일) - byproductYieldPercent 가 내려오는 RAW 라인 */
  const oilLine = useMemo(
    () => lines.find((l) => l.allocationGroup === "RAW" && l.preview?.byproductYieldPercent != null) ?? null,
    [lines],
  );

  /** 오일 투입량(탈피씨드) → 헴프박 발생량 / 건조 후 공급량 (③ 직접입력용 프론트 계산) */
  const calcParkFromOil = (oilQty: number) => {
    const bp = oilLine?.preview?.byproductYieldPercent;
    const dry = preview?.park.dryYieldPercent;
    if (bp == null || dry == null) return null;
    const byproduct = round3((oilQty * bp) / 100); // 건조 전 헴프박 발생량
    return { byproduct, dry: round3((byproduct * dry) / 100) }; // 건조 후 = PARK 그룹 투입 가능 풀
  };

  const redistributePark = (next: Record<number, string>) => {
    if (!oilLine) return;
    const newPark = calcParkFromOil(toNum(next[oilLine.salesOrderLineId]));
    const parkLines = lines.filter((l) => l.allocationGroup === "PARK");
    if (!newPark || parkLines.length === 0) return;

    const curTotal = parkLines.reduce((s, l) => s + toNum(next[l.salesOrderLineId]), 0);
    let assigned = 0;
    parkLines.forEach((l, i) => {
      const share =
        curTotal > 0
          ? toNum(next[l.salesOrderLineId]) / curTotal
          : (l.allocationPercent ?? 100 / parkLines.length) / 100;
      const v = i === parkLines.length - 1 ? round3(newPark.dry - assigned) : round3(newPark.dry * share);
      assigned += v;
      next[l.salesOrderLineId] = String(Math.max(0, v));
    });
  };

  /** 방식별 헴프박 발생량(건조 전)/공급량(건조 후) - PARK 그룹 풀 */
  const parkInfo = useMemo(() => {
    if (!preview) return null;
    const p = preview.park;
    if (effMethod === "A") return { byproduct: p.ratioKeptByproductQty, dry: p.ratioKeptDryQty };
    if (effMethod === "B") return { byproduct: p.targetYieldKeptByproductQty, dry: p.targetYieldKeptDryQty };
    return calcParkFromOil(oilLine ? toNum(direct[oilLine.salesOrderLineId]) : 0);
  }, [preview, effMethod, direct, oilLine]);

  /** 그룹별 총량(풀) - RAW=탈피씨드 가능량, PARK=건조헴프박 공급량 */
  const poolOf = (group: string): number | null => {
    if (group === "RAW") return rawPool;
    if (group === "PARK") return parkInfo?.dry ?? null;
    return null;
  };

  /** 라인의 현재 지시수량(= 투입량) - 선택한 방식에 따라 달라진다 */
  const qtyOf = (line: WorkOrderLine): number => {
    const p = line.preview;
    if (!p) return line.contractInputQty; // 미리보기가 없으면 계약 배분량 그대로
    if (effMethod === "C") return toNum(direct[line.salesOrderLineId]);
    return effMethod === "B" ? p.targetYieldKeptQty : p.ratioKeptQty;
  };

  /** 라인의 예상 산출량 - 수율 미확정 라인은 null */
  const outputOf = (line: WorkOrderLine): number | null => {
    const p = line.preview;
    if (!p) return line.planQty;
    if (p.outputYieldPercent == null) return null;
    if (effMethod === "C") return round3((qtyOf(line) * p.outputYieldPercent) / 100); // ③ 은 프론트에서 직접 계산
    return effMethod === "B" ? p.targetYieldKeptOutputQty : p.ratioKeptOutputQty;
  };

  /** 그룹별 투입량 합계 (우측 요약 + 배너) */
  const groupUsages = useMemo<GroupUsage[]>(() => {
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
  }, [lines, effMethod, direct, preview, parkInfo]);

  /** 풀(총량)을 초과한 그룹 키 집합 - 빨간 표시는 이 그룹에만 건다 */
  const overGroups = useMemo(
    () => new Set(groupUsages.filter((g) => g.pool != null && isOverPool(g.total, g.pool)).map((g) => g.key)),
    [groupUsages],
  );

  /** 그룹 순서를 유지한 채 라인을 그룹별로 묶는다 (그룹 배너 표시용) */
  const lineGroups = useMemo(() => {
    const map = new Map<string, WorkOrderLine[]>();
    lines.forEach((l) => map.set(l.allocationGroup, [...(map.get(l.allocationGroup) ?? []), l]));
    return Array.from(map.entries());
  }, [lines]);

  /** ③ 직접입력에서 풀(총량)을 넘긴 그룹이 있으면 저장을 막는다 */
  const directError = useMemo(() => {
    if (!isDirect) return "";
    for (const g of groupUsages) {
      if (g.pool != null && isOverPool(g.total, g.pool)) {
        return `${g.label} 투입량 합계(${fmt(g.total)})가 사용 가능량(${fmt(g.pool)})을 초과했습니다.`;
      }
    }
    return "";
  }, [isDirect, groupUsages]);

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
      alert(errorMessage || "수주 정보를 불러오는 중 오류가 발생했습니다.");
      setForm((prev) => ({ ...prev, orderCode: "" }));
    } finally {
      if (reqId === orderReqRef.current) setIsOrderLoading(false);
    }
  };

  /**
   * 투입량 계산 방식 선택
   * - ③ 으로 넘어갈 때는 지금 화면에 보이는 값(현재 방식 ①/②의 투입량)으로 시작해서 자유롭게 고치게 한다
   * - PARK 라인은 프론트 계산 풀(③ 기준)에 맞춰 다시 나눠, 진입 직후 합계와 풀이 어긋나지 않게 한다
   */
  const handleSelectMethod = (next: Method) => {
    if (next === method) return;
    if (next === "C") {
      if (rawPool == null) return; // 탈피씨드 가능량을 모르면 직접입력 불가
      const init: Record<number, string> = {};
      lines.forEach((l) => {
        init[l.salesOrderLineId] = String(round3(qtyOf(l)));
      });
      redistributePark(init);
      setDirect(init);
    }
    setMethod(next);
  };

  /**
   * ③ 직접입력 변경
   * - 그룹 총량(풀)을 넘지 않도록 자르고, 그룹이 2라인이면 남은 수량을 나머지 라인에 자동 배정한다
   * - RAW(오일)가 바뀌면 헴프박 공급량(= PARK 풀)이 바뀌므로, PARK 라인들은 기존 배분 비율을 유지한 채 새 풀로 다시 나눈다
   */
  const handleDirectChange = (lineId: number, text: string) => {
    const target = lines.find((l) => l.salesOrderLineId === lineId);
    if (!target) return;

    const next: Record<number, string> = { ...direct };
    const groupLines = lines.filter((l) => l.allocationGroup === target.allocationGroup);

    const pool = poolOf(target.allocationGroup);
    let value = toNum(text);
    if (pool != null && value > pool) value = pool; // 풀 초과 입력은 풀로 자른다

    // 사용자가 타이핑 중인 칸은 입력 문자열을 최대한 그대로 유지 (자른 경우만 값으로 교체)
    next[lineId] = pool != null && toNum(text) > pool ? String(pool) : text;

    // 그룹이 정확히 2라인이면 남은 수량을 다른 한쪽에 자동으로 넣는다
    if (pool != null && groupLines.length === 2) {
      const other = groupLines.find((l) => l.salesOrderLineId !== lineId)!;
      next[other.salesOrderLineId] = String(round3(pool - value));
    }

    // 오일 투입량이 바뀌면 PARK 풀이 바뀌므로 PARK 라인을 새 풀로 재배분
    if (target.allocationGroup === "RAW") redistributePark(next);

    setDirect(next);
  };

  const handleCancel = () => {
    navigate(-1);
  };

  /* ───── 검증 (오류 문구는 저장 시도 후부터) ───── */

  const fieldErrors = {
    workDate: form.workDate ? "" : "작업일자를 입력해주세요.",
    managerId: form.managerId ? "" : "담당자를 선택해주세요.",
    orderCode: form.orderCode ? "" : "수주를 선택해주세요.",
  };

  const hasError =
    Object.values(fieldErrors).some(Boolean) ||
    lines.length === 0 || // 배분된 산출 라인이 하나도 없으면 저장할 수 없다
    !!directError; // ③ 직접입력에서 풀 초과

  const showError = (msg: string) => (submitted ? msg : "");

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

  /* ───── 렌더 보조 ───── */

  const isBusy = isSubmitting || isOrderLoading;

  // 입고 현황 (계약 대비 실제 입고)
  const receivedQty = orderDetail?.receivedQty ?? preview?.raw.receivedQty ?? null;
  const contractQty = orderDetail?.orderQty ?? null;
  const receivedDiff = receivedQty != null && contractQty != null ? round3(receivedQty - contractQty) : 0;

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
   */
  const methodDelta = (line: WorkOrderLine, m: "A" | "B") => {
    const out = methodOut(line, m);
    if (out != null && line.planQty != null) {
      return { diff: round3(out - line.planQty), unit: line.unit };
    }
    return { diff: round3(methodQty(line, m) - line.contractInputQty), unit: line.inputUnit };
  };

  /** 방식 카드 하단 요약 칩 */
  const renderDeltaChips = (m: "A" | "B") =>
    rawLines.map((line) => {
      const { diff, unit } = methodDelta(line, m);
      const flat = Math.abs(diff) < 0.05;
      return (
        <span key={line.salesOrderLineId} className={flat ? "flat" : diff < 0 ? "down" : ""}>
          {line.itemNm} {flat ? "변동없음" : `${fmtSigned(diff)}${unit}`}
        </span>
      );
    });

  /** ③ 풀 사용 현황 문구 (카드 ③ 하단) */
  const rawGroup = groupUsages.find((g) => g.key === "RAW");
  const poolNote =
    rawPool == null
      ? "입고된 원료가 없거나 탈피씨드로 환산할 수 없어 직접 입력을 사용할 수 없습니다."
      : isDirect && rawGroup
        ? isFullyUsed(rawGroup.total, rawPool)
          ? `탈피씨드 풀 ${fmt(rawPool)}kg 전량 사용`
          : `탈피씨드 풀 ${fmt(rawPool)}kg 중 ${fmt(rawGroup.total)}kg 사용 · ${fmt(round3(rawPool - rawGroup.total))}kg 남음`
        : `탈피씨드 풀 ${fmt(rawPool)}kg 안에서 자유롭게 배분`;

  /** 라인 하나 렌더 */
  const renderLine = (line: WorkOrderLine) => {
    const id = line.salesOrderLineId;
    const groupTagCls = line.allocationGroup === "RAW" ? "raw" : line.allocationGroup === "PARK" ? "park" : "";
    const qty = qtyOf(line);
    const out = outputOf(line);
    const percent = (() => {
      // 그룹 내 현재 비율 (직접입력이면 사용자가 정한 비율, 아니면 수주 배분 비율과 같아진다)
      const total = lines.filter((l) => l.allocationGroup === line.allocationGroup).reduce((s, l) => s + qtyOf(l), 0);
      return total > 0 ? round3((qty / total) * 100) : 0;
    })();

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

        <div className="woc-line__fields">
          {/* 지시수량 = 투입량 기준 */}
          <div className="woc-field">
            <label htmlFor={`wocQty-${id}`}>투입량 (= 지시수량)</label>
            <div className="woc-unitInput">
              <input
                id={`wocQty-${id}`}
                type="number"
                step="0.1"
                min="0"
                className="woc-input"
                // 직접 입력 중에는 입력 문자열 그대로, 아니면 계산된 값을 표시
                value={editable ? (direct[id] ?? "") : qty.toFixed(1)}
                disabled={!editable || isSubmitting}
                // 풀을 초과한 그룹의 입력칸에만 빨간 표시
                aria-invalid={editable && overGroups.has(line.allocationGroup)}
                onChange={(e) => handleDirectChange(id, e.target.value)}
              />
              <span>{line.inputUnit.toLowerCase()}</span>
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
              <span>{out != null ? `${fmt(out)}${line.unit}` : "미정"}</span>
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
                  <li className="woc-infocard is-received">
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

              <div className="wocm-grid" role="radiogroup" aria-label="투입량 계산 방식">
                {/* ① 원료 비율 유지 */}
                <div
                  className={`wocm-card${method === "A" ? " selected" : ""}`}
                  role="radio"
                  aria-checked={method === "A"}
                  tabIndex={0}
                  onClick={() => handleSelectMethod("A")}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), handleSelectMethod("A"))}
                >
                  <div className="head">
                    <span className="radio" />
                    <span className="name">① 원료 비율 유지</span>
                  </div>
                  <div className="desc">
                    계약 때 정한 배분비율을 실제 입고량에 그대로 적용합니다. 라인들이 같이 비례해서 줄어(늘어)듭니다.
                  </div>
                  <div className="delta">{renderDeltaChips("A")}</div>
                </div>

                {/* ② 목표 산출량 유지 */}
                <div
                  className={`wocm-card${method === "B" ? " selected" : ""}`}
                  role="radio"
                  aria-checked={method === "B"}
                  tabIndex={0}
                  onClick={() => handleSelectMethod("B")}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), handleSelectMethod("B"))}
                >
                  <div className="head">
                    <span className="radio" />
                    <span className="name">② 오일 목표 산출량 유지</span>
                  </div>
                  <div className="desc">
                    수율이 확정된 라인(헴프오일)의 목표 산출량을 계약값 그대로 지키고, 남는 원료만 수율이 불확실한
                    라인(헴프씨드)이 떠안습니다.
                  </div>
                  <div className="delta">{renderDeltaChips("B")}</div>
                </div>

                {/* ③ 직접 입력 - 수율은 서버가 내려준 값으로 프론트에서 계산 */}
                <div
                  className={`wocm-card c${method === "C" ? " selected" : ""}`}
                  role="radio"
                  aria-checked={method === "C"}
                  aria-disabled={rawPool == null}
                  tabIndex={0}
                  onClick={() => handleSelectMethod("C")}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), handleSelectMethod("C"))}
                >
                  <div className="head">
                    <span className="radio" />
                    <span className="name">③ 직접 입력</span>
                  </div>
                  <div className="desc">
                    실제 입고량 기준 탈피씨드 전량 안에서 라인에 자유롭게 나눠줍니다. 아래 작업지시 라인에서 한쪽 투입량을
                    고치면 남은 수량이 다른 한쪽에 자동으로 들어갑니다. 오일 투입량에 따라 달라지는 헴프박 공급량 안에서
                    PARK 라인도 똑같이 나눌 수 있습니다.
                  </div>
                  <p className="wocm-capNote">{poolNote}</p>
                </div>
              </div>

              {/* 방식 ①② 비교표 (RAW 라인) */}
              {rawLines.length > 0 && (
                <div className="wocm-tableWrap">
                  <table className="wocm-cmp">
                    <thead>
                      <tr>
                        <th>산출 품목</th>
                        <th className="hA">① 원료 비율 유지</th>
                        <th className="hB">② 오일 목표 산출량 유지</th>
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
                          {(["A", "B"] as const).map((m) => {
                            const out = methodOut(line, m);
                            const { diff, unit } = methodDelta(line, m);
                            const flat = Math.abs(diff) < 0.05;
                            return (
                              <td key={m} className={m === "A" ? "colA" : "colB"}>
                                <span className="wocm-qty">
                                  {fmt(methodQty(line, m))}
                                  {line.inputUnit.toLowerCase()}
                                </span>
                                <span className="wocm-out">
                                  {out != null ? `예상 산출 ${fmt(out)}${line.unit}` : "예상 산출량 미정"}
                                </span>
                                <span className={`wocm-delta ${flat ? "flat" : "down"}`}>
                                  {flat
                                    ? "계약과 동일"
                                    : `계약 대비 ${fmtSigned(diff)}${unit}`}
                                </span>
                              </td>
                            );
                          })}
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
              <p className="woc-empty">
                {orderDetail && !isOrderLoading
                  ? "이 수주에는 배분된 산출 라인이 없습니다. 수주의 배분 그룹/비율을 확인해주세요."
                  : "수주를 선택하면 산출 품목과 공정이 여기에 표시됩니다."}
              </p>
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

        {/* ───── 우측: 배분 그룹별 투입량 요약 + 저장 ───── */}
        <aside className="woc-side" aria-label="투입원료 사용량">
          <div className="woc-usage">
            <h2 className="woc-usage__title">투입원료 사용량</h2>

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
                      {group.pool != null ? ` / ${fmt(group.pool)}` : ""} {group.unit.toLowerCase()}
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
                            : `${fmt(round3(group.pool - group.total))}${group.unit.toLowerCase()} 남음`}
                      </p>
                    </>
                  )}

                  {/* 라인별 투입량 + 그룹 내 비율 */}
                  <ul className="woc-usage__list">
                    {isPark && parkInfo && (
                      <li>
                        <span>공급(오일 부산물)</span>
                        <span>{fmt(parkInfo.byproduct)}kg</span>
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
                            {fmt(q)}{line.inputUnit.toLowerCase()} ({fmt(share)}%)
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

            {/* ③ 직접입력 풀 초과 오류 (저장 시도 후 표시) */}
            {showError(directError) && <p className="woc-field__error">{directError}</p>}
          </div>

          <div className="woc-actions">
            <button type="submit" className="woc-btn primary block" disabled={isBusy}>
              {isSubmitting ? "등록 중..." : "작업지시 저장"}
            </button>
            <button type="button" className="woc-btn ghost block" onClick={handleCancel} disabled={isSubmitting}>
              취소
            </button>
          </div>
        </aside>
      </form>
    </section>
  );
}
