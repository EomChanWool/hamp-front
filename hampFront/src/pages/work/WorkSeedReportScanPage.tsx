import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArchiveBoxIcon, ExclamationTriangleIcon, MapPinIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { apiClient } from '@/api/apiClient';
import {
  SeedGoodsReceiptReturnApi,
  type SeedGoodsReceiptResponse,
} from '@/api/ioSeed/SeedGoodsReceipt';
import { isValidWorkZone } from '@/utils/common';
import '@/pages/work/WorkTabletHome.css';
import '@/pages/work/WorkSeedReportScanPage.css';

type ConnectionStatus = 'connecting' | 'open' | 'closed';

interface ScanFailure {
  code: string;
  message: string;
}

// 백엔드가 스캔 실패 시 성공 응답과 같은 "scan" 이벤트로 { status: "NG", code, message }를 흘려보냄
const isScanFailure = (data: unknown): data is ScanFailure =>
  !!data && typeof data === 'object' && (data as { status?: string }).status === 'NG';

// [주의] toISOString()은 UTC 기준이라 한국 시간 00:00~09:00 사이에는 "어제 날짜"가 나옴
// -> 로컬(KST) 기준 날짜로 만들어 준다
const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// 신고 진행상태 문자열(백엔드가 그대로 라벨을 내려줌)에 따라 상태칩 색을 다르게 보여주기 위한 매핑
const REPORT_STATUS_VARIANT: Record<string, string> = {
  미신고: 'none',
  부분신고: 'partial',
  신고완료: 'done',
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

export function WorkSeedReportScanPage() {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const zone = searchParams.get('zone') ?? '';

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [scanResult, setScanResult] = useState<SeedGoodsReceiptResponse | null>(null);
  const [scanFailure, setScanFailure] = useState<ScanFailure | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [hullQtyInput, setHullQtyInput] = useState('');
  const [inputMode, setInputMode] = useState<'return' | 'hull'>('return');
  const [returnDueDate, setReturnDueDate] = useState(todayStr());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 신고처리 화면 진입 시 SSE 연결, 이탈 시 반드시 연결 종료
  useEffect(() => {
    if (!isValidWorkZone(zone)) return;

    const eventSource = new EventSource(
      `${apiClient.defaults.baseURL}/seed-goods-receipts/scan/stream?zone=${encodeURIComponent(zone)}`,
    );

    eventSource.onopen = () => setConnectionStatus('open');
    eventSource.onerror = () => setConnectionStatus('closed'); // 브라우저가 자동 재연결 시도, 성공하면 다시 onopen 발생

    eventSource.addEventListener('scan', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (isScanFailure(data)) {
          setScanFailure(data);
          setScanResult(null);
          return;
        }

        setScanFailure(null);
        setScanResult(data as SeedGoodsReceiptResponse);
        setQtyInput('');
        setHullQtyInput('');
        setInputMode('return');
        setReturnDueDate(todayStr());
        setErrorMsg(null);
      } catch (err) {
        console.error('스캔 데이터 파싱에 실패했습니다.', err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [zone]);

  useEffect(() => {
    if (!successMsg) return;
    const timer = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(timer);
  }, [successMsg]);

  useEffect(() => {
    if (!scanFailure) return;
    const timer = setTimeout(() => setScanFailure(null), 5000);
    return () => clearTimeout(timer);
  }, [scanFailure]);

  const handleKeypadPress = useCallback((key: string) => {
    const setInput = inputMode === 'return' ? setQtyInput : setHullQtyInput;

    if (key === 'back') {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    setInput((prev) => {
      if (key === '.' && prev.includes('.')) return prev;
      if (prev.length >= 10) return prev;
      return prev + key;
    });
  }, [inputMode]);

  const handleCancel = () => {
    setScanResult(null);
    setQtyInput('');
    setHullQtyInput('');
    setInputMode('return');
    setErrorMsg(null);
  };

  const handleSubmit = async () => {
    if (!scanResult) return;

    const qty = Number(qtyInput);
    const hullQty = Number(hullQtyInput);

    if (!qtyInput || Number.isNaN(qty) || qty <= 0) {
      setErrorMsg('신고수량을 올바르게 입력해 주세요.');
      return;
    }

    if (hullQtyInput === '' || Number.isNaN(hullQty) || hullQty < 0) {
      setErrorMsg('껍질수량을 올바르게 입력해 주세요.');
      return;
    }

    if (qty > scanResult.remainingQty) {
      setErrorMsg(`신고 가능 잔여수량(${scanResult.remainingQty})을 초과했습니다.`);
      return;
    }

    if (hullQty > qty) {
      setErrorMsg('껍질수량은 신고수량을 초과할 수 없습니다.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await SeedGoodsReceiptReturnApi.createByScan(scanResult.receiptId, {
        returnQty: qty,
        hullQty,
        reportDate: todayStr(),
        returnDueDate,
        processStatus: 0,
      });
      setSuccessMsg('신고가 등록되었습니다.');
      setScanResult(null);
      setQtyInput('');
      setHullQtyInput('');
      setInputMode('return');
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
      setErrorMsg(message || '신고 등록에 실패했습니다.');
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

  if (!isValidWorkZone(zone)) {
    return <Navigate to="/work" replace />;
  }

  const isFoodZone = zone === '1';
  const zoneLabel = isFoodZone ? '식품동' : '섬유동';
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
                신고처리
              </span>
            </div>
            {scanFailure ? (
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
                    <ArchiveBoxIcon className="workScanWaitingIconSvg" />
                  </div>
                </div>
                <h1>스캔 대기 중</h1>
                <p>입고 라벨을 스캐너로 찍으면 이 화면에 자동으로 표시됩니다.</p>
              </div>
            ) : (
              <div className="workScanEntry">
                <div className="workScanItemCard">
                  <div className="workScanCardHead">
                    <span className="workScanBarcode">{scanResult.barcode}</span>
                    <span
                      className={`workScanStatusChip workScanStatusChip--${REPORT_STATUS_VARIANT[scanResult.reportStatus] ?? 'none'}`}
                    >
                      {scanResult.reportStatus}
                    </span>
                  </div>
                  <h2>{scanResult.itemNm}</h2>
                  <div className="workScanInfoGrid">
                    <div className="workScanInfoItem">
                      <span>입고수량</span>
                      <strong>{scanResult.receiptQty} {scanResult.unit}</strong>
                    </div>
                    <div className="workScanInfoItem">
                      <span>양품수량</span>
                      <strong>{scanResult.goodQty} {scanResult.unit}</strong>
                    </div>
                    <div className="workScanInfoItem">
                      <span>기존 신고수량</span>
                      <strong>{scanResult.returnedQty} {scanResult.unit}</strong>
                    </div>
                    <div className="workScanInfoItem">
                      <span>입고일자</span>
                      <strong>{scanResult.receivedAt?.slice(0, 10)}</strong>
                    </div>
                  </div>
                  <div className="workScanRemainingBanner">
                    신고 가능 잔여 {scanResult.remainingQty} {scanResult.unit}
                  </div>
                </div>

                <div className="workScanForm">
                  <div className="workScanInputMode">
                    <button
                      type="button"
                      className={`workScanInputModeBtn ${inputMode === 'return' ? 'is-active' : ''
                        }`}
                      onClick={() => setInputMode('return')}
                    >
                      신고수량 입력
                    </button>

                    <button
                      type="button"
                      className={`workScanInputModeBtn ${inputMode === 'hull' ? 'is-active' : ''
                        }`}
                      onClick={() => setInputMode('hull')}
                    >
                      껍질수량 입력
                    </button>
                  </div>

                  <div className="workScanQtyDisplay">
                    {inputMode === 'return'
                      ? qtyInput || '0'
                      : hullQtyInput || '0'}{' '}
                    <span>{scanResult.unit}</span>
                  </div>

                  <NumericKeypad onPress={handleKeypadPress} />

                  <div className="workScanQtySummary">
                    <div className="workScanQtySummaryItem">
                      <span>신고수량</span>
                      <strong>
                        {qtyInput || 0} {scanResult.unit}
                      </strong>
                    </div>

                    <div className="workScanQtySummaryItem">
                      <span>껍질수량</span>
                      <strong>
                        {hullQtyInput || 0} {scanResult.unit}
                      </strong>
                    </div>

                    <div className="workScanQtySummaryItem workScanQtySummaryItem--total">
                      <span>합계</span>
                      <strong>
                        {Number(qtyInput || 0).toLocaleString()} {scanResult.unit}
                      </strong>
                    </div>
                  </div>

                  <div className="workScanDueDateRow">
                    <label htmlFor="returnDueDate">반납예정일</label>
                    <input
                      id="returnDueDate"
                      type="date"
                      value={returnDueDate}
                      onChange={(e) => setReturnDueDate(e.target.value)}
                    />
                  </div>

                  {errorMsg && <div className="workScanErrorMsg">{errorMsg}</div>}

                  <div className="workScanActionRow">
                    <button
                      type="button"
                      className="workScanCancelBtn"
                      onClick={handleCancel}
                      disabled={isSubmitting}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="workScanSubmitBtn"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? '등록 중...' : '신고 등록'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {successMsg && <div className="workScanSuccessToast">{successMsg}</div>}
        </div>
      </div>
    </div>
  );
}
