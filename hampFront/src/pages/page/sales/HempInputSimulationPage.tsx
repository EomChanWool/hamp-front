import { useState } from 'react';
import type { FormEvent } from 'react';
import './HempInputSimulation.css';

/* ------------------------------------------------------------------ */
/* 수율 상수 (헴프 생산 품목 구조 기준) — 수율이 바뀌면 여기만 수정      */
/* ------------------------------------------------------------------ */
const YIELD = {
  SEMI: 0.65, // 원물 → 탈피씨드 (탈피·선별)
  HULL: 0.36, // 원물 → 껍질 (부산물, 폐기성)
  OIL: 0.275, // 탈피씨드 → 헴프오일 (착유)
  PARK: 0.725, // 탈피씨드 → 헴프박 (착유 부산물)
  DRY_ASSUMED: 1.0, // 헴프박 → 헴프박건조 (수율 불확실, 가정치)
  POWDER: 0.9, // 헴프박건조 → 헴프박분말 (분쇄)
} as const;

/* ------------------------------------------------------------------ */
/* 타입                                                                */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* 유틸                                                                */
/* ------------------------------------------------------------------ */
const round1 = (n: number): number => Math.round(n * 10) / 10;

const fmt = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return Number(n).toLocaleString('ko-KR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
};

/** 입력한 비율의 나머지(100 - 입력값) 라벨 */
const remainLabel = (value: string): string => {
  const n = parseFloat(value);
  return Number.isNaN(n) ? '-%' : `${fmt(round1(100 - n))}%`;
};

const isInvalidPercent = (n: number): boolean => Number.isNaN(n) || n < 0 || n > 100;

/* ------------------------------------------------------------------ */
/* 계산 (화면과 분리된 순수 함수)                                       */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* 작은 표시용 컴포넌트                                                 */
/* ------------------------------------------------------------------ */
const ArrowIcon = () => (
  <svg
    className="hsim-arrow"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* 페이지                                                              */
/* ------------------------------------------------------------------ */
const HempInputSimulationPage = () => {
  // 1단계 입력 (직접 타이핑)
  const [rawWeight, setRawWeight] = useState<string>('1000');
  const [oilPercent, setOilPercent] = useState<string>('60');
  const [formError, setFormError] = useState<string>('');
  const [result, setResult] = useState<MainResult | null>(null);

  // 헴프박 재투입 입력
  const [parkWeight, setParkWeight] = useState<string>('0');
  const [powderPercent, setPowderPercent] = useState<string>('50');
  const [parkError, setParkError] = useState<string>('');
  const [parkResult, setParkResult] = useState<ParkResult | null>(null);

  const handleCalculate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const raw = parseFloat(rawWeight);
    if (!raw || raw <= 0) {
      setFormError('원물 무게를 입력해 주세요.');
      setResult(null);
      return;
    }

    const oil = parseFloat(oilPercent);
    if (isInvalidPercent(oil)) {
      setFormError('헴프오일 배분 비율은 0~100 사이로 입력해 주세요.');
      setResult(null);
      return;
    }

    const next = calcMain(raw, oil);
    setFormError('');
    setResult(next);

    // 헴프박 재투입 영역 초기화 (최소 산출량을 기본 투입량으로)
    setParkWeight(String(next.parkMinQty));
    setParkResult(null);
    setParkError('');
  };

  const handleParkCalculate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const park = parseFloat(parkWeight);
    if (!park || park <= 0) {
      setParkError('헴프박 투입량을 입력해 주세요.');
      setParkResult(null);
      return;
    }

    const powder = parseFloat(powderPercent);
    if (isInvalidPercent(powder)) {
      setParkError('분말 배분 비율은 0~100 사이로 입력해 주세요.');
      setParkResult(null);
      return;
    }

    setParkError('');
    setParkResult(calcPark(park, powder));
  };

  return (
    <div className="hsim">
      <header className="hsim-header">
        <h1 className="hsim-title">원물 투입 시뮬레이션</h1>
        <p className="hsim-lead">
          원물(헴프 씨드) 무게를 입력하면 탈각 후 탈피씨드 생산 가능량을 먼저 보여주고, 그
          탈피씨드를 헴프오일과 헴프씨드(포장)에 각각 몇 %씩 투입할지 배분 비율을 받아
          계산합니다. 저장되지 않는 참고용 추정치입니다.
        </p>
      </header>

      <div className="hsim-layout">
        {/* ───────── 좌측: 투입 조건 ───────── */}
        <form className="hsim-panel" onSubmit={handleCalculate} noValidate>
          <div>
            <h2 className="hsim-panel-title">투입 조건</h2>
            <p className="hsim-panel-desc">원물 무게와 배분 비율을 입력해 주세요.</p>
          </div>

          <div className="hsim-field">
            <label className="hsim-label" htmlFor="hsimRawWeight">
              원물(헴프 씨드) 무게 <span className="hsim-required">*</span>
            </label>
            <div className="hsim-input-row">
              <input
                id="hsimRawWeight"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={rawWeight}
                onChange={(e) => setRawWeight(e.target.value)}
                aria-invalid={formError.includes('원물')}
              />
              <span className="hsim-unit">kg</span>
            </div>
          </div>

          <div className="hsim-divider" />

          <div className="hsim-field">
            <label className="hsim-label" htmlFor="hsimOilPercent">
              탈피씨드 중 헴프오일에 배분할 비율
            </label>
            <div className="hsim-input-row">
              <input
                id="hsimOilPercent"
                type="number"
                min="0"
                max="100"
                step="1"
                inputMode="decimal"
                value={oilPercent}
                onChange={(e) => setOilPercent(e.target.value)}
                aria-invalid={formError.includes('배분')}
              />
              <span className="hsim-unit">%</span>
            </div>
            <p className="hsim-hint">
              헴프씨드(포장) 배분: <strong>{remainLabel(oilPercent)}</strong> (자동 계산, 나머지)
            </p>
          </div>

          {formError && (
            <div className="hsim-error" role="alert">
              {formError}
            </div>
          )}

          <button type="submit" className="hsim-btn">
            계산하기
          </button>
          <p className="hsim-foot">입력값은 저장되지 않습니다.</p>
        </form>

        {/* ───────── 우측: 결과 ───────── */}
        <div className="hsim-results" aria-live="polite">
          {!result ? (
            <div className="hsim-empty">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <path d="M4 19h16M6 19V9l6-5 6 5v10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p>
                왼쪽에 원물 무게와 배분 비율을 입력하고 <strong>계산하기</strong>를 눌러보세요.
              </p>
            </div>
          ) : (
            <>
              {/* STEP 1 전처리 */}
              <section className="hsim-card">
                <div className="hsim-card-head">
                  <h3>
                    <span className="hsim-step">STEP 1</span>
                    전처리 단계 생산 가능량
                  </h3>
                  <span className="hsim-meta">탈각(탈피·선별) 결과</span>
                </div>

                <div className="hsim-flow">
                  <div>
                    <div className="hsim-stat-label">원물 투입량</div>
                    <div className="hsim-stat-value">
                      {fmt(result.raw)} <span className="hsim-u">kg</span>
                    </div>
                  </div>
                  <ArrowIcon />
                  <div>
                    <div className="hsim-stat-label">탈피씨드</div>
                    <div className="hsim-stat-value is-primary">
                      {fmt(result.semiSeedTotal)} <span className="hsim-u">kg</span>
                    </div>
                  </div>
                </div>

                <div className="hsim-card-foot">
                  <span className="hsim-stat-label">함께 발생하는 부산물</span>
                  <span className="hsim-chip">
                    껍질 <strong>{fmt(result.hull)}</strong> kg
                  </span>
                </div>
              </section>

              {/* STEP 2 배분 라인 */}
              <div className="hsim-alloc">
                <section className="hsim-card">
                  <div className="hsim-card-head">
                    <h3>
                      <span className="hsim-step">STEP 2</span>
                      헴프오일 라인
                    </h3>
                    <span className="hsim-meta">배분 {fmt(result.oilPercent)}%</span>
                  </div>

                  <div className="hsim-stat-label">탈피씨드 투입량</div>
                  <div className="hsim-input-qty">
                    {fmt(result.oilSemiSeed)} <span className="hsim-u">kg</span>
                  </div>

                  <div className="hsim-box is-oil">
                    <div className="hsim-box-label">최소 산출량 (수율 확정)</div>
                    <div className="hsim-box-value">
                      {fmt(result.oilMinQty)} <span className="hsim-u">kg</span>
                    </div>
                  </div>

                  <span className="hsim-badge">헴프박(부산물) 최소 {fmt(result.parkMinQty)}kg</span>
                  <p className="hsim-note is-green">
                    ⚠ 이건 <strong>최소</strong> 산출량입니다. 오른쪽 헴프씨드(포장) 라인에서 규격
                    미달로 탈락하는 분량이 추가로 이 라인에 투입되면, 실제 오일 산출량은 이보다{' '}
                    <strong>더 많아질 수 있습니다.</strong>
                  </p>
                </section>

                <section className="hsim-card is-uncertain">
                  <div className="hsim-card-head">
                    <h3>
                      <span className="hsim-step">STEP 2</span>⚠ 헴프씨드(포장) 라인
                    </h3>
                    <span className="hsim-meta">배분 {fmt(result.seedPercent)}%</span>
                  </div>

                  <div className="hsim-stat-label">탈피씨드 투입량 (상한)</div>
                  <div className="hsim-input-qty">
                    {fmt(result.seedSemiSeed)} <span className="hsim-u">kg</span>
                  </div>

                  <div className="hsim-box is-seed">
                    <div className="hsim-box-label">실제 산출량(합격분)</div>
                    <div className="hsim-box-value is-text">사전에 알 수 없음</div>
                  </div>

                  <p className="hsim-note is-amber">
                    수율은 원료 상태에 따라 달라져 참고용으로도 제시하지 않습니다. 투입한{' '}
                    {fmt(result.seedSemiSeed)}kg 중 규격 미달로 판정된 분량(불합격분)은 폐기되지
                    않고 <strong>왼쪽 헴프오일 라인의 원료로 전환 투입</strong>되어, 헴프오일 최소
                    산출량보다 더 많은 오일이 나올 수 있습니다.
                  </p>
                </section>
              </div>

              {/* STEP 3 헴프박 재투입 */}
              {result.parkMinQty > 0 && (
                <section className="hsim-card is-sub">
                  <div className="hsim-card-head is-block">
                    <h3>
                      <span className="hsim-step">STEP 3</span>
                      부산물(헴프박) 재투입 시뮬레이션
                    </h3>
                    <p className="hsim-sub-desc">
                      위 헴프오일 라인에서 나온 헴프박 최소 <strong>{fmt(result.parkMinQty)}kg</strong>
                      을 그대로 가져와 건조 후 분말/농축에 각각 몇 %씩 배분할지 입력해볼 수
                      있습니다. 필요하면 투입량을 직접 수정해도 됩니다.
                    </p>
                  </div>

                  <form className="hsim-park-form" onSubmit={handleParkCalculate} noValidate>
                    <div className="hsim-field">
                      <label className="hsim-label" htmlFor="hsimParkWeight">
                        헴프박 투입량
                      </label>
                      <div className="hsim-input-row">
                        <input
                          id="hsimParkWeight"
                          type="number"
                          min="0"
                          step="1"
                          inputMode="decimal"
                          value={parkWeight}
                          onChange={(e) => setParkWeight(e.target.value)}
                          aria-invalid={parkError.includes('투입량')}
                        />
                        <span className="hsim-unit">kg</span>
                      </div>
                    </div>

                    <div className="hsim-field">
                      <label className="hsim-label" htmlFor="hsimPowderPercent">
                        건조 후 분말에 배분할 비율
                      </label>
                      <div className="hsim-input-row">
                        <input
                          id="hsimPowderPercent"
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          inputMode="decimal"
                          value={powderPercent}
                          onChange={(e) => setPowderPercent(e.target.value)}
                          aria-invalid={parkError.includes('분말')}
                        />
                        <span className="hsim-unit">%</span>
                      </div>
                      <p className="hsim-hint">
                        농축 배분: <strong>{remainLabel(powderPercent)}</strong> (자동 계산, 나머지)
                      </p>
                    </div>

                    <button type="submit" className="hsim-btn is-sm">
                      계산하기
                    </button>
                  </form>

                  {parkError && (
                    <div className="hsim-error" role="alert">
                      {parkError}
                    </div>
                  )}

                  {parkResult && (
                    <div className="hsim-park-result">
                      <div className="hsim-flow is-compact">
                        <div>
                          <div className="hsim-stat-label">헴프박 투입</div>
                          <div className="hsim-stat-value is-sm">
                            {fmt(parkResult.park)} <span className="hsim-u">kg</span>
                          </div>
                        </div>
                        <ArrowIcon />
                        <div>
                          <div className="hsim-stat-label">헴프박건조 ⚠(수율 불확실, 가정치)</div>
                          <div className="hsim-stat-value is-sm is-primary">
                            {fmt(parkResult.dryQty)} <span className="hsim-u">kg</span>
                          </div>
                        </div>
                      </div>

                      <div className="hsim-park-lines">
                        <div className="hsim-line">
                          <div className="hsim-line-head">
                            <strong>헴프박분말 라인</strong>
                            <span>배분 {fmt(parkResult.powderPercent)}%</span>
                          </div>
                          <div className="hsim-stat-label">건조 투입량</div>
                          <div className="hsim-line-qty">{fmt(parkResult.powderDry)}kg</div>
                          <div className="hsim-box is-powder">
                            <div className="hsim-box-label">산출량(분쇄 90%)</div>
                            <div className="hsim-box-value is-md">{fmt(parkResult.powderQty)}kg</div>
                          </div>
                        </div>

                        <div className="hsim-line is-uncertain">
                          <div className="hsim-line-head">
                            <strong>⚠ 헴프박농축 라인</strong>
                            <span>배분 {fmt(parkResult.concPercent)}%</span>
                          </div>
                          <div className="hsim-stat-label">건조 투입량 (상한)</div>
                          <div className="hsim-line-qty">{fmt(parkResult.concDry)}kg</div>
                          <div className="hsim-box is-seed">
                            <div className="hsim-box-label">산출량</div>
                            <div className="hsim-box-value is-text">사전에 알 수 없음</div>
                          </div>
                        </div>
                      </div>

                      <p className="hsim-foot is-left">
                        건조·농축 공정 모두 수율이 확정돼 있지 않아 참고용 추정치입니다.
                      </p>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HempInputSimulationPage;