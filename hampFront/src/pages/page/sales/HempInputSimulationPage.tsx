import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArchiveBoxIcon,
  BeakerIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  Square3Stack3DIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import axios from "axios";
import {
  SalesOrderApi,
  type SalesOrderByproductSimulationResponse,
  type SalesOrderRawMaterialSimulationResponse,
} from "@/api/sales/SalesOrder";
import { NumberInput } from "@/components/common/NumberInput";
import { PARK_ITEM_CODE } from "@/utils/salesOrderAllocation";
import "@/pages/page/food/Food.css"; // woc- 공통 스타일 (작업지시 등록과 동일)
import "./HempInputSimulation.css"; // 이 페이지 전용 추가분 (wsim-)

/* ───────────── 표시용 수율 (산출량은 서버 시뮬레이션 API가 계산, 여기 값은 문구에만 사용) ───────────── */
const YIELD = {
  OIL: 0.275, // 탈피씨드 → 헴프오일 (착유)
  PARK: 0.725, // 탈피씨드 → 헴프박 (착유 부산물)
  DRY_ASSUMED: 0.95, // 헴프박 → 헴프박건조 (수율 불확실, 가정치)
  POWDER: 0.9, // 헴프박건조 → 헴프박분말 (분쇄)
} as const;

/** 시뮬레이션 응답에서 껍질(탈각 부산물) 품목 코드 */
const HULL_ITEM_CODE = "HEMP_HULL";

/* ───────────── 타입 ───────────── */
interface MainResult {
  raw: number;
  rawUnit: string;
  semiSeedTotal: number;
  semiUnit: string;
  hull: number;
  hullUnit: string;
  oilPercent: number;
  seedPercent: number;
  oilSemiSeed: number;
  seedSemiSeed: number;
  oilMinQty: number;
  oilUnit: string;
  parkMinQty: number;
  parkUnit: string;
  /** 헴프박 최소량을 건조했을 때 수량 (헴프박이 없으면 null) */
  parkDryQty: number | null;
  parkDryUnit: string;
}

interface ParkResult {
  park: number;
  dryQty: number;
  dryUnit: string;
  powderPercent: number;
  concPercent: number;
  powderDry: number;
  concDry: number;
  powderQty: number;
  powderUnit: string;
}

/** 공정 스테퍼 한 단계 */
interface StepDef {
  name: string;
  sub?: string;
  kind?: "output" | "byproduct";
  /** 수율 불확실 — 점선 + 앰버 */
  uncertain?: boolean;
}

/* ───────────── 유틸 ───────────── */

/** 소수 1자리 반올림 (부동소수점 오차 보정) */
const round1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;

/** 수량 표시 (소수 1자리 고정 — 작업지시 등록과 동일) */
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 서버 단위 표시 (KG → kg, L 등은 그대로) */
const unitLabel = (unit: string) => (unit.toUpperCase() === "KG" ? "kg" : unit);

/** 수량 + 단위 */
const fmtQty = (n: number, unit: string) => `${fmt(n)}${unitLabel(unit)}`;

/** 퍼센트 표시 (불필요한 .0 제거) */
const fmtPct = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** 수율 상수 → 퍼센트 문자열 (0.275 → "27.5") */
const yieldPct = (rate: number) => fmtPct(round1(rate * 100));

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");

/** 입력한 비율의 나머지(100 - 입력값) 라벨 */
const remainLabel = (value: number | null) => (value == null ? "-%" : `${fmtPct(round1(100 - value))}%`);

const isValidPercent = (n: number | null): n is number => n != null && n >= 0 && n <= 100;

const isValidWeight = (n: number | null): n is number => n != null && n > 0;

/* ───────────── 시뮬레이션 응답 → 화면 값 ───────────── */

/** 확정 수율 구간인데 수량이 비어 있으면 계산 실패로 본다 */
const requireQty = (qty: number | null, name: string) => {
  if (qty == null) throw new Error(`${name} 계산 결과가 없습니다.`);
  return qty;
};

const toMainResult = (
  raw: SalesOrderRawMaterialSimulationResponse,
  dryPark: SalesOrderByproductSimulationResponse | null,
): MainResult => {
  const { semiSeedCapacity: semi, oilCapacity: oil, seedCapacity: seed } = raw;
  const hull = semi.byproducts.find((b) => b.itemCode === HULL_ITEM_CODE);
  const park = oil.byproducts.find((b) => b.itemCode === PARK_ITEM_CODE);

  return {
    raw: raw.rawWeight,
    rawUnit: raw.rawUnit,
    semiSeedTotal: requireQty(semi.qty, "탈피씨드"),
    semiUnit: semi.unit ?? raw.rawUnit,
    hull: hull?.qty ?? 0,
    hullUnit: hull?.unit ?? raw.rawUnit,
    oilPercent: oil.percent,
    seedPercent: seed.percent,
    oilSemiSeed: requireQty(oil.semiSeedQty, "헴프오일 라인 투입량"),
    seedSemiSeed: requireQty(seed.semiSeedQty, "헴프씨드(포장) 라인 투입량"),
    oilMinQty: requireQty(oil.qty, "헴프오일"),
    oilUnit: oil.unit,
    parkMinQty: park?.qty ?? 0,
    parkUnit: park?.unit ?? raw.rawUnit,
    parkDryQty: dryPark ? requireQty(dryPark.dryParkCapacity.qty, "헴프박건조") : null,
    parkDryUnit: dryPark?.dryParkCapacity.unit ?? park?.unit ?? raw.rawUnit,
  };
};

const toParkResult = (res: SalesOrderByproductSimulationResponse): ParkResult => {
  const { dryParkCapacity: dry, powderCapacity: powder, concCapacity: conc } = res;
  return {
    park: res.parkWeight,
    dryQty: requireQty(dry.qty, "헴프박건조"),
    dryUnit: dry.unit ?? res.parkUnit,
    powderPercent: powder.percent,
    concPercent: conc.percent,
    powderDry: requireQty(powder.dryParkQty, "헴프박분말 라인 투입량"),
    concDry: requireQty(conc.dryParkQty, "헴프박농축 라인 투입량"),
    powderQty: requireQty(powder.qty, "헴프박분말"),
    powderUnit: powder.unit,
  };
};

/** 응답 본문이 비어 있으면 실패로 본다 */
const requireData = <T,>(res: { data?: T | null }): T => {
  if (res.data == null) throw new Error("시뮬레이션 결과를 받지 못했습니다.");
  return res.data;
};

/** 서버 오류 메시지 우선, 없으면 fallback */
const errorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) return error.response?.data?.message || fallback;
  return error instanceof Error && error.message ? error.message : fallback;
};

/* ───────────── 표시용 작은 컴포넌트 ───────────── */

/** 수주 정보 카드와 같은 모양의 요약 카드 */
interface InfoCardProps {
  icon: ReactNode;
  label: string;
  qty: number;
  unit: string;
  /** is-raw / is-received is-ok 등 woc 카드 변형 클래스 */
  variant?: string;
  subtag?: string;
}

const InfoCard = ({ icon, label, qty, unit, variant, subtag }: InfoCardProps) => {
  // 변형 카드(is-*)는 woc 스타일이 <em> 단위를 처리한다
  const Unit = variant ? "em" : "span";
  return (
    <li className={cx("woc-infocard", variant)}>
      <span className="woc-infocard__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="woc-infocard__text">
        <span className="woc-infocard__label">{label}</span>
        <strong className={cx("woc-infocard__value", !variant && "is-num")}>
          {fmt(qty)}
          <Unit className={variant ? undefined : "wsim-unit"}>{unitLabel(unit)}</Unit>
        </strong>
        {subtag && <span className="woc-infocard__subtag">{subtag}</span>}
      </div>
    </li>
  );
};

/** STEP 박스 헤더 (STEP 배지 + 제목 + 수치 칩) */
interface BannerStat {
  label: string;
  qty: number;
  unit: string;
  highlight?: boolean;
  /** true이면 앞에 → 표시 */
  arrow?: boolean;
}

interface GroupBannerProps {
  /** 제목 요소 id — STEP 박스의 aria-labelledby 와 연결 */
  id: string;
  step: string;
  title: string;
  stats: BannerStat[];
  park?: boolean;
}

const GroupBanner = ({ id, step, title, stats, park }: GroupBannerProps) => (
  <div className={cx("woc-groupBanner", park && "is-park")}>
    <div className="wsim-bannerHead">
      <span className="wsim-bannerStep">{step}</span>
      <h3 id={id} className="woc-groupBanner__title">
        {title}
      </h3>
    </div>
    <div className="woc-groupBanner__stats">
      {stats.map((s) => (
        <Fragment key={s.label}>
          {s.arrow && (
            <span className="woc-groupBanner__arrow" aria-hidden="true">
              →
            </span>
          )}
          <div className={cx("woc-groupBanner__stat", s.highlight && "is-highlight")}>
            <span className="woc-groupBanner__label">{s.label}</span>
            <strong className="woc-groupBanner__value">
              {fmt(s.qty)}
              <em>{unitLabel(s.unit)}</em>
            </strong>
          </div>
        </Fragment>
      ))}
    </div>
  </div>
);

/** 공정 스테퍼 (woc-stepper 재사용) */
const Stepper = ({ steps, note }: { steps: StepDef[]; note?: string }) => (
  <div className="woc-process">
    <ol className="woc-stepper">
      {steps.map((s) => (
        <li
          key={s.name}
          className={cx(
            "woc-stepper__step",
            s.kind === "output" && "output",
            s.kind === "byproduct" && "byproduct",
            s.uncertain && "is-uncertain",
          )}
        >
          <span className="woc-stepper__dot" aria-hidden="true" />
          <span className="woc-stepper__name">
            {s.name}
            {s.uncertain && <span className="wsim-sr"> (수율 불확실)</span>}
          </span>
          {s.sub && <span className="woc-stepper__yield">{s.sub}</span>}
        </li>
      ))}
    </ol>
    {note && <p className="woc-process__note">{note}</p>}
  </div>
);

/** 산출 라인 하나 (woc-line 재사용: 투입량 / 예상 산출량 / 공정 스테퍼) */
interface SimLineProps {
  name: string;
  tags: Array<{ text: string; cls: string }>;
  uncertain?: boolean;
  inLabel: string;
  inQty: number;
  inUnit: string;
  inTag: string;
  /** null이면 "미정" */
  outQty: number | null;
  outUnit?: string;
  outTag: string;
  /** 헴프오일 라인에서만: 함께 발생하는 헴프박 */
  parkBadge?: { qty: number; unit: string };
  hint: string;
  warn?: string;
  steps: StepDef[];
  stepNote?: string;
}

const SimLine = (p: SimLineProps) => (
  <li className={cx("woc-line", p.uncertain && "is-uncertain")}>
    <div className="woc-line__head">
      <strong className="woc-line__name">{p.name}</strong>
      {p.tags.map((t) => (
        <span key={t.text} className={`woc-tag ${t.cls}`}>
          {t.text}
        </span>
      ))}
    </div>

    <div className="woc-line__fields">
      <div className="woc-field">
        <span className="woc-field__label">{p.inLabel}</span>
        <div className="woc-readonly">
          <span>{fmtQty(p.inQty, p.inUnit)}</span>
          <span className="woc-readonly__tag">{p.inTag}</span>
        </div>
      </div>

      <div className="woc-field">
        <span className="woc-field__label">예상 산출량</span>
        <div className={cx("woc-readonly", p.outQty == null && "is-unknown")}>
          <span>{p.outQty != null ? fmtQty(p.outQty, p.outUnit ?? p.inUnit) : "미정"}</span>
          <span className="woc-readonly__tag">{p.outTag}</span>
        </div>
        {p.parkBadge != null && (
          <div>
            <span className="woc-tag park">
              부산물 헴프박 <strong>{fmt(p.parkBadge.qty)}</strong>
              {unitLabel(p.parkBadge.unit)} 발생
            </span>
          </div>
        )}
        <p className="woc-field__hint">{p.hint}</p>
      </div>
    </div>

    {p.warn && (
      <p className="woc-hint__warn">
        <ExclamationTriangleIcon aria-hidden="true" />
        <span>{p.warn}</span>
      </p>
    )}

    <Stepper steps={p.steps} note={p.stepNote} />
  </li>
);

/* ───────────── 페이지 ───────────── */

const DEFAULT_RAW = 1000;
const DEFAULT_OIL_PERCENT = 60;
const DEFAULT_POWDER_PERCENT = 50;

const HempInputSimulationPage = () => {
  const rootRef = useRef<HTMLElement>(null);

  // 1단계 입력 (시뮬레이션 돌리는 사람이 직접 입력)
  const [rawWeight, setRawWeight] = useState<number | null>(DEFAULT_RAW);
  const [oilPercent, setOilPercent] = useState<number | null>(DEFAULT_OIL_PERCENT);
  const [attempted, setAttempted] = useState(false);
  const [result, setResult] = useState<MainResult | null>(null);

  // 헴프박 재투입 입력
  const [parkWeight, setParkWeight] = useState<number | null>(0);
  const [powderPercent, setPowderPercent] = useState<number | null>(DEFAULT_POWDER_PERCENT);
  const [parkAttempted, setParkAttempted] = useState(false);
  const [parkResult, setParkResult] = useState<ParkResult | null>(null);

  // 시뮬레이션 API 요청 중 (중복 요청 방지)
  const [calculating, setCalculating] = useState<"main" | "park" | null>(null);
  const busy = calculating != null;

  // 검증 실패 시 해당 폼의 첫 오류 입력칸으로 포커스 이동 (매번 새 객체라 같은 폼도 다시 실행됨)
  const [focusRequest, setFocusRequest] = useState<{ formId: string } | null>(null);

  useEffect(() => {
    if (!focusRequest) return;
    rootRef.current
      ?.querySelector<HTMLElement>(`#${focusRequest.formId} [aria-invalid="true"]`)
      ?.focus();
  }, [focusRequest]);

  /* ───── 검증 (오류 문구는 계산 시도 후부터) ───── */
  const rawError = attempted && !isValidWeight(rawWeight) ? "원물 무게를 입력해주세요." : "";
  const oilError = attempted && !isValidPercent(oilPercent) ? "0~100 사이로 입력해주세요." : "";

  const parkError = parkAttempted && !isValidWeight(parkWeight) ? "헴프박 투입량을 입력해주세요." : "";
  const powderError = parkAttempted && !isValidPercent(powderPercent) ? "0~100 사이로 입력해주세요." : "";

  /* ───── 핸들러 ───── */
  const handleCalculate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setAttempted(true);

    if (!isValidWeight(rawWeight) || !isValidPercent(oilPercent)) {
      setResult(null);
      setFocusRequest({ formId: "wsimMainForm" });
      return;
    }

    setCalculating("main");
    try {
      const raw = requireData(await SalesOrderApi.simulateRawMaterial({ rawWeight, oilPercent }));

      // STEP 3 헤더의 건조 후 수량용 (건조량은 분말 비율과 무관해 기본 비율로 요청)
      const parkQty = raw.oilCapacity.byproducts.find((b) => b.itemCode === PARK_ITEM_CODE)?.qty ?? 0;
      const dryPark =
        parkQty > 0
          ? requireData(
              await SalesOrderApi.simulateByproduct({
                parkWeight: parkQty,
                powderPercent: DEFAULT_POWDER_PERCENT,
              }),
            )
          : null;

      const next = toMainResult(raw, dryPark);
      setResult(next);

      // 헴프박 재투입 영역 초기화 (최소 산출량을 기본 투입량으로)
      setParkWeight(next.parkMinQty);
      setParkResult(null);
      setParkAttempted(false);
    } catch (error) {
      setResult(null);
      alert(errorMessage(error, "원물 투입 시뮬레이션 계산 중 오류가 발생했습니다."));
    } finally {
      setCalculating(null);
    }
  };

  const handleParkCalculate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setParkAttempted(true);

    if (!isValidWeight(parkWeight) || !isValidPercent(powderPercent)) {
      setParkResult(null);
      setFocusRequest({ formId: "wsimParkForm" });
      return;
    }

    setCalculating("park");
    try {
      const res = requireData(await SalesOrderApi.simulateByproduct({ parkWeight, powderPercent }));
      setParkResult(toParkResult(res));
    } catch (error) {
      setParkResult(null);
      alert(errorMessage(error, "헴프박 재투입 계산 중 오류가 발생했습니다."));
    } finally {
      setCalculating(null);
    }
  };

  const handleReset = () => {
    setRawWeight(DEFAULT_RAW);
    setOilPercent(DEFAULT_OIL_PERCENT);
    setAttempted(false);
    setResult(null);
    setParkWeight(0);
    setPowderPercent(DEFAULT_POWDER_PERCENT);
    setParkAttempted(false);
    setParkResult(null);
  };

  const hasPark = !!result && result.parkMinQty > 0;

  /* ───── 렌더 ───── */
  return (
    <section ref={rootRef} className="woc wsim">
      <header className="woc-header">
        <div>
          <h1 className="woc-header__title">원물 투입 시뮬레이션</h1>
          <p className="woc-header__desc">
            원물(헴프 씨드) 무게를 입력하면 탈각 후 탈피씨드 생산 가능량을 먼저 보여주고, 그 탈피씨드를 헴프오일과
            헴프씨드(포장)에 몇 %씩 투입할지 정하면 예상 산출량과 부산물을 계산합니다. 저장되지 않는 참고용
            추정치입니다.
          </p>
        </div>
        <span className="woc-header__required">
          <em>*</em> 표시는 필수 입력 항목입니다
        </span>
      </header>

      <div className="woc-layout">
        {/* ───── 좌측: 입력 + 결과 ───── */}
        <div className="woc-main">
          {/* ── 투입 조건 ── */}
          <section className="woc-panel" aria-labelledby="wsimInputTitle">
            <h2 id="wsimInputTitle" className="woc-panel__title">
              투입 조건
            </h2>

            <form id="wsimMainForm" onSubmit={handleCalculate} noValidate>
              <div className="woc-grid3">
                <div className="woc-field">
                  <label htmlFor="wsimRaw">
                    원물(헴프 씨드) 무게 <em>*</em>
                  </label>
                  <NumberInput
                    id="wsimRaw"
                    className="woc-input"
                    wrapClassName="woc-unitInput"
                    suffix={<span>kg</span>}
                    decimalScale={1}
                    value={rawWeight}
                    aria-invalid={rawError ? true : undefined}
                    onValueChange={setRawWeight}
                  />
                  {rawError ? (
                    <p className="woc-field__error">{rawError}</p>
                  ) : (
                    <p className="woc-field__hint">수주받은 원물(헴프 씨드)의 투입 무게</p>
                  )}
                </div>

                <div className="woc-field">
                  <label htmlFor="wsimOilPercent">탈피씨드 중 헴프오일 배분 비율</label>
                  <NumberInput
                    id="wsimOilPercent"
                    className="woc-input"
                    wrapClassName="woc-unitInput"
                    suffix={<span>%</span>}
                    max={100}
                    thousandSeparator={false}
                    value={oilPercent}
                    aria-invalid={oilError ? true : undefined}
                    onValueChange={setOilPercent}
                  />
                  {oilError ? (
                    <p className="woc-field__error">{oilError}</p>
                  ) : (
                    <p className="woc-field__hint">탈피씨드 중 오일 라인으로 보낼 비율</p>
                  )}
                </div>

                <div className="woc-field">
                  <span className="woc-field__label">헴프씨드(포장) 배분</span>
                  <div className="woc-readonly">
                    <span>{remainLabel(oilPercent)}</span>
                    <span className="woc-readonly__tag">자동 계산</span>
                  </div>
                  <p className="woc-field__hint">100% − 헴프오일 배분 비율</p>
                </div>
              </div>
            </form>

            {result && (
              <ul className="woc-infocards">
                <InfoCard
                  variant="is-raw"
                  icon={<CubeIcon />}
                  label="원물(헴프 씨드) 투입"
                  qty={result.raw}
                  unit={result.rawUnit}
                />
                <InfoCard
                  icon={<Square3Stack3DIcon />}
                  label="탈피씨드"
                  qty={result.semiSeedTotal}
                  unit={result.semiUnit}
                />
                <InfoCard icon={<TrashIcon />} label="껍질 (폐기성)" qty={result.hull} unit={result.hullUnit} />
                <InfoCard
                  variant="is-received is-ok"
                  icon={<BeakerIcon />}
                  label="헴프오일 (최소)"
                  qty={result.oilMinQty}
                  unit={result.oilUnit}
                  subtag="수율 확정 기준"
                />
                <InfoCard
                  icon={<ArchiveBoxIcon />}
                  label="헴프박 (최소)"
                  qty={result.parkMinQty}
                  unit={result.parkUnit}
                />
              </ul>
            )}
          </section>

          {/* ── 공정별 예상 산출 (바깥 카드 테두리 없이 제목만, STEP 박스가 카드 역할) ── */}
          <section className="woc-panel wsim-flowPanel" aria-labelledby="wsimFlowTitle">
            <div className="woc-panel__head">
              <h2 id="wsimFlowTitle" className="woc-panel__title">
                공정별 예상 산출
              </h2>
              <span className="woc-panel__count">참고용 추정치</span>
            </div>

            {!result ? (
              <p className="woc-empty">원물 무게와 배분 비율을 입력하고 계산하기를 눌러보세요.</p>
            ) : (
              <div className="wsim-steps">
                {/* STEP 1 전처리 — 라인 없이 헤더만 */}
                <section className="wsim-step" aria-labelledby="wsimStep1Title">
                  <GroupBanner
                    id="wsimStep1Title"
                    step="STEP 1"
                    title="전처리 (원물 → 탈피씨드)"
                    stats={[
                      { label: "원물 투입량", qty: result.raw, unit: result.rawUnit },
                      {
                        label: "탈각(탈피·선별) 후 탈피씨드",
                        qty: result.semiSeedTotal,
                        unit: result.semiUnit,
                        highlight: true,
                        arrow: true,
                      },
                      { label: "껍질 (폐기성 부산물)", qty: result.hull, unit: result.hullUnit },
                    ]}
                  />
                </section>

                {/* STEP 2 탈피씨드 배분 */}
                <section className="wsim-step" aria-labelledby="wsimStep2Title">
                  <GroupBanner
                    id="wsimStep2Title"
                    step="STEP 2"
                    title="탈피씨드 배분 (헴프오일 / 헴프씨드 포장)"
                    stats={[
                      { label: "탈피씨드", qty: result.semiSeedTotal, unit: result.semiUnit },
                      {
                        label: `헴프오일 라인 ${fmtPct(result.oilPercent)}%`,
                        qty: result.oilSemiSeed,
                        unit: result.semiUnit,
                        highlight: true,
                        arrow: true,
                      },
                      {
                        label: `헴프씨드(포장) 라인 ${fmtPct(result.seedPercent)}%`,
                        qty: result.seedSemiSeed,
                        unit: result.semiUnit,
                      },
                    ]}
                  />

                  <ul className="woc-lines wsim-stepBody">
                    <SimLine
                      name="헴프오일 라인"
                      tags={[
                        { text: `배분 ${fmtPct(result.oilPercent)}%`, cls: "raw" },
                        { text: "수율 확정", cls: "fixed" },
                      ]}
                      inLabel="탈피씨드 투입량"
                      inQty={result.oilSemiSeed}
                      inUnit={result.semiUnit}
                      inTag="투입 기준"
                      outQty={result.oilMinQty}
                      outUnit={result.oilUnit}
                      outTag="최소 산출량"
                      parkBadge={{ qty: result.parkMinQty, unit: result.parkUnit }}
                      hint={`착유 수율 ${yieldPct(YIELD.OIL)}% 기준 최소 산출량 (참고용 추정치)`}
                      warn="최소 산출량입니다. 헴프씨드(포장) 라인에서 규격 미달로 탈락한 분량이 이 라인에 투입되면 실제 오일 산출량은 이보다 더 많아질 수 있습니다."
                      steps={[
                        { name: "탈피씨드", sub: fmtQty(result.oilSemiSeed, result.semiUnit) },
                        { name: "착유", sub: `${yieldPct(YIELD.OIL)}% / ${yieldPct(YIELD.PARK)}%` },
                        { name: "헴프오일", sub: `최소 ${fmtQty(result.oilMinQty, result.oilUnit)}`, kind: "output" },
                        {
                          name: "헴프박",
                          sub: `최소 ${fmtQty(result.parkMinQty, result.parkUnit)}`,
                          kind: "byproduct",
                        },
                      ]}
                      stepNote="착유 한 번에 헴프오일과 부산물 헴프박이 함께 나옵니다."
                    />

                    <SimLine
                      name="헴프씨드(포장) 라인"
                      uncertain
                      tags={[
                        { text: `배분 ${fmtPct(result.seedPercent)}%`, cls: "raw" },
                        { text: "수율 불확실", cls: "direct" },
                      ]}
                      inLabel="탈피씨드 투입량 (상한)"
                      inQty={result.seedSemiSeed}
                      inUnit={result.semiUnit}
                      inTag="상한"
                      outQty={null}
                      outTag="수율 미확정"
                      hint="수율은 원료 상태에 따라 달라져 참고용으로도 제시하지 않습니다."
                      warn="규격 미달로 판정된 불합격분은 폐기되지 않고 헴프오일 라인의 원료로 전환 투입됩니다."
                      steps={[
                        { name: "탈피씨드", sub: fmtQty(result.seedSemiSeed, result.semiUnit) },
                        { name: "선별·포장" },
                        { name: "헴프씨드(포장)", sub: "미정", kind: "output", uncertain: true },
                      ]}
                    />
                  </ul>
                </section>

                {/* STEP 3 헴프박 재투입 */}
                {hasPark && (
                  <section className="wsim-step" aria-labelledby="wsimStep3Title">
                    <GroupBanner
                      park
                      id="wsimStep3Title"
                      step="STEP 3"
                      title="부산물 재투입 (헴프박 → 헴프박건조)"
                      stats={[
                        { label: "예상 헴프박 수량(오일 부산물, 최소)", qty: result.parkMinQty, unit: result.parkUnit },
                        ...(result.parkDryQty != null
                          ? [
                              {
                                label: `건조 후 수량 (수율 ${yieldPct(YIELD.DRY_ASSUMED)}% 가정)`,
                                qty: result.parkDryQty,
                                unit: result.parkDryUnit,
                                highlight: true,
                                arrow: true,
                              },
                            ]
                          : []),
                      ]}
                    />

                    <ul className="woc-lines wsim-stepBody">
                      <li className="wsim-parkBox">
                        <p className="woc-field__hint wsim-parkDesc">
                          헴프오일 라인의 헴프박 최소 {fmtQty(result.parkMinQty, result.parkUnit)}을 기본 투입량으로
                          가져왔습니다.
                          필요하면 직접 수정해도 됩니다.
                        </p>

                        <form id="wsimParkForm" onSubmit={handleParkCalculate} noValidate>
                          <div className="woc-grid3">
                            <div className="woc-field">
                              <label htmlFor="wsimParkWeight">헴프박 투입량</label>
                              <NumberInput
                                id="wsimParkWeight"
                                className="woc-input"
                                wrapClassName="woc-unitInput"
                                suffix={<span>{unitLabel(result.parkUnit)}</span>}
                                decimalScale={1}
                                value={parkWeight}
                                aria-invalid={parkError ? true : undefined}
                                onValueChange={setParkWeight}
                              />
                              {parkError && <p className="woc-field__error">{parkError}</p>}
                            </div>

                            <div className="woc-field">
                              <label htmlFor="wsimPowderPercent">건조 후 분말 배분 비율</label>
                              <NumberInput
                                id="wsimPowderPercent"
                                className="woc-input"
                                wrapClassName="woc-unitInput"
                                suffix={<span>%</span>}
                                max={100}
                                thousandSeparator={false}
                                value={powderPercent}
                                aria-invalid={powderError ? true : undefined}
                                onValueChange={setPowderPercent}
                              />
                              {powderError && <p className="woc-field__error">{powderError}</p>}
                            </div>

                            <div className="woc-field">
                              <span className="woc-field__label">헴프박농축 배분</span>
                              <div className="woc-readonly">
                                <span>{remainLabel(powderPercent)}</span>
                                <span className="woc-readonly__tag">자동 계산</span>
                              </div>
                            </div>

                            <div className="woc-field wsim-parkActions">
                              <span className="woc-field__label wsim-parkActions__spacer" aria-hidden="true">
                                &nbsp;
                              </span>
                              <button type="submit" className="woc-btn primary" disabled={busy}>
                                {calculating === "park" ? "계산 중..." : "재투입 계산"}
                              </button>
                            </div>
                          </div>
                        </form>
                      </li>

                      {parkResult && (
                        <>
                          <SimLine
                            name="헴프박분말 라인"
                            tags={[
                              { text: `배분 ${fmtPct(parkResult.powderPercent)}%`, cls: "raw" },
                              { text: `분쇄 수율 ${yieldPct(YIELD.POWDER)}%`, cls: "fixed" },
                            ]}
                            inLabel="건조헴프박 투입량"
                            inQty={parkResult.powderDry}
                            inUnit={parkResult.dryUnit}
                            inTag="가정치 기준"
                            outQty={parkResult.powderQty}
                            outUnit={parkResult.powderUnit}
                            outTag="참고용"
                            hint={`건조 수율을 ${yieldPct(YIELD.DRY_ASSUMED)}%로 가정한 값이라 실제와 다를 수 있습니다.`}
                            steps={[
                              {
                                name: "헴프박건조",
                                sub: fmtQty(parkResult.powderDry, parkResult.dryUnit),
                                uncertain: true,
                              },
                              { name: "분쇄", sub: `${yieldPct(YIELD.POWDER)}%` },
                              {
                                name: "헴프박분말",
                                sub: fmtQty(parkResult.powderQty, parkResult.powderUnit),
                                kind: "output",
                              },
                            ]}
                          />

                          <SimLine
                            name="헴프박농축 라인"
                            uncertain
                            tags={[
                              { text: `배분 ${fmtPct(parkResult.concPercent)}%`, cls: "raw" },
                              { text: "수율 불확실", cls: "direct" },
                            ]}
                            inLabel="건조헴프박 투입량 (상한)"
                            inQty={parkResult.concDry}
                            inUnit={parkResult.dryUnit}
                            inTag="상한"
                            outQty={null}
                            outTag="수율 미확정"
                            hint="농축 공정은 수율이 확정돼 있지 않아 산출량을 사전에 알 수 없습니다."
                            steps={[
                              {
                                name: "헴프박건조",
                                sub: fmtQty(parkResult.concDry, parkResult.dryUnit),
                                uncertain: true,
                              },
                              { name: "농축" },
                              { name: "헴프박농축", sub: "미정", kind: "output", uncertain: true },
                            ]}
                          />

                          <li>
                            <p className="woc-chain__state">
                              건조·농축 공정 모두 수율이 확정돼 있지 않아 참고용 추정치입니다.
                            </p>
                          </li>
                        </>
                      )}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ───── 우측: 예상 산출 요약 + 실행 ───── */}
        <aside className="woc-side" aria-label="예상 산출 요약">
          <div className="woc-usage" aria-live="polite">
            <h2 className="woc-usage__title">예상 산출 요약</h2>

            {!result ? (
              <p className="woc-usage__empty">
                원물 무게와 배분 비율을 입력하고 계산하기를 누르면 완제품과 부산물 예상량이 여기에 정리됩니다.
              </p>
            ) : (
              <>
                {/* 탈피씨드 배분 */}
                <div className="woc-usage__group">
                  <div className="woc-usage__groupHead">
                    <span>탈피씨드 배분</span>
                    <span>라인 2개</span>
                  </div>
                  <p className="woc-usage__figure">
                    <strong>{fmt(result.oilSemiSeed)}</strong>
                    <span>
                      {" "}
                      / {fmt(result.semiSeedTotal)} {unitLabel(result.semiUnit)}
                    </span>
                  </p>
                  <div className="woc-meter">
                    <span style={{ width: `${Math.min(100, Math.max(0, result.oilPercent))}%` }} />
                  </div>
                  <p className="woc-usage__status">
                    헴프오일 {fmtPct(result.oilPercent)}% · 헴프씨드(포장) {fmtPct(result.seedPercent)}%
                  </p>
                  <ul className="woc-usage__list">
                    <li>
                      <span>헴프오일 라인</span>
                      <span>
                        {fmtQty(result.oilSemiSeed, result.semiUnit)} ({fmtPct(result.oilPercent)}%)
                      </span>
                    </li>
                    <li>
                      <span>헴프씨드(포장) 라인</span>
                      <span>
                        {fmtQty(result.seedSemiSeed, result.semiUnit)} ({fmtPct(result.seedPercent)}%)
                      </span>
                    </li>
                  </ul>
                </div>

                {/* 완제품 */}
                <div className="woc-usage__group">
                  <div className="woc-usage__groupHead">
                    <span>완제품 예상</span>
                    <span>참고용</span>
                  </div>
                  <ul className="woc-usage__list">
                    <li>
                      <span>헴프오일 (최소)</span>
                      <span>{fmtQty(result.oilMinQty, result.oilUnit)}</span>
                    </li>
                    <li>
                      <span>헴프씨드(포장)</span>
                      <span className="wsim-sumUnknown">알 수 없음</span>
                    </li>
                    {hasPark && (
                      <>
                        <li>
                          <span>헴프박분말</span>
                          {parkResult ? (
                            <span>{fmtQty(parkResult.powderQty, parkResult.powderUnit)}</span>
                          ) : (
                            <span className="wsim-sumPending">재투입 계산 전</span>
                          )}
                        </li>
                        <li>
                          <span>헴프박농축</span>
                          {parkResult ? (
                            <span className="wsim-sumUnknown">알 수 없음</span>
                          ) : (
                            <span className="wsim-sumPending">재투입 계산 전</span>
                          )}
                        </li>
                      </>
                    )}
                  </ul>
                </div>

                {/* 부산물 */}
                <div className="woc-usage__group">
                  <div className="woc-usage__groupHead">
                    <span>부산물</span>
                    <span>폐기 / 재투입</span>
                  </div>
                  <ul className="woc-usage__list">
                    <li>
                      <span>껍질 (폐기성)</span>
                      <span>{fmtQty(result.hull, result.hullUnit)}</span>
                    </li>
                    {hasPark && (
                      <li>
                        <span>헴프박 (재투입, 최소)</span>
                        <span>{fmtQty(result.parkMinQty, result.parkUnit)}</span>
                      </li>
                    )}
                  </ul>
                </div>

                <p className="woc-usage__msg muted">
                  헴프오일은 불합격분이 재투입되면 최소값보다 늘어날 수 있고, 건조 수율은 가정치(
                  {yieldPct(YIELD.DRY_ASSUMED)}
                  %)입니다.
                </p>
              </>
            )}
          </div>

          <div className="woc-actions">
            <button type="submit" form="wsimMainForm" className="woc-btn primary block" disabled={busy}>
              {calculating === "main" ? "계산 중..." : "계산하기"}
            </button>
            {/* 요청 중 초기화하면 늦게 온 응답이 초기화한 화면을 다시 채우므로 요청 중에는 막는다 */}
            <button type="button" className="woc-btn ghost block" onClick={handleReset} disabled={busy}>
              초기화
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default HempInputSimulationPage;