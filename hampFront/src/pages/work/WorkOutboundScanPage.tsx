import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  ChevronRightIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  TruckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '@/api/apiClient';
import {
  SHIPMENT_STATUS_LABEL,
  ShipmentOrderApi,
  type ShipmentLotScanResponse,
  type ShipmentOrderLineResponse,
  type ShipmentOrderResponse,
  type ShipmentOrderStatus,
  type ShipmentScanFailure,
} from '@/api/ShipmentOrder';
import { isValidWorkZone } from '@/utils/common';
import '@/pages/work/WorkTabletHome.css';
import '@/pages/work/WorkSeedReportScanPage.css';
import '@/pages/work/WorkOutboundScanPage.css';

type ConnectionStatus = 'connecting' | 'open' | 'closed';

// 백엔드가 스캔 실패 시 성공 응답과 같은 "scan" 이벤트로 { status: "NG", code, message }를 흘려보냄
const isScanFailure = (data: unknown): data is ShipmentScanFailure =>
  !!data && typeof data === 'object' && (data as { status?: string }).status === 'NG';

// SSE 성공 응답은 래퍼 없이 객체 자체로 내려오지만, REST와 같은 { data } 래퍼가 와도 꺼내서 쓴다
const unwrapPayload = (payload: unknown): object | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  return data && typeof data === 'object' ? data : payload;
};

// 같은 "scan" 이벤트로 출고지시서(OUT-)와 LOT 스캔 결과가 모두 오므로 형태로 구분한다
const parseShipmentOrder = (payload: unknown): ShipmentOrderResponse | null => {
  const order = unwrapPayload(payload) as Partial<ShipmentOrderResponse> | null;
  if (!order || typeof order.shipId !== 'string' || !Array.isArray(order.lines)) return null;
  return order as ShipmentOrderResponse;
};

const parseLotScan = (payload: unknown): ShipmentLotScanResponse | null => {
  const lot = unwrapPayload(payload) as Partial<ShipmentLotScanResponse> | null;
  if (!lot || typeof lot.lotCode !== 'string' || typeof lot.shipOrderLineId !== 'number') return null;
  return lot as ShipmentLotScanResponse;
};

// 소수 수량 합산 시 부동소수점 오차 정리
const roundQty = (qty: number) => Math.round(qty * 1000) / 1000;

const toQty = (value: unknown) => Math.max(0, Number(value) || 0);

const getConfirmedQty = (line: ShipmentOrderLineResponse) => toQty(line.scannedQty);

const getRemainingQty = (line: ShipmentOrderLineResponse) =>
  toQty(line.remainingQty ?? toQty(line.instructQty) - getConfirmedQty(line));

const getPendingQtyByLine = (lots: ShipmentLotScanResponse[]) => {
  const totals = new Map<number, number>();
  lots.forEach((lot) => {
    totals.set(lot.shipOrderLineId, roundQty((totals.get(lot.shipOrderLineId) ?? 0) + toQty(lot.qty)));
  });
  return totals;
};

// 서버 기준 잔여수량에 맞춰 등록 대기 LOT를 다시 거른다 (넘치거나 없는 라인의 LOT는 dropped)
const fitPendingToOrder = (order: ShipmentOrderResponse, pending: ShipmentLotScanResponse[]) => {
  const registered = new Set(order.lines.flatMap((line) => line.lots.map((lot) => lot.lotCode)));
  const remainingByLine = new Map(order.lines.map((line) => [line.shipOrderLineId, getRemainingQty(line)]));
  const kept: ShipmentLotScanResponse[] = [];
  const dropped: ShipmentLotScanResponse[] = [];

  pending.forEach((lot) => {
    if (registered.has(lot.lotCode)) return;
    const remainingQty = remainingByLine.get(lot.shipOrderLineId);
    if (remainingQty === undefined || toQty(lot.qty) > remainingQty) {
      dropped.push(lot);
      return;
    }
    remainingByLine.set(lot.shipOrderLineId, roundQty(remainingQty - toQty(lot.qty)));
    kept.push(lot);
  });

  return { kept, dropped };
};

const getDroppedMessage = (dropped: ShipmentLotScanResponse[]) =>
  `잔여 지시수량이 바뀌어 LOT ${dropped.length}건을 등록 대기에서 뺐습니다: ${dropped.map((lot) => lot.lotCode).join(', ')}`;

// 상태별 "다음 행동" 안내 문구 - 작업지시 화면의 안내 배너와 같은 역할
const getBannerInfo = (status: string): { variant: string; text: string } => {
  switch (status as ShipmentOrderStatus) {
    case 'DONE':
      return { variant: 'done', text: '출고가 완료된 출고지시서입니다' };
    case 'PROGRESS':
      return { variant: 'progress', text: '출고 진행 중입니다 — 남은 품목의 LOT 라벨을 스캔해 주세요' };
    case 'DELAY':
      return { variant: 'delay', text: '출고가 지연되고 있습니다 — 담당자에게 확인해 주세요' };
    case 'WAIT':
    default:
      return { variant: 'wait', text: '출고 대기 중입니다 — 출고할 LOT 라벨을 스캔해 주세요' };
  }
};

export function WorkOutboundScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const zone = searchParams.get('zone') ?? '';

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [shipmentOrder, setShipmentOrder] = useState<ShipmentOrderResponse | null>(null);
  // 스캔만으로는 서버에 저장되지 않으므로, 등록 전까지 스캔한 LOT는 화면에서 누적 관리한다
  const [pendingLots, setPendingLots] = useState<ShipmentLotScanResponse[]>([]);
  const [scanFailure, setScanFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 연속 스캔 시 화면 갱신 전 상태로 검증하지 않도록 최신 값을 ref로 유지
  const latestRef = useRef({ order: shipmentOrder, pending: pendingLots });
  const submittingLotCodesRef = useRef<string[]>([]);

  const applyOrder = (order: ShipmentOrderResponse) => {
    latestRef.current = { ...latestRef.current, order };
    setShipmentOrder(order);
  };

  const applyPending = (pending: ShipmentLotScanResponse[]) => {
    latestRef.current = { ...latestRef.current, pending };
    setPendingLots(pending);
  };

  const pendingQtyByLine = useMemo(() => getPendingQtyByLine(pendingLots), [pendingLots]);

  const handleScan = (payload: unknown) => {
    // 서버가 내려준 실패 사유(NG)를 그대로 보여준다
    if (isScanFailure(payload)) {
      setScanFailure(payload.message);
      return;
    }

    const { order: currentOrder, pending } = latestRef.current;

    const order = parseShipmentOrder(payload);
    if (order) {
      // 서버는 마지막으로 스캔한 출고지시서 기준으로 LOT를 검증하므로, 다른 지시서로 바뀌면 이전 스캔분은 등록할 수 없다
      if (currentOrder && order.shipId !== currentOrder.shipId && pending.length > 0) {
        // 등록 요청 중인 LOT는 취소 안내에서 제외
        const cancelledCount = pending.filter((lot) => !submittingLotCodesRef.current.includes(lot.lotCode)).length;
        if (cancelledCount > 0) {
          setNotice(`${currentOrder.shipId}에서 등록하지 않은 LOT ${cancelledCount}건은 취소되었습니다.`);
        }
        applyPending([]);
      } else if (currentOrder?.shipId === order.shipId) {
        // 같은 지시서 재스캔 시 바뀐 잔여수량으로 대기 LOT 재검증
        const { kept, dropped } = fitPendingToOrder(order, pending);
        applyPending(kept);
        if (dropped.length > 0) setNotice(getDroppedMessage(dropped));
      }

      // WAIT도 정상적인 출고 업무 상태이므로 실패로 처리하지 않는다
      applyOrder(order);
      setScanFailure(null);
      setSubmitError(null);
      return;
    }

    const lot = parseLotScan(payload);
    if (!lot) {
      console.error('출고 스캔 데이터 형식이 올바르지 않습니다.', payload);
      setScanFailure('스캔 결과를 확인할 수 없습니다.');
      return;
    }

    if (!currentOrder) {
      setScanFailure('먼저 출고지시서 라벨을 스캔해 주세요.');
      return;
    }

    const line = currentOrder.lines.find((item) => item.shipOrderLineId === lot.shipOrderLineId);
    if (!line) {
      setScanFailure(`현재 출고지시서에 없는 품목의 LOT입니다: ${lot.lotCode}`);
      return;
    }

    const isRegistered = currentOrder.lines.some((item) => item.lots.some((registered) => registered.lotCode === lot.lotCode));
    if (isRegistered || pending.some((item) => item.lotCode === lot.lotCode)) {
      setScanFailure(`이미 스캔한 LOT입니다: ${lot.lotCode}`);
      return;
    }

    // 등록은 LOT 단위로만 되므로(부분 출고 불가) LOT 수량이 남은 지시수량을 넘으면 담지 않는다
    const remainingQty = roundQty(getRemainingQty(line) - (getPendingQtyByLine(pending).get(line.shipOrderLineId) ?? 0));
    if (toQty(lot.qty) > remainingQty) {
      setScanFailure(
        `잔여 지시수량(${remainingQty.toLocaleString()}${line.unit})을 초과하는 LOT입니다: ` +
        `${lot.lotCode} (${toQty(lot.qty).toLocaleString()}${lot.unit})`,
      );
      return;
    }

    applyPending([...pending, lot]);
    setScanFailure(null);
    setSubmitError(null);
  };

  // SSE 구독은 한 번만 열고 이벤트는 최신 핸들러로 넘긴다
  const handleScanRef = useRef(handleScan);
  useEffect(() => {
    handleScanRef.current = handleScan;
  });

  // 출고처리 화면 진입 시 SSE 연결, 이탈 시 반드시 연결 종료
  useEffect(() => {
    if (!isValidWorkZone(zone)) return;

    const eventSource = new EventSource(
      `${apiClient.defaults.baseURL}/shipment-orders/scan/stream?zone=${encodeURIComponent(zone)}`,
    );

    eventSource.onopen = () => setConnectionStatus('open');
    eventSource.onerror = () => setConnectionStatus('closed'); // 브라우저가 자동 재연결 시도, 성공하면 다시 onopen 발생

    eventSource.addEventListener('scan', (event: MessageEvent) => {
      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch (err) {
        console.error('스캔 데이터 파싱에 실패했습니다.', err);
        setScanFailure('스캔 결과를 해석할 수 없습니다.');
        return;
      }
      handleScanRef.current(payload);
    });

    return () => {
      eventSource.close();
    };
  }, [zone]);

  // 스캔 실패·안내 메시지는 5초 뒤 자동으로 사라짐
  useEffect(() => {
    if (!scanFailure) return;
    const timer = setTimeout(() => setScanFailure(null), 5000);
    return () => clearTimeout(timer);
  }, [scanFailure]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  // 단위별 총 지시수량 (단위가 섞여 있어도 안전하게 "kg, EA"처럼 나눠서 표시)
  const totalQtyLabel = useMemo(() => {
    if (!shipmentOrder) return '';

    const totals = new Map<string, number>();
    shipmentOrder.lines.forEach((line) => {
      totals.set(line.unit, (totals.get(line.unit) ?? 0) + Number(line.instructQty));
    });

    return Array.from(totals.entries())
      .map(([unit, qty]) => `${qty.toLocaleString()} ${unit}`)
      .join(', ');
  }, [shipmentOrder]);

  const registeredLots = useMemo(() => {
    if (!shipmentOrder) return [];
    return shipmentOrder.lines.flatMap((line) =>
      line.lots.map((lot) => ({ ...lot, itemNm: line.itemNm, unit: line.unit })),
    );
  }, [shipmentOrder]);

  const handleBack = () => {
    if (
      pendingLots.length > 0 &&
      !window.confirm(`등록하지 않은 LOT ${pendingLots.length}건이 있습니다.\n화면을 나가면 스캔 내역이 사라집니다. 나가시겠습니까?`)
    ) {
      return;
    }
    navigate(`/work-pc?zone=${encodeURIComponent(zone)}`);
  };

  const handleRemoveLot = (lotCode: string) => {
    applyPending(latestRef.current.pending.filter((lot) => lot.lotCode !== lotCode));
    setSubmitError(null);
  };

  const handleConfirm = async () => {
    if (!shipmentOrder || pendingLots.length === 0 || isSubmitting) return;

    // 등록 직전 잔여수량 재확인
    const checked = fitPendingToOrder(shipmentOrder, pendingLots);
    if (checked.kept.length !== pendingLots.length) {
      applyPending(checked.kept);
      if (checked.dropped.length > 0) {
        setSubmitError(`${getDroppedMessage(checked.dropped)}. 목록을 확인한 뒤 다시 등록해 주세요.`);
      }
      return;
    }

    const lotSummary = pendingLots
      .map((lot) => `${lot.lotCode} (${lot.itemNm} ${toQty(lot.qty).toLocaleString()}${lot.unit})`)
      .join('\n');
    if (!window.confirm(`LOT ${pendingLots.length}건을 출고 등록하시겠습니까?\n\n${lotSummary}`)) {
      return;
    }

    const { shipId } = shipmentOrder;
    const lotCodes = pendingLots.map((lot) => lot.lotCode);
    // 요청 중에 다른 출고지시서를 스캔했으면 늦게 온 응답으로 현재 화면을 덮어쓰지 않는다
    const isStillCurrent = () => latestRef.current.order?.shipId === shipId;

    submittingLotCodesRef.current = lotCodes;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await ShipmentOrderApi.confirmScan({ shipId, lotCodes });
      const successMessage = `${shipId}: LOT ${lotCodes.length}건의 출고가 등록되었습니다.`;

      if (!isStillCurrent()) {
        setNotice(successMessage);
        return;
      }

      applyOrder(res.data);
      // 요청 중 새로 스캔된 LOT는 남기고 갱신된 잔여수량으로 재검증
      const { kept, dropped } = fitPendingToOrder(
        res.data,
        latestRef.current.pending.filter((lot) => !lotCodes.includes(lot.lotCode)),
      );
      applyPending(kept);
      setNotice(dropped.length > 0 ? `${successMessage} ${getDroppedMessage(dropped)}` : successMessage);
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
      const reason = message || '출고 등록에 실패했습니다.';
      setSubmitError(isStillCurrent() ? reason : `${shipId}: ${reason}`);
    } finally {
      submittingLotCodesRef.current = [];
      setIsSubmitting(false);
    }
  };

  const statusLabel =
    connectionStatus === 'open'
      ? '실시간 연결됨 · 스캔 대기 중'
      : connectionStatus === 'connecting'
        ? '연결 중'
        : '연결 끊김 · 재연결 시도 중';

  if (!isValidWorkZone(zone)) {
    return <Navigate to="/work-pc" replace />;
  }

  const isFoodZone = zone === '1';
  const zoneLabel = isFoodZone ? '식품동' : '섬유동';
  const zoneVariant = isFoodZone ? 'food' : 'crop';

  const banner = shipmentOrder ? getBannerInfo(shipmentOrder.status) : null;

  return (
    <div className="workTabletPage">
      <div className="workScanPanel">
        <div className={`workScanContainer workScanContainer--${zoneVariant}`}>
          {/* 상단바: 돌아가기 + 실시간 연결 상태 */}
          <div className="workScanTopBar">
            <button type="button" className="workScanHomeBtn" onClick={handleBack}>
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
            {/* 생산동 > 처리 종류 배지 */}
            <div className="workTabletScanHeader">
              <span className={`workTabletScanZoneBadge workTabletScanZoneBadge--${zoneVariant}`}>
                <MapPinIcon aria-hidden="true" />
                {zoneLabel}
              </span>
              <ChevronRightIcon className="workTabletScanArrow" aria-hidden="true" />
              <span className={`workTabletScanProcessBadge workTabletScanProcessBadge--${zoneVariant}`}>
                출고처리
              </span>
            </div>

            {scanFailure && !shipmentOrder ? (
              // 출고지시서를 아직 한 번도 못 읽은 경우 - 보여줄 결과가 없으니 전체 화면으로 안내
              <div className="workScanWaiting workScanFailure">
                <ExclamationTriangleIcon className="workScanWaitingIconSvg" />
                <h1>스캔한 라벨을 확인할 수 없습니다</h1>
                <p>{scanFailure}</p>
                <button type="button" className="workScanCancelBtn" onClick={() => setScanFailure(null)}>
                  다시 스캔하기
                </button>
              </div>
            ) : !shipmentOrder ? (
              // 스캔 대기 화면
              <div className="workScanWaiting">
                <div className={`workScanTarget workScanTarget--${zoneVariant}`}>
                  <span className="workScanTargetCorner workScanTargetCorner--tl" />
                  <span className="workScanTargetCorner workScanTargetCorner--tr" />
                  <span className="workScanTargetCorner workScanTargetCorner--bl" />
                  <span className="workScanTargetCorner workScanTargetCorner--br" />
                  <span className="workScanTargetLine" />
                  <div className="workScanTargetLabel">
                    <TruckIcon className="workScanWaitingIconSvg" />
                  </div>
                </div>
                <h1>스캔 대기 중</h1>
                <p>출고지시서 라벨을 스캐너로 찍으면 출고지시서가 이 화면에 자동으로 표시됩니다.</p>
              </div>
            ) : (
              <div className="workOutboundResult">
                {/* ① 출고지시서 요약 카드 */}
                <div className="workOutboundSummaryCard">
                  <div className="workOutboundCardHead">
                    <span className="workOutboundId">{shipmentOrder.shipId}</span>
                    <span className={`workOutboundStatusChip workOutboundStatusChip--${shipmentOrder.status}`}>
                      {SHIPMENT_STATUS_LABEL[shipmentOrder.status as ShipmentOrderStatus] ?? shipmentOrder.status}
                    </span>
                  </div>

                  <h2>{shipmentOrder.bpNm || '거래처 미지정'}</h2>

                  <div className="workOutboundInfoGrid">
                    <div className="workOutboundInfoItem">
                      <span>주문번호</span>
                      <strong>{shipmentOrder.orderCode || '-'}</strong>
                    </div>
                    <div className="workOutboundInfoItem">
                      <span>납기일</span>
                      <strong>{shipmentOrder.dueDate?.slice(0, 10) || '-'}</strong>
                    </div>
                    <div className="workOutboundInfoItem">
                      <span>출고일</span>
                      <strong>{shipmentOrder.shipDate?.slice(0, 10) || '-'}</strong>
                    </div>
                    <div className="workOutboundInfoItem">
                      <span>담당자</span>
                      <strong>{shipmentOrder.managerNm || '미지정'}</strong>
                    </div>
                  </div>

                  <div className="workOutboundQtyRow">
                    <span>총 지시수량 ({shipmentOrder.lines.length.toLocaleString()}개 품목)</span>
                    <strong>{totalQtyLabel || '-'}</strong>
                  </div>
                </div>

                {/* 안내 배너 - 스캔 실패가 오면 이미 정상 스캔된 결과를 날리지 않고 이 자리에 오류로만 표시 */}
                {scanFailure ? (
                  <div className="workOutboundBanner workOutboundBanner--error" role="alert">
                    스캔 오류 — {scanFailure}
                  </div>
                ) : notice ? (
                  <div className="workOutboundBanner workOutboundBanner--done" role="status">
                    {notice}
                  </div>
                ) : (
                  banner && (
                    <div className={`workOutboundBanner workOutboundBanner--${banner.variant}`}>
                      {banner.text}
                    </div>
                  )
                )}

                {/* 출고 품목 목록 */}
                <div className="workOutboundLinesSection">
                  <div className="workOutboundLinesLabel">출고 품목</div>

                  {shipmentOrder.lines.length === 0 ? (
                    <div className="workOutboundLinesEmpty">등록된 출고 품목이 없습니다.</div>
                  ) : (
                    <div className="workOutboundLineList">
                      {shipmentOrder.lines.map((line) => {
                        const instructedQty = toQty(line.instructQty);
                        const confirmedQty = getConfirmedQty(line);
                        const pendingQty = pendingQtyByLine.get(line.shipOrderLineId) ?? 0;
                        const totalQty = roundQty(confirmedQty + pendingQty);
                        const remainingQty = Math.max(0, roundQty(getRemainingQty(line) - pendingQty));

                        const confirmedPercent = instructedQty > 0
                          ? Math.min(100, (confirmedQty / instructedQty) * 100)
                          : 0;
                        const pendingPercent = instructedQty > 0
                          ? Math.min(100 - confirmedPercent, (pendingQty / instructedQty) * 100)
                          : 0;

                        const isDone = remainingQty <= 0 && instructedQty > 0;

                        return (
                          <div
                            className={`workOutboundItemCard ${isDone ? 'workOutboundItemCard--done' : ''}`}
                            key={line.shipOrderLineId}
                          >
                            <div className="workOutboundItemHeader">
                              <div className="workOutboundItemIdentity">
                                <strong className="workOutboundItemName">
                                  {line.itemNm}
                                </strong>

                                <span className="workOutboundItemCode">
                                  {line.itemCode} · {line.unit}
                                </span>
                              </div>

                              <div className="workOutboundItemQuantity">
                                {totalQty.toLocaleString()} <span>/ </span>
                                {instructedQty.toLocaleString()}{line.unit}
                              </div>
                            </div>

                            <div
                              className="workOutboundProgressTrack"
                              role="progressbar"
                              aria-label={`${line.itemNm} 출고 스캔 진행률`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={Math.round(confirmedPercent + pendingPercent)}
                            >
                              <div
                                className="workOutboundProgressFill"
                                style={{ width: `${confirmedPercent}%` }}
                              />
                              <div
                                className="workOutboundProgressFill workOutboundProgressFill--pending"
                                style={{ width: `${pendingPercent}%` }}
                              />
                            </div>

                            <div className="workOutboundItemMessage">
                              {pendingQty > 0 && (
                                <span className="workOutboundItemPending">
                                  스캔 {pendingQty.toLocaleString()}{line.unit} 등록 대기 ·{' '}
                                </span>
                              )}
                              {isDone
                                ? (pendingQty > 0 ? '등록하면 출고 완료' : '출고 완료')
                                : `잔여 ${remainingQty.toLocaleString()}${line.unit} 더 스캔 필요`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ② 스캔한 LOT 목록 */}
                <div className="workOutboundLinesSection">
                  <div className="workOutboundLinesLabel">
                    스캔한 LOT
                    <span className="workOutboundLotCount">
                      등록 대기 {pendingLots.length.toLocaleString()}건 · 등록됨 {registeredLots.length.toLocaleString()}건
                    </span>
                  </div>

                  {pendingLots.length === 0 && registeredLots.length === 0 ? (
                    <div className="workOutboundLotEmpty">
                      출고할 LOT 라벨을 스캔하면 여기에 추가됩니다.
                    </div>
                  ) : (
                    <ul className="workOutboundLotList">
                      {pendingLots.map((lot) => (
                        <li className="workOutboundLotRow" key={lot.lotCode}>
                          <span className="workOutboundLotBadge workOutboundLotBadge--pending">등록 대기</span>
                          <span className="workOutboundLotCode">{lot.lotCode}</span>
                          <span className="workOutboundLotItem">{lot.itemNm}</span>
                          <span className="workOutboundLotQty">
                            {toQty(lot.qty).toLocaleString()}{lot.unit}
                          </span>
                          <button
                            type="button"
                            className="workOutboundLotRemoveBtn"
                            aria-label={`${lot.lotCode} 스캔 취소`}
                            onClick={() => handleRemoveLot(lot.lotCode)}
                            disabled={isSubmitting}
                          >
                            <XMarkIcon aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                      {registeredLots.map((lot) => (
                        <li className="workOutboundLotRow workOutboundLotRow--registered" key={lot.lotCode}>
                          <span className="workOutboundLotBadge">등록됨</span>
                          <span className="workOutboundLotCode">{lot.lotCode}</span>
                          <span className="workOutboundLotItem">{lot.itemNm}</span>
                          <span className="workOutboundLotQty">
                            {toQty(lot.qty).toLocaleString()}{lot.unit}
                          </span>
                          <span className="workOutboundLotRemoveBtn workOutboundLotRemoveBtn--placeholder" aria-hidden="true" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* ③ 출고 등록 */}
                {submitError && (
                  <div className="workOutboundBanner workOutboundBanner--error" role="alert">
                    출고 등록 실패 — {submitError}
                  </div>
                )}
                <button
                  type="button"
                  className="workOutboundConfirmBtn"
                  onClick={handleConfirm}
                  disabled={pendingLots.length === 0 || isSubmitting}
                >
                  {isSubmitting
                    ? '등록 중...'
                    : pendingLots.length > 0
                      ? `LOT ${pendingLots.length.toLocaleString()}건 출고 등록`
                      : '출고 등록'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
