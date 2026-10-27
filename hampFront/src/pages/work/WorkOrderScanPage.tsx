import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { apiClient } from '@/api/apiClient';
import { WorkOrderApi } from '@/api/WorkOrder';
import type {
  WorkOrderLineScanResponse,
  WorkOrderPerformanceDefectRequest,
  WorkOrderPerformanceMaterialQtyRequest,
  WorkOrderPerformanceScanResponse,
  WorkOrderRoutingStepResponse, // 공정 단계별 자재(materials) 분리 헬퍼에서 사용
  ZoneType,
} from '@/api/WorkOrder';
import type { ItemOptionResponse } from '@/api/master/Item';
import { DefectApi, type DefectOptionResponse } from '@/api/master/Defect';
import { isValidWorkZone } from '@/utils/common';
import '@/pages/work/WorkTabletHome.css';
import '@/pages/work/WorkSeedReportScanPage.css';
import '@/pages/work/WorkOrderScanPage.css';

type ConnectionStatus = 'connecting' | 'open' | 'closed';

type FinishInputType = 'OUTPUT' | 'DEFECT';

interface ScanFailure {
  code: string;
  message: string;
}

/** 화면 표시용 자재 입력 내역 (전송용 payload 와 달리 이름/단위까지 들고 있음) */
interface MaterialSummary {
  itemCode: string;
  itemNm: string;
  unit: string;
  qty: number;
}

/** 이번 화면에서 방금 처리한 공정의 투입/산출 내역 (다음 재스캔 전까지 즉시 보여주기 위한 용도) */
interface LocalPerformance {
  inputs?: MaterialSummary[];
  outputs?: MaterialSummary[];
  defectQty?: number;
}

const STATUS_LABEL: Record<string, string> = {
  WAIT: '대기',
  PROGRESS: '진행중',
  DONE: '완료',
  DELAY: '지연',
};

const KEYPAD_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back'];

const getStartMaterials = (scan: WorkOrderPerformanceScanResponse): ItemOptionResponse[] =>
  scan.requiredMaterials ?? [];

const getFinishMaterials = (scan: WorkOrderPerformanceScanResponse): ItemOptionResponse[] =>
  scan.requiredMaterials ?? [];

/**
 * 서버가 내려주는 공정별 materials 를 투입(IN) / 산출(OUT) 로 나눠 화면 표시용으로 변환한다.
 * - 자재마다 단위(G, KG, L ...)가 달라서 공정 합계(inputQty/outputQty)에 작업지시 품목 단위를
 *   붙이면 단위가 틀어지므로, 자재별 이름·수량·단위 그대로 보여주기 위한 용도.
 */
const splitStepMaterials = (
  step: WorkOrderRoutingStepResponse,
): { ins: MaterialSummary[]; outs: MaterialSummary[] } => {
  const toSummary = (ioType: 'IN' | 'OUT'): MaterialSummary[] =>
    (step.materials ?? [])
      .filter((m) => m.ioType === ioType)
      .map(({ itemCode, itemNm, unit, qty }) => ({ itemCode, itemNm, unit, qty }));

  return { ins: toSummary('IN'), outs: toSummary('OUT') };
};

/** 키패드 입력을 문자열에 반영 (소수점 1개, 최대 10자리) */
const applyKeypad = (prev: string, key: string) => {
  if (key === 'back') return prev.slice(0, -1);
  if (key === '.' && prev.includes('.')) return prev;
  if (prev.length >= 10) return prev;
  return prev + key;
};

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

// 백엔드가 스캔 실패 시 성공 응답과 같은 "scan" 이벤트로 { status: "NG", code, message }를 흘려보냄
const isScanFailure = (data: unknown): data is ScanFailure =>
  !!data && typeof data === 'object' && (data as { status?: string }).status === 'NG';

// 설비 스캔 결과는 작업지시라인 스캔 결과와 같은 "scan" 이벤트로 오지만 action 필드로 구분된다
const isPerformanceScanResult = (data: unknown): data is WorkOrderPerformanceScanResponse =>
  !!data && typeof data === 'object' && 'action' in (data as object);

export function WorkOrderScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const zone = searchParams.get('zone') ?? '';

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [scanResult, setScanResult] = useState<WorkOrderLineScanResponse | null>(null);
  const [scanFailure, setScanFailure] = useState<ScanFailure | null>(null);

  // 설비 스캔으로 "공정 시작 가능"을 받은 상태 - 투입자재 수량을 입력받아 확정해야 실제로 기록됨
  const [pendingStart, setPendingStart] = useState<WorkOrderPerformanceScanResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // 설비 재스캔 후 공정 종료 실적(산출자재/불량)을 입력받기 위한 상태
  const [pendingFinish, setPendingFinish] = useState<WorkOrderPerformanceScanResponse | null>(null);

  const [materialQtys, setMaterialQtys] = useState<Record<string, string>>({});
  const [activeItemCode, setActiveItemCode] = useState('');

  const [finishInputType, setFinishInputType] = useState<FinishInputType>('OUTPUT');

  const [defectQty, setDefectQty] = useState('');
  const [selectedDefectCode, setSelectedDefectCode] = useState('');
  const [defectEntries, setDefectEntries] = useState<WorkOrderPerformanceDefectRequest[]>([]);
  const [finishError, setFinishError] = useState<string | null>(null);

  const [isDefectDropdownOpen, setIsDefectDropdownOpen] = useState(false);

  const [defectOptions, setDefectOptions] = useState<DefectOptionResponse[]>([]);
  const [isDefectOptionsLoading, setIsDefectOptionsLoading] = useState(true);
  const [defectOptionsError, setDefectOptionsError] = useState<string | null>(null);

  // 입력 중에 들어온 스캔을 무시했을 때 띄우는 경고 토스트 문구
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const shouldIgnoreScanRef = useRef(false);

  // 이번 화면에서 종료 처리된 공정 코드들 - 공정순서도에 완료 표시를 해주기 위한 용도
  const [completedOperCodes, setCompletedOperCodes] = useState<Set<string>>(new Set());
  const [completedBanner, setCompletedBanner] = useState<string | null>(null);

  // 방금 이 화면에서 시작 확정한 공정 - 다음 재스캔 전까지 "진행중" 표시를 즉시 보여주기 위한 용도
  const [startedOperCode, setStartedOperCode] = useState<string | null>(null);

  const [localPerformance, setLocalPerformance] = useState<Record<string, LocalPerformance>>({});

  // 공정 실적을 아코디언으로 펼쳐서 보고 있는 공정 코드들
  const [expandedOperCodes, setExpandedOperCodes] = useState<Set<string>>(new Set());

  /** 자재 입력 상태 초기화 */
  const resetMaterialInput = useCallback(() => {
    setMaterialQtys({});
    setActiveItemCode('');
  }, []);

  const resetStartForm = useCallback(() => {
    setPendingStart(null);
    setStartError(null);
    resetMaterialInput();
  }, [resetMaterialInput]);

  const resetFinishForm = useCallback(() => {
    setPendingFinish(null);
    setFinishInputType('OUTPUT');
    setDefectQty('');
    setSelectedDefectCode('');
    setDefectEntries([]);
    setFinishError(null);
    setIsDefectDropdownOpen(false);
    resetMaterialInput();
  }, [resetMaterialInput]);

  // 불량 옵션 조회
  const loadDefectOptions = useCallback(async (operCode: string) => {
    setIsDefectOptionsLoading(true);

    try {
      const res = await DefectApi.getOptions(operCode);
      setDefectOptions(res.data ?? []);
      setDefectOptionsError(null);
    } catch (err) {
      console.error('불량 유형 목록을 불러오지 못했습니다.', err);
      setDefectOptionsError('불량 유형을 불러오지 못했습니다.');
      setDefectOptions([]);
    } finally {
      setIsDefectOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    const operCode = pendingFinish?.operCode;

    if (!operCode) {
      setDefectOptions([]);
      return;
    }

    loadDefectOptions(operCode);
  }, [pendingFinish?.operCode, loadDefectOptions]);

  // defCode -> 불량명 (옵션에 없으면 코드 그대로 표시)
  const getDefectName = (defCode: string) =>
    defectOptions.find((option) => option.defCode === defCode)?.defNm ?? defCode;

  // 작업지시 스캔 화면 진입 시 SSE 연결, 이탈 시 반드시 연결 종료
  useEffect(() => {
    if (!isValidWorkZone(zone)) return;

    const eventSource = new EventSource(
      `${apiClient.defaults.baseURL}/work-orders/scan/stream?zone=${encodeURIComponent(zone)}`,
    );

    eventSource.onopen = () => setConnectionStatus('open');
    eventSource.onerror = () => setConnectionStatus('closed'); // 브라우저가 자동 재연결 시도, 성공하면 다시 onopen 발생

    eventSource.addEventListener('scan', (event: MessageEvent) => {
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error('스캔 데이터 파싱에 실패했습니다.', err);
        return;
      }

      if (isScanFailure(data)) {
        setScanFailure(data);
        return;
      }

      // (스캔 실패(NG) 배너는 폼을 건드리지 않으므로 위에서 그대로 처리됨)
      if (shouldIgnoreScanRef.current) {
        setScanNotice('입력 중인 내용이 있어 새 스캔을 무시했습니다. 취소 후 다시 스캔해 주세요.');
        return;
      }

      if (isPerformanceScanResult(data)) {
        // 이전에 잘못된 설비를 찍어서 빨간 오류 배너가 떠 있었더라도,
        // 이번 스캔이 성공했으니 바로 지운다
        setScanFailure(null);

        if (data.action === 'START_READY') {
          resetFinishForm();
          resetStartForm();
          setPendingStart(data);
          setActiveItemCode(getStartMaterials(data)[0]?.itemCode ?? '');
          return;
        }

        // FINISH_READY - 바로 종료하지 않고 산출자재/불량 입력 화면을 띄운다.
        if (data.action === 'FINISH_READY') {
          resetStartForm();
          resetFinishForm();
          setPendingFinish(data);
          setActiveItemCode(getFinishMaterials(data)[0]?.itemCode ?? '');
        }

        return;
      }

      // 작업지시 라인 스캔 결과
      // 새 라인이 스캔된 것이므로 이전 공정 진행 상태를 전부 초기화
      setScanFailure(null);
      setScanResult(data as WorkOrderLineScanResponse);

      resetStartForm();
      resetFinishForm();

      setCompletedOperCodes(new Set());
      setStartedOperCode(null);
      setLocalPerformance({});
      setExpandedOperCodes(new Set());
    });

    return () => {
      eventSource.close();
    };
  }, [zone, resetStartForm, resetFinishForm]);

  useEffect(() => {
    if (!scanFailure) return;
    const timer = setTimeout(() => setScanFailure(null), 5000);
    return () => clearTimeout(timer);
  }, [scanFailure]);

  useEffect(() => {
    if (!completedBanner) return;
    const timer = setTimeout(() => setCompletedBanner(null), 3000);
    return () => clearTimeout(timer);
  }, [completedBanner]);

  useEffect(() => {
    if (!scanNotice) return;
    const timer = setTimeout(() => setScanNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [scanNotice]);

  // 새 스캔을 무시해야 하는 상태를 ref에 최신으로 반영
  useEffect(() => {
    const hasMaterialInput = Object.values(materialQtys).some((v) => v !== '');
    const hasStartInput = pendingStart !== null && hasMaterialInput;
    const hasFinishInput =
      pendingFinish !== null && (hasMaterialInput || defectQty !== '' || defectEntries.length > 0);

    shouldIgnoreScanRef.current = isSubmitting || hasStartInput || hasFinishInput;
  }, [isSubmitting, pendingStart, pendingFinish, materialQtys, defectQty, defectEntries]);

  // 자재 키패드 - 시작(투입)/종료(산출) 공용. 현재 선택된 자재의 수량 문자열을 수정
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

  // 불량 수량 전용 키패드 (기존 handleFinishKeypadPress 에서 양품 분기 제거)
  const handleDefectKeypadPress = useCallback((key: string) => {
    setDefectQty((prev) => applyKeypad(prev, key));
  }, []);

  const buildMaterialPayload = (
    materials: ItemOptionResponse[],
    { requireAll }: { requireAll: boolean },
  ): { payload: WorkOrderPerformanceMaterialQtyRequest[]; summary: MaterialSummary[] } | null => {
    const rows = materials.map((m) => ({
      itemCode: m.itemCode,
      itemNm: m.itemNm,
      unit: m.unit,
      qty: Number(materialQtys[m.itemCode] || 0),
    }));

    if (rows.some((row) => Number.isNaN(row.qty) || row.qty < 0)) return null;
    if (requireAll && rows.some((row) => row.qty <= 0)) return null;

    const filled = rows.filter((row) => row.qty > 0);
    return {
      payload: filled.map(({ itemCode, qty }) => ({ itemCode, qty })),
      summary: filled,
    };
  };

  const handleAddDefect = () => {
    const qty = Number(defectQty);

    if (!selectedDefectCode) {
      setFinishError('불량 유형을 선택해 주세요.');
      return;
    }

    if (!defectQty || Number.isNaN(qty) || qty <= 0) {
      setFinishError('불량 수량을 입력해 주세요.');
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
    setFinishError(null);
  };

  const handleRemoveDefect = (defCode: string) => {
    setDefectEntries((prev) => prev.filter((entry) => entry.defCode !== defCode));

    if (selectedDefectCode === defCode) {
      setSelectedDefectCode('');
    }

    setFinishError(null);
  };

  const toggleExpandedOperCode = (operCode: string) => {
    setExpandedOperCodes((prev) => {
      const next = new Set(prev);
      if (next.has(operCode)) {
        next.delete(operCode);
      } else {
        next.add(operCode);
      }
      return next;
    });
  };

  const markStepFinished = useCallback((operCode: string, totalDefectQty: number) => {
    setScanResult((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        routingSteps: prev.routingSteps.map((step) =>
          step.operCode === operCode
            ? { ...step, done: true, inProgress: false, defectQty: totalDefectQty }
            : step,
        ),
      };
    });
  }, []);

  const handleConfirmStart = async () => {
    if (!pendingStart) return;

    const materials = getStartMaterials(pendingStart);
    const built = buildMaterialPayload(materials, { requireAll: true });

    if (!built) {
      setStartError('모든 투입자재의 수량을 올바르게 입력해 주세요.');
      return;
    }

    const summaryText = built.summary
      .map((m) => `${m.itemNm} ${m.qty.toLocaleString()}${m.unit}`)
      .join('\n');

    if (!window.confirm(`${pendingStart.operNm} 공정을 아래 투입자재로 시작하시겠습니까?\n\n${summaryText}`)) {
      return;
    }

    setIsSubmitting(true);
    setStartError(null);
    try {
      await WorkOrderApi.startPerformance({
        zone: Number(zone) as ZoneType,
        operCode: pendingStart.operCode,
        materials: built.payload,
      });

      setStartedOperCode(pendingStart.operCode);
      // 방금 입력한 투입자재를 화면에 즉시 표시 (재스캔 전까지)
      setLocalPerformance((prev) => ({
        ...prev,
        [pendingStart.operCode]: { ...prev[pendingStart.operCode], inputs: built.summary },
      }));
      resetStartForm();
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
      setStartError(message || '공정 시작 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmFinish = async () => {
    if (!pendingFinish) return;

    const materials = getFinishMaterials(pendingFinish);
    const built = buildMaterialPayload(materials, { requireAll: false });

    if (!built) {
      setFinishError('산출자재 수량을 올바르게 입력해 주세요.');
      return;
    }

    const totalDefectQty = defectEntries.reduce((sum, entry) => sum + entry.qty, 0);

    // 현재 불량 입력창에 값을 입력해놓고
    // "불량 내역 추가"를 누르지 않은 상태
    if (defectQty) {
      setFinishError('입력한 불량 수량을 불량 내역에 추가해 주세요.');
      return;
    }

    // 산출자재도 불량도 하나도 없으면 종료할 수 없음
    if (built.payload.length === 0 && defectEntries.length === 0) {
      setFinishError('산출자재 또는 불량 수량을 입력해 주세요.');
      return;
    }

    const outputText =
      built.summary.length > 0
        ? built.summary.map((m) => `${m.itemNm} ${m.qty.toLocaleString()}${m.unit}`).join('\n')
        : '없음';

    if (
      !window.confirm(
        `${pendingFinish.operNm} 공정을 종료하시겠습니까?\n\n` +
        `[산출자재]\n${outputText}\n\n` +
        `[불량] ${totalDefectQty.toLocaleString()} ${defectUnit}`,
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setFinishError(null);

    try {
      await WorkOrderApi.finishPerformance({
        zone: Number(zone) as ZoneType,
        operCode: pendingFinish.operCode,
        materials: built.payload,
        ...(defectEntries.length > 0
          ? {
            defects: defectEntries.map((entry) => ({
              defCode: entry.defCode,
              qty: entry.qty,
            })),
          }
          : {}),
      });

      // 서버 저장 성공 직후 현재 화면의 공정 상태도 같이 갱신한다.
      markStepFinished(pendingFinish.operCode, totalDefectQty);

      // 방금 입력한 산출자재를 화면에 즉시 표시 (재스캔 전까지)
      setLocalPerformance((prev) => ({
        ...prev,
        [pendingFinish.operCode]: {
          ...prev[pendingFinish.operCode],
          outputs: built.summary,
          defectQty: totalDefectQty,
        },
      }));

      // 기존 완료 상태도 유지
      setCompletedOperCodes((prev) => {
        const next = new Set(prev);
        next.add(pendingFinish.operCode);
        return next;
      });

      setStartedOperCode(null);
      setCompletedBanner(`${pendingFinish.operNm} 공정이 종료되었습니다.`);

      resetFinishForm();
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message : undefined;

      setFinishError(message || '공정 종료 처리에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusLabel =
    connectionStatus === 'open'
      ? '실시간 연결됨 · 스캔 대기 중'
      : connectionStatus === 'connecting'
        ? '연결 중'
        : '연결 끊김 · 재연결 시도 중';

  // 지금 진행 중인 공정이 있으면(시작O, 종료X) 그걸 종료하는 게 다음 행동이고,
  // 없으면 아직 시작 안 한 공정 중 제일 앞순서가 다음 행동 - "설비 바코드를 찍어야
  // 공정이 시작/종료된다"는 걸 화면만 봐서는 알기 어려워서 안내 배너와 타임라인 강조에 같이 쓴다.
  const inProgressStep = scanResult?.routingSteps.find((step) => {
    const done = step.done || completedOperCodes.has(step.operCode);
    return !done && (step.inProgress || startedOperCode === step.operCode);
  });
  const nextStep =
    scanResult && !inProgressStep
      ? scanResult.routingSteps.find((step) => !(step.done || completedOperCodes.has(step.operCode)))
      : undefined;

  // 안내 배너에 "무슨 설비를 찍어야 하는지"까지 구체적으로 알려주기 위한 설비명 목록 (없으면 null)
  const equipmentLabel = (step?: { equipments: { eqNm: string }[] }) =>
    step && step.equipments.length > 0 ? step.equipments.map((eq) => eq.eqNm).join(', ') : null;
  const nextStepEquipment = equipmentLabel(nextStep);
  const inProgressStepEquipment = equipmentLabel(inProgressStep);

  if (!isValidWorkZone(zone)) {
    return <Navigate to="/work" replace />;
  }

  const isFoodZone = zone === '1';
  const zoneLabel = isFoodZone ? '식품동' : '섬유동';
  const zoneVariant = isFoodZone ? 'food' : 'crop';

  // 폼에서 쓸 자재 목록 (pending 이 없으면 빈 배열)
  const startMaterials = pendingStart ? getStartMaterials(pendingStart) : [];
  const finishMaterials = pendingFinish ? getFinishMaterials(pendingFinish) : [];
  // 불량 단위는 전체 완제품 단위가 아니라 현재 공정의 산출자재 단위를 따른다.
  // 산출자재가 여러 개면 현재 선택된 자재를 우선하고, 선택값이 없으면 첫 산출자재를 사용한다.
  const defectUnit =
    finishMaterials.find((material) => material.itemCode === activeItemCode)?.unit ??
    finishMaterials[0]?.unit ??
    scanResult?.unit ??
    '';

  /** 자재 내역을 셀 안에 줄바꿈으로 나열 (투입량/양품량 칸 공용) */
  const renderMaterialLines = (list: MaterialSummary[]) =>
    list.map((m, idx) => (
      <span key={`${m.itemCode}-${idx}`} className="workOrderRoutingPerformanceLine">
        {m.itemNm} {m.qty.toLocaleString()} {m.unit}
      </span>
    ));

  const renderStepQtyCell = (list: MaterialSummary[], fallbackQty: number | null) => {
    if (list.length > 0) return renderMaterialLines(list);
    if (fallbackQty !== null) return fallbackQty.toLocaleString();
    return '-';
  };

  return (
    <div className="workTabletPage">
      <div className="workScanPanel">
        <div className={`workScanContainer workScanContainer--${zoneVariant}`}>
          <div className="workScanTopBar">
            <button
              type="button"
              className="workScanHomeBtn"
              onClick={() => navigate(`/work/home?zone=${encodeURIComponent(zone)}`)}
            >
              ← 돌아가기
            </button>
            <span className={`workScanStatus workScanStatus--${connectionStatus}`}>
              <span className="workScanStatusDot" />
              {statusLabel}
              {connectionStatus === 'connecting' && (
                <span className="workScanConnectingDots" aria-hidden="true">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              )}
            </span>
          </div>

          <div className="workScanMain">
            <div className="workTabletScanHeader">
              <span
                className={`workTabletScanZoneBadge workTabletScanZoneBadge--${zoneVariant}`}
              >
                <MapPinIcon aria-hidden="true" />
                {zoneLabel}
              </span>
              <ChevronRightIcon
                className="workTabletScanArrow"
                aria-hidden="true"
              />
              <span
                className={`workTabletScanProcessBadge workTabletScanProcessBadge--${zoneVariant}`}
              >
                작업지시
              </span>
            </div>
            {scanFailure && !scanResult ? (
              // 작업지시 라벨 자체를 아직 못 읽은 경우 - 보여줄 결과 화면이 없으니 전체 화면으로 안내
              <div className="workScanWaiting workScanFailure">
                <ExclamationTriangleIcon className="workScanWaitingIconSvg" />
                <h1>스캔한 라벨을 확인할 수 없습니다</h1>
                <p>{scanFailure.message}</p>
                <button
                  type="button"
                  className="workScanCancelBtn"
                  onClick={() => setScanFailure(null)}
                >
                  다시 스캔하기
                </button>
              </div>
            ) : !scanResult ? (
              <div className="workScanWaiting">
                <div className={`workScanTarget workScanTarget--${zoneVariant}`}>
                  <span className="workScanTargetCorner workScanTargetCorner--tl" />
                  <span className="workScanTargetCorner workScanTargetCorner--tr" />
                  <span className="workScanTargetCorner workScanTargetCorner--bl" />
                  <span className="workScanTargetCorner workScanTargetCorner--br" />
                  <span className="workScanTargetLine" />
                  <div className="workScanTargetLabel">
                    <ClipboardDocumentListIcon className="workScanWaitingIconSvg" />
                  </div>
                </div>
                <h1>스캔 대기 중</h1>
                <p>작업지시 라벨을 스캐너로 찍으면 이 화면에 자동으로 표시됩니다.</p>
              </div>
            ) : (
              <div className="workOrderResult">
                <div className="workOrderItemCard">
                  <div className="workOrderCardHead">
                    <span className="workOrderId">{scanResult.workId}</span>
                    <span className={`workOrderStatusChip workOrderStatusChip--${scanResult.status}`}>
                      {STATUS_LABEL[scanResult.status] ?? scanResult.status}
                    </span>
                  </div>
                  <h2>{scanResult.itemNm}</h2>
                  <div className="workScanInfoGrid">
                    <div className="workScanInfoItem">
                      <span>담당자</span>
                      <strong>{scanResult.managerNm ?? '미지정'}</strong>
                    </div>
                    <div className="workScanInfoItem">
                      <span>거래처</span>
                      <strong>{scanResult.bpNm ?? '-'}</strong>
                    </div>
                  </div>
                  <div className="workOrderQtyRow">
                    <span>지시수량</span>
                    <strong>
                      {scanResult.instructQty.toLocaleString()} {scanResult.unit}
                    </strong>
                  </div>
                </div>

                {scanFailure ? (
                  // 작업지시는 이미 정상 스캔된 상태라 화면을 통째로 날리지 않고,
                  // 다음 행동 안내 자리에 빨간 오류로만 짚어준다 (5초 뒤 자동으로 사라짐)
                  <div className="workOrderNextStepBanner workOrderNextStepBanner--error">
                    스캔한 라벨을 확인할 수 없습니다 — {scanFailure.message}
                  </div>
                ) : (
                  !pendingStart && !pendingFinish && (
                    <div
                      className={[
                        'workOrderNextStepBanner',
                        inProgressStep
                          ? 'workOrderNextStepBanner--inprogress'
                          : nextStep
                            ? 'workOrderNextStepBanner--next'
                            : 'workOrderNextStepBanner--complete',
                      ].join(' ')}
                    >
                      {/* 진행중/다음 상태는 "지금도 스캐너가 계속 듣고 있다"는 걸 대기 화면과
                        같은 뷰파인더 모양으로 보여준다 - 완료/오류 상태엔 의미가 없어 뺀다 */}
                      {(inProgressStep || nextStep) && (
                        <span className="workOrderNextStepBannerIcon">
                          <span className="workOrderNextStepBannerCorner workOrderNextStepBannerCorner--tl" />
                          <span className="workOrderNextStepBannerCorner workOrderNextStepBannerCorner--tr" />
                          <span className="workOrderNextStepBannerCorner workOrderNextStepBannerCorner--bl" />
                          <span className="workOrderNextStepBannerCorner workOrderNextStepBannerCorner--br" />
                          <span className="workOrderNextStepBannerScanLine" />
                        </span>
                      )}
                      <span>
                        {inProgressStep
                          ? `진행 중: ${inProgressStep.operNm} — 종료하려면 ${inProgressStepEquipment ? `${inProgressStepEquipment} ` : ''}바코드를 다시 스캔하세요`
                          : nextStep
                            ? `다음 공정: ${nextStep.operNm} — ${nextStepEquipment ? `${nextStepEquipment} ` : ''}바코드를 스캔해주세요`
                            : '모든 공정이 완료되었습니다'}
                      </span>
                    </div>
                  )
                )}

                <div className="workOrderRoutingSection">
                  <div className="workOrderRoutingLabel">공정순서도</div>
                  {scanResult.routingSteps.length === 0 ? (
                    <div className="workOrderRoutingEmpty">등록된 공정순서가 없습니다.</div>
                  ) : (
                    <div className="workOrderRoutingList">
                      {scanResult.routingSteps.map((step) => {
                        // done: 작업지시 라벨을 스캔한 시점의 DB 기준값(재스캔해도 유지됨)
                        // completedOperCodes: 지금 이 화면에서 방금 종료된 공정(다음 재스캔 전 즉시 반영용)
                        const isDone = step.done || completedOperCodes.has(step.operCode);
                        const isPending = pendingStart?.operCode === step.operCode;
                        // inProgress: 시작은 했는데 아직 종료(완료) 전인 상태 - done이면 더 이상 진행중이 아니므로 제외
                        const isInProgress = !isDone && (step.inProgress || startedOperCode === step.operCode);

                        const local = localPerformance[step.operCode];
                        const localInputs = local?.inputs ?? [];
                        const localOutputs = local?.outputs ?? [];
                        const displayDefectQty = step.defectQty ?? local?.defectQty ?? null;

                        // 서버 materials 를 투입(IN)/산출(OUT)로 분리.
                        // 서버 값이 있으면 그걸 우선 쓰고, 없으면(방금 이 화면에서 처리해 아직 재스캔 전)
                        // 로컬 입력값으로 대체한다.
                        const { ins: serverInputs, outs: serverOutputs } = splitStepMaterials(step);
                        const displayInputs = serverInputs.length > 0 ? serverInputs : localInputs;
                        const displayOutputs = serverOutputs.length > 0 ? serverOutputs : localOutputs;

                        // 불량량 단위 - 완제품 단위(scanResult.unit)가 아니라 이 공정 산출자재의 단위를 따른다.
                        // (예: 압출공정 산출이 G 이면 불량도 G). 산출자재 정보가 없을 때만 완제품 단위로 대체
                        const stepDefectUnit = displayOutputs[0]?.unit ?? scanResult.unit;

                        const hasPerformance =
                          displayInputs.length > 0 ||
                          displayOutputs.length > 0 ||
                          step.inputQty !== null ||
                          step.outputQty !== null ||
                          displayDefectQty !== null ||
                          step.yieldRate !== null;

                        const isExpanded = expandedOperCodes.has(step.operCode);
                        const isNext = !isPending && nextStep?.operCode === step.operCode;
                        return (
                          <div
                            key={step.operCode}
                            className={[
                              'workOrderRoutingStep',
                              step.finalYn === 'Y' ? 'workOrderRoutingStep--final' : '',
                              isDone ? 'workOrderRoutingStep--done' : '',
                              isInProgress ? 'workOrderRoutingStep--inprogress' : '',
                              isPending ? 'workOrderRoutingStep--pending' : '',
                              isNext ? 'workOrderRoutingStep--next' : '',
                            ].filter(Boolean).join(' ')}
                          >
                            <span className="workOrderRoutingMarker">{isDone ? '✓' : step.operSeq}</span>
                            <div className="workOrderRoutingInfo">
                              <div className="workOrderRoutingHead">
                                <div className="workOrderRoutingText">
                                  <div className="workOrderRoutingNameRow">
                                    <span className="workOrderRoutingOperNm">{step.operNm}</span>
                                    <span className="workOrderRoutingOperCode">
                                      ({step.operCode}
                                      {step.equipments.length > 0
                                        ? ` · ${step.equipments.map((eq) => eq.eqNm).join(', ')}`
                                        : ''}
                                      )
                                    </span>
                                  </div>
                                  {hasPerformance && isExpanded && (
                                    <div className="workOrderRoutingPerformance">
                                      {/* 투입량: IN 자재별 "자재명 수량 단위" 로 표시 */}
                                      <div className="workOrderRoutingPerformanceCell">
                                        <span className="workOrderRoutingPerformanceLabel">투입량</span>
                                        <strong className="workOrderRoutingPerformanceValue">
                                          {renderStepQtyCell(displayInputs, step.inputQty)}
                                        </strong>
                                      </div>

                                      {/* 양품량: OUT 자재별 "자재명 수량 단위" 로 표시 */}
                                      <div className="workOrderRoutingPerformanceCell">
                                        <span className="workOrderRoutingPerformanceLabel">양품량</span>
                                        <strong className="workOrderRoutingPerformanceValue">
                                          {renderStepQtyCell(displayOutputs, step.outputQty)}
                                        </strong>
                                      </div>

                                      {/* 불량량: 산출자재 단위 사용 (단위를 모르면 숫자만) */}
                                      <div className="workOrderRoutingPerformanceCell">
                                        <span className="workOrderRoutingPerformanceLabel">불량량</span>
                                        <strong className="workOrderRoutingPerformanceValue">
                                          {displayDefectQty !== null
                                            ? `${displayDefectQty.toLocaleString()} ${stepDefectUnit}`.trim()
                                            : '-'}
                                        </strong>
                                      </div>

                                      <div className="workOrderRoutingPerformanceCell">
                                        <span className="workOrderRoutingPerformanceLabel">양품률</span>
                                        <strong className="workOrderRoutingPerformanceValue workOrderRoutingPerformanceYield">
                                          {step.yieldRate !== null
                                            ? `${step.yieldRate.toLocaleString()}%`
                                            : '-'}
                                        </strong>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {(isInProgress || isNext || step.finalYn === 'Y') && (
                                  <div className="workOrderRoutingTags">
                                    {isInProgress && (
                                      <span className="workOrderRoutingProgressTag">진행중</span>
                                    )}
                                    {isNext && (
                                      <span className="workOrderRoutingNextTag">다음</span>
                                    )}
                                    {step.finalYn === 'Y' && (
                                      <span className="workOrderRoutingFinalTag">최종공정</span>
                                    )}
                                  </div>
                                )}
                                {hasPerformance && (
                                  <button
                                    type="button"
                                    className="workOrderRoutingChevronBtn"
                                    onClick={() => toggleExpandedOperCode(step.operCode)}
                                    aria-label={isExpanded ? '공정실적 접기' : '공정실적 펼치기'}
                                    aria-expanded={isExpanded}
                                  >
                                    <ChevronDownIcon
                                      className={[
                                        'workOrderRoutingChevron',
                                        isExpanded ? 'workOrderRoutingChevron--open' : '',
                                      ].filter(Boolean).join(' ')}
                                    />
                                  </button>
                                )}
                              </div>

                              {/* ───────── 공정 시작: 투입자재 수량 입력 ───────── */}
                              {isPending && (
                                <div className="workOrderPerformanceForm">
                                  <div className="workOrderPerformanceLabel">투입자재 수량 입력</div>

                                  <MaterialQtyInput
                                    materials={startMaterials}
                                    values={materialQtys}
                                    activeCode={activeItemCode}
                                    onSelect={setActiveItemCode}
                                    onKeyPress={handleMaterialKeyPress}
                                  />

                                  {startError && <div className="workScanErrorMsg">{startError}</div>}

                                  <div className="workScanActionRow">
                                    <button
                                      type="button"
                                      className="workScanCancelBtn"
                                      onClick={resetStartForm}
                                      disabled={isSubmitting}
                                    >
                                      취소
                                    </button>
                                    <button
                                      type="button"
                                      className="workScanSubmitBtn"
                                      onClick={handleConfirmStart}
                                      disabled={isSubmitting}
                                    >
                                      {isSubmitting ? '등록 중...' : '공정 시작'}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* ───────── 공정 종료: 산출자재 / 불량 입력 ───────── */}
                              {pendingFinish?.operCode === step.operCode && (
                                <div className="workOrderFinishForm">
                                  {/* 산출자재 / 불량 입력 선택 */}
                                  <div className="workOrderFinishTabs">
                                    <button
                                      type="button"
                                      className={finishInputType === 'OUTPUT' ? 'active' : ''}
                                      onClick={() => {
                                        setFinishInputType('OUTPUT');
                                        setIsDefectDropdownOpen(false);
                                        setFinishError(null);
                                      }}
                                    >
                                      산출자재 입력
                                    </button>

                                    <button
                                      type="button"
                                      className={finishInputType === 'DEFECT' ? 'active' : ''}
                                      onClick={() => {
                                        setFinishInputType('DEFECT');
                                        setFinishError(null);
                                      }}
                                    >
                                      불량 입력
                                    </button>
                                  </div>

                                  {/* 산출자재 탭: 자재별 수량 입력 (키패드 포함) */}
                                  {finishInputType === 'OUTPUT' && (
                                    <>
                                      <div className="workOrderFinishLabel">산출자재 수량</div>
                                      <MaterialQtyInput
                                        materials={finishMaterials}
                                        values={materialQtys}
                                        activeCode={activeItemCode}
                                        onSelect={setActiveItemCode}
                                        onKeyPress={handleMaterialKeyPress}
                                      />
                                    </>
                                  )}

                                  {/* 불량 입력을 선택했을 때만 불량 유형 선택 */}
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
                                              (defectOptionsError || defectOptions.length === 0) &&
                                              pendingFinish?.operCode
                                            ) {
                                              loadDefectOptions(pendingFinish.operCode);
                                            }
                                            setIsDefectDropdownOpen((prev) => !prev);
                                            setFinishError(null);
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
                                              // 실패/빈 목록일 때 새로고침 없이 다시 불러올 수 있게 버튼 추가
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
                                                    onClick={() => {
                                                      if (pendingFinish?.operCode) {
                                                        loadDefectOptions(pendingFinish.operCode);
                                                      }
                                                    }}
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
                                                    setFinishError(null);
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

                                  {/* 불량 탭: 불량 수량 표시 + 키패드 + 추가 버튼 (산출자재 탭에서는 숨김) */}
                                  {finishInputType === 'DEFECT' && (
                                    <>
                                      <div className="workOrderFinishLabel">불량 수량</div>

                                      <div className="workScanQtyDisplay">
                                        {defectQty || '0'}
                                        <span>{defectUnit}</span>
                                      </div>

                                      <NumericKeypad onPress={handleDefectKeypadPress} />

                                      <button
                                        type="button"
                                        className="workOrderAddDefectBtn"
                                        onClick={handleAddDefect}
                                      >
                                        불량 내역 추가
                                      </button>
                                    </>
                                  )}

                                  {/* 현재까지 입력된 산출자재 / 불량 내역 요약 */}
                                  <div className="workOrderDefectSummary">
                                    {/* 산출량(양품) 1줄 → 산출자재별 N줄 */}
                                    {finishMaterials.map((m) => (
                                      <div key={m.itemCode} className="workOrderDefectSummaryRow">
                                        <span>산출 · {m.itemNm}</span>
                                        <strong>
                                          {Number(materialQtys[m.itemCode] || 0).toLocaleString()} {m.unit}
                                        </strong>
                                      </div>
                                    ))}

                                    <div className="workOrderDefectSummaryHead">
                                      <span>불량 내역</span>

                                      {defectEntries.length > 0 && (
                                        <strong>{defectEntries.length}건</strong>
                                      )}
                                    </div>

                                    {defectEntries.length === 0 ? (
                                      <div className="workOrderDefectEmpty">
                                        등록된 불량 내역이 없습니다.
                                      </div>
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

                                  {/* 에러 */}
                                  {finishError && (
                                    <div className="workScanErrorMsg">{finishError}</div>
                                  )}

                                  {/* 취소 / 종료 */}
                                  <div className="workScanActionRow">
                                    <button
                                      type="button"
                                      className="workScanCancelBtn"
                                      onClick={resetFinishForm}
                                      disabled={isSubmitting}
                                    >
                                      취소
                                    </button>

                                    <button
                                      type="button"
                                      className="workScanSubmitBtn"
                                      onClick={handleConfirmFinish}
                                      disabled={isSubmitting}
                                    >
                                      {isSubmitting ? '등록 중...' : '공정 종료'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {completedBanner && <div className="workScanSuccessToast">{completedBanner}</div>}

          {scanNotice && !completedBanner && <div className="workOrderWarnToast">{scanNotice}</div>}
        </div>
      </div>
    </div>
  );
}
