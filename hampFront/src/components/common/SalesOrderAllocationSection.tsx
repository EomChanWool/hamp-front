import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import axios from "axios";
import {
  SalesOrderApi,
  type SalesOrderByproductSimulationResponse,
  type SalesOrderRawMaterialSimulationResponse,
  type SalesOrderSimulationByproduct,
} from "@/api/sales/SalesOrder";
import {
  ALLOCATION_ITEM,
  PARK_ITEM_CODE,
  clampPercent,
  parsePercentInput,
  formatQty,
  type AllocationPercents,
} from "@/utils/salesOrderAllocation";
import "@/pages/page/seedSales/SeedSales.css";

const SIMULATION_DEBOUNCE_MS = 300;

/** 슬라이더 값을 바꾸는 키 - 이 키를 뗄 때 조작을 마친 것으로 본다 */
const SLIDER_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

/** 시뮬레이션 응답 전에 보여줄 품목명 (응답이 오면 서버 품목명으로 바뀜) */
const FALLBACK_NAME: Record<string, string> = {
  [ALLOCATION_ITEM.oil]: "헴프 오일",
  [ALLOCATION_ITEM.seed]: "헴프씨드(완제품)",
  [ALLOCATION_ITEM.powder]: "헴프 파우더",
  [ALLOCATION_ITEM.conc]: "헴프박 농축액",
};

/** 서버가 별다른 안내가 없을 때 내려주는 note - 카드에는 표시하지 않음 */
const NORMAL_NOTE = "정상 계산";

type SimulationResult<T> = {
  key: string;
  data: T | null;
  error: string | null;
};

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function errorMessage(error: unknown, fallback: string): string {
  const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
  return message || fallback;
}

/**
 * 디바운스된 key가 바뀔 때마다 시뮬레이션을 호출한다. key가 null이면 호출하지 않는다.
 * 결과는 key와 함께 보관해서, 현재 key와 다르면 "계산 중"으로 보고 data를 비운다
 * (바뀐 비율 옆에 이전 비율 기준 수량이 보이지 않게). 품목명 표시용으로 직전 결과는 lastData로 남긴다.
 */
function useSimulation<T>(
  key: string | null,
  run: (key: string) => Promise<{ data?: T | null }>,
  failMessage: string,
) {
  const debouncedKey = useDebouncedValue(key, SIMULATION_DEBOUNCE_MS);
  const [result, setResult] = useState<SimulationResult<T> | null>(null);

  useEffect(() => {
    if (debouncedKey == null) return;
    let cancelled = false;
    run(debouncedKey)
      .then((res) => {
        if (!cancelled) setResult({ key: debouncedKey, data: res.data ?? null, error: null });
      })
      .catch((error) => {
        if (!cancelled) setResult({ key: debouncedKey, data: null, error: errorMessage(error, failMessage) });
      });
    return () => {
      cancelled = true;
    };
    // run은 넘겨받은 key로만 요청을 만들므로 key 변경 시에만 다시 실행한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKey]);

  const lastData = result?.data ?? null;
  if (key == null) return { data: null, lastData, error: null, loading: false };
  const current = result?.key === key;
  return {
    data: current ? (result?.data ?? null) : null,
    lastData,
    error: current ? (result?.error ?? null) : null,
    loading: !current,
  };
}

type Props = {
  /** 원물 투입 무게 (수주 투입수량) */
  rawWeight: number | null;
  percents: AllocationPercents;
  onChange: (percents: AllocationPercents) => void;
  disabled?: boolean;
  /** form: 수주 등록 화면(formCard), detail: 수주 상세 화면(detailSection) */
  variant: "form" | "detail";
  /** 투입수량 없이 비율 조작을 마쳤을 때(슬라이더에서 손을 뗄 때 등) 호출 - 화면에서 투입수량 입력을 유도 */
  onNeedRawWeight?: () => void;
};

export function SalesOrderAllocationSection({
  rawWeight,
  percents,
  onChange,
  disabled,
  variant,
  onNeedRawWeight,
}: Props) {
  const { oilPercent, powderPercent } = percents;

  const validRawWeight = rawWeight != null && rawWeight > 0 ? rawWeight : null;
  const handleCommit = () => {
    if (validRawWeight == null) onNeedRawWeight?.();
  };
  const rawKey = validRawWeight != null ? `${validRawWeight}|${oilPercent}` : null;
  const raw = useSimulation<SalesOrderRawMaterialSimulationResponse>(
    rawKey,
    (key) => {
      const [w, p] = key.split("|").map(Number);
      return SalesOrderApi.simulateRawMaterial({ rawWeight: w, oilPercent: p });
    },
    "원물 배분 계산에 실패했습니다.",
  );

  const parkByproduct = raw.data?.oilCapacity.byproducts.find((b) => b.itemCode === PARK_ITEM_CODE) ?? null;
  const parkWeight = parkByproduct?.qty ?? null;
  const parkKey = parkWeight != null && parkWeight > 0 ? `${parkWeight}|${powderPercent}` : null;
  const park = useSimulation<SalesOrderByproductSimulationResponse>(
    parkKey,
    (key) => {
      const [w, p] = key.split("|").map(Number);
      return SalesOrderApi.simulateByproduct({ parkWeight: w, powderPercent: p });
    },
    "헴프박 배분 계산에 실패했습니다.",
  );

  const oil = raw.data?.oilCapacity ?? null;
  const seed = raw.data?.seedCapacity ?? null;
  const powder = park.data?.powderCapacity ?? null;
  const conc = park.data?.concCapacity ?? null;

  const rawStatus = validRawWeight == null
    ? "투입수량을 입력하면 배분 투입량과 예상 산출량이 계산됩니다."
    : raw.error ?? (raw.loading ? "계산 중..." : null);

  let parkStatus: string | null;
  if (validRawWeight == null) {
    parkStatus = "투입수량을 입력하면 헴프박 발생량이 계산됩니다.";
  } else if (raw.data && parkWeight != null && parkWeight <= 0) {
    parkStatus = "헴프오일 배분이 없어 재투입할 헴프박이 발생하지 않습니다. 비율은 그대로 저장됩니다.";
  } else if (!raw.data) {
    parkStatus = raw.loading ? "헴프박 발생량 계산을 기다리는 중..." : null;
  } else {
    parkStatus = park.error ?? (park.loading ? "계산 중..." : null);
  }

  const semiSeed = raw.data?.semiSeedCapacity ?? null;
  const dryPark = park.data?.dryParkCapacity ?? null;

  // 계산 중에도 라벨·카드 제목이 기본 이름으로 바뀌었다 돌아오지 않도록 직전 결과의 품목명을 쓴다
  const names = {
    oil: raw.lastData?.oilCapacity.itemNm,
    seed: raw.lastData?.seedCapacity.itemNm,
    semiSeed: raw.lastData?.semiSeedCapacity.itemNm,
    powder: park.lastData?.powderCapacity.itemNm,
    conc: park.lastData?.concCapacity.itemNm,
    dryPark: park.lastData?.dryParkCapacity.itemNm,
  };

  const rawGroup = (
    <AllocationGroup
      variant={variant}
      titleId={`so-alloc-raw-${variant}`}
      title="생산 배분 · 원물 (탈피씨드)"
      desc="탈피씨드 중 헴프오일에 배분할 비율을 입력합니다. 나머지는 헴프씨드(완제품)에 자동 배분됩니다."
    >
      <PercentControl
        id={`so-alloc-oil-${variant}`}
        label={`${names.oil ?? FALLBACK_NAME[ALLOCATION_ITEM.oil]} 배분 비율`}
        value={oilPercent}
        disabled={disabled}
        restLabel={names.seed ?? FALLBACK_NAME[ALLOCATION_ITEM.seed]}
        onChange={(v) => onChange({ ...percents, oilPercent: v })}
        onCommit={handleCommit}
      />
      {semiSeed && (
        <p className="soAllocBase">
          원물 {formatQty(raw.data?.rawWeight, raw.data?.rawUnit)} → {semiSeed.itemNm ?? "탈피씨드"}{" "}
          <strong>{formatQty(semiSeed.qty, semiSeed.unit)}</strong>
          {semiSeed.byproducts.length > 0 && <> (부산물 {formatByproducts(semiSeed.byproducts)})</>}
        </p>
      )}
      {rawStatus && <p className={raw.error ? "soAllocStatus isError" : "soAllocStatus"}>{rawStatus}</p>}
      <div className="soAllocCards">
        <AllocationCard
          itemCode={ALLOCATION_ITEM.oil}
          itemNm={names.oil}
          percent={oilPercent}
          inputLabel={`배분 투입량(${names.semiSeed ?? "탈피씨드"})`}
          inputQty={oil?.semiSeedQty}
          inputUnit={semiSeed?.unit}
          qty={oil?.qty}
          unit={oil?.unit}
          byproducts={oil?.byproducts}
          note={oil?.note}
          hasData={!!oil}
        />
        <AllocationCard
          itemCode={ALLOCATION_ITEM.seed}
          itemNm={names.seed}
          percent={100 - oilPercent}
          inputLabel={`배분 투입량(${names.semiSeed ?? "탈피씨드"})`}
          inputQty={seed?.semiSeedQty}
          inputUnit={semiSeed?.unit}
          qty={seed?.qty}
          unit={seed?.unit}
          byproducts={seed?.byproducts}
          note={seed?.note}
          hasData={!!seed}
        />
      </div>
    </AllocationGroup>
  );

  const parkGroup = (
    <AllocationGroup
      variant={variant}
      titleId={`so-alloc-park-${variant}`}
      title="생산 배분 · 부산물 재투입 (헴프박)"
      desc="헴프오일 공정에서 나오는 헴프박을 건조한 뒤 분말/농축으로 나누는 비율입니다. 나머지는 헴프박 농축액에 자동 배분됩니다."
    >
      <PercentControl
        id={`so-alloc-powder-${variant}`}
        label={`${names.powder ?? FALLBACK_NAME[ALLOCATION_ITEM.powder]} 배분 비율`}
        value={powderPercent}
        disabled={disabled}
        restLabel={names.conc ?? FALLBACK_NAME[ALLOCATION_ITEM.conc]}
        onChange={(v) => onChange({ ...percents, powderPercent: v })}
        onCommit={handleCommit}
      />
      {parkByproduct && parkWeight != null && parkWeight > 0 && (
        <p className="soAllocBase">
          {parkByproduct.itemNm ?? "헴프박"} 발생 추정 <strong>{formatQty(parkWeight, parkByproduct.unit)}</strong>
          {dryPark && (
            <>
              {" "}→ {dryPark.itemNm ?? "건조 헴프박"} <strong>{formatQty(dryPark.qty, dryPark.unit)}</strong>
            </>
          )}
        </p>
      )}
      {parkStatus && <p className={park.error ? "soAllocStatus isError" : "soAllocStatus"}>{parkStatus}</p>}
      <div className="soAllocCards">
        <AllocationCard
          itemCode={ALLOCATION_ITEM.powder}
          itemNm={names.powder}
          percent={powderPercent}
          inputLabel={`배분 투입량(${names.dryPark ?? "건조 헴프박"})`}
          inputQty={powder?.dryParkQty}
          inputUnit={dryPark?.unit}
          qty={powder?.qty}
          unit={powder?.unit}
          byproducts={powder?.byproducts}
          note={powder?.note}
          hasData={!!powder}
        />
        <AllocationCard
          itemCode={ALLOCATION_ITEM.conc}
          itemNm={names.conc}
          percent={100 - powderPercent}
          inputLabel={`배분 투입량(${names.dryPark ?? "건조 헴프박"})`}
          inputQty={conc?.dryParkQty}
          inputUnit={dryPark?.unit}
          qty={conc?.qty}
          unit={conc?.unit}
          byproducts={conc?.byproducts}
          note={conc?.note}
          hasData={!!conc}
        />
      </div>
    </AllocationGroup>
  );

  return (
    <>
      {rawGroup}
      {parkGroup}
    </>
  );
}

function formatByproducts(list: SalesOrderSimulationByproduct[]): string {
  return list.map((b) => `${b.itemNm ?? b.itemCode} ${formatQty(b.qty, b.unit)}`).join(", ");
}

function AllocationGroup({
  variant,
  titleId,
  title,
  desc,
  children,
}: {
  variant: Props["variant"];
  titleId: string;
  title: string;
  desc: string;
  children: ReactNode;
}) {
  if (variant === "detail") {
    return (
      <div className="detailSection detailSection--full soAllocGroup" aria-labelledby={titleId}>
        <h3 className="detailSectionTitle" id={titleId}>
          {title}
        </h3>
        <p className="soAllocDesc">{desc}</p>
        {children}
      </div>
    );
  }
  return (
    <section className="formCard soAllocGroup" aria-labelledby={titleId}>
      <div className="formCardHead">
        <div>
          <h2 className="formCardTitle" id={titleId}>
            {title} <span className="required" aria-hidden="true">*</span>
          </h2>
          <p className="formCardDesc">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function PercentControl({
  id,
  label,
  value,
  restLabel,
  disabled,
  onChange,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  restLabel: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** 조작을 마친 시점(슬라이더에서 손을 뗌, 방향키를 뗌, 직접 입력 후 포커스 이동)에 호출 */
  onCommit?: () => void;
}) {
  // 100을 넘는 입력은 반영하지 않고 안내만 띄운다 (55 입력 중 5를 더 눌러 100%로 바뀌는 실수 방지)
  const [rejected, setRejected] = useState(false);
  const hintId = `${id}-hint`;
  // 직접 입력칸에서 값을 바꾼 뒤 포커스를 벗어날 때만 onCommit을 부르기 위한 표시
  const textEditedRef = useRef(false);

  const handleTextChange = (raw: string) => {
    const next = parsePercentInput(raw);
    if (next == null) {
      setRejected(true);
      return;
    }
    setRejected(false);
    textEditedRef.current = true;
    onChange(next);
  };

  return (
    <div className="soAllocControl">
      <label className="soAllocLabel" htmlFor={id}>
        {label}
      </label>
      <div className="soAllocControlRow">
        <input
          id={id}
          type="range"
          className="soAllocRange"
          min={0}
          max={100}
          step={1}
          value={value}
          disabled={disabled}
          style={{ "--so-alloc-pct": value } as CSSProperties}
          onChange={(e) => {
            setRejected(false);
            onChange(clampPercent(e.target.value));
          }}
          onPointerUp={() => onCommit?.()}
          onKeyUp={(e) => {
            if (SLIDER_KEYS.has(e.key)) onCommit?.();
          }}
        />
        <div className="soAllocPercentInput">
          <input
            type="text"
            inputMode="numeric"
            aria-label={`${label}(%)`}
            aria-invalid={rejected || undefined}
            aria-describedby={rejected ? hintId : undefined}
            value={String(value)}
            disabled={disabled}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={() => {
              setRejected(false);
              if (textEditedRef.current) {
                textEditedRef.current = false;
                onCommit?.();
              }
            }}
          />
          <span aria-hidden="true">%</span>
        </div>
      </div>
      {rejected && (
        <span className="soAllocHint" id={hintId} role="alert">
          배분 비율은 0~100 사이로 입력해주세요.
        </span>
      )}
      <span className="soAllocRest">
        {restLabel} 배분 비율 <strong>{100 - value}%</strong> (자동 계산)
      </span>
    </div>
  );
}

function AllocationCard({
  itemCode,
  itemNm,
  percent,
  inputLabel,
  inputQty,
  inputUnit,
  qty,
  unit,
  byproducts,
  note,
  hasData,
}: {
  itemCode: string;
  itemNm?: string | null;
  percent: number;
  inputLabel: string;
  inputQty?: number | null;
  inputUnit?: string | null;
  qty?: number | null;
  unit?: string | null;
  byproducts?: SalesOrderSimulationByproduct[];
  note?: string | null;
  hasData: boolean;
}) {
  // 서버는 수율이 확정된 분기만 qty를 내려주고, 불확실한 분기는 null
  const confirmed = hasData && qty != null;
  const uncertain = hasData && qty == null;

  return (
    <div className={`soAllocCard${uncertain ? " isUncertain" : ""}`}>
      <div className="soAllocCardHead">
        <span className="soAllocCardTitle">
          {itemNm ?? FALLBACK_NAME[itemCode] ?? itemCode} <span className="soAllocCode">{itemCode}</span>
        </span>
        {confirmed && <span className="soAllocBadge">수율 확정</span>}
        {uncertain && <span className="soAllocBadge isWarn">수율 불확실</span>}
      </div>
      <dl className="soAllocFigures">
        <div>
          <dt>배분 비율</dt>
          <dd>{percent}%</dd>
        </div>
        <div>
          <dt>{uncertain ? `${inputLabel}, 상한` : inputLabel}</dt>
          <dd>{hasData ? formatQty(inputQty, inputUnit) : "-"}</dd>
        </div>
        <div>
          <dt>{confirmed ? "최소 산출량" : "산출량"}</dt>
          <dd>{!hasData ? "-" : confirmed ? <strong>{formatQty(qty, unit)}</strong> : <strong>미정</strong>}</dd>
        </div>
        {byproducts && byproducts.length > 0 && (
          <div>
            <dt>부산물 발생 추정</dt>
            <dd>{formatByproducts(byproducts)}</dd>
          </div>
        )}
      </dl>
      {hasData && note && note !== NORMAL_NOTE && <p className="soAllocNote">{note}</p>}
    </div>
  );
}
