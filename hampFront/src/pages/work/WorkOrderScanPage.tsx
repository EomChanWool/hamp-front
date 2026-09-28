import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { apiClient } from '@/api/apiClient';
import { WorkOrderApi } from '@/api/WorkOrder';
import type { WorkOrderLineScanResponse, WorkOrderPerformanceScanResponse } from '@/api/WorkOrder';
import '@/pages/work/WorkTabletHome.css';
import '@/pages/work/WorkSeedReportScanPage.css';
import '@/pages/work/WorkOrderScanPage.css';

type ConnectionStatus = 'connecting' | 'open' | 'closed';

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

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [scanResult, setScanResult] = useState<WorkOrderLineScanResponse | null>(null);
  const [scanFailure, setScanFailure] = useState<ScanFailure | null>(null);

  // 설비 스캔으로 "공정 시작 가능"을 받은 상태 - 투입수량을 입력받아 확정해야 실제로 기록됨
  const [pendingStart, setPendingStart] = useState<WorkOrderPerformanceScanResponse | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

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

  // 작업지시 스캔 화면 진입 시 SSE 연결, 이탈 시 반드시 연결 종료
  useEffect(() => {
    const eventSource = new EventSource(
      `${apiClient.defaults.baseURL}/work-orders/scan/stream`,
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

      if (isPerformanceScanResult(data)) {
        // 이전에 잘못된 설비를 찍어서 빨간 오류 배너가 떠 있었더라도, 이번 스캔이 성공했으니 바로 지운다
        setScanFailure(null);

        if (data.action === 'START_READY') {
          setPendingStart(data);
          setQtyInput('');
          setStartError(null);
          return;
        }

        // FINISH_READY - 아직 아무것도 기록 안 된 상태라, 정말 종료할지 확인받고 나서야
        // performance/finish를 호출해 실제로 기록한다
        if (window.confirm(`${data.operNm} 공정을 종료하시겠습니까?`)) {
          WorkOrderApi.finishPerformance({ operCode: data.operCode })
            .then(() => {
              setCompletedOperCodes((prev) => new Set(prev).add(data.operCode));
              setStartedOperCode(null);
              setStartedInputQty(null);
              setCompletedBanner(`${data.operNm} 공정이 종료되었습니다.`);
            })
            .catch((err) => {
              const message = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
              alert(message || '공정 종료 처리에 실패했습니다.');
            });
        }
        return;
      }

      // 작업지시 라인 스캔 결과 - 새 라인이 스캔된 것이므로 이전 공정 진행 상태를 전부 초기화
      setScanFailure(null);
      setScanResult(data as WorkOrderLineScanResponse);
      setPendingStart(null);
      setCompletedOperCodes(new Set());
      setStartedOperCode(null);
      setStartedInputQty(null);
      setExpandedOperCodes(new Set());
    });

    return () => {
      eventSource.close();
    };
  }, []);

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

  const handleCancelStart = () => {
    setPendingStart(null);
    setQtyInput('');
    setStartError(null);
  };

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
      await WorkOrderApi.startPerformance({ operCode: pendingStart.operCode, qty });
      setStartedOperCode(pendingStart.operCode);
      setStartedInputQty(qty);
      setPendingStart(null);
      setQtyInput('');
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
      setStartError(message || '공정 시작 등록에 실패했습니다.');
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

  return (
    <div className="workTabletPage">
      <div className="workScanPanel">
        <div className="workScanContainer">
          <div className="workScanTopBar">
            <button type="button" className="workScanHomeBtn" onClick={() => navigate('/work')}>
              ← 홈으로
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
              <div className="workScanTarget">
                <span className="workScanTargetCorner workScanTargetCorner--tl" />
                <span className="workScanTargetCorner workScanTargetCorner--tr" />
                <span className="workScanTargetCorner workScanTargetCorner--bl" />
                <span className="workScanTargetCorner workScanTargetCorner--br" />
                <span className="workScanTargetLine" />
                <ClipboardDocumentListIcon className="workScanWaitingIconSvg" />
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
                !pendingStart && (
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
                          ? `다음 공정: ${nextStep.operNm} — ${nextStepEquipment ? `${nextStepEquipment} ` : ''} 바코드를 스캔해주세요`
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
                      const hasInputQty = displayInputQty !== null;
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
                                {hasInputQty && isExpanded && (
                                  <div
                                    className={[
                                      'workOrderRoutingInputQty',
                                      isInProgress ? 'workOrderRoutingInputQty--active' : '',
                                    ].filter(Boolean).join(' ')}
                                  >
                                    투입 {displayInputQty.toLocaleString()} {scanResult.unit}
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
                              {hasInputQty && (
                                <button
                                  type="button"
                                  className="workOrderRoutingChevronBtn"
                                  onClick={() => toggleExpandedOperCode(step.operCode)}
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
                                    onClick={handleCancelStart}
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
        </div>
      </div>
    </div>
  );
}
