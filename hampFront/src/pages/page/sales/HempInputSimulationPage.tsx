import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  ArchiveBoxIcon,
  BeakerIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  Square3Stack3DIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import "@/pages/page/food/Food.css"; // woc- 공통 스타일 (작업지시 등록과 동일)
import "./HempInputSimulation.css"; // 이 페이지 전용 추가분 (wsim-)

/* ───────────── 수율 상수 (헴프 생산 품목 구조 기준) — 수율이 바뀌면 여기만 수정 ───────────── */
const YIELD = {
  SEMI: 0.65, // 원물 → 탈피씨드 (탈피·선별)
  HULL: 0.36, // 원물 → 껍질 (부산물, 폐기성)
  OIL: 0.275, // 탈피씨드 → 헴프오일 (착유)
  PARK: 0.725, // 탈피씨드 → 헴프박 (착유 부산물)
  DRY_ASSUMED: 1.0, // 헴프박 → 헴프박건조 (수율 불확실, 가정치)
  POWDER: 0.9, // 헴프박건조 → 헴프박분말 (분쇄)
} as const;

/* ───────────── 타입 ───────────── */
interface MainResult {
  raw: number;
  semiSeedTotal: number;
  hull: number;
  oilPercent: number;
  seedPercent: number;
  oilSemiSeed: number;
  seedSemiSeed: number;
  oilMinQty: number;
  parkMinQty: number;
}

interface ParkResult {
  park: number;
  dryQty: number;
  powderPercent: number;
  concPercent: number;
  powderDry: number;
  concDry: number;
  powderQty: number;
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

/** 퍼센트 표시 (불필요한 .0 제거) */
const fmtPct = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** 수율 상수 → 퍼센트 문자열 (0.275 → "27.5") */
const yieldPct = (rate: number) => fmtPct(round1(rate * 100));

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");

/** 입력한 비율의 나머지(100 - 입력값) 라벨 */
const remainLabel = (value: string) => {
  const n = parseFloat(value);
  return Number.isNaN(n) ? "-%" : `${fmtPct(round1(100 - n))}%`;
};

const isInvalidPercent = (n: number) => Number.isNaN(n) || n < 0 || n > 100;

/** 숫자 입력칸에서 음수/지수 표기 입력 차단 */
const blockSign = (e: KeyboardEvent<HTMLInputElement>) => {
  if (["-", "+", "e", "E"].includes(e.key)) e.preventDefault();
};

/* ───────────── 계산 (화면과 분리된 순수 함수) ───────────── */
const calcMain = (raw: number, oilPercent: number): MainResult => {
  const semiSeedTotal = round1(raw * YIELD.SEMI);
  const oilSemiSeed = round1(semiSeedTotal * (oilPercent / 100));

  return {
    raw,
    semiSeedTotal,
    hull: Math.ceil(raw * YIELD.HULL),
    oilPercent,
    seedPercent: round1(100 - oilPercent),
    oilSemiSeed,
    seedSemiSeed: round1(semiSeedTotal - oilSemiSeed),
    oilMinQty: round1(oilSemiSeed * YIELD.OIL),
    parkMinQty: Math.ceil(oilSemiSeed * YIELD.PARK),
  };
};

const calcPark = (park: number, powderPercent: number): ParkResult => {
  const dryQty = round1(park * YIELD.DRY_ASSUMED);
  const powderDry = round1(dryQty * (powderPercent / 100));

  return {
    park,
    dryQty,
    powderPercent,
    concPercent: round1(100 - powderPercent),
    powderDry,
    concDry: round1(dryQty - powderDry),
    powderQty: round1(powderDry * YIELD.POWDER),
  };
};

/* ───────────── 표시용 작은 컴포넌트 ───────────── */

/** 수주 정보 카드와 같은 모양의 요약 카드 */
interface InfoCardProps {
  icon: ReactNode;
  label: string;
  qty: number;
  /** is-raw / is-received is-ok 등 woc 카드 변형 클래스 */
  variant?: string;
  subtag?: string;
}

const InfoCard = ({ icon, label, qty, variant, subtag }: InfoCardProps) => {
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
          <Unit className={variant ? undefined : "wsim-unit"}>kg</Unit>
        </strong>
        {subtag && <span className="woc-infocard__subtag">{subtag}</span>}
      </div>
    </li>
  );
};

/** 그룹 상단 투입 현황 배너 */
interface BannerStat {
  label: string;
  qty: number;
  highlight?: boolean;
  /** true이면 앞에 → 표시 */
  arrow?: boolean;
}

const GroupBanner = ({ title, stats, park }: { title: string; stats: BannerStat[]; park?: boolean }) => (
  <li className={cx("woc-groupBanner", park && "is-park")}>
    <span className="woc-groupBanner__title">{title}</span>
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
              <em>kg</em>
            </strong>
          </div>
        </Fragment>
      ))}
    </div>
  </li>
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
  inTag: string;
  /** null이면 "미정" */
  outQty: number | null;
  outTag: string;
  /** 헴프오일 라인에서만: 함께 발생하는 헴프박 */
  parkBadge?: number;
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
          <span>{fmt(p.inQty)}kg</span>
          <span className="woc-readonly__tag">{p.inTag}</span>
        </div>
      </div>

      <div className="woc-field">
        <span className="woc-field__label">예상 산출량</span>
        <div className={cx("woc-readonly", p.outQty == null && "is-unknown")}>
          <span>{p.outQty != null ? `${fmt(p.outQty)}kg` : "미정"}</span>
          <span className="woc-readonly__tag">{p.outTag}</span>
        </div>
        {p.parkBadge != null && (
          <div>
            <span className="woc-tag park">
              부산물 헴프박 <strong>{fmt(p.parkBadge)}</strong>kg 발생
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

const DEFAULT_RAW = "1000";
const DEFAULT_OIL_PERCENT = "60";
const DEFAULT_POWDER_PERCENT = "50";

const HempInputSimulationPage = () => {
  const rootRef = useRef<HTMLElement>(null);

  // 1단계 입력 (시뮬레이션 돌리는 사람이 직접 입력)
  const [rawWeight, setRawWeight] = useState<string>(DEFAULT_RAW);
  const [oilPercent, setOilPercent] = useState<string>(DEFAULT_OIL_PERCENT);
  const [attempted, setAttempted] = useState(false);
  const [result, setResult] = useState<MainResult | null>(null);

  // 헴프박 재투입 입력
  const [parkWeight, setParkWeight] = useState<string>("0");
  const [powderPercent, setPowderPercent] = useState<string>(DEFAULT_POWDER_PERCENT);
  const [parkAttempted, setParkAttempted] = useState(false);
  const [parkResult, setParkResult] = useState<ParkResult | null>(null);

  // 검증 실패 시 첫 오류 입력칸으로 포커스 이동하기 위한 카운터
  const [focusTick, setFocusTick] = useState(0);

  useEffect(() => {
    if (focusTick === 0) return;
    rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusTick]);

  /* ───── 검증 (오류 문구는 계산 시도 후부터) ───── */
  const rawNum = parseFloat(rawWeight);
  const oilNum = parseFloat(oilPercent);
  const rawError = attempted && (!rawNum || rawNum <= 0) ? "원물 무게를 입력해주세요." : "";
  const oilError = attempted && isInvalidPercent(oilNum) ? "0~100 사이로 입력해주세요." : "";

  const parkNum = parseFloat(parkWeight);
  const powderNum = parseFloat(powderPercent);
  const parkError = parkAttempted && (!parkNum || parkNum <= 0) ? "헴프박 투입량을 입력해주세요." : "";
  const powderError = parkAttempted && isInvalidPercent(powderNum) ? "0~100 사이로 입력해주세요." : "";

  /* ───── 핸들러 ───── */
  const handleCalculate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAttempted(true);

    if (!rawNum || rawNum <= 0 || isInvalidPercent(oilNum)) {
      setResult(null);
      setFocusTick((n) => n + 1);
      return;
    }

    const next = calcMain(rawNum, oilNum);
    setResult(next);

    // 헴프박 재투입 영역 초기화 (최소 산출량을 기본 투입량으로)
    setParkWeight(String(next.parkMinQty));
    setParkResult(null);
    setParkAttempted(false);
  };

  const handleParkCalculate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setParkAttempted(true);

    if (!parkNum || parkNum <= 0 || isInvalidPercent(powderNum)) {
      setParkResult(null);
      setFocusTick((n) => n + 1);
      return;
    }

    setParkResult(calcPark(parkNum, powderNum));
  };

  const handleReset = () => {
    setRawWeight(DEFAULT_RAW);
    setOilPercent(DEFAULT_OIL_PERCENT);
    setAttempted(false);
    setResult(null);
    setParkWeight("0");
    setPowderPercent(DEFAULT_POWDER_PERCENT);
    setParkAttempted(false);
    setParkResult(null);
  };

  const hasPark = !!result && result.parkMinQty > 0;
  const parkDryAssumed = result ? round1(result.parkMinQty * YIELD.DRY_ASSUMED) : 0;

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
                  <div className="woc-unitInput">
                    <input
                      id="wsimRaw"
                      type="number"
                      step="0.1"
                      min="0"
                      inputMode="decimal"
                      className="woc-input"
                      value={rawWeight}
                      aria-invalid={!!rawError}
                      onKeyDown={blockSign}
                      onChange={(e) => setRawWeight(e.target.value)}
                    />
                    <span>kg</span>
                  </div>
                  {rawError ? (
                    <p className="woc-field__error">{rawError}</p>
                  ) : (
                    <p className="woc-field__hint">수주받은 원물(헴프 씨드)의 투입 무게</p>
                  )}
                </div>

                <div className="woc-field">
                  <label htmlFor="wsimOilPercent">탈피씨드 중 헴프오일 배분 비율</label>
                  <div className="woc-unitInput">
                    <input
                      id="wsimOilPercent"
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      inputMode="decimal"
                      className="woc-input"
                      value={oilPercent}
                      aria-invalid={!!oilError}
                      onKeyDown={blockSign}
                      onChange={(e) => setOilPercent(e.target.value)}
                    />
                    <span>%</span>
                  </div>
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
                />
                <InfoCard icon={<Square3Stack3DIcon />} label="탈피씨드" qty={result.semiSeedTotal} />
                <InfoCard icon={<TrashIcon />} label="껍질 (폐기성)" qty={result.hull} />
                <InfoCard
                  variant="is-received is-ok"
                  icon={<BeakerIcon />}
                  label="헴프오일 (최소)"
                  qty={result.oilMinQty}
                  subtag="수율 확정 기준"
                />
                <InfoCard icon={<ArchiveBoxIcon />} label="헴프박 (최소)" qty={result.parkMinQty} />
              </ul>
            )}
          </section>

          {/* ── 공정별 예상 산출 ── */}
          <section className="woc-panel" aria-labelledby="wsimFlowTitle">
            <div className="woc-panel__head">
              <h2 id="wsimFlowTitle" className="woc-panel__title">
                공정별 예상 산출
              </h2>
              <span className="woc-panel__count">참고용 추정치</span>
            </div>

            {!result ? (
              <p className="woc-empty">원물 무게와 배분 비율을 입력하고 계산하기를 눌러보세요.</p>
            ) : (
              <ul className="woc-lines">
                {/* STEP 1 전처리 */}
                <GroupBanner
                  title="STEP 1 전처리 (원물 → 탈피씨드)"
                  stats={[
                    { label: "원물 투입량", qty: result.raw },
                    { label: "탈각(탈피·선별) 후 탈피씨드", qty: result.semiSeedTotal, highlight: true, arrow: true },
                    { label: "껍질 (폐기성 부산물)", qty: result.hull },
                  ]}
                />

                {/* STEP 2 탈피씨드 배분 */}
                <GroupBanner
                  title="STEP 2 탈피씨드 배분 (헴프오일 / 헴프씨드 포장)"
                  stats={[
                    { label: "탈피씨드", qty: result.semiSeedTotal },
                    { label: `헴프오일 라인 ${fmtPct(result.oilPercent)}%`, qty: result.oilSemiSeed, highlight: true, arrow: true },
                    { label: `헴프씨드(포장) 라인 ${fmtPct(result.seedPercent)}%`, qty: result.seedSemiSeed },
                  ]}
                />

                <SimLine
                  name="헴프오일 라인"
                  tags={[
                    { text: `배분 ${fmtPct(result.oilPercent)}%`, cls: "raw" },
                    { text: "수율 확정", cls: "fixed" },
                  ]}
                  inLabel="탈피씨드 투입량"
                  inQty={result.oilSemiSeed}
                  inTag="투입 기준"
                  outQty={result.oilMinQty}
                  outTag="최소 산출량"
                  parkBadge={result.parkMinQty}
                  hint={`착유 수율 ${yieldPct(YIELD.OIL)}% 기준 최소 산출량 (참고용 추정치)`}
                  warn="최소 산출량입니다. 헴프씨드(포장) 라인에서 규격 미달로 탈락한 분량이 이 라인에 투입되면 실제 오일 산출량은 이보다 더 많아질 수 있습니다."
                  steps={[
                    { name: "탈피씨드", sub: `${fmt(result.oilSemiSeed)}kg` },
                    { name: "착유", sub: `${yieldPct(YIELD.OIL)}% / ${yieldPct(YIELD.PARK)}%` },
                    { name: "헴프오일", sub: `최소 ${fmt(result.oilMinQty)}kg`, kind: "output" },
                    { name: "헴프박", sub: `최소 ${fmt(result.parkMinQty)}kg`, kind: "byproduct" },
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
                  inTag="상한"
                  outQty={null}
                  outTag="수율 미확정"
                  hint="수율은 원료 상태에 따라 달라져 참고용으로도 제시하지 않습니다."
                  warn="규격 미달로 판정된 불합격분은 폐기되지 않고 헴프오일 라인의 원료로 전환 투입됩니다."
                  steps={[
                    { name: "탈피씨드", sub: `${fmt(result.seedSemiSeed)}kg` },
                    { name: "선별·포장" },
                    { name: "헴프씨드(포장)", sub: "미정", kind: "output", uncertain: true },
                  ]}
                />

                {/* STEP 3 헴프박 재투입 */}
                {hasPark && (
                  <>
                    <GroupBanner
                      park
                      title="STEP 3 부산물 재투입 (헴프박 → 헴프박건조)"
                      stats={[
                        { label: "예상 헴프박 수량(오일 부산물, 최소)", qty: result.parkMinQty },
                        { label: "건조 후 수량 (수율 100% 가정)", qty: parkDryAssumed, highlight: true, arrow: true },
                      ]}
                    />

                    <li className="wsim-parkBox">
                      <p className="woc-field__hint wsim-parkDesc">
                        헴프오일 라인의 헴프박 최소 {fmt(result.parkMinQty)}kg을 기본 투입량으로 가져왔습니다. 필요하면
                        직접 수정해도 됩니다.
                      </p>

                      <form id="wsimParkForm" onSubmit={handleParkCalculate} noValidate>
                        <div className="woc-grid3">
                          <div className="woc-field">
                            <label htmlFor="wsimParkWeight">헴프박 투입량</label>
                            <div className="woc-unitInput">
                              <input
                                id="wsimParkWeight"
                                type="number"
                                step="0.1"
                                min="0"
                                inputMode="decimal"
                                className="woc-input"
                                value={parkWeight}
                                aria-invalid={!!parkError}
                                onKeyDown={blockSign}
                                onChange={(e) => setParkWeight(e.target.value)}
                              />
                              <span>kg</span>
                            </div>
                            {parkError && <p className="woc-field__error">{parkError}</p>}
                          </div>

                          <div className="woc-field">
                            <label htmlFor="wsimPowderPercent">건조 후 분말 배분 비율</label>
                            <div className="woc-unitInput">
                              <input
                                id="wsimPowderPercent"
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                inputMode="decimal"
                                className="woc-input"
                                value={powderPercent}
                                aria-invalid={!!powderError}
                                onKeyDown={blockSign}
                                onChange={(e) => setPowderPercent(e.target.value)}
                              />
                              <span>%</span>
                            </div>
                            {powderError && <p className="woc-field__error">{powderError}</p>}
                          </div>

                          <div className="woc-field">
                            <span className="woc-field__label">헴프박농축 배분</span>
                            <div className="woc-readonly">
                              <span>{remainLabel(powderPercent)}</span>
                              <span className="woc-readonly__tag">자동 계산</span>
                            </div>
                          </div>
                        </div>

                        <div className="wsim-parkActions">
                          <button type="submit" className="woc-btn primary">
                            재투입 계산
                          </button>
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
                          inTag="가정치 기준"
                          outQty={parkResult.powderQty}
                          outTag="참고용"
                          hint="건조 수율을 100%로 가정한 값이라 실제와 다를 수 있습니다."
                          steps={[
                            { name: "헴프박건조", sub: `${fmt(parkResult.powderDry)}kg`, uncertain: true },
                            { name: "분쇄", sub: `${yieldPct(YIELD.POWDER)}%` },
                            { name: "헴프박분말", sub: `${fmt(parkResult.powderQty)}kg`, kind: "output" },
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
                          inTag="상한"
                          outQty={null}
                          outTag="수율 미확정"
                          hint="농축 공정은 수율이 확정돼 있지 않아 산출량을 사전에 알 수 없습니다."
                          steps={[
                            { name: "헴프박건조", sub: `${fmt(parkResult.concDry)}kg`, uncertain: true },
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
                  </>
                )}
              </ul>
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
                    <span> / {fmt(result.semiSeedTotal)} kg</span>
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
                        {fmt(result.oilSemiSeed)}kg ({fmtPct(result.oilPercent)}%)
                      </span>
                    </li>
                    <li>
                      <span>헴프씨드(포장) 라인</span>
                      <span>
                        {fmt(result.seedSemiSeed)}kg ({fmtPct(result.seedPercent)}%)
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
                      <span>{fmt(result.oilMinQty)}kg</span>
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
                            <span>{fmt(parkResult.powderQty)}kg</span>
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
                      <span>{fmt(result.hull)}kg</span>
                    </li>
                    {hasPark && (
                      <li>
                        <span>헴프박 (재투입, 최소)</span>
                        <span>{fmt(result.parkMinQty)}kg</span>
                      </li>
                    )}
                  </ul>
                </div>

                <p className="woc-usage__msg muted">
                  헴프오일은 불합격분이 재투입되면 최소값보다 늘어날 수 있고, 건조 수율은 가정치({yieldPct(YIELD.DRY_ASSUMED)}
                  %)입니다.
                </p>
              </>
            )}
          </div>

          <div className="woc-actions">
            <button type="submit" form="wsimMainForm" className="woc-btn primary block">
              계산하기
            </button>
            <button type="button" className="woc-btn ghost block" onClick={handleReset}>
              초기화
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default HempInputSimulationPage;