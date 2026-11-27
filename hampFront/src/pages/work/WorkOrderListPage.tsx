import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { WorkOrderApi } from '@/api/WorkOrder';
import type {
  WorkOrderDetailResponse,
  WorkOrderLineResponse,
  WorkOrderPerformanceDefectRequest,
  WorkOrderPerformanceMaterialQtyRequest,
  WorkOrderPerformanceReadyResponse,
  WorkOrderProductionLineResponse,
  WorkOrderResponse,
  WorkOrderRoutingStepResponse,
  ZoneType,
} from '@/api/WorkOrder';
import type { ItemOptionResponse } from '@/api/master/Item';
import { DefectApi, type DefectOptionResponse } from '@/api/master/Defect';
import { isValidWorkZone } from '@/utils/common';
import '@/pages/work/WorkTabletHome.css';
import '@/pages/work/WorkSeedReportScanPage.css';
import '@/pages/work/WorkOrderScanPage.css';
import '@/pages/work/WorkOrderListPage.css';

/* ================================================================
   타입 / 상수 / 헬퍼
================================================================ */

type FinishInputType = 'OUTPUT' | 'DEFECT';
type LineStatus = 'WAIT' | 'PROGRESS' | 'DONE';
type EntryMode = 'START' | 'FINISH';
type ViewMode = 'list' | 'detail' | 'entry';

/** 화면 표시용 자재 내역 (전송용 payload 와 달리 이름/단위까지 들고 있음) */
interface MaterialSummary {
  itemCode: string;
  itemNm: string;
  unit: string;
  qty: number;
}

/** 라인에서 [투입 입력]/[실적 입력]을 눌러 들어간 공정 */
interface EntryTarget {
  workOrderLineId: number;
  operCode: string;
  mode: EntryMode;
  /** 생산라인 현황 카드에서 들어온 경우 그 카드의 seq (입력 화면 배지/투입량 표시용) */
  productionSeq?: number;
}

const PAGE_SIZE = 10;

const STATUS_LABEL: Record<string, string> = {
  WAIT: '대기',
  PROGRESS: '진행중',
  DONE: '완료',
  DELAY: '지연',
};

const ENTRY_LABEL: Record<EntryMode, string> = {
  START: '공정 시작',
  FINISH: '공정 종료',
};

const KEYPAD_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back'];

const getErrorMessage = (err: unknown, fallback: string) =>
  (axios.isAxiosError(err) ? err.response?.data?.message : undefined) || fallback;

/** 키패드 입력을 문자열에 반영 (소수점 1개, 최대 10자리) */
const applyKeypad = (prev: string, key: string) => {
  if (key === 'back') return prev.slice(0, -1);
  if (key === '.' && prev.includes('.')) return prev;
  if (prev.length >= 10) return prev;
  return prev + key;
};

/** 공정별 materials 를 투입(IN) / 산출(OUT) 로 나눠 화면 표시용으로 변환 (자재마다 단위가 달라서 합계 대신 자재별로 보여준다) */
const splitStepMaterials = (
  step: WorkOrderRoutingStepResponse,
): { ins: MaterialSummary[]; outs: MaterialSummary[] } => {
  const toSummary = (ioType: 'IN' | 'OUT'): MaterialSummary[] =>
    (step.materials ?? [])
      .filter((m) => m.ioType === ioType)
      .map(({ itemCode, itemNm, unit, qty }) => ({ itemCode, itemNm, unit, qty }));

  return { ins: toSummary('IN'), outs: toSummary('OUT') };
};

/** 라인의 공정 진행 상태 (모든 공정 완료 → 완료, 하나라도 시작/완료 → 진행중) */
const getLineStatus = (steps: WorkOrderRoutingStepResponse[]): LineStatus => {
  if (steps.length === 0) return 'WAIT';
  if (steps.every((s) => s.done)) return 'DONE';
  if (steps.some((s) => s.done || s.inProgress)) return 'PROGRESS';
  return 'WAIT';
};

/** 라인에서 지금 입력할 수 있는 공정 (진행 중 공정 → 종료, 없으면 첫 미완료 공정 → 시작) */
const getActionableStep = (
  steps: WorkOrderRoutingStepResponse[],
): { step: WorkOrderRoutingStepResponse; mode: EntryMode } | null => {
  const inProgress = steps.find((s) => !s.done && s.inProgress);
  if (inProgress) return { step: inProgress, mode: 'FINISH' };
  const next = steps.find((s) => !s.done);
  if (next) return { step: next, mode: 'START' };
  return null;
};

const equipmentLabel = (step?: WorkOrderRoutingStepResponse) =>
  step && step.equipments.length > 0 ? step.equipments.map((eq) => eq.eqNm).join(', ') : null;

/** 자재 요약을 한 줄로 ("자재A 10kg · 자재B 3ea") */
const formatMaterials = (list: MaterialSummary[]) =>
  list.map((m) => `${m.itemNm} ${m.qty.toLocaleString()}${m.unit}`).join(' · ');

/** 라인 카드 상태 배지 종류 */
type LineCardVariant = 'START' | 'FINISH' | 'PACK' | 'DONE' | 'LOCKED' | 'NONE';

/** 라인 카드 테두리/번호 색상 종류 */
type LineCardTone = LineStatus | 'LOCKED' | 'PACK';

/* ── 생산라인 현황(production-lines) 표시용 ── */

/** 생산라인 상태별 배지 문구 / 색상 */
const PRODUCTION_STATUS_META: Record<string, { label: string; variant: LineCardVariant; tone: LineCardTone }> = {
  LOCKED: { label: '잠김', variant: 'LOCKED', tone: 'LOCKED' },
  READY: { label: '대기 · 투입입력', variant: 'START', tone: 'WAIT' },
  PRODUCING: { label: '진행중 · 실적입력', variant: 'FINISH', tone: 'PROGRESS' },
  AWAITING_PACK: { label: '포장대기 · 포장입력', variant: 'PACK', tone: 'PACK' },
  DONE: { label: '완료', variant: 'DONE', tone: 'DONE' },
};

/** 상단 요약 칩 순서 */
const PRODUCTION_SUMMARY_ORDER: { status: string; label: string }[] = [
  { status: 'DONE', label: '완료' },
  { status: 'AWAITING_PACK', label: '포장대기' },
  { status: 'PRODUCING', label: '진행중' },
  { status: 'READY', label: '대기' },
  { status: 'LOCKED', label: '잠김' },
];

const getProductionMeta = (status: string) =>
  PRODUCTION_STATUS_META[status] ?? { label: status || '-', variant: 'NONE' as const, tone: 'WAIT' as const };

/**
 * 생산라인 현황 한 건 → 실제 입력을 보낼 작업지시 라인 찾기
 * (현황 응답에 workOrderLineId 가 없어서 품목코드 기준으로 맞춘다)
 * 1) 라인 품목코드가 같은 라인
 * 2) 공정에 기록된 자재 중 같은 품목코드가 있는 라인 (전처리처럼 투입 품목코드가 오는 경우)
 * 3) 대표 공정명이 같은 미완료 공정을 가진 라인
 */
const findWorkOrderLine = (
  pl: WorkOrderProductionLineResponse,
  lines: WorkOrderLineResponse[],
): WorkOrderLineResponse | undefined =>
  lines.find((l) => l.itemCode === pl.itemCode) ??
  lines.find((l) => l.routingSteps.some((s) => (s.materials ?? []).some((m) => m.itemCode === pl.itemCode))) ??
  lines.find((l) => l.routingSteps.some((s) => s.operNm === pl.operNm && !s.done));

/** 생산라인 산출 자재 (OUT 우선, ioType 이 비어 있으면 전체) */
const productionOutputs = (pl: WorkOrderProductionLineResponse): MaterialSummary[] => {
  const list = pl.outputs ?? [];
  const outs = list.filter((m) => m.ioType === 'OUT');
  return (outs.length > 0 ? outs : list).map(({ itemCode, itemNm, unit, qty }) => ({ itemCode, itemNm, unit, qty }));
};

/** 자재별 입력 수량 → 전송 payload / 화면 요약. 값이 잘못되면 null */
const buildMaterialPayload = (
  materials: ItemOptionResponse[],
  qtys: Record<string, string>,
  { requireAll }: { requireAll: boolean },
): { payload: WorkOrderPerformanceMaterialQtyRequest[]; summary: MaterialSummary[] } | null => {
  const rows = materials.map((m) => ({
    itemCode: m.itemCode,
    itemNm: m.itemNm,
    unit: m.unit,
    qty: Number(qtys[m.itemCode] || 0),
  }));

  if (rows.some((row) => Number.isNaN(row.qty) || row.qty < 0)) return null;
  if (requireAll && rows.some((row) => row.qty <= 0)) return null;

  const filled = rows.filter((row) => row.qty > 0);
  return {
    payload: filled.map(({ itemCode, qty }) => ({ itemCode, qty })),
    summary: filled,
  };
};

/** 자재 내역 → 입력 폼용 자재 옵션 (같은 자재는 한 번만) */
const toMaterialOptions = (list: MaterialSummary[]): ItemOptionResponse[] => {
  const seen = new Set<string>();
  return list
    .filter((m) => (seen.has(m.itemCode) ? false : (seen.add(m.itemCode), true)))
    .map(({ itemCode, itemNm, unit }) => ({ itemCode, itemNm, unit }) as ItemOptionResponse);
};

/**
 * 공정 시작/종료 입력 정보를 화면에 있는 상세 데이터로 만든다
 * (getPerformanceReady 백엔드가 아직 없어서 대신 사용, 기록은 startPerformance / finishPerformance 로 바로 전송)
 * - 시작: 이 공정에 기록된 투입자재 → 없으면 바로 앞 공정의 산출자재 → 없으면 라인 품목
 * - 종료: 이 공정에 기록된 산출자재 → 없으면 라인 품목
 */
const buildPerformanceReady = (
  line: WorkOrderLineResponse,
  step: WorkOrderRoutingStepResponse,
  mode: EntryMode,
): WorkOrderPerformanceReadyResponse => {
  const lineItem: MaterialSummary = {
    itemCode: line.itemCode,
    itemNm: line.itemNm,
    unit: line.unit,
    qty: 0,
  };
  const { ins, outs } = splitStepMaterials(step);

  let materials: MaterialSummary[];
  if (mode === 'START') {
    const prevStep = [...line.routingSteps]
      .filter((s) => s.operSeq < step.operSeq)
      .sort((a, b) => b.operSeq - a.operSeq)[0];
    const prevOuts = prevStep ? splitStepMaterials(prevStep).outs : [];
    materials = ins.length > 0 ? ins : prevOuts.length > 0 ? prevOuts : [lineItem];
  } else {
    materials = outs.length > 0 ? outs : [lineItem];
  }

  return {
    action: mode === 'FINISH' ? 'FINISH_READY' : 'START_READY',
    workOrderLineId: line.workOrderLineId,
    operCode: step.operCode,
    operNm: step.operNm,
    operSeq: step.operSeq,
    perfId: null,
    requiredMaterials: toMaterialOptions(materials),
  };
};

/* ================================================================
   공통 입력 컴포넌트
================================================================ */

function NumericKeypad({ onPress }: { onPress: (key: string) => void }) {
  return (
    <div className="workScanKeypad">
      {KEYPAD_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className="workScanKeypadBtn"
          onClick={() => onPress(key)}
        >
          {key === 'back' ? '⌫' : key}
        </button>
      ))}
    </div>
  );
}

function MaterialQtyInput({
  materials,
  values,
  activeCode,
  onSelect,
  onKeyPress,
}: {
  materials: ItemOptionResponse[];
  values: Record<string, string>;
  activeCode: string;
  onSelect: (itemCode: string) => void;
  onKeyPress: (key: string) => void;
}) {
  if (materials.length === 0) {
    return <div className="workOrderMaterialEmpty">등록된 자재가 없습니다.</div>;
  }

  return (
    <>
      <div className="workOrderMaterialList">
        {materials.map((m) => (
          <button
            key={m.itemCode}
            type="button"
            className={`workOrderMaterialRow ${activeCode === m.itemCode ? 'active' : ''}`}
            onClick={() => onSelect(m.itemCode)}
          >
            <span className="workOrderMaterialName">{m.itemNm}</span>
            <strong className="workOrderMaterialQty">
              {values[m.itemCode] || '0'} <span>{m.unit}</span>
            </strong>
          </button>
        ))}
      </div>
      <NumericKeypad onPress={onKeyPress} />
    </>
  );
}

/* ================================================================
   공정 시작 폼 (투입자재 수량 입력)
================================================================ */

function PerformanceStartForm({
  ready,
  zone,
  onCancel,
  onDone,
  onDirtyChange,
}: {
  ready: WorkOrderPerformanceReadyResponse;
  zone: string;
  onCancel: () => void;
  onDone: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const materials = ready.requiredMaterials ?? [];

  const [materialQtys, setMaterialQtys] = useState<Record<string, string>>({});
  const [activeItemCode, setActiveItemCode] = useState(materials[0]?.itemCode ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 입력 중이면 뒤로가기 시 확인하도록 부모에게 알린다
  const isDirty = isSubmitting || Object.values(materialQtys).some((v) => v !== '');
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (!activeItemCode) return;
      setMaterialQtys((prev) => ({
        ...prev,
        [activeItemCode]: applyKeypad(prev[activeItemCode] ?? '', key),
      }));
    },
    [activeItemCode],
  );

  const handleConfirm = async () => {
    const built = buildMaterialPayload(materials, materialQtys, { requireAll: true });

    if (!built) {
      setError('모든 투입자재의 수량을 올바르게 입력해 주세요.');
      return;
    }

    const summaryText = built.summary
      .map((m) => `${m.itemNm} ${m.qty.toLocaleString()}${m.unit}`)
      .join('\n');

    if (!window.confirm(`${ready.operNm} 공정을 아래 투입자재로 시작하시겠습니까?\n\n${summaryText}`)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await WorkOrderApi.startPerformance({
        zone: Number(zone) as ZoneType,
        workOrderLineId: ready.workOrderLineId,
        operCode: ready.operCode,
        materials: built.payload,
      });
      onDone(`${ready.operNm} 공정이 시작되었습니다.`);
    } catch (err) {
      setError(getErrorMessage(err, '공정 시작 등록에 실패했습니다.'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="workOrderPerformanceForm">
      <div className="workOrderPerformanceLabel">투입자재 수량 입력</div>

      <MaterialQtyInput
        materials={materials}
        values={materialQtys}
        activeCode={activeItemCode}
        onSelect={setActiveItemCode}
        onKeyPress={handleKeyPress}
      />

      {error && <div className="workScanErrorMsg">{error}</div>}

      <div className="workScanActionRow">
        <button type="button" className="workScanCancelBtn" onClick={onCancel} disabled={isSubmitting}>
          취소
        </button>
        <button type="button" className="workScanSubmitBtn" onClick={handleConfirm} disabled={isSubmitting}>
          {isSubmitting ? '등록 중...' : '공정 시작'}
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   공정 종료 폼 (산출자재 / 불량 입력)
================================================================ */

function PerformanceFinishForm({
  ready,
  zone,
  fallbackUnit,
  onCancel,
  onDone,
  onDirtyChange,
}: {
  ready: WorkOrderPerformanceReadyResponse;
  zone: string;
  fallbackUnit: string;
  onCancel: () => void;
  onDone: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const materials = ready.requiredMaterials ?? [];

  const [materialQtys, setMaterialQtys] = useState<Record<string, string>>({});
  const [activeItemCode, setActiveItemCode] = useState(materials[0]?.itemCode ?? '');
  const [finishInputType, setFinishInputType] = useState<FinishInputType>('OUTPUT');

  const [defectQty, setDefectQty] = useState('');
  const [selectedDefectCode, setSelectedDefectCode] = useState('');
  const [defectEntries, setDefectEntries] = useState<WorkOrderPerformanceDefectRequest[]>([]);
  const [isDefectDropdownOpen, setIsDefectDropdownOpen] = useState(false);

  const [defectOptions, setDefectOptions] = useState<DefectOptionResponse[]>([]);
  const [isDefectOptionsLoading, setIsDefectOptionsLoading] = useState(true);
  const [defectOptionsError, setDefectOptionsError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    isSubmitting ||
    Object.values(materialQtys).some((v) => v !== '') ||
    defectQty !== '' ||
    defectEntries.length > 0;
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const loadDefectOptions = useCallback(async () => {
    setIsDefectOptionsLoading(true);
    try {
      const res = await DefectApi.getOptions(ready.operCode);
      setDefectOptions(res.data ?? []);
      setDefectOptionsError(null);
    } catch (err) {
      console.error('불량 유형 목록을 불러오지 못했습니다.', err);
      setDefectOptionsError('불량 유형을 불러오지 못했습니다.');
      setDefectOptions([]);
    } finally {
      setIsDefectOptionsLoading(false);
    }
  }, [ready.operCode]);

  useEffect(() => {
    loadDefectOptions();
  }, [loadDefectOptions]);

  // defCode -> 불량명 (옵션에 없으면 코드 그대로 표시)
  const getDefectName = (defCode: string) =>
    defectOptions.find((option) => option.defCode === defCode)?.defNm ?? defCode;

  // 불량 단위는 현재 공정의 산출자재 단위를 따른다 (선택된 자재 우선 → 첫 자재 → 라인 단위)
  const defectUnit =
    materials.find((m) => m.itemCode === activeItemCode)?.unit ?? materials[0]?.unit ?? fallbackUnit;

  const handleMaterialKeyPress = useCallback(
    (key: string) => {
      if (!activeItemCode) return;
      setMaterialQtys((prev) => ({
        ...prev,
        [activeItemCode]: applyKeypad(prev[activeItemCode] ?? '', key),
      }));
    },
    [activeItemCode],
  );

  const handleDefectKeypadPress = useCallback((key: string) => {
    setDefectQty((prev) => applyKeypad(prev, key));
  }, []);

  const handleAddDefect = () => {
    const qty = Number(defectQty);

    if (!selectedDefectCode) {
      setError('불량 유형을 선택해 주세요.');
      return;
    }

    if (!defectQty || Number.isNaN(qty) || qty <= 0) {
      setError('불량 수량을 입력해 주세요.');
      return;
    }

    setDefectEntries((prev) => {
      const existing = prev.find((item) => item.defCode === selectedDefectCode);

      if (existing) {
        return prev.map((item) =>
          item.defCode === selectedDefectCode ? { ...item, qty: item.qty + qty } : item,
        );
      }

      return [...prev, { defCode: selectedDefectCode, qty }];
    });

    setDefectQty('');
    setError(null);
  };

  const handleRemoveDefect = (defCode: string) => {
    setDefectEntries((prev) => prev.filter((entry) => entry.defCode !== defCode));
    if (selectedDefectCode === defCode) setSelectedDefectCode('');
    setError(null);
  };

  const handleConfirm = async () => {
    const built = buildMaterialPayload(materials, materialQtys, { requireAll: false });

    if (!built) {
      setError('산출자재 수량을 올바르게 입력해 주세요.');
      return;
    }

    // 불량 수량을 입력해 놓고 "불량 내역 추가"를 누르지 않은 상태
    if (defectQty) {
      setError('입력한 불량 수량을 불량 내역에 추가해 주세요.');
      return;
    }

    // 산출자재도 불량도 하나도 없으면 종료할 수 없음
    if (built.payload.length === 0 && defectEntries.length === 0) {
      setError('산출자재 또는 불량 수량을 입력해 주세요.');
      return;
    }

    const totalDefectQty = defectEntries.reduce((sum, entry) => sum + entry.qty, 0);
    const outputText =
      built.summary.length > 0
        ? built.summary.map((m) => `${m.itemNm} ${m.qty.toLocaleString()}${m.unit}`).join('\n')
        : '없음';

    if (
      !window.confirm(
        `${ready.operNm} 공정을 종료하시겠습니까?\n\n` +
          `[산출자재]\n${outputText}\n\n` +
          `[불량] ${totalDefectQty.toLocaleString()} ${defectUnit}`,
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await WorkOrderApi.finishPerformance({
        zone: Number(zone) as ZoneType,
        workOrderLineId: ready.workOrderLineId,
        operCode: ready.operCode,
        materials: built.payload,
        ...(defectEntries.length > 0
          ? { defects: defectEntries.map((entry) => ({ defCode: entry.defCode, qty: entry.qty })) }
          : {}),
      });
      onDone(`${ready.operNm} 공정이 종료되었습니다.`);
    } catch (err) {
      setError(getErrorMessage(err, '공정 종료 처리에 실패했습니다.'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="workOrderFinishForm">
      {/* 산출자재 / 불량 입력 선택 */}
      <div className="workOrderFinishTabs">
        <button
          type="button"
          className={finishInputType === 'OUTPUT' ? 'active' : ''}
          onClick={() => {
            setFinishInputType('OUTPUT');
            setIsDefectDropdownOpen(false);
            setError(null);
          }}
        >
          산출자재 입력
        </button>

        <button
          type="button"
          className={finishInputType === 'DEFECT' ? 'active' : ''}
          onClick={() => {
            setFinishInputType('DEFECT');
            setError(null);
          }}
        >
          불량 입력
        </button>
      </div>

      {/* 산출자재 탭 */}
      {finishInputType === 'OUTPUT' && (
        <>
          <div className="workOrderFinishLabel">산출자재 수량</div>
          <MaterialQtyInput
            materials={materials}
            values={materialQtys}
            activeCode={activeItemCode}
            onSelect={setActiveItemCode}
            onKeyPress={handleMaterialKeyPress}
          />
        </>
      )}

      {/* 불량 탭: 불량 유형 선택 */}
      {finishInputType === 'DEFECT' && (
        <div className="workOrderDefectSelector">
          <div className="workOrderFinishLabel">불량 유형</div>

          <div className="workOrderDefectDropdown">
            <button
              type="button"
              className={`workOrderDefectDropdownTrigger ${isDefectDropdownOpen ? 'isOpen' : ''}`}
              onClick={() => {
                if (
                  !isDefectDropdownOpen &&
                  !isDefectOptionsLoading &&
                  (defectOptionsError || defectOptions.length === 0)
                ) {
                  loadDefectOptions();
                }
                setIsDefectDropdownOpen((prev) => !prev);
                setError(null);
              }}
            >
              <span>
                {selectedDefectCode
                  ? getDefectName(selectedDefectCode)
                  : isDefectOptionsLoading
                    ? '불량 유형을 불러오는 중...'
                    : '불량 유형을 선택하세요'}
              </span>

              <ChevronDownIcon
                className={`workOrderDefectDropdownIcon ${isDefectDropdownOpen ? 'isOpen' : ''}`}
              />
            </button>

            {isDefectDropdownOpen && (
              <div className="workOrderDefectDropdownMenu">
                {defectOptionsError || defectOptions.length === 0 ? (
                  <div className="workOrderDefectDropdownEmpty">
                    <div>
                      {isDefectOptionsLoading
                        ? '불러오는 중...'
                        : defectOptionsError ?? '등록된 불량 유형이 없습니다.'}
                    </div>
                    {!isDefectOptionsLoading && (
                      <button
                        type="button"
                        className="workOrderDefectRetryBtn"
                        onClick={loadDefectOptions}
                      >
                        다시 불러오기
                      </button>
                    )}
                  </div>
                ) : (
                  defectOptions.map((option) => (
                    <button
                      key={option.defCode}
                      type="button"
                      className={`workOrderDefectDropdownOption ${selectedDefectCode === option.defCode ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedDefectCode(option.defCode);
                        setIsDefectDropdownOpen(false);
                        setError(null);
                      }}
                    >
                      <span>{option.defNm}</span>
                      {selectedDefectCode === option.defCode && (
                        <span className="workOrderDefectDropdownCheck">✓</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 불량 탭: 수량 + 키패드 + 추가 */}
      {finishInputType === 'DEFECT' && (
        <>
          <div className="workOrderFinishLabel">불량 수량</div>

          <div className="workScanQtyDisplay">
            {defectQty || '0'}
            <span>{defectUnit}</span>
          </div>

          <NumericKeypad onPress={handleDefectKeypadPress} />

          <button type="button" className="workOrderAddDefectBtn" onClick={handleAddDefect}>
            불량 내역 추가
          </button>
        </>
      )}

      {/* 현재까지 입력된 산출자재 / 불량 내역 요약 */}
      <div className="workOrderDefectSummary">
        {materials.map((m) => (
          <div key={m.itemCode} className="workOrderDefectSummaryRow">
            <span>산출 · {m.itemNm}</span>
            <strong>
              {Number(materialQtys[m.itemCode] || 0).toLocaleString()} {m.unit}
            </strong>
          </div>
        ))}

        <div className="workOrderDefectSummaryHead">
          <span>불량 내역</span>
          {defectEntries.length > 0 && <strong>{defectEntries.length}건</strong>}
        </div>

        {defectEntries.length === 0 ? (
          <div className="workOrderDefectEmpty">등록된 불량 내역이 없습니다.</div>
        ) : (
          defectEntries.map((entry) => {
            const defectName = getDefectName(entry.defCode);

            return (
              <div key={entry.defCode} className="workOrderDefectItem">
                <div className="workOrderDefectItemName">
                  <span>{defectName}</span>
                  <span className="workOrderDefectItemQty">
                    · {entry.qty.toLocaleString()} {defectUnit}
                  </span>
                </div>

                <button
                  type="button"
                  className="workOrderDefectDeleteBtn"
                  onClick={() => handleRemoveDefect(entry.defCode)}
                  disabled={isSubmitting}
                  aria-label={`${defectName} 삭제`}
                >
                  삭제
                </button>
              </div>
            );
          })
        )}
      </div>

      {error && <div className="workScanErrorMsg">{error}</div>}

      <div className="workScanActionRow">
        <button type="button" className="workScanCancelBtn" onClick={onCancel} disabled={isSubmitting}>
          취소
        </button>
        <button type="button" className="workScanSubmitBtn" onClick={handleConfirm} disabled={isSubmitting}>
          {isSubmitting ? '등록 중...' : '공정 종료'}
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   공정 입력 화면
   - 라인 정보 카드 + 시작/종료 폼
   - 입력할 자재 목록은 상세 데이터로 만들고(buildPerformanceReady), 확정은 start / finish API 로 보낸다
================================================================ */

function PerformanceEntryView({
  workId,
  line,
  step,
  initialMode,
  zone,
  productionLine,
  onCancel,
  onDone,
  onDirtyChange,
}: {
  workId: string;
  line: WorkOrderLineResponse;
  step: WorkOrderRoutingStepResponse;
  initialMode: EntryMode;
  zone: string;
  productionLine?: WorkOrderProductionLineResponse;
  onCancel: () => void;
  onDone: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  // 진행 중 공정이면 종료, 아니면 시작 (상세 데이터 기준)
  const mode: EntryMode = step.inProgress && !step.done ? 'FINISH' : initialMode;
  const ready = useMemo(() => buildPerformanceReady(line, step, mode), [line, step, mode]);
  const eq = equipmentLabel(step);
  const { ins } = splitStepMaterials(step);
  const title = productionLine?.itemNm ?? line.itemNm;
  const isPack = productionLine?.status === 'AWAITING_PACK';

  return (
    <div className="woEntryView">
      {/* 라인 / 공정 정보 */}
      <div className="workOrderItemCard">
        <div className="workOrderCardHead">
          <span className="workOrderId">{title}</span>
          {productionLine?.operNm && (
            <span className={`woLineOperChip woLineOperChip--${isPack ? 'PACK' : mode}`}>
              {productionLine.operNm}
            </span>
          )}
          <span className={`woEntryChip woEntryChip--${mode}`}>{ENTRY_LABEL[mode]}</span>
        </div>
        <div className="workScanInfoGrid">
          <div className="workScanInfoItem">
            <span>공정</span>
            <strong>
              {step.operSeq}. {step.operNm}
            </strong>
          </div>
          <div className="workScanInfoItem">
            <span>설비</span>
            <strong>{eq ?? '-'}</strong>
          </div>
          <div className="workScanInfoItem">
            <span>지시수량</span>
            <strong>
              {line.instructQty.toLocaleString()} {line.unit}
            </strong>
          </div>
          <div className="workScanInfoItem">
            <span>작업지시</span>
            <strong>{workId}</strong>
          </div>
        </div>

        {/* 종료 시에는 시작 때 기록한 투입 내역을 같이 보여준다 */}
        {mode === 'FINISH' && ins.length > 0 && (
          <div className="woEntryInputs">
            <div className="woEntryInputsLabel">투입 내역</div>
            {ins.map((m, idx) => (
              <div key={`${m.itemCode}-${idx}`} className="woEntryInputsRow">
                <span>{m.itemNm}</span>
                <strong>
                  {m.qty.toLocaleString()} {m.unit}
                </strong>
              </div>
            ))}
          </div>
        )}

        {/* 공정 투입 내역이 없으면 생산라인 현황의 투입량으로 대신 보여준다 */}
        {mode === 'FINISH' && ins.length === 0 && productionLine?.inputQty != null && (
          <div className="woEntryInputs">
            <div className="woEntryInputsLabel">투입 내역</div>
            <div className="woEntryInputsRow">
              <span>{productionLine.itemNm}</span>
              <strong>
                {productionLine.inputQty.toLocaleString()} {line.unit}
              </strong>
            </div>
          </div>
        )}

        {/* 포장 대기 라인이면 포장 전 산출 내역을 같이 보여준다 */}
        {isPack && productionLine && productionOutputs(productionLine).length > 0 && (
          <div className="woEntryInputs">
            <div className="woEntryInputsLabel">포장 전 산출 내역</div>
            {productionOutputs(productionLine).map((m, idx) => (
              <div key={`${m.itemCode}-${idx}`} className="woEntryInputsRow">
                <span>{m.itemNm}</span>
                <strong>
                  {m.qty.toLocaleString()} {m.unit}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 입력 폼 */}
      <div className="woEntryFormCard">
        {mode === 'START' ? (
          <PerformanceStartForm
            ready={ready}
            zone={zone}
            onCancel={onCancel}
            onDone={onDone}
            onDirtyChange={onDirtyChange}
          />
        ) : (
          <PerformanceFinishForm
            ready={ready}
            zone={zone}
            fallbackUnit={line.unit}
            onCancel={onCancel}
            onDone={onDone}
            onDirtyChange={onDirtyChange}
          />
        )}
      </div>
    </div>
  );
}

/* ================================================================
   페이지
================================================================ */

export function WorkOrderListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const zone = searchParams.get('zone') ?? '';

  /* ── 목록 ── */
  const [orders, setOrders] = useState<WorkOrderResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [pageNo, setPageNo] = useState(0);
  const [isLastPage, setIsLastPage] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  /* ── 상세 (selectedWorkId 가 있으면 상세 화면) ── */
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkOrderDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  /* ── 생산라인 현황 (null 이면 아직 못 받음 → 공정 기준 카드로 표시) ── */
  const [productionLines, setProductionLines] = useState<WorkOrderProductionLineResponse[] | null>(null);
  const [productionLinesError, setProductionLinesError] = useState<string | null>(null);

  /* ── 공정 입력 화면 (entryTarget 이 있으면 입력 화면) ── */
  const [entryTarget, setEntryTarget] = useState<EntryTarget | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [completedBanner, setCompletedBanner] = useState<string | null>(null);

  // 입력 폼에 값이 있는지 (뒤로가기 확인용)
  const formDirtyRef = useRef(false);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    formDirtyRef.current = dirty;
  }, []);

  /* ── 목록 조회 (내 작업지시: 완료되지 않은 건 전체) ── */
  const loadOrders = useCallback(async (targetPage: number, silent = false) => {
    if (targetPage === 0) {
      if (!silent) setListLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const res = await WorkOrderApi.getMyList({ page: targetPage, size: PAGE_SIZE });
      const pageData = res.data;

      setOrders((prev) =>
        targetPage === 0 ? pageData.content : [...prev, ...pageData.content],
      );
      setPageNo(pageData.number);
      setIsLastPage(pageData.last);
      setTotalElements(pageData.totalElements);
      setListError(null);
    } catch (err) {
      console.error('작업지시 목록을 불러오지 못했습니다.', err);
      setListError(getErrorMessage(err, '작업지시 목록을 불러오지 못했습니다.'));
    } finally {
      setListLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!isValidWorkZone(zone)) return;
    loadOrders(0);
  }, [zone, loadOrders]);

  /* ── 상세 + 생산라인 현황 조회 (둘 다 동시에, 현황이 실패해도 상세는 보여준다) ── */
  const loadDetail = useCallback(async (workId: string, silent = false) => {
    if (!silent) {
      setDetailLoading(true);
      setDetailError(null);
    }

    const [detailRes, linesRes] = await Promise.allSettled([
      WorkOrderApi.getDetail(workId),
      WorkOrderApi.getProductionLines(workId),
    ]);

    if (detailRes.status === 'fulfilled') {
      setDetail(detailRes.value.data);
      setDetailError(null);
    } else {
      console.error('작업지시 상세를 불러오지 못했습니다.', detailRes.reason);
      if (silent) {
        setNotice('최신 상태를 불러오지 못했습니다. 새로고침해 주세요.');
      } else {
        setDetailError(getErrorMessage(detailRes.reason, '작업지시 상세를 불러오지 못했습니다.'));
      }
    }

    if (linesRes.status === 'fulfilled') {
      const list = [...(linesRes.value.data ?? [])].sort((a, b) => a.seq - b.seq);
      setProductionLines(list);
      setProductionLinesError(null);
    } else {
      console.error('생산라인 현황을 불러오지 못했습니다.', linesRes.reason);
      setProductionLinesError(getErrorMessage(linesRes.reason, '생산라인 현황을 불러오지 못했습니다.'));
      // 조용한 새로고침 실패면 이전 현황을 유지, 처음 조회 실패면 공정 기준 카드로 표시
      if (!silent) setProductionLines(null);
    }

    if (!silent) setDetailLoading(false);
  }, []);

  const resetEntry = useCallback(() => {
    setEntryTarget(null);
    formDirtyRef.current = false;
  }, []);

  /** 입력 중인 값이 있으면 나가기 전에 확인 */
  const confirmLeaveEntry = () =>
    !formDirtyRef.current ||
    window.confirm('입력 중인 내용이 있습니다. 저장하지 않고 나가시겠습니까?');

  const openDetail = (workId: string) => {
    resetEntry();
    setDetail(null);
    setProductionLines(null);
    setProductionLinesError(null);
    setSelectedWorkId(workId);
    loadDetail(workId);
  };

  const closeDetail = () => {
    resetEntry();
    setSelectedWorkId(null);
    setDetail(null);
    setDetailError(null);
    setProductionLines(null);
    setProductionLinesError(null);
    // 완료된 작업지시가 목록에서 빠지도록 조용히 다시 불러온다
    loadOrders(0, true);
  };

  const openEntry = (
    line: WorkOrderLineResponse,
    step: WorkOrderRoutingStepResponse,
    mode: EntryMode,
    productionSeq?: number,
  ) => {
    formDirtyRef.current = false;
    setEntryTarget({ workOrderLineId: line.workOrderLineId, operCode: step.operCode, mode, productionSeq });
  };

  /** 입력 화면 → 상세 (취소 버튼 / 상단 뒤로가기) */
  const closeEntry = () => {
    if (!confirmLeaveEntry()) return;
    resetEntry();
  };

  /* ── 자동으로 사라지는 안내/토스트 ── */
  useEffect(() => {
    if (!completedBanner) return;
    const timer = setTimeout(() => setCompletedBanner(null), 3000);
    return () => clearTimeout(timer);
  }, [completedBanner]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  /* ── 시작/종료 확정 완료 → 상세로 돌아가서 서버 기준으로 다시 불러온다 ── */
  const handlePerformanceDone = useCallback(
    async (message: string) => {
      resetEntry();
      setCompletedBanner(message);
      if (selectedWorkId) await loadDetail(selectedWorkId, true);
    },
    [selectedWorkId, loadDetail, resetEntry],
  );

  // 입력 대상 라인/공정 (상세 데이터 기준)
  const entryLine = entryTarget
    ? detail?.lines.find((line) => line.workOrderLineId === entryTarget.workOrderLineId)
    : undefined;
  const entryStep = entryTarget
    ? entryLine?.routingSteps.find((step) => step.operCode === entryTarget.operCode)
    : undefined;
  const entryProductionLine =
    entryTarget?.productionSeq !== undefined
      ? productionLines?.find((pl) => pl.seq === entryTarget.productionSeq)
      : undefined;

  // 생산라인 현황을 쓸 수 있으면 그걸로 카드를 그리고, 아니면 기존 공정 기준 카드로 표시
  const useProductionView = !!productionLines && productionLines.length > 0;

  const viewMode: ViewMode =
    selectedWorkId === null ? 'list' : entryTarget && entryLine && entryStep ? 'entry' : 'detail';

  // 화면이 바뀌면 맨 위부터 보이게
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [viewMode]);

  if (!isValidWorkZone(zone)) {
    return <Navigate to="/work" replace />;
  }

  const isFoodZone = zone === '1';
  const zoneLabel = isFoodZone ? '식품동' : '섬유동';
  const zoneVariant = isFoodZone ? 'food' : 'crop';

  const handleBack = () => {
    if (viewMode === 'entry') closeEntry();
    else if (viewMode === 'detail') closeDetail();
    else navigate(`/work/home?zone=${encodeURIComponent(zone)}`);
  };

  const backLabel =
    viewMode === 'entry' ? '← 상세' : viewMode === 'detail' ? '← 목록' : '← 돌아가기';

  /* ── 렌더 헬퍼 ── */

  /** 라인 카드 (목업 형태: 카드 하나 = 라인 하나, 누르면 바로 입력 화면) */
  const renderLine = (line: WorkOrderLineResponse, index: number) => {
    const steps = line.routingSteps;
    const lineStatus = getLineStatus(steps);
    const doneCount = steps.filter((s) => s.done).length;
    const actionable = getActionableStep(steps);
    const lastDoneStep = [...steps].reverse().find((s) => s.done);
    // 칩에 보여줄 공정: 지금 입력할 공정, 없으면 마지막으로 끝난 공정
    const operStep = actionable?.step ?? lastDoneStep;

    let variant: LineCardVariant;
    let statusLabel: string;
    let subtitle: string;

    if (steps.length === 0) {
      variant = 'NONE';
      statusLabel = '공정 없음';
      subtitle = '등록된 공정이 없습니다';
    } else if (actionable?.mode === 'FINISH') {
      const { ins } = splitStepMaterials(actionable.step);
      const eq = equipmentLabel(actionable.step);
      const inputText =
        ins.length > 0
          ? `투입 ${formatMaterials(ins)}`
          : actionable.step.inputQty !== null
            ? `투입 ${actionable.step.inputQty.toLocaleString()} ${line.unit}`
            : '투입 내역 없음';
      variant = 'FINISH';
      statusLabel = '진행중 · 실적입력';
      subtitle = [inputText, eq].filter(Boolean).join(' · ');
    } else if (actionable?.mode === 'START') {
      const eq = equipmentLabel(actionable.step);
      variant = 'START';
      statusLabel = lineStatus === 'WAIT' ? '대기 · 투입입력' : '다음 공정 · 투입입력';
      subtitle = [
        `지시 ${line.instructQty.toLocaleString()} ${line.unit}`,
        line.bpNm,
        line.dueDate ? `납기 ${line.dueDate}` : null,
        eq,
      ]
        .filter(Boolean)
        .join(' · ');
    } else {
      const outs = lastDoneStep ? splitStepMaterials(lastDoneStep).outs : [];
      variant = 'DONE';
      statusLabel = '완료';
      subtitle =
        outs.length > 0
          ? `산출 ${formatMaterials(outs)}`
          : lastDoneStep?.outputQty != null
            ? `산출 ${lastDoneStep.outputQty.toLocaleString()} ${line.unit}`
            : '모든 공정 완료';
    }

    const clickable = actionable !== null;

    return (
      <button
        key={line.workOrderLineId}
        type="button"
        className={`woLineCard woLineCard--${lineStatus}`}
        onClick={() => actionable && openEntry(line, actionable.step, actionable.mode)}
        disabled={!clickable}
        aria-label={`${line.itemNm} ${statusLabel}`}
      >
        <span className="woLineSeq">{lineStatus === 'DONE' ? '✓' : index + 1}</span>

        <div className="woLineInfo">
          <div className="woLineNameRow">
            <span className="woLineName">{line.itemNm}</span>
            {operStep && (
              <span className={`woLineOperChip woLineOperChip--${variant}`}>
                {operStep.operSeq}. {operStep.operNm}
              </span>
            )}
          </div>
          <div className="woLineMeta">{subtitle}</div>
        </div>

        <div className="woLineSide">
          {steps.length > 0 && (
            <span className="woLineProgress">
              {doneCount}/{steps.length}
            </span>
          )}
          <span className={`woLineStatus woLineStatus--${variant}`}>
            {variant === 'DONE' && <span aria-hidden="true">✓</span>}
            {statusLabel}
          </span>
          {clickable && <ChevronRightIcon className="woLineChevron" aria-hidden="true" />}
        </div>
      </button>
    );
  };

  /**
   * 생산라인 현황 카드 (production-lines 기준)
   * - 상태/배지/잠금은 현황 응답을 따르고, 실제 입력할 공정은 상세(routingSteps)에서 찾는다
   */
  const renderProductionLine = (pl: WorkOrderProductionLineResponse, lines: WorkOrderLineResponse[]) => {
    const meta = getProductionMeta(pl.status);
    const line = findWorkOrderLine(pl, lines);
    const steps = line?.routingSteps ?? [];
    const doneCount = steps.filter((s) => s.done).length;
    const actionable = line ? getActionableStep(steps) : null;
    const unit = line?.unit ?? pl.outputs?.[0]?.unit ?? '';
    const outs = productionOutputs(pl);

    let subtitle: string;
    switch (pl.status) {
      case 'LOCKED':
        subtitle = pl.lockedReason ? `${pl.lockedReason} 완료 후 진행 가능` : '선행 라인 완료 후 진행 가능';
        break;
      case 'READY':
        subtitle = [
          line ? `지시 ${line.instructQty.toLocaleString()} ${line.unit}` : null,
          line?.bpNm,
          line?.dueDate ? `납기 ${line.dueDate}` : null,
          equipmentLabel(actionable?.step),
        ]
          .filter(Boolean)
          .join(' · ') || '투입량을 입력해 작업을 시작하세요';
        break;
      case 'PRODUCING':
        subtitle = [
          pl.inputQty != null ? `투입 ${pl.inputQty.toLocaleString()} ${unit}` : '투입 내역 없음',
          equipmentLabel(actionable?.step),
        ]
          .filter(Boolean)
          .join(' · ');
        break;
      case 'AWAITING_PACK':
        subtitle = [
          pl.inputQty != null ? `투입 ${pl.inputQty.toLocaleString()} ${unit}` : null,
          outs.length > 0 ? `산출 ${formatMaterials(outs)}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || '포장 실적을 입력하세요';
        break;
      case 'DONE':
        subtitle =
          pl.finalQty != null
            ? `최종 ${pl.finalQty.toLocaleString()} ${unit}` + (outs.length > 0 ? ` · 산출 ${formatMaterials(outs)}` : '')
            : outs.length > 0
              ? `산출 ${formatMaterials(outs)}`
              : '모든 공정 완료';
        break;
      default:
        subtitle = '-';
    }

    const canEnter = pl.status !== 'LOCKED' && pl.status !== 'DONE' && !!line && actionable !== null;
    // 현황상 입력 가능한데 연결할 라인을 못 찾은 경우 안내
    if (!canEnter && pl.status !== 'LOCKED' && pl.status !== 'DONE' && !line) {
      subtitle = `${subtitle} · 연결된 작업지시 라인을 찾을 수 없습니다`;
    }

    return (
      <button
        key={`${pl.seq}-${pl.itemCode}`}
        type="button"
        className={`woLineCard woLineCard--${meta.tone}`}
        onClick={() => canEnter && line && actionable && openEntry(line, actionable.step, actionable.mode, pl.seq)}
        disabled={!canEnter}
        aria-label={`${pl.itemNm} ${meta.label}`}
      >
        <span className="woLineSeq">
          {pl.status === 'DONE' ? (
            '✓'
          ) : pl.status === 'LOCKED' ? (
            <LockClosedIcon className="woLineSeqIcon" aria-hidden="true" />
          ) : (
            pl.seq
          )}
        </span>

        <div className="woLineInfo">
          <div className="woLineNameRow">
            <span className="woLineName">{pl.itemNm}</span>
            {pl.operNm && (
              <span className={`woLineOperChip woLineOperChip--${meta.variant}`}>{pl.operNm}</span>
            )}
          </div>
          <div className="woLineMeta">{subtitle}</div>
        </div>

        <div className="woLineSide">
          {steps.length > 0 && (
            <span className="woLineProgress">
              {doneCount}/{steps.length}
            </span>
          )}
          <span className={`woLineStatus woLineStatus--${meta.variant}`}>
            {pl.status === 'DONE' && <span aria-hidden="true">✓</span>}
            {pl.status === 'LOCKED' && <LockClosedIcon className="woLineStatusIcon" aria-hidden="true" />}
            {meta.label}
          </span>
          {canEnter && <ChevronRightIcon className="woLineChevron" aria-hidden="true" />}
        </div>
      </button>
    );
  };

  /* ── 목록 화면 ── */
  const renderListView = () => (
    <div className="woListView">
      <div className="woListHead">
        <div>
          <h1>작업지시 목록</h1>
          <p>내게 배정된 진행 대상 {totalElements.toLocaleString()}건</p>
        </div>
        <button
          type="button"
          className="woRefreshBtn"
          onClick={() => loadOrders(0)}
          disabled={listLoading}
        >
          <ArrowPathIcon className={listLoading ? 'woSpin' : ''} aria-hidden="true" />
          새로고침
        </button>
      </div>

      {listLoading && orders.length === 0 ? (
        <div className="woState">
          <span className="woSpinner" aria-hidden="true" />
          <p>작업지시를 불러오는 중...</p>
        </div>
      ) : listError && orders.length === 0 ? (
        <div className="woState woState--error">
          <ExclamationTriangleIcon className="woStateIcon" aria-hidden="true" />
          <p>{listError}</p>
          <button type="button" className="workScanCancelBtn" onClick={() => loadOrders(0)}>
            다시 불러오기
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="woState">
          <ClipboardDocumentListIcon className="woStateIcon" aria-hidden="true" />
          <p>배정된 작업지시가 없습니다.</p>
        </div>
      ) : (
        <>
          {listError && (
            <div className="workOrderNextStepBanner workOrderNextStepBanner--error">{listError}</div>
          )}

          <div className="woCardList">
            {orders.map((order) => (
              <button
                key={order.workId}
                type="button"
                className="woCard"
                onClick={() => openDetail(order.workId)}
                aria-label={`${order.workId} 상세 보기`}
              >
                <div className="woCardMain">
                  <div className="woCardTop">
                    <span className="workOrderId">{order.workId}</span>
                    <span className={`workOrderStatusChip workOrderStatusChip--${order.status}`}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </div>

                  <div className="woCardItems">{order.itemNms.join(' · ') || '-'}</div>

                  <div className="woCardMeta">
                    <span>작업일 {order.workDate}</span>
                    {order.orderCode && <span>수주 {order.orderCode}</span>}
                    <span>{order.lineCount}개 라인</span>
                    <span>지시수량 {order.totalInstructQty.toLocaleString()}</span>
                  </div>
                </div>
                <ChevronRightIcon className="woCardChevron" aria-hidden="true" />
              </button>
            ))}
          </div>

          {!isLastPage && (
            <button
              type="button"
              className="woMoreBtn"
              onClick={() => loadOrders(pageNo + 1)}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? '불러오는 중...' : '더 보기'}
            </button>
          )}
        </>
      )}
    </div>
  );

  /* ── 상세 화면 ── */
  const renderDetailView = () => {
    if (detailLoading && !detail) {
      return (
        <div className="woState">
          <span className="woSpinner" aria-hidden="true" />
          <p>작업지시를 불러오는 중...</p>
        </div>
      );
    }

    if (detailError && !detail) {
      return (
        <div className="woState woState--error">
          <ExclamationTriangleIcon className="woStateIcon" aria-hidden="true" />
          <p>{detailError}</p>
          <button
            type="button"
            className="workScanCancelBtn"
            onClick={() => selectedWorkId && loadDetail(selectedWorkId)}
          >
            다시 불러오기
          </button>
        </div>
      );
    }

    if (!detail) return null;

    const hasActionable = useProductionView
      ? productionLines!.some(
          (pl) =>
            pl.status !== 'LOCKED' &&
            pl.status !== 'DONE' &&
            !!findWorkOrderLine(pl, detail.lines),
        )
      : detail.lines.some((line) => getActionableStep(line.routingSteps) !== null);

    // 상태별 개수 (요약 칩)
    const statusCounts = (productionLines ?? []).reduce<Record<string, number>>((acc, pl) => {
      acc[pl.status] = (acc[pl.status] ?? 0) + 1;
      return acc;
    }, {});
    const doneLineCount = statusCounts.DONE ?? 0;
    const totalLineCount = productionLines?.length ?? 0;

    return (
      <div className="workOrderResult">
        <div className="workOrderItemCard">
          <div className="workOrderCardHead">
            <span className="workOrderId">{detail.workId}</span>
            <span className={`workOrderStatusChip workOrderStatusChip--${detail.status}`}>
              {STATUS_LABEL[detail.status] ?? detail.status}
            </span>
          </div>
          <div className="workScanInfoGrid">
            <div className="workScanInfoItem">
              <span>작업일</span>
              <strong>{detail.workDate}</strong>
            </div>
            <div className="workScanInfoItem">
              <span>담당자</span>
              <strong>{detail.managerNm || '미지정'}</strong>
            </div>
          </div>
        </div>

        {/* 라인 버튼으로 공정을 시작/종료한다는 안내 */}
        {hasActionable && (
          <div className="workOrderNextStepBanner workOrderNextStepBanner--next">
            <span>라인을 누르면 지금 해야 할 공정의 투입량 / 실적 입력 화면으로 이동합니다</span>
          </div>
        )}

        <div className="woLineSection">
          <div className="woLineSectionHead">
            <div className="workOrderRoutingLabel woLineSectionLabel">생산 라인 (공정 순서대로)</div>
            <button
              type="button"
              className="woRefreshBtn"
              onClick={() => selectedWorkId && loadDetail(selectedWorkId, true)}
            >
              <ArrowPathIcon aria-hidden="true" />
              새로고침
            </button>
          </div>

          {/* 생산라인 진행 요약 (완료 n/전체 m + 상태별 개수) */}
          {useProductionView && (
            <div className="woLineSummary">
              <div className="woLineSummaryProgress">
                <div className="woLineSummaryText">
                  <span>전체 진행</span>
                  <strong>
                    {doneLineCount}/{totalLineCount}
                  </strong>
                </div>
                <div className="woLineSummaryBar">
                  <div
                    className="woLineSummaryBarFill"
                    style={{ width: `${totalLineCount > 0 ? (doneLineCount / totalLineCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="woLineSummaryChips">
                {PRODUCTION_SUMMARY_ORDER.filter(({ status }) => (statusCounts[status] ?? 0) > 0).map(
                  ({ status, label }) => (
                    <span
                      key={status}
                      className={`woLineSummaryChip woLineSummaryChip--${getProductionMeta(status).variant}`}
                    >
                      {label} {statusCounts[status]}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          {/* 현황 API 실패 → 공정 기준으로 표시 중이라는 안내 */}
          {productionLinesError && !useProductionView && (
            <div className="workOrderNextStepBanner workOrderNextStepBanner--error">
              {productionLinesError} 공정 기준으로 표시합니다.
            </div>
          )}

          {useProductionView ? (
            <div className="woLineList">
              {productionLines!.map((pl) => renderProductionLine(pl, detail.lines))}
            </div>
          ) : detail.lines.length === 0 ? (
            <div className="workOrderRoutingEmpty">등록된 라인이 없습니다.</div>
          ) : (
            <div className="woLineList">{detail.lines.map((line, idx) => renderLine(line, idx))}</div>
          )}
        </div>
      </div>
    );
  };

  /* ── 공정 입력 화면 ── */
  const renderEntryView = () => {
    if (!detail || !entryTarget || !entryLine || !entryStep) return null;

    return (
      <PerformanceEntryView
        key={`${entryTarget.workOrderLineId}:${entryTarget.operCode}:${entryTarget.mode}`}
        workId={detail.workId}
        line={entryLine}
        step={entryStep}
        initialMode={entryTarget.mode}
        zone={zone}
        productionLine={entryProductionLine}
        onCancel={closeEntry}
        onDone={handlePerformanceDone}
        onDirtyChange={handleDirtyChange}
      />
    );
  };

  return (
    <div className="workTabletPage">
      <div className="workScanPanel">
        <div className={`workScanContainer workScanContainer--${zoneVariant}`}>
          <div className="workScanTopBar">
            <button type="button" className="workScanHomeBtn" onClick={handleBack}>
              {backLabel}
            </button>
          </div>

          <div className="workScanMain">
            <div className="workTabletScanHeader">
              <span className={`workTabletScanZoneBadge workTabletScanZoneBadge--${zoneVariant}`}>
                <MapPinIcon aria-hidden="true" />
                {zoneLabel}
              </span>
              <ChevronRightIcon className="workTabletScanArrow" aria-hidden="true" />
              <span className={`workTabletScanProcessBadge workTabletScanProcessBadge--${zoneVariant}`}>
                작업지시
              </span>
              {viewMode === 'entry' && entryTarget && (
                <>
                  <ChevronRightIcon className="workTabletScanArrow" aria-hidden="true" />
                  <span className={`workTabletScanProcessBadge workTabletScanProcessBadge--${zoneVariant}`}>
                    {ENTRY_LABEL[entryTarget.mode]}
                  </span>
                </>
              )}
            </div>

            {viewMode === 'list' && renderListView()}
            {viewMode === 'detail' && renderDetailView()}
            {viewMode === 'entry' && renderEntryView()}
          </div>

          {completedBanner && <div className="workScanSuccessToast">{completedBanner}</div>}

          {notice && !completedBanner && <div className="workOrderWarnToast">{notice}</div>}
        </div>
      </div>
    </div>
  );
}
