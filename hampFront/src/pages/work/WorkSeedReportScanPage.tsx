import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { apiClient } from '@/api/apiClient';
import {
  SeedGoodsReceiptReturnApi,
  type SeedGoodsReceiptResponse,
} from '@/api/ioSeed/SeedGoodsReceipt';
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

const todayStr = () => new Date().toISOString().slice(0, 10);

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

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [scanResult, setScanResult] = useState<SeedGoodsReceiptResponse | null>(null);
  const [scanFailure, setScanFailure] = useState<ScanFailure | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [returnDueDate, setReturnDueDate] = useState(todayStr());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 신고처리 화면 진입 시 SSE 연결, 이탈 시 반드시 연결 종료
  useEffect(() => {
    const eventSource = new EventSource(
      `${apiClient.defaults.baseURL}/seed-goods-receipts/scan/stream`,
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
        setReturnDueDate(todayStr());
        setErrorMsg(null);
      } catch (err) {
        console.error('스캔 데이터 파싱에 실패했습니다.', err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, []);

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

  const handleCancel = () => {
    setScanResult(null);
    setQtyInput('');
    setErrorMsg(null);
  };

  const handleSubmit = async () => {
    if (!scanResult) return;

    const qty = Number(qtyInput);
    if (!qtyInput || Number.isNaN(qty) || qty <= 0) {
      setErrorMsg('신고수량을 올바르게 입력해 주세요.');
      return;
    }
    if (qty > scanResult.remainingQty) {
      setErrorMsg(`신고 가능 잔여수량(${scanResult.remainingQty})을 초과했습니다.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await SeedGoodsReceiptReturnApi.create(scanResult.receiptId, {
        returnQty: qty,
        reportDate: todayStr(),
        returnDueDate,
        processStatus: 0,
      });
      setSuccessMsg('신고가 등록되었습니다.');
      setScanResult(null);
      setQtyInput('');
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
        ? '연결 중...'
        : '연결 끊김 · 재연결 시도 중';

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
            </span>
          </div>

          {scanFailure ? (
            <div className="workScanWaiting workScanFailure">
              <div className="workScanWaitingIcon">⚠️</div>
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
              <div className="workScanWaitingIcon">📷</div>
              <h1>스캔 대기 중</h1>
              <p>입고 라벨을 스캐너로 찍으면 이 화면에 자동으로 표시됩니다.</p>
            </div>
          ) : (
            <div className="workScanEntry">
              <div className="workScanItemCard">
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
                    <span>신고 상태</span>
                    <strong>{scanResult.reportStatus}</strong>
                  </div>
                </div>
                <div className="workScanRemainingBanner">
                  신고 가능 잔여 {scanResult.remainingQty} {scanResult.unit}
                </div>
              </div>

              <div className="workScanForm">
                <div className="workScanQtyDisplay">
                  {qtyInput || '0'} <span>{scanResult.unit}</span>
                </div>

                <NumericKeypad onPress={handleKeypadPress} />

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

          {successMsg && <div className="workScanSuccessToast">{successMsg}</div>}
        </div>
      </div>
    </div>
  );
}
