import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronRightIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '@/api/apiClient';
import {
  SHIPMENT_STATUS_LABEL,
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

// SSE 성공 응답은 래퍼 없이 출고지시서 객체 자체로 내려오므로 최소한의 형태만 검증한다
const parseShipmentOrder = (
  payload: unknown,
): ShipmentOrderResponse | null => {
  if (!payload || typeof payload !== 'object') return null;

  const response = payload as {
    data?: unknown;
    shipId?: unknown;
    lines?: unknown;
  };

  const candidate =
    response.data && typeof response.data === 'object'
      ? response.data
      : payload;

  if (!candidate || typeof candidate !== 'object') return null;

  const order = candidate as Partial<ShipmentOrderResponse>;

  if (typeof order.shipId !== 'string' || !Array.isArray(order.lines)) {
    return null;
  }

  return order as ShipmentOrderResponse;
};

// 상태별 "다음 행동" 안내 문구 - 작업지시 화면의 안내 배너와 같은 역할
const getBannerInfo = (status: string): { variant: string; text: string } => {
  switch (status as ShipmentOrderStatus) {
    case 'DONE':
      return { variant: 'done', text: '출고가 완료된 출고지시서입니다' };
    case 'PROGRESS':
      return { variant: 'progress', text: '출고 진행 중입니다 — 아래 품목을 확인하며 출고를 이어가세요' };
    case 'DELAY':
      return { variant: 'delay', text: '출고가 지연되고 있습니다 — 담당자에게 확인해 주세요' };
    case 'WAIT':
    default:
      return { variant: 'wait', text: '출고 대기 중입니다 — 아래 출고 품목을 확인해 주세요' };
  }
};

export function WorkOutboundScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const zone = searchParams.get('zone') ?? '';

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [shipmentOrder, setShipmentOrder] = useState<ShipmentOrderResponse | null>(null);
  const [scanFailure, setScanFailure] = useState<string | null>(null);

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

      // 서버가 내려준 실패 사유(NG)를 그대로 보여준다
      if (isScanFailure(payload)) {
        setScanFailure(payload.message);
        return;
      }

      const order = parseShipmentOrder(payload);
      if (!order) {
        console.error('출고지시서 데이터 형식이 올바르지 않습니다.', payload);
        setScanFailure('출고지시서 데이터를 확인할 수 없습니다.');
        return;
      }

      // WAIT도 정상적인 출고 업무 상태이므로 실패로 처리하지 않는다
      setShipmentOrder(order);
      setScanFailure(null);
    });

    return () => {
      eventSource.close();
    };
  }, [zone]);

  // 스캔 실패 메시지는 5초 뒤 자동으로 사라짐
  useEffect(() => {
    if (!scanFailure) return;
    const timer = setTimeout(() => setScanFailure(null), 5000);
    return () => clearTimeout(timer);
  }, [scanFailure]);

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

  const statusLabel =
    connectionStatus === 'open'
      ? '실시간 연결됨 · 스캔 대기 중'
      : connectionStatus === 'connecting'
        ? '연결 중'
        : '연결 끊김 · 재연결 시도 중';

  if (!isValidWorkZone(zone)) {
    return <Navigate to="/work" replace />;
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
                <p>품목 라벨을 스캐너로 찍으면 출고지시서가 이 화면에 자동으로 표시됩니다.</p>
              </div>
            ) : (
              <div className="workOutboundResult">
                {/* 출고지시서 요약 카드 */}
                <div className="workOutboundSummaryCard">
                  <div className="workOutboundCardHead">
                    <span className="workOutboundId">{shipmentOrder.shipId}</span>
                    <span className={`workOutboundStatusChip workOutboundStatusChip--${shipmentOrder.status}`}>
                      {SHIPMENT_STATUS_LABEL[shipmentOrder.status as ShipmentOrderStatus] ?? shipmentOrder.status}
                    </span>
                  </div>

                  <h2>주문번호 {shipmentOrder.orderCode}</h2>

                  <div className="workOutboundInfoGrid">
                    <div className="workOutboundInfoItem">
                      <span>출고일</span>
                      <strong>{shipmentOrder.shipDate?.slice(0, 10) ?? '-'}</strong>
                    </div>
                    <div className="workOutboundInfoItem">
                      <span>담당자</span>
                      <strong>{shipmentOrder.managerNm || '미지정'}</strong>
                    </div>
                    <div className="workOutboundInfoItem">
                      <span>출고 품목</span>
                      <strong>{shipmentOrder.lines.length.toLocaleString()}건</strong>
                    </div>
                  </div>

                  <div className="workOutboundQtyRow">
                    <span>총 지시수량</span>
                    <strong>{totalQtyLabel || '-'}</strong>
                  </div>
                </div>

                {/* 안내 배너 - 스캔 실패가 오면 이미 정상 스캔된 결과를 날리지 않고 이 자리에 오류로만 표시 */}
                {scanFailure ? (
                  <div className="workOutboundBanner workOutboundBanner--error">
                    스캔한 라벨을 확인할 수 없습니다 — {scanFailure}
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
                        const instructedQty = Math.max(0, Number(line.instructQty) || 0);
                        const scannedQty = Math.max(0, Number(line.scannedQty) || 0);
                        const remainingQty = Math.max(
                          0,
                          Number(
                            line.remainingQty ??
                            Math.max(0, instructedQty - scannedQty),
                          ) || 0,
                        );

                        const progress = instructedQty > 0
                          ? Math.min(100, (scannedQty / instructedQty) * 100)
                          : 0;

                        const isDone = remainingQty <= 0 && instructedQty > 0;

                        return (
                          <div
                            className={`workOutboundItemCard ${isDone ? 'workOutboundItemCard--done' : ''
                              }`}
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
                                {scannedQty.toLocaleString()} <span>/ </span>
                                {instructedQty.toLocaleString()}{line.unit}
                              </div>
                            </div>

                            <div
                              className="workOutboundProgressTrack"
                              role="progressbar"
                              aria-label={`${line.itemNm} 출고 스캔 진행률`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={progress}
                            >
                              <div
                                className="workOutboundProgressFill"
                                style={{ width: `${progress}%` }}
                              />
                            </div>

                            <div className="workOutboundItemMessage">
                              {isDone
                                ? '스캔 완료'
                                : `잔여 ${remainingQty.toLocaleString()}${line.unit} 더 스캔 필요`}
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
        </div>
      </div>
    </div>
  );
}
