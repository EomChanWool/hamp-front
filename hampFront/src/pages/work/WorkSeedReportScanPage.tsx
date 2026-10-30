/**
 *  배치(헤더+라인) 기반 3단계 흐름
 *      새 배치 시작(여러 입고건 스캔 + 투입량 N) → 탈피 완료 처리(H, D) → 최종 완료 처리(M)
 *      + 배치 병합(같은 상태끼리) / 배치 취소(진행중만)
 *
 * ■ 확인필요 번호 목록
 *  #1 탈피 가드: 설계안 "H + D ≈ ΣN" vs 목업 "H + D ≤ ΣN" → 초과는 차단, 부족은 5% 넘으면 경고만 (허용오차 확정 필요)
 *  #2 계량: 목업은 가상(랜덤) 계량. 저울 연동 방식 미정 → 지금은 기존 키패드 수동 입력
 *  #3 반납예정일 / 신고수량 개념이 새 화면에서 사라짐 (의도인지 확인)
 *  #4 스캔 응답(remainingQty 등) 계산식이 새 공식(goodQty − Σ예약 N)으로 내려와야 함
 *  #5 (해소) SSE 가 생산동(zone) 단위라 태블릿 간 스캔이 섞이던 문제 → GET 조회로 바뀌며 사라짐
 *  #6 병합 세부 규칙 / #7 취소=삭제 vs 상태값 / #8 단위·소수점 / #10 배치 목록 범위
 *  #11 [신규] 스캔 응답에 barcode 가 없어서 라벨 번호는 "스캔한 code"를 화면이 따로 보관한다.
 *      → 새로고침/다른 태블릿에서 연 배치 상세에는 라벨 번호 대신 "입고건 #ID" 로 표시됨.
 *        라인 응답에 barcode(또는 입고번호)를 내려주면 해결.
 *  #12 [신규] 스캔 실패 시 서버가 내려주는 message 를 그대로 노출한다 (err.response.data.message). 에러 응답 규격 확인 필요
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArchiveBoxIcon, MapPinIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import {
  PRETREATMENT_USE_MOCK,
  PretreatmentBatchApi as Api,
  mockScanReceipt,
  sumInputQty,
  type PretreatmentBatch,
  type PretreatmentScanReceipt,
  type PretreatmentStatus,
  type PretreatmentStock,
  type ReceiptId,
} from '@/api/PretreatmentReport';
import { isValidWorkZone } from '@/utils/common';
import '@/pages/work/WorkTabletHome.css';
import '@/pages/work/WorkSeedReportScanPage.css';
import { useNativeQrScan } from '@/hooks/useNativeQrScan';
import { NativeScanButton } from '@/components/button/NativeScanButton';

/* ============================================================================
 * 상수 / 타입
 * ========================================================================== */
interface ScanFailure {
  code: string;
  message: string;
}

type View = 'home' | 'new' | 'detail' | 'dehull' | 'final' | 'cancel' | 'merge';

/** 새 배치 작성 중(아직 서버에 안 보낸) 라인 */
interface DraftLine {
  /** 스캔할 때 보낸 QR 문자열 (= 화면에 보여줄 라벨 번호). 스캔 응답에는 barcode 가 없어서 직접 들고 있는다 */
  code: string;
  /** GET /pretreatment-reports/scan 응답 */
  receipt: PretreatmentScanReceipt;
  /** 키패드로 입력 중인 투입량 N (문자열) */
  input: string;
}

const VIEW_TITLE: Record<View, string> = {
  home: '전처리 신고',
  new: '새 배치 시작',
  detail: '배치 상세',
  dehull: '탈피 완료 처리',
  final: '최종 완료 처리',
  cancel: '배치 취소',
  merge: '배치 병합',
};

const STATUS_LABEL: Record<PretreatmentStatus, string> = {
  PROGRESS: '진행중',
  DEHULLED: '탈피완료',
  DONE: '완료',
};
const STATUS_VARIANT: Record<PretreatmentStatus, string> = {
  PROGRESS: 'progress',
  DEHULLED: 'dehulled',
  DONE: 'done',
};

const KEYPAD_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back'];
const MAX_INPUT_LENGTH = 10;

/** [확인필요 #8] 저울/현장이 소수점 몇 자리까지 쓰는지 모름. 목업이 소수 1자리라 1로 맞춤 */
const MAX_DECIMALS = 1;
/** 부동소수점 오차 흡수용 (목업과 동일한 0.001) */
const EPS = 0.001;
/** [확인필요 #1] 탈피 시 "H + D"가 투입량보다 이 비율 넘게 모자라면 경고(차단 아님). 임시값 — 현장 기준 확정 필요 */
const DEHULL_LOSS_WARN_RATIO = 0.05;
/** [확인필요 #10] 완료 배치는 무한정 쌓이므로 홈에는 최근 N건만. 실제로는 서버에서 기간/건수 제한 권장 */
const DONE_LIST_LIMIT = 10;

/* ============================================================================
 * 유틸
 * ========================================================================== */
const getErrorMessage = (err: unknown, fallback: string) => {
  if (axios.isAxiosError(err)) return err.response?.data?.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

/** 키패드 입력 한 번을 문자열에 반영 (자릿수/소수점/앞자리 0 처리) */
function applyKeypad(prev: string, key: string): string {
  if (key === 'back') return prev.slice(0, -1);
  if (key === '.') {
    if (prev.includes('.')) return prev;
    return prev === '' ? '0.' : `${prev}.`;
  }
  if (prev.length >= MAX_INPUT_LENGTH) return prev;
  const dot = prev.indexOf('.');
  if (dot >= 0 && prev.length - dot - 1 >= MAX_DECIMALS) return prev;
  if (prev === '0') return key; // "05" 방지
  return prev + key;
}

/** 입력 문자열 → 숫자 (비었거나 "." 만 있으면 null) */
function parseQty(s: string): number | null {
  if (s === '' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const fmt = (n: number) =>
  n.toLocaleString('ko-KR', { maximumFractionDigits: MAX_DECIMALS });

interface GuardResult {
  level: 'idle' | 'ok' | 'warn' | 'bad';
  message: string;
  canSubmit: boolean;
}

/**
 * 탈피완료 가드 (설계안 2-3: H + D ≈ ΣN)
 * [확인필요 #1] 설계안은 "≈", 목업은 "≤". 둘을 합쳐서
 *   - H + D > ΣN        → 차단 (목업과 동일)
 *   - 부족분이 5% 초과   → 경고만 하고 확정은 허용 (설계안의 "≈"를 반영한 임시 규칙)
 * 서버에서도 같은 검증을 해야 한다 (화면 검증은 UX용일 뿐).
 */
function evaluateDehull(totalN: number, h: number | null, d: number | null, unit: string): GuardResult {
  if (h === null || d === null) return { level: 'idle', message: '', canSubmit: false };
  const sum = h + d;
  if (d <= 0) return { level: 'bad', message: '탈피후씨드는 0보다 커야 합니다.', canSubmit: false };
  if (sum > totalN + EPS) {
    return {
      level: 'bad',
      message: `껍질 ${fmt(h)} + 탈피후씨드 ${fmt(d)} = ${fmt(sum)}${unit} > 투입량 ${fmt(totalN)}${unit} 초과 — 다시 계량하세요`,
      canSubmit: false,
    };
  }
  const loss = totalN - sum;
  if (totalN > 0 && loss / totalN > DEHULL_LOSS_WARN_RATIO) {
    return {
      level: 'warn',
      message: `합계 ${fmt(sum)}${unit}가 투입량 ${fmt(totalN)}${unit}보다 ${fmt(loss)}${unit}(${Math.round((loss / totalN) * 100)}%) 적습니다. 계량값을 한 번 더 확인해 주세요.`,
      canSubmit: true,
    };
  }
  return {
    level: 'ok',
    message: `껍질 ${fmt(h)} + 탈피후씨드 ${fmt(d)} = ${fmt(sum)}${unit} ≤ 투입량 ${fmt(totalN)}${unit} ✓ 정상`,
    canSubmit: true,
  };
}

/** 최종완료 가드 (설계안 2-3: M ≤ D) */
function evaluateFinal(dQty: number, m: number | null, unit: string): GuardResult {
  if (m === null) return { level: 'idle', message: '', canSubmit: false };
  if (m <= 0) return { level: 'bad', message: '전처리후씨드는 0보다 커야 합니다.', canSubmit: false };
  if (m > dQty + EPS) {
    return {
      level: 'bad',
      message: `전처리후씨드 ${fmt(m)}${unit} > 탈피후씨드 ${fmt(dQty)}${unit} 초과 — 탈피후씨드보다 많을 수 없습니다`,
      canSubmit: false,
    };
  }
  return {
    level: 'ok',
    message: `전처리후씨드 ${fmt(m)}${unit} ≤ 탈피후씨드 ${fmt(dQty)}${unit} ✓ 정상`,
    canSubmit: true,
  };
}

/* ============================================================================
 * 작은 컴포넌트
 * ========================================================================== */
function NumericKeypad({ onPress }: { onPress: (key: string) => void }) {
  return (
    <div className="workScanKeypad">
      {KEYPAD_KEYS.map((key) => (
        <button key={key} type="button" className="workScanKeypadBtn" onClick={() => onPress(key)}>
          {key === 'back' ? '⌫' : key}
        </button>
      ))}
    </div>
  );
}

/** 값 표시창 + 키패드 (신고수량 입력 때 쓰던 조합을 그대로 묶음) */
function QtyEntry({ value, unit, onPress }: { value: string; unit: string; onPress: (key: string) => void }) {
  return (
    <>
      <div className="workScanQtyDisplay">
        {value || '0'} <span>{unit}</span>
      </div>
      <NumericKeypad onPress={onPress} />
    </>
  );
}

function StatusChip({ status }: { status: PretreatmentStatus }) {
  return <span className={`workPtChip workPtChip--${STATUS_VARIANT[status]}`}>{STATUS_LABEL[status]}</span>;
}

function GuardBox({ guard }: { guard: GuardResult }) {
  if (guard.level === 'idle') return null;
  return <div className={`workPtGuard workPtGuard--${guard.level}`}>{guard.message}</div>;
}

/* ============================================================================
 * 페이지
 * ========================================================================== */
export function WorkSeedReportScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const zone = searchParams.get('zone') ?? '';

  const [view, setView] = useState<View>('home');

  // 서버 데이터
  const [stock, setStock] = useState<PretreatmentStock | null>(null);
  const [batches, setBatches] = useState<PretreatmentBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // 새 배치 작성
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  /** 라벨 번호 직접 입력창 값 (키보드형 스캐너도 여기로 들어온다) */
  const [codeInput, setCodeInput] = useState('');
  /** 스캔 조회(GET) 진행 중 */
  const [isScanning, setIsScanning] = useState(false);

  // 탈피 / 최종 / 취소 입력
  const [dehullMode, setDehullMode] = useState<'hull' | 'dehulled'>('hull');
  const [hullInput, setHullInput] = useState('');
  const [dInput, setDInput] = useState('');
  const [mInput, setMInput] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  // 공통 상태
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [scanFailure, setScanFailure] = useState<ScanFailure | null>(null);
  const [flashKeys, setFlashKeys] = useState<string[]>([]);

  /* ---------- 서버 데이터 불러오기 ---------- */
  const refresh = useCallback(async () => {
    try {
      const [list, st] = await Promise.all([Api.listBatches(zone), Api.getStock(zone)]);
      setBatches(list);
      setStock(st);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, '배치 목록을 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
    }
  }, [zone]);

  useEffect(() => {
    if (isValidWorkZone(zone)) void refresh();
  }, [zone, refresh]);

  /* ---------- 스캔 처리 (GET /pretreatment-reports/scan?code=) ---------- */
  /**
   * 스캔 코드가 들어오는 모든 경로(네이티브 스캔 / 직접 입력 / 목업 가상 스캔)는 enqueueScan(code) 로 모인다.
   *
   * - 스캔은 비동기(GET)라서, 응답을 기다리는 사이 화면 상태(view / draftLines)가 바뀔 수 있다.
   *   그래서 "최신 값"을 ref 로 들고 있다가 응답이 온 뒤 다시 확인한다.
   * - 스캐너가 연속으로 여러 건을 찍어도 응답 순서가 꼬이지 않도록 큐(promise chain)로 한 건씩 처리한다.
   */
  const viewRef = useRef<View>(view);
  viewRef.current = view;
  const draftRef = useRef<DraftLine[]>(draftLines);
  draftRef.current = draftLines;
  const scanChain = useRef<Promise<void>>(Promise.resolve());

  const processScan = useCallback(async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    // [확인필요] 새 배치 화면이 아닐 때 스캔되면? 설계안에 규정이 없어서 "무시 + 안내"로 처리.
    //            (대안: 홈에서 스캔하면 자동으로 새 배치 화면으로 넘어가며 해당 입고건 추가)
    if (viewRef.current !== 'new') {
      setToast('스캔은 "새 배치 시작" 화면에서 할 수 있습니다.');
      return;
    }

    // 같은 라벨(code)을 이미 쌓았으면 서버 호출 없이 해당 줄로 이동
    const sameCodeIdx = draftRef.current.findIndex((l) => l.code === code);
    if (sameCodeIdx >= 0) {
      setActiveIdx(sameCodeIdx);
      setToast('이미 스캔된 입고건입니다.');
      return;
    }

    setIsScanning(true);
    try {
      const receipt = await Api.scanReceipt(code);

      // 응답을 기다리는 사이 화면을 벗어났으면 버린다
      if (viewRef.current !== 'new') return;

      const cur = draftRef.current;

      // 서로 다른 code 가 같은 입고건(receiptId)을 가리키는 경우도 중복으로 본다
      const dupIdx = cur.findIndex((l) => Number(l.receipt.receiptId) === Number(receipt.receiptId));
      if (dupIdx >= 0) {
        setActiveIdx(dupIdx);
        setToast('이미 스캔된 입고건입니다.');
        return;
      }

      // [목업추가] 잔여수량이 없는 입고건은 라인으로 못 쌓게 막는다 (서버도 등록 시 검증해야 함)
      if (receipt.remainingQty <= 0) {
        setScanFailure({ code: 'NO_REMAINING', message: `${code} 는 투입 가능한 잔여수량이 없습니다.` });
        return;
      }

      const next = [...cur, { code, receipt, input: '' }];
      draftRef.current = next; // 큐의 다음 스캔이 바로 최신 목록을 보도록 즉시 반영
      setDraftLines(next);
      setActiveIdx(next.length - 1); // 방금 스캔한 건을 바로 입력 대상으로
      setScanFailure(null);
      setErrorMsg(null);
      setToast(`${code} 스캔됨`);
    } catch (err) {
      // 없는 라벨 / 권한 / 서버 오류 → 서버 message 우선 표시 ([확인필요 #12])
      setScanFailure({ code: 'SCAN_FAILED', message: getErrorMessage(err, '입고 라벨을 조회하지 못했습니다.') });
    } finally {
      setIsScanning(false);
    }
  }, []);

  const enqueueScan = useCallback(
    (code: string) => {
      scanChain.current = scanChain.current.then(() => processScan(code)).catch(() => undefined);
    },
    [processScan],
  );

  /** 라벨 번호 직접 입력 → 조회 (키보드형 스캐너는 마지막에 Enter 를 보내므로 그대로 동작) */
  const submitCodeInput = () => {
    const code = codeInput.trim();
    if (!code) return;
    setCodeInput('');
    enqueueScan(code);
  };

  // 토스트 3초 / 스캔 실패 배너 5초 후 자동 닫힘 (기존과 동일)
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!scanFailure) return;
    const timer = setTimeout(() => setScanFailure(null), 5000);
    return () => clearTimeout(timer);
  }, [scanFailure]);

  useEffect(() => {
    if (flashKeys.length === 0) return;
    const timer = setTimeout(() => setFlashKeys([]), 1300);
    return () => clearTimeout(timer);
  }, [flashKeys]);

  // 네이티브(앱) 스캔 — 이제 서버(SSE)를 거치지 않고, 읽은 값을 바로 GET 조회한다.
  const { isNative, startScan } = useNativeQrScan(async (barcode) => {
    enqueueScan(barcode);
  });

  /* ---------- 화면 이동 ---------- */
  const selected = batches.find((b) => b.batchId === selectedId) ?? null;

  const goHome = () => {
    setView('home');
    setErrorMsg(null);
    void refresh(); // 다른 태블릿/작업자가 처리했을 수 있으므로 홈에 올 때마다 다시 불러옴
  };

  const openNew = () => {
    setDraftLines([]);
    draftRef.current = [];
    setActiveIdx(0);
    setCodeInput('');
    setScanFailure(null);
    setErrorMsg(null);
    setView('new');
  };

  const openDetail = (id: number) => {
    setSelectedId(id);
    setErrorMsg(null);
    setView('detail');
  };

  const openDehull = () => {
    setHullInput('');
    setDInput('');
    setDehullMode('hull');
    setErrorMsg(null);
    setView('dehull');
  };

  const openFinal = () => {
    setMInput('');
    setErrorMsg(null);
    setView('final');
  };

  const openCancel = () => {
    setCancelReason('');
    setErrorMsg(null);
    setView('cancel');
  };

  const openMerge = () => {
    setErrorMsg(null);
    setView('merge');
  };

  const handleBack = () => {
    if (view === 'home') {
      navigate(`/work/home?zone=${encodeURIComponent(zone)}`);
    } else if (view === 'new') {
      if (draftLines.length > 0 && !window.confirm('스캔한 입고건이 모두 사라집니다. 돌아갈까요?')) return;
      goHome();
    } else if (view === 'detail') {
      goHome();
    } else {
      setErrorMsg(null);
      setView('detail'); // dehull / final / cancel / merge → 배치 상세로
    }
  };

  /* ---------- 키패드 ---------- */
  const handleKeypadPress = (key: string) => {
    setErrorMsg(null);
    if (view === 'new') {
      setDraftLines((prev) =>
        prev.map((l, i) => (i === activeIdx ? { ...l, input: applyKeypad(l.input, key) } : l)),
      );
    } else if (view === 'dehull') {
      if (dehullMode === 'hull') setHullInput((p) => applyKeypad(p, key));
      else setDInput((p) => applyKeypad(p, key));
    } else if (view === 'final') {
      setMInput((p) => applyKeypad(p, key));
    }
  };

  /* ---------- 서버 호출 공통 ---------- */
  const runAction = async (fn: () => Promise<void>, failMsg: string) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await fn();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, failMsg));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------- 새 배치 시작 (POST /pretreatment-reports) ---------- */
  const draftQtys = draftLines.map((l) => parseQty(l.input));
  const lineOver = (l: DraftLine, q: number | null) => q !== null && q > l.receipt.remainingQty + EPS;
  const canStart =
    draftLines.length > 0 &&
    draftLines.every((l, i) => {
      const q = draftQtys[i];
      return q !== null && q > 0 && !lineOver(l, q);
    });

  const handleStart = () => {
    if (!canStart) return;
    void runAction(async () => {
      // [확인필요] 설계안: "전처리 시작 → 배치(헤더) 생성, 재고 변화 없음, 잔여수량만 즉시 예약 차감" (서버가 처리)
      // 등록 요청에는 zone 이 없다 → lines(receiptId, inputQty) 만 보낸다.
      const created = await Api.startBatch({
        lines: draftLines.map((l, i) => ({
          receiptId: l.receipt.receiptId as unknown as ReceiptId,
          inputQty: draftQtys[i] as number,
        })),
      });
      setToast(`배치 ${created.batchNo} 시작됨 (재고 변화 없음, 잔여수량만 예약)`);
      setDraftLines([]);
      draftRef.current = [];
      goHome();
    }, '전처리 시작에 실패했습니다.');
  };

  /* ---------- 탈피 완료 ---------- */
  const handleDehullConfirm = () => {
    if (!selected) return;
    const totalN = sumInputQty(selected);
    const h = parseQty(hullInput);
    const d = parseQty(dInput);
    const guard = evaluateDehull(totalN, h, d, selected.unit);
    if (!guard.canSubmit || h === null || d === null) return;

    // [목업추가] 재고가 바로 바뀌고 되돌릴 수 없어서(취소는 진행중에서만 가능) 확인창을 한 번 거친다
    const ok = window.confirm(
      `탈피 완료로 확정할까요?\n\n전처리전씨드 -${fmt(totalN)}${selected.unit}\n껍질 +${fmt(h)}${selected.unit}\n\n확정 후에는 취소할 수 없습니다.`,
    );
    if (!ok) return;

    void runAction(async () => {
      await Api.completeDehull(selected.batchId, { hullQty: h, dehulledQty: d });
      setFlashKeys(['before', 'hull']);
      setToast(`탈피완료: 전처리전씨드 -${fmt(totalN)}${selected.unit}, 껍질 +${fmt(h)}${selected.unit} 반영됨`);
      goHome();
    }, '탈피 완료 처리에 실패했습니다.');
  };

  /* ---------- 최종 완료 ---------- */
  const handleFinalConfirm = () => {
    if (!selected) return;
    const m = parseQty(mInput);
    const guard = evaluateFinal(selected.dehulledQty ?? 0, m, selected.unit);
    if (!guard.canSubmit || m === null) return;

    const ok = window.confirm(
      `최종 완료로 확정할까요?\n\n전처리후씨드 +${fmt(m)}${selected.unit}\n\n확정 후에는 취소할 수 없습니다.`,
    );
    if (!ok) return;

    void runAction(async () => {
      await Api.completeFinal(selected.batchId, { finalQty: m });
      setFlashKeys(['after']);
      setToast(`최종완료: 전처리후씨드 +${fmt(m)}${selected.unit} 반영됨`);
      goHome();
    }, '최종 완료 처리에 실패했습니다.');
  };

  /* ---------- 취소 ---------- */
  const handleCancelConfirm = () => {
    if (!selected) return;
    void runAction(async () => {
      await Api.cancelBatch(selected.batchId, cancelReason.trim() || undefined);
      setToast('배치가 취소되었습니다 (재고 변화 없음, 잔여수량 복구)');
      goHome();
    }, '배치 취소에 실패했습니다.');
  };

  /* ---------- 병합 ---------- */
  const handleMerge = (target: PretreatmentBatch) => {
    if (!selected) return;
    // [목업추가] 병합은 되돌릴 수 없어서 확인창 추가
    if (!window.confirm(`배치 ${selected.batchNo} 를 ${target.batchNo} 로 합칩니다.\n합친 뒤에는 되돌릴 수 없습니다.`)) return;
    void runAction(async () => {
      const merged = await Api.mergeBatches(selected.batchId, target.batchId);
      setToast(`배치 ${selected.batchNo} 가 ${merged.batchNo} 로 병합되었습니다`);
      await refresh();
      setSelectedId(merged.batchId);
      setView('detail');
    }, '배치 병합에 실패했습니다.');
  };

  /* ---------- 가상 스캔 (목업 모드 전용) ---------- */
  // 목업이 골라준 라벨 번호를 "스캔한 code" 로 삼아 실서버와 같은 경로(enqueueScan → Api.scanReceipt)를 태운다.
  const handleMockScan = () => enqueueScan(mockScanReceipt().barcode);

  /* ============================================================================
   * 렌더
   * ========================================================================== */
  // 훅은 모두 위에서 호출 완료 — 이 아래부터는 조건부 return 가능 (기존과 동일한 위치)
  if (!isValidWorkZone(zone)) {
    return <Navigate to="/work" replace />;
  }

  const isFoodZone = zone === '1';
  const zoneLabel = isFoodZone ? '식품동' : '섬유동';
  const zoneVariant = isFoodZone ? 'food' : 'crop';

  // 상단 상태 표시: SSE 연결 상태 대신 "조회 중 / 대기 중" 으로 단순화 (연결이 없으므로 끊김 상태도 없음)
  const statusLabel = PRETREATMENT_USE_MOCK
    ? '목업 모드 · 가상 스캔 사용'
    : isScanning
      ? '라벨 조회 중...'
      : '스캔 대기 중';
  const statusVariant = PRETREATMENT_USE_MOCK || isScanning ? 'connecting' : 'open';

  const activeBatches = batches.filter((b) => b.status !== 'DONE');
  const doneBatches = batches.filter((b) => b.status === 'DONE').slice(0, DONE_LIST_LIMIT);

  /* ---------- 홈 ---------- */
  const renderHome = () => {
    const stockCells: { key: string; label: string; value: number | undefined }[] = [
      { key: 'before', label: '전처리전씨드', value: stock?.beforeQty },
      { key: 'after', label: '전처리후씨드', value: stock?.afterQty },
      { key: 'hull', label: '껍질', value: stock?.hullQty },
    ];
    return (
      <div className="workPtBody">
        {/* [확인필요] 재고 패널은 목업에만 있음 (설계안에 재고 조회 API 언급 없음) */}
        <div className="workPtStock">
          {stockCells.map((c) => (
            <div key={c.key} className={`workPtStockCell ${flashKeys.includes(c.key) ? 'is-flash' : ''}`}>
              <span>{c.label}</span>
              <strong>{c.value === undefined ? '-' : fmt(c.value)}</strong>
            </div>
          ))}
        </div>

        <button type="button" className="workPtBtn workPtBtn--primary" onClick={openNew}>
          + 새 배치 시작
        </button>

        {loadError && <div className="workPtLoadError">{loadError}</div>}

        <div className="workPtLabel">진행중인 배치</div>
        {isLoading ? (
          <div className="workPtEmpty">불러오는 중...</div>
        ) : activeBatches.length === 0 ? (
          <div className="workPtEmpty">진행중인 배치가 없습니다</div>
        ) : (
          activeBatches.map((b) => (
            <button key={b.batchId} type="button" className="workPtCard" onClick={() => openDetail(b.batchId)}>
              <div className="workPtCardTop">
                <span className="workPtCardTitle">배치 {b.batchNo}</span>
                <StatusChip status={b.status} />
              </div>
              <div className="workPtCardSub">
                입고건 {b.lines.length}건 · 투입량 합계 {fmt(sumInputQty(b))}
                {b.unit}
                {b.hullQty !== null && ` · 껍질 ${fmt(b.hullQty)}${b.unit}`}
              </div>
            </button>
          ))
        )}

        <div className="workPtLabel">완료된 배치</div>
        {!isLoading && doneBatches.length === 0 ? (
          <div className="workPtEmpty">완료된 배치가 없습니다</div>
        ) : (
          doneBatches.map((b) => (
            <button key={b.batchId} type="button" className="workPtCard" onClick={() => openDetail(b.batchId)}>
              <div className="workPtCardTop">
                <span className="workPtCardTitle">배치 {b.batchNo}</span>
                <StatusChip status={b.status} />
              </div>
              <div className="workPtCardSub">
                투입 {fmt(sumInputQty(b))}
                {b.unit} → 산출 {fmt(b.finalQty ?? 0)}
                {b.unit} / 껍질 {fmt(b.hullQty ?? 0)}
                {b.unit}
              </div>
            </button>
          ))
        )}
      </div>
    );
  };

  /* ---------- 새 배치 시작 ---------- */
  const renderNew = () => {
    const activeLine = draftLines[activeIdx];
    const unit = activeLine?.receipt.unit ?? 'kg';
    return (
      <div className="workPtBody">
        {scanFailure && (
          <div className="workPtScanFail" role="alert">
            <span>{scanFailure.message}</span>
            <button type="button" aria-label="닫기" onClick={() => setScanFailure(null)}>
              ✕
            </button>
          </div>
        )}

        {/* 라벨 번호 직접 입력 / 키보드형 스캐너 입력창 — Enter 또는 [조회] 로 GET 스캔 조회 */}
        <div className="workPtScanInput">
          <input
            type="text"
            value={codeInput}
            placeholder="라벨 번호 입력 또는 스캐너로 스캔"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            aria-label="입고 라벨 번호"
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitCodeInput();
              }
            }}
          />
          <button type="button" disabled={!codeInput.trim() || isScanning} onClick={submitCodeInput}>
            {isScanning ? '조회 중...' : '조회'}
          </button>
        </div>

        {draftLines.length === 0 ? (
          // 입고건이 하나도 없을 땐 기존 스캔 대기 화면의 "스캔 타겟" 프레임을 그대로 사용
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
            <p>입고 라벨을 스캔하면 이 화면에 쌓입니다. 여러 건을 스캔할 수 있습니다.</p>
          </div>
        ) : (
          <>
            <div className="workPtLabel">스캔된 입고건 {draftLines.length}건 · 투입량(N)을 입력할 건을 선택하세요</div>
            {draftLines.map((l, i) => {
              const q = draftQtys[i];
              const over = lineOver(l, q);
              return (
                <div
                  key={String(l.receipt.receiptId)}
                  className={`workPtLineCard ${i === activeIdx ? 'is-active' : ''} ${over ? 'is-over' : ''}`}
                >
                  <button type="button" className="workPtLineMain" onClick={() => setActiveIdx(i)}>
                    <span className="workPtLineInfo">
                      <b>{l.code}</b>
                      <span className={over ? 'is-error' : ''}>
                        {over ? '잔여수량 초과 — ' : ''}잔여 {fmt(l.receipt.remainingQty)} {l.receipt.unit}
                      </span>
                    </span>
                    {q === null ? (
                      <span className="workPtLineQty is-empty">투입량 입력</span>
                    ) : (
                      <span className="workPtLineQty">
                        {fmt(q)}
                        {l.receipt.unit}
                      </span>
                    )}
                  </button>
                  {/* [목업추가] 잘못 스캔한 입고건을 뺄 수 있는 버튼 (목업엔 없음) */}
                  <button
                    type="button"
                    className="workPtLineRemove"
                    aria-label={`${l.code} 제거`}
                    onClick={() => {
                      setDraftLines(draftLines.filter((_, idx) => idx !== i));
                      setActiveIdx(0);
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            {activeLine && (
              <>
                {/* [확인필요 #2] 설계안: "각 건 계량 → 투입량(N) 자동 입력". 저울 연동 방식(시리얼/블루투스/서버 경유)이
                    정해지지 않아서 지금은 기존 키패드로 직접 입력. 저울이 붙으면 이 자리에서 값을 setDraftLines 로 채워주면 된다. */}
                <div className="workPtLabel">{activeLine.code} 투입량(N)</div>
                <QtyEntry value={activeLine.input} unit={unit} onPress={handleKeypadPress} />
              </>
            )}
          </>
        )}

        {PRETREATMENT_USE_MOCK && (
          <button type="button" className="workPtDevBtn" onClick={handleMockScan}>
            🧪 가상 스캔 (목업 전용)
          </button>
        )}

        {errorMsg && <div className="workScanErrorMsg">{errorMsg}</div>}

        <button
          type="button"
          className="workPtBtn workPtBtn--primary"
          disabled={!canStart || isSubmitting}
          onClick={handleStart}
        >
          {isSubmitting ? '시작 중...' : '전처리 시작'}
        </button>
      </div>
    );
  };

  /* ---------- 배치 상세 ---------- */
  const renderDetail = () => {
    if (!selected) return <div className="workPtEmpty">배치를 찾을 수 없습니다. 목록에서 다시 선택해 주세요.</div>;
    const u = selected.unit;
    return (
      <div className="workPtBody">
        <div className="workPtDetailHead">
          <StatusChip status={selected.status} />
          <strong>배치 {selected.batchNo}</strong>
        </div>

        <div className="workPtLabel">투입 내역</div>
        <div className="workPtKv">
          {selected.lines.map((l) => (
            <div className="workPtKvRow" key={String(l.receiptId)}>
              {/* [확인필요 #11] 서버 라인 응답에 라벨 번호가 없어서, 이번 세션에서 스캔한 적 없는 입고건은 ID 로 표시 */}
              <span className="k">{l.barcode || `입고건 #${String(l.receiptId)}`}</span>
              <span className="v">
                {fmt(l.inputQty)}
                {u}
              </span>
            </div>
          ))}
          <div className="workPtKvRow workPtKvRow--total">
            <span className="k">투입량 합계</span>
            <span className="v">
              {fmt(sumInputQty(selected))}
              {u}
            </span>
          </div>
        </div>

        {selected.hullQty !== null && (
          <>
            <div className="workPtLabel">탈피완료 계량 결과</div>
            <div className="workPtKv">
              <div className="workPtKvRow">
                <span className="k" style={{ fontFamily: 'inherit' }}>껍질(H)</span>
                <span className="v">{fmt(selected.hullQty)}{u}</span>
              </div>
              <div className="workPtKvRow">
                <span className="k" style={{ fontFamily: 'inherit' }}>탈피후씨드(D)</span>
                <span className="v">{fmt(selected.dehulledQty ?? 0)}{u}</span>
              </div>
            </div>
          </>
        )}

        {selected.finalQty !== null && (
          <>
            <div className="workPtLabel">최종완료 계량 결과</div>
            <div className="workPtKv">
              <div className="workPtKvRow">
                <span className="k" style={{ fontFamily: 'inherit' }}>전처리후씨드(M)</span>
                <span className="v">{fmt(selected.finalQty)}{u}</span>
              </div>
            </div>
          </>
        )}

        {/* 상태별 가능한 작업 — 설계안 2-3 / 2-4 / 2-5
            진행중: 탈피완료 처리 / 병합 / 취소(진행중에서만)   탈피완료: 최종완료 처리 / 병합   완료: 없음 */}
        {selected.status === 'PROGRESS' && (
          <>
            <button type="button" className="workPtBtn workPtBtn--primary" onClick={openDehull}>
              탈피 완료 처리
            </button>
            <button type="button" className="workPtBtn" onClick={openMerge}>
              다른 배치와 병합
            </button>
            <button type="button" className="workPtBtn workPtBtn--danger" onClick={openCancel}>
              배치 취소
            </button>
          </>
        )}
        {selected.status === 'DEHULLED' && (
          <>
            <button type="button" className="workPtBtn workPtBtn--primary" onClick={openFinal}>
              최종 완료 처리
            </button>
            <button type="button" className="workPtBtn" onClick={openMerge}>
              다른 배치와 병합
            </button>
          </>
        )}
        {selected.status === 'DONE' && (
          <p className="workPtHint">완료된 배치입니다. 재고에 이미 반영되었습니다.</p>
        )}
      </div>
    );
  };

  /* ---------- 탈피 완료 처리 ---------- */
  const renderDehull = () => {
    if (!selected) return <div className="workPtEmpty">배치를 찾을 수 없습니다.</div>;
    const u = selected.unit;
    const totalN = sumInputQty(selected);
    const h = parseQty(hullInput);
    const d = parseQty(dInput);
    const guard = evaluateDehull(totalN, h, d, u);

    return (
      <div className="workPtBody">
        <p className="workPtHint">
          배치 {selected.batchNo} · 투입량 합계 {fmt(totalN)}
          {u}. 껍질(H)과 탈피후씨드(D)를 계량해 입력하세요. 확정하면 전처리전씨드가 차감되고 껍질 재고가 늘어납니다.
        </p>

        {/* 기존 "신고수량 입력 / 껍질수량 입력" 토글 UI 를 그대로 재사용 */}
        <div className="workScanInputMode">
          <button
            type="button"
            className={`workScanInputModeBtn ${dehullMode === 'hull' ? 'is-active' : ''}`}
            onClick={() => setDehullMode('hull')}
          >
            껍질(H) 입력
          </button>
          <button
            type="button"
            className={`workScanInputModeBtn ${dehullMode === 'dehulled' ? 'is-active' : ''}`}
            onClick={() => setDehullMode('dehulled')}
          >
            탈피후씨드(D) 입력
          </button>
        </div>

        <QtyEntry value={dehullMode === 'hull' ? hullInput : dInput} unit={u} onPress={handleKeypadPress} />

        <div className="workScanQtySummary">
          <div className="workScanQtySummaryItem">
            <span>껍질(H)</span>
            <strong>{h === null ? '-' : `${fmt(h)} ${u}`}</strong>
          </div>
          <div className="workScanQtySummaryItem">
            <span>탈피후씨드(D)</span>
            <strong>{d === null ? '-' : `${fmt(d)} ${u}`}</strong>
          </div>
          <div className="workScanQtySummaryItem workScanQtySummaryItem--total">
            <span>H + D / 투입량</span>
            <strong>
              {fmt((h ?? 0) + (d ?? 0))} / {fmt(totalN)}
            </strong>
          </div>
        </div>

        <GuardBox guard={guard} />
        {errorMsg && <div className="workScanErrorMsg">{errorMsg}</div>}

        <div className="workScanActionRow">
          <button type="button" className="workScanCancelBtn" onClick={handleBack} disabled={isSubmitting}>
            돌아가기
          </button>
          <button
            type="button"
            className="workScanSubmitBtn"
            onClick={handleDehullConfirm}
            disabled={!guard.canSubmit || isSubmitting}
          >
            {isSubmitting ? '처리 중...' : '탈피 완료 확정'}
          </button>
        </div>
      </div>
    );
  };

  /* ---------- 최종 완료 처리 ---------- */
  const renderFinal = () => {
    if (!selected) return <div className="workPtEmpty">배치를 찾을 수 없습니다.</div>;
    const u = selected.unit;
    const dQty = selected.dehulledQty ?? 0;
    const m = parseQty(mInput);
    const guard = evaluateFinal(dQty, m, u);

    return (
      <div className="workPtBody">
        <p className="workPtHint">
          배치 {selected.batchNo} · 탈피후씨드(D) {fmt(dQty)}
          {u}. 건조가 끝난 전처리후씨드(M)를 계량해 입력하세요. 확정하면 전처리후씨드 재고가 늘어납니다.
        </p>

        <QtyEntry value={mInput} unit={u} onPress={handleKeypadPress} />

        <GuardBox guard={guard} />
        {errorMsg && <div className="workScanErrorMsg">{errorMsg}</div>}

        <div className="workScanActionRow">
          <button type="button" className="workScanCancelBtn" onClick={handleBack} disabled={isSubmitting}>
            돌아가기
          </button>
          <button
            type="button"
            className="workScanSubmitBtn"
            onClick={handleFinalConfirm}
            disabled={!guard.canSubmit || isSubmitting}
          >
            {isSubmitting ? '처리 중...' : '최종 완료 확정'}
          </button>
        </div>
      </div>
    );
  };

  /* ---------- 배치 취소 ---------- */
  const renderCancel = () => {
    if (!selected) return <div className="workPtEmpty">배치를 찾을 수 없습니다.</div>;
    return (
      <div className="workPtBody">
        <p className="workPtHint">
          배치 {selected.batchNo} 를 취소하면 예약된 잔여수량이 자동으로 복구됩니다. 실제 재고에는 영향이 없습니다.
        </p>
        <div className="workPtLabel">취소 사유 (선택)</div>
        <textarea
          className="workPtTextarea"
          rows={3}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="예: 작업자 착오로 잘못 시작함"
        />
        {errorMsg && <div className="workScanErrorMsg">{errorMsg}</div>}
        <button
          type="button"
          className="workPtBtn workPtBtn--danger"
          onClick={handleCancelConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? '취소 중...' : '배치 취소 확정'}
        </button>
        <button type="button" className="workPtBtn" onClick={handleBack} disabled={isSubmitting}>
          돌아가기
        </button>
      </div>
    );
  };

  /* ---------- 배치 병합 ---------- */
  const renderMerge = () => {
    if (!selected) return <div className="workPtEmpty">배치를 찾을 수 없습니다.</div>;
    // 설계안 2-4: 같은 상태의 헤더끼리만 병합 가능
    const candidates = batches.filter((b) => b.batchId !== selected.batchId && b.status === selected.status);
    // [확인필요 #6] 병합 규칙은 설계안 문장만으로는 세부가 비어 있음 — 아래 안내문도 내 해석이다.
    const rule =
      selected.status === 'PROGRESS'
        ? '투입 내역(입고건)이 선택한 배치로 옮겨지고, 현재 배치는 사라집니다.'
        : '이미 반영된 재고는 그대로 두고, 탈피후씨드(D)만 합쳐져 최종 완료 때 하나의 M으로 계량합니다.';
    return (
      <div className="workPtBody">
        <p className="workPtHint">같은 상태({STATUS_LABEL[selected.status]})인 다른 배치로 합칠 수 있습니다. {rule}</p>
        {candidates.length === 0 ? (
          <div className="workPtEmpty">합칠 수 있는 배치가 없습니다</div>
        ) : (
          candidates.map((c) => (
            <div className="workPtMergePick" key={c.batchId}>
              <div>
                <b>배치 {c.batchNo}</b>
                <span>
                  투입량 {fmt(sumInputQty(c))}
                  {c.unit}
                  {c.dehulledQty !== null && ` · 탈피후씨드 ${fmt(c.dehulledQty)}${c.unit}`}
                </span>
              </div>
              <button type="button" disabled={isSubmitting} onClick={() => handleMerge(c)}>
                이 배치로 합치기
              </button>
            </div>
          ))
        )}
        {errorMsg && <div className="workScanErrorMsg">{errorMsg}</div>}
      </div>
    );
  };

  const renderBody = () => {
    switch (view) {
      case 'home':
        return renderHome();
      case 'new':
        return renderNew();
      case 'detail':
        return renderDetail();
      case 'dehull':
        return renderDehull();
      case 'final':
        return renderFinal();
      case 'cancel':
        return renderCancel();
      case 'merge':
        return renderMerge();
    }
  };

  return (
    <div className="workTabletPage">
      <div className="workScanPanel">
        <div className={`workScanContainer workScanContainer--${zoneVariant}`}>
          <div className="workScanTopBar">
            <button type="button" className="workScanHomeBtn" onClick={handleBack}>
              {view === 'home' ? '← 돌아가기' : '← 이전'}
            </button>
            {/* 스캔이 의미 있는 "새 배치 시작" 화면에서만 스캔 버튼/상태 표시 */}
            {view === 'new' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <NativeScanButton isNative={isNative} onClick={startScan} disabled={isSubmitting || isScanning} />
                <span className={`workScanStatus workScanStatus--${statusVariant}`}>
                  <span className="workScanStatusDot" />
                  {statusLabel}
                </span>
              </div>
            ) : (
              <span />
            )}
          </div>

          <div className="workScanMain">
            <div className="workTabletScanHeader">
              <span className={`workTabletScanZoneBadge workTabletScanZoneBadge--${zoneVariant}`}>
                <MapPinIcon aria-hidden="true" />
                {zoneLabel}
              </span>
              <ChevronRightIcon className="workTabletScanArrow" aria-hidden="true" />
              {/* [확인필요] 홈 메뉴 버튼 이름은 아직 "신고처리". 목업 제목은 "전처리 신고" → 용어 통일 필요 */}
              <span className={`workTabletScanProcessBadge workTabletScanProcessBadge--${zoneVariant}`}>
                전처리 신고
              </span>
            </div>
            {view !== 'home' && <h1 className="workPtTitle">{VIEW_TITLE[view]}</h1>}

            {renderBody()}
          </div>

          {toast && <div className="workScanSuccessToast">{toast}</div>}
        </div>
      </div>
    </div>
  );
}
