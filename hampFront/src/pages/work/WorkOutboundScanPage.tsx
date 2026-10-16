import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronRightIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '@/api/apiClient';
import { isValidWorkZone } from '@/utils/common';
import '@/pages/work/WorkTabletHome.css';
import '@/pages/work/WorkSeedReportScanPage.css';
import { type ShipmentOrderResponse } from '@/api/ShipmentOrder';

type ConnectionStatus = 'connecting' | 'open' | 'closed';

const STATUS_LABEL: Record<string, string> = {
  WAIT: '대기',
  PROGRESS: '진행중',
  DONE: '완료',
  DELAY: '지연',
};

function parseShipmentOrder(
  data: unknown,
): ShipmentOrderResponse | null {
  let value = data;

  // data가 JSON 문자열로 넘어오는 경우 처리
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const order = value as Partial<ShipmentOrderResponse>;

  if (
    typeof order.shipId !== 'string' ||
    !Array.isArray(order.lines)
  ) {
    return null;
  }

  return order as ShipmentOrderResponse;
}

export function WorkOutboundScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const zone = searchParams.get('zone') ?? '';

  const [shipmentOrder, setShipmentOrder] =
    useState<ShipmentOrderResponse | null>(null);

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connecting');

  const [scanFailure, setScanFailure] = useState<string | null>(null);

  // 출고지시 스캔 결과 SSE 구독
  useEffect(() => {
    if (!isValidWorkZone(zone)) return;

    const eventSource = new EventSource(
      `${apiClient.defaults.baseURL}/shipment-orders/scan/stream?zone=${encodeURIComponent(zone)}`,
    );

    eventSource.onopen = () => {
      setConnectionStatus('open');
    };

    eventSource.onerror = () => {
      setConnectionStatus('closed');
    };

    eventSource.addEventListener('scan', (event: MessageEvent) => {
      try {
        const payload: unknown = JSON.parse(event.data);

        // SSE 응답은 status: OK 래퍼 없이 출고지시서 객체 자체로 전달됨
        const order = parseShipmentOrder(payload);

        if (!order) {
          console.error('[출고지시서 데이터 형식 오류]', payload);
          setScanFailure('출고지시서 데이터를 확인할 수 없습니다.');
          return;
        }

        // WAIT는 정상적인 출고 업무 상태이므로 실패로 처리하지 않음
        setShipmentOrder(order);
        setScanFailure(null);

        console.log('[출고지시서 표시 성공]', order.shipId);
      } catch (error) {
        console.error('[출고 SSE 데이터 처리 실패]', error);
        setScanFailure('스캔 결과를 해석할 수 없습니다.');
      }
    });

    return () => {
      // 화면 이탈 시 SSE 연결 종료
      eventSource.close();
    };
  }, [zone]);

  // 스캔 실패 메시지는 일정 시간 후 자동으로 제거
  useEffect(() => {
    if (!scanFailure) return;

    const timer = window.setTimeout(() => {
      setScanFailure(null);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [scanFailure]);

  if (!isValidWorkZone(zone)) {
    return <Navigate to="/work" replace />;
  }

  const isFoodZone = zone === '1';
  const zoneLabel = isFoodZone ? '식품동' : '섬유동';
  const zoneVariant = isFoodZone ? 'food' : 'crop';

  const statusLabel =
    connectionStatus === 'open'
      ? '실시간 연결됨 · 스캔 대기 중'
      : connectionStatus === 'connecting'
        ? '연결 중'
        : '연결 끊김 · 재연결 시도 중';

  return (
    <div className="workTabletPage">
      <div className="workScanPanel">
        <div className={`workScanContainer workScanContainer--${zoneVariant}`}>
          <div className="workScanTopBar">
            <button
              type="button"
              className="workScanHomeBtn"
              onClick={() =>
                navigate(`/work/home?zone=${encodeURIComponent(zone)}`)
              }
            >
              ← 돌아가기
            </button>

            <span
              className={`workScanStatus workScanStatus--${connectionStatus}`}
            >
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
                출고처리
              </span>
            </div>

            {scanFailure ? (
              <div className="workScanWaiting workScanFailure">
                <ExclamationTriangleIcon className="workScanWaitingIconSvg" />

                <h1>출고지시 스캔 실패</h1>
                <p>{scanFailure}</p>

                <button
                  type="button"
                  className="workScanCancelBtn"
                  onClick={() => setScanFailure(null)}
                >
                  다시 스캔하기
                </button>
              </div>
            ) : shipmentOrder ? (
              <div className="workOrderResult">
                <div className="workOrderItemCard">
                  <div className="workOrderItemCardHead">
                    <span className="workOrderId">{shipmentOrder.shipId}</span>
                    <h1></h1>
                  </div>

                  <span className="workOutboundStatus">
                    {shipmentOrder.status === 'WAIT'
                      ? '대기'
                      : shipmentOrder.status}
                  </span>
                </div>

                <div className="workOutboundOrderInfo">
                  <div>
                    <span>주문번호</span>
                    <strong>{shipmentOrder.orderCode}</strong>
                  </div>

                  <div>
                    <span>출고일</span>
                    <strong>{shipmentOrder.shipDate}</strong>
                  </div>

                  <div>
                    <span>담당자</span>
                    <strong>{shipmentOrder.managerNm}</strong>
                  </div>
                </div>

                <h2>출고 품목</h2>

                <div className="workOutboundLines">
                  {shipmentOrder.lines.map((line) => (
                    <div
                      className="workOutboundLine"
                      key={line.shipOrderLineId}
                    >
                      <div className="workOutboundLineInfo">
                        <strong>{line.itemNm}</strong>
                        <span>{line.itemCode}</span>
                      </div>

                      <div className="workOutboundLineQty">
                        <strong>
                          {Number(line.instructQty).toLocaleString()}
                        </strong>
                        <span>{line.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
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
                <p>
                  출고지시 라벨을 스캐너로 찍으면 이 화면에 자동으로 표시됩니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}