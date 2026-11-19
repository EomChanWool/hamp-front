import {
  useEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type SyntheticEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { WorkOrderApi } from "@/api/WorkOrder";
import { UserApi, type UserOptionResponse } from "@/api/User";
import {
  SalesOrderApi,
  type SalesOrderDetailResponse, type SalesOrderOptionResponse,
} from "@/api/sales/SalesOrder";
import { ItemApi, type ItemRoutingChainResponse, type ItemRoutingResponse } from "@/api/master/Item";
import "./Food.css";
import {
  BanknotesIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CubeIcon,
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

/** 소수점 부동소수점 오차 방지용 반올림 (그룹 합계 계산용) */
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** 수량 표시 (소수 1자리 고정) */
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/* ───────────── 타입 ───────────── */

/** 작업지시 라인 (수주 단건 조회의 산출 라인 + 사용자가 입력하는 지시수량) */
interface WorkOrderLine {
  salesOrderLineId: number;
  itemCode: string;
  itemNm: string;
  unit: string; // 산출 품목 단위 (예상 산출량 표시용)
  planQty: number | null; // 예정 산출수량 - 수율이 확정된 라인만 값이 있고, 미정이면 null
  allocationGroup: string; // 배분 그룹 키 (RAW / PARK ...)
  allocationPercent: number | null; // 그룹 내 배분 비율(%)
  allocatedInputQty: number; // 배분된 투입량 = 지시수량 (수주에서 확정, 화면에서 수정 불가)
  inputUnit: string; // 투입량 단위
}

/** 배분 그룹별 투입량 합계 (우측 요약용) */
interface GroupUsage {
  key: string;
  label: string;
  unit: string;
  total: number; // 그룹 내 지시수량(= 배분 투입량) 합계
  lineCount: number;
}

/** 품목별 생산 체인 조회 상태 */
interface ChainState {
  status: "loading" | "done" | "error";
  data?: ItemRoutingChainResponse;
}

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
                <span className="woc-stepper__yield">{step.yieldText}</span>
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
  const orderReqRef = useRef(0); // 수주 단건 조회/체인 조회 요청 식별자 - 수주를 바꾸면 이전 응답은 무시한다

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
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [lines, setLines] = useState<WorkOrderLine[]>([]);

  const [chains, setChains] = useState<Record<string, ChainState>>({}); // 품목코드별 생산 체인

  /** 배분 그룹별 투입량 합계 (우측 요약) - 그룹 순서는 라인 순서를 따른다 */
  const groupUsages = useMemo<GroupUsage[]>(() => {
    const map = new Map<string, GroupUsage>();
    lines.forEach((line) => {
      const cur = map.get(line.allocationGroup) ?? {
        key: line.allocationGroup,
        label: GROUP_LABEL[line.allocationGroup] ?? line.allocationGroup,
        unit: line.inputUnit,
        total: 0,
        lineCount: 0,
      };
      cur.total += line.allocatedInputQty;
      cur.lineCount += 1;
      map.set(line.allocationGroup, cur);
    });
    return Array.from(map.values()).map((g) => ({ ...g, total: round3(g.total) }));
  }, [lines]);

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

  // 수주 하나 = 작업지시 하나 - 수주를 고르면 단건 조회로 산출라인(배분 정보 포함)을 가져오고, 생산 체인도 함께 불러온다
  const handleOrderChange = async (orderCode: string) => {
    const reqId = ++orderReqRef.current;

    setForm((prev) => ({ ...prev, orderCode }));
    setOrderDetail(null);
    setLines([]);
    setChains({});
    setSubmitted(false);

    if (!orderCode) return;

    setIsOrderLoading(true);
    try {
      const res = await SalesOrderApi.getDetail(orderCode);
      if (reqId !== orderReqRef.current) return;

      const detail = res.data;
      setOrderDetail(detail);

      const rawUnit = detail.unit ?? "KG"; // RAW 그룹 투입량 단위 = 수주 투입원료 단위

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
            allocatedInputQty: line.allocatedInputQty,
            inputUnit: line.allocationGroup === "PARK" ? PARK_UNIT : rawUnit,
          },
        ];
      });

      setLines(nextLines);
      loadChains(
        nextLines.map((line) => line.itemCode),
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
    lines.length === 0; // 배분된 산출 라인이 하나도 없으면 저장할 수 없다

  const showError = (msg: string) => (submitted ? msg : "");

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (hasError) {
      setSubmitAttempt((n) => n + 1);
      return;
    }

    // instructQty = 투입량 기준 지시수량 (산출수량이 아님) - 수주에서 확정된 배분 투입량을 그대로 보낸다
    const payload = {
      workDate: form.workDate,
      managerId: form.managerId,
      lines: lines.map((line) => ({
        salesOrderLineId: line.salesOrderLineId,
        instructQty: line.allocatedInputQty,
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

  const isBusy = isSubmitting || isOrderLoading;

  return (
    <section ref={rootRef} className="woc">
      <header className="woc-header">
        <div>
          <h1 className="woc-header__title">작업지시 등록</h1>
          <p className="woc-header__desc">수주를 선택하면 산출 품목과 배분 비율이 자동으로 구성됩니다.</p>
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
                    <span className="woc-infocard__label">계약 원물 (탈각전) · {orderDetail.itemNm ?? "-"}</span>
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

            {lines.length === 0 ? (
              <p className="woc-empty">
                {orderDetail && !isOrderLoading
                  ? "이 수주에는 배분된 산출 라인이 없습니다. 수주의 배분 그룹/비율을 확인해주세요."
                  : "수주를 선택하면 산출 품목과 공정이 여기에 표시됩니다."}
              </p>
            ) : (
              <ul className="woc-lines">
                {lines.map((line) => {
                  const id = line.salesOrderLineId;
                  const groupTagCls = line.allocationGroup === "RAW" ? "raw" : line.allocationGroup === "PARK" ? "park" : "";

                  return (
                    <li key={id} className="woc-line">
                      <div className="woc-line__head">
                        <strong className="woc-line__name">{line.itemNm}</strong>
                        <span className="woc-line__code">{line.itemCode}</span>
                        {/* 배분 그룹/비율 (투입량 자체는 아래 지시수량 칸에 표시) */}
                        <span className={`woc-tag ${groupTagCls}`}>
                          {GROUP_LABEL[line.allocationGroup] ?? line.allocationGroup}
                          {line.allocationPercent != null ? ` ${line.allocationPercent}%` : ""}
                        </span>
                      </div>

                      <div className="woc-line__fields">
                        {/* 지시수량: 투입량 기준, 수주에서 확정된 값이라 읽기 전용 */}
                        <div className="woc-field">
                          <div className="woc-field__labelRow">
                            <span className="woc-field__label">지시수량 (투입량 기준)</span>
                          </div>
                          <div className="woc-readonly">
                            <span>
                              {fmt(line.allocatedInputQty)}
                              {line.inputUnit}
                            </span>
                            <span className="woc-readonly__tag">수주 확정</span>
                          </div>
                          <p className="woc-field__hint">수주에서 배분된 투입량이며 수정할 수 없음</p>
                        </div>

                        {/* 예상 산출량: 수주의 planQty 를 그대로 보여주는 참고값 (수율 미확정이면 모름) */}
                        <div className="woc-field">
                          <div className="woc-field__labelRow">
                            <span className="woc-field__label">예상 산출량</span>
                          </div>
                          {line.planQty != null ? (
                            <div className="woc-readonly">
                              <span>
                                {fmt(line.planQty)}
                                {line.unit}
                              </span>
                              <span className="woc-readonly__tag">참고용</span>
                            </div>
                          ) : (
                            <div className="woc-readonly is-unknown">
                              <span>모름</span>
                              <span className="woc-readonly__tag">수율 미등록</span>
                            </div>
                          )}
                          <p className="woc-field__hint">
                            {line.planQty != null
                              ? "수율 기준 예정 산출수량(참고용 추정치)"
                              : "수율이 등록되지 않아 계산 불가 - 생산 후 실적으로 확정"}
                          </p>
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

        {/* ───── 우측: 배분 그룹별 투입량 요약 + 저장 ───── */}
        <aside className="woc-side" aria-label="투입원료 사용량">
          <div className="woc-usage">
            <h2 className="woc-usage__title">투입원료 사용량</h2>

            {groupUsages.length === 0 ? (
              <p className="woc-usage__empty">수주를 선택하면 배분 그룹별 투입량이 표시됩니다.</p>
            ) : (
              <div>
                {groupUsages.map((group) => (
                  <div key={group.key} className="woc-usage__group">
                    <div className="woc-usage__groupHead">
                      <span>{group.label} 투입</span>
                      <span>라인 {group.lineCount}개</span>
                    </div>
                    <p className="woc-usage__figure">
                      <strong>{fmt(group.total)}</strong>
                      <span> {group.unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
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
