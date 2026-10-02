import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { apiClient } from '@/api/apiClient';
import { WorkOrderApi } from '@/api/WorkOrder';
import type { WorkOrderLineScanResponse, WorkOrderPerformanceDefectRequest, WorkOrderPerformanceScanResponse, ZoneType } from '@/api/WorkOrder';
import { DefectApi, type DefectOptionResponse } from '@/api/master/Defect';
import { isValidWorkZone } from '@/utils/common';
import '@/pages/work/WorkTabletHome.css';
import '@/pages/work/WorkSeedReportScanPage.css';
import '@/pages/work/WorkOrderScanPage.css';

type ConnectionStatus = 'connecting' | 'open' | 'closed';
type FinishInputType = 'GOOD' | 'DEFECT';

interface ScanFailure {
  code: string;
  message: string;
}

const STATUS_LABEL: Record<string, string> = {
  WAIT: '대기',
  PROGRESS: '진행중',
  DONE: '완료',
  DELAY: '지연',
};

const KEYPAD_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back'];

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

  // 설비 스캔으로 "공정 시작 가능"을 받은 상태 - 투입수량을 입력받아 확정해야 실제로 기록됨
  const [pendingStart, setPendingStart] = useState<WorkOrderPerformanceScanResponse | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // 설비 재스캔 후 공정 종료 실적을 입력받기 위한 상태
  const [pendingFinish, setPendingFinish] = useState<WorkOrderPerformanceScanResponse | null>(null);

  const [finishInputType, setFinishInputType] = useState<FinishInputType>('GOOD');
  const [goodQty, setGoodQty] = useState('');
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

  // 방금 이 화면에서 시작 확정한 공정과 그때 입력한 투입수량 - 다음 재스캔 전까지 "진행중" 표시와
  // 투입수량을 즉시 보여주기 위한 용도 (재스캔하면 서버가 내려주는 step.inProgress/inputQty가
  // DB 기준으로 대신 알려줌)
  const [startedOperCode, setStartedOperCode] = useState<string | null>(null);
  const [startedInputQty, setStartedInputQty] = useState<number | null>(null);

  // 투입수량을 아코디언으로 펼쳐서 보고 있는 공정 코드들
  const [expandedOperCodes, setExpandedOperCodes] = useState<Set<string>>(new Set());

  const resetStartForm = useCallback(() => {
    setPendingStart(null);
    setQtyInput('');
    setStartError(null);
  }, []);

  const resetFinishForm = useCallback(() => {
    setPendingFinish(null);
    setFinishInputType('GOOD');
    setGoodQty('');
    setDefectQty('');
    setSelectedDefectCode('');
    setDefectEntries([]);
    setFinishError(null);
    setIsDefectDropdownOpen(false);
  }, []);

  // 불량 옵션 조회
  const loadDefectOptions = useCallback(async () => {
    setIsDefectOptionsLoading(true);
    try {
      const res = await DefectApi.getOptions();
      setDefectOptions(res.data ?? []);
      setDefectOptionsError(null);
    } catch (err) {
      console.error('불량 유형 목록을 불러오지 못했습니다.', err);
      setDefectOptionsError('불량 유형을 불러오지 못했습니다.');
    } finally {
      setIsDefectOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDefectOptions();
  }, [loadDefectOptions]);

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
          return;
        }

        // FINISH_READY - 바로 종료하지 않고 양품/불량 입력 화면을 띄운다.
        if (data.action === 'FINISH_READY') {
          resetStartForm();
          resetFinishForm();
          setPendingFinish(data);
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
      setStartedInputQty(null);
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
    const hasStartInput = pendingStart !== null && qtyInput !== '';
    const hasFinishInput =
      pendingFinish !== null && (goodQty !== '' || defectQty !== '' || defectEntries.length > 0);

    shouldIgnoreScanRef.current = isSubmitting || hasStartInput || hasFinishInput;
  }, [isSubmitting, pendingStart, qtyInput, pendingFinish, goodQty, defectQty, defectEntries]);

  const handleKeypadPress = useCallback((key: string) => {
    if (key === 'back') {
      setQtyInput((prev) => prev.slice(0, -1));
      return;
    }
    setQtyInput((prev) => {
      if (key === '.' && prev.includes('.')) return prev;
      if (prev.length >= 10) return prev;
      return prev + key;
    });
  }, []);

  const handleFinishKeypadPress = useCallback(
    (key: string) => {
      const setter = finishInputType === 'GOOD' ? setGoodQty : setDefectQty;

      if (key === 'back') {
        setter((prev) => prev.slice(0, -1));
        return;
      }

      setter((prev) => {
        if (key === '.' && prev.includes('.')) return prev;
        if (prev.length >= 10) return prev;
        return prev + key;
      });
    },
    [finishInputType],
  );

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

  const updateFinishedStepPerformance = useCallback(
    ({
      operCode,
      inputQty,
      outputQty,
      defectQty,
      yieldRate,
    }: {
      operCode: string;
      inputQty: number | null;
      outputQty: number;
      defectQty: number;
      yieldRate: number;
    }) => {
      setScanResult((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          routingSteps: prev.routingSteps.map((step) =>
            step.operCode === operCode
              ? {
                ...step,
                done: true,
                inProgress: false,
                inputQty,
                outputQty,
                defectQty,
                yieldRate,
              }
              : step,
          ),
        };
      });
    },
    [],
  );

  const handleConfirmStart = async () => {
    if (!pendingStart) return;

    const qty = Number(qtyInput);
    if (!qtyInput || Number.isNaN(qty) || qty <= 0) {
      setStartError('투입수량을 올바르게 입력해 주세요.');
      return;
    }

    const unit = scanResult?.unit ?? '';
    if (!window.confirm(`${pendingStart.operNm} 공정을 투입수량 ${qty.toLocaleString()}${unit}으로 시작하시겠습니까?`)) {
      return;
    }

    setIsSubmitting(true);
    setStartError(null);
    try {
      await WorkOrderApi.startPerformance({ zone: Number(zone) as ZoneType, operCode: pendingStart.operCode, qty });
      setStartedOperCode(pendingStart.operCode);
      setStartedInputQty(qty);
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

    const good = Number(goodQty || 0);
    const totalDefectQty = defectEntries.reduce((sum, entry) => sum + entry.qty, 0);
    const totalQty = good + totalDefectQty;

    if (Number.isNaN(good) || good < 0) {
      setFinishError('양품 수량을 올바르게 입력해 주세요.');
      return;
    }

    // 현재 불량 입력창에 값을 입력해놓고
    // "불량 내역 추가"를 누르지 않은 상태
    if (defectQty) {
      setFinishError('입력한 불량 수량을 불량 내역에 추가해 주세요.');
      return;
    }

    if (totalQty <= 0) {
      setFinishError('양품 또는 불량 수량을 입력해 주세요.');
      return;
    }

    if (scanResult && totalQty > scanResult.instructQty) {
      setFinishError(
        `생산수량은 지시수량 ${scanResult.instructQty.toLocaleString()} ${scanResult.unit}을 초과할 수 없습니다.`,
      );
      return;
    }

    if (
      !window.confirm(
        `${pendingFinish.operNm} 공정을 종료하시겠습니까?\n\n` +
        `양품 ${good.toLocaleString()} ${scanResult?.unit ?? ''}\n` +
        `불량 ${totalDefectQty.toLocaleString()} ${scanResult?.unit ?? ''}`,
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
        qty: good,
        ...(defectEntries.length > 0
          ? {
            defects: defectEntries.map((entry) => ({
              defCode: entry.defCode,
              qty: entry.qty,
            })),
          }
          : {}),
      });

      // ------------------------------------------------------------
      // 중요:
      // 서버 저장 성공 직후 현재 화면의 routingSteps도 같이 갱신한다.
      // 그렇지 않으면 서버에는 양품/불량이 저장됐는데
      // 현재 scanResult는 이전 값을 계속 가지고 있게 된다.
      // ------------------------------------------------------------

      const currentStep = scanResult?.routingSteps.find(
        (step) => step.operCode === pendingFinish.operCode,
      );

      const inputQty =
        currentStep?.inputQty ??
        (startedOperCode === pendingFinish.operCode ? startedInputQty : null);

      const yieldRate =
        inputQty !== null && inputQty > 0
          ? Number(((good / inputQty) * 100).toFixed(2))
          : 0;

      updateFinishedStepPerformance({
        operCode: pendingFinish.operCode,
        inputQty,
        outputQty: good,
        defectQty: totalDefectQty,
        yieldRate,
      });

      // 기존 완료 상태도 유지
      setCompletedOperCodes((prev) => {
        const next = new Set(prev);
        next.add(pendingFinish.operCode);
        return next;
      });

      setStartedOperCode(null);
      setStartedInputQty(null);

      setCompletedBanner(`${pendingFinish.operNm} 공정이 종료되었습니다.`);

      resetFinishForm();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message
        : undefined;

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
  const zoneLabel = isFoodZone ? '식품동' : '작물동';
  const zoneVariant = isFoodZone ? 'food' : 'crop';

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
              <span className="workTabletZone">
                <MapPinIcon aria-hidden="true" />
                {zoneLabel}
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
                    <strong>작업지시</strong>
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
                        // 투입수량: 재스캔 후엔 서버가 DB 기준으로 내려주지만, 방금 이 화면에서 시작한
                        // 공정은 아직 재스캔 전이라 서버 값이 없어 직전에 입력한 값을 그대로 보여준다
                        const displayInputQty =
                          step.inputQty ?? (startedOperCode === step.operCode ? startedInputQty : null);

                        const hasPerformance =
                          displayInputQty !== null ||
                          step.outputQty !== null ||
                          step.defectQty !== null ||
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
                                      <div className="workOrderRoutingPerformanceCell">
                                        <span className="workOrderRoutingPerformanceLabel">투입량</span>
                                        <strong className="workOrderRoutingPerformanceValue">
                                          {displayInputQty !== null
                                            ? `${displayInputQty.toLocaleString()} ${scanResult.unit}`
                                            : '-'}
                                        </strong>
                                      </div>

                                      <div className="workOrderRoutingPerformanceCell">
                                        <span className="workOrderRoutingPerformanceLabel">양품량</span>
                                        <strong className="workOrderRoutingPerformanceValue">
                                          {step.outputQty !== null
                                            ? `${step.outputQty.toLocaleString()} ${scanResult.unit}`
                                            : '-'}
                                        </strong>
                                      </div>

                                      <div className="workOrderRoutingPerformanceCell">
                                        <span className="workOrderRoutingPerformanceLabel">불량량</span>
                                        <strong className="workOrderRoutingPerformanceValue">
                                          {step.defectQty !== null
                                            ? `${step.defectQty.toLocaleString()} ${scanResult.unit}`
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

                              {isPending && (
                                <div className="workOrderPerformanceForm">
                                  <div className="workOrderPerformanceLabel">투입수량 입력</div>
                                  <div className="workScanQtyDisplay">
                                    {qtyInput || '0'} <span>{scanResult.unit}</span>
                                  </div>

                                  <NumericKeypad onPress={handleKeypadPress} />

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
                              {pendingFinish?.operCode === step.operCode && (
                                <div className="workOrderFinishForm">
                                  {/* 양품 / 불량 입력 선택 */}
                                  <div className="workOrderFinishTabs">
                                    <button
                                      type="button"
                                      className={finishInputType === 'GOOD' ? 'active' : ''}
                                      onClick={() => {
                                        setFinishInputType('GOOD');
                                        setIsDefectDropdownOpen(false);
                                        setFinishError(null);
                                      }}
                                    >
                                      양품 입력
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

                                  {/* 불량 입력을 선택했을 때만 불량 유형 선택 */}
                                  {finishInputType === 'DEFECT' && (
                                    <div className="workOrderDefectSelector">
                                      <div className="workOrderFinishLabel">불량 유형</div>

                                      <div className="workOrderDefectDropdown">
                                        <button
                                          type="button"
                                          className={`workOrderDefectDropdownTrigger ${isDefectDropdownOpen ? 'isOpen' : ''}`}
                                          onClick={() => {
                                            if (!isDefectDropdownOpen && !isDefectOptionsLoading && (defectOptionsError || defectOptions.length === 0)) {
                                              loadDefectOptions();
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
                                            className={`workOrderDefectDropdownIcon ${isDefectDropdownOpen ? 'isOpen' : ''
                                              }`}
                                          />
                                        </button>

                                        {isDefectDropdownOpen && (
                                          <div className="workOrderDefectDropdownMenu">
                                            {defectOptionsError || defectOptions.length === 0 ? (
                                              // [변경] 실패/빈 목록일 때 새로고침 없이 다시 불러올 수 있게 버튼 추가
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

                                  {/* 현재 입력 중인 수량 */}
                                  <div className="workOrderFinishLabel">
                                    {finishInputType === 'GOOD' ? '산출량 (양품)' : '불량 수량'}
                                  </div>

                                  <div className="workScanQtyDisplay">
                                    {(finishInputType === 'GOOD' ? goodQty : defectQty) || '0'}
                                    <span>{scanResult.unit}</span>
                                  </div>

                                  {/* 숫자 키패드 */}
                                  <NumericKeypad onPress={handleFinishKeypadPress} />

                                  {/* 불량 내역 추가 */}
                                  {finishInputType === 'DEFECT' && (
                                    <button
                                      type="button"
                                      className="workOrderAddDefectBtn"
                                      onClick={handleAddDefect}
                                    >
                                      불량 내역 추가
                                    </button>
                                  )}

                                  {/* 현재까지 입력된 불량 내역 */}
                                  <div className="workOrderDefectSummary">
                                    <div className="workOrderDefectSummaryRow">
                                      <span>산출량(양품)</span>
                                      <strong>
                                        {Number(goodQty || 0).toLocaleString()} {scanResult.unit}
                                      </strong>
                                    </div>

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
                                                · {entry.qty.toLocaleString()} {scanResult.unit}
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