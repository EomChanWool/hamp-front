import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import axios from "axios";
import { Panel } from "@components/card/Panel";
import { SearchBand, type SearchField } from "@components/search/SearchBand";
import { Badge } from "@/components/common/Badge";
import Spinner from "@/components/common/Spinner";
import { QrLabelPrintModal, type QrLabelItem } from "@/components/modal/QrLabelPrintModal";
import { formatDateTime } from "@/utils/common";
import {
  SeedGoodsReceiptApi,
  type SeedGoodsReceiptOrderSummaryResponse,
  type SeedGoodsReceiptResponse,
} from "@/api/ioSeed/SeedGoodsReceipt";
import type { StatusTone } from "@/types";
import "@components/table/Custable.css";
import "@/pages/page/ioSeed/ioSeed.css";

// 백엔드 status 값: 입고대기 / 미만입고 / 입고 / 초과입고 / 수주종료
const STATUS_OPTIONS = ["입고대기", "미만입고", "입고", "초과입고", "수주종료"];

const STATUS_TONE: Record<string, StatusTone> = {
  입고대기: "muted",
  미만입고: "info",
  입고: "good",
  초과입고: "danger",
  수주종료: "good",
};

const CLOSED_STATUS = "수주종료";

/** 수주 상세 펼침 시 입고 내역을 한 번에 받아오는 최대 건수 */
const RECEIPT_FETCH_SIZE = 1000;

type InlineForm = {
  receivedAt: string;
  receiptQty: string;
  note: string;
  boxQty: string;
};

type InlineEditing =
  | { mode: "create"; orderCode: string }
  | { mode: "edit"; orderCode: string; receiptId: number };

const EMPTY_FORM: InlineForm = { receivedAt: "", receiptQty: "", note: "", boxQty: "1" };

function formatQty(value: number | null | undefined, unit: string | null | undefined) {
  const qty = (value ?? 0).toLocaleString();
  return unit ? `${qty} ${unit}` : qty;
}

/** 숫자·소수점만 남기고 소수점은 하나, 소수 둘째 자리까지만 (DB decimal(12,2)) */
function sanitizeQty(text: string) {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex === -1) return cleaned;
  const intPart = cleaned.slice(0, dotIndex);
  const decimalPart = cleaned.slice(dotIndex + 1).replace(/\./g, "").slice(0, 2);
  return `${intPart}.${decimalPart}`;
}

/** 쉼표 없는 수량 문자열에 천 단위 쉼표를 붙인다 (입력 중인 소수점·소수부는 그대로) */
function formatQtyInput(raw: string) {
  if (raw === "") return "";
  const [intPart, decimalPart] = raw.split(".");
  const intText = intPart === "" ? "" : Number(intPart).toLocaleString("ko-KR");
  return decimalPart === undefined ? intText : `${intText || "0"}.${decimalPart}`;
}

type QtyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  /** 쉼표 없는 수량 문자열 (비어 있을 수 있음) */
  value: string;
  onValueChange: (value: string) => void;
};

/** 입력 중에도 천 단위 쉼표를 표시하는 수량 입력칸 (소수 둘째 자리까지). 값은 쉼표 없이 전달 */
function QtyInput({ value, onValueChange, ...inputProps }: QtyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const charsBeforeCaretRef = useRef<number | null>(null);

  // 쉼표가 추가·삭제되어도 커서가 같은 숫자 뒤에 머물도록 복원
  useLayoutEffect(() => {
    const input = inputRef.current;
    const charsBeforeCaret = charsBeforeCaretRef.current;
    if (!input || charsBeforeCaret === null) return;
    charsBeforeCaretRef.current = null;

    let caret = 0;
    let seen = 0;
    while (caret < input.value.length && seen < charsBeforeCaret) {
      if (/[0-9.]/.test(input.value[caret])) seen++;
      caret++;
    }
    input.setSelectionRange(caret, caret);
  });

  return (
    <input
      {...inputProps}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={formatQtyInput(value)}
      onChange={(e) => {
        const caret = e.target.selectionStart ?? e.target.value.length;
        const next = sanitizeQty(e.target.value);
        charsBeforeCaretRef.current = sanitizeQty(e.target.value.slice(0, caret)).length;
        onValueChange(next);
      }}
    />
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
  return message || fallback;
}

/** 입고 1건의 박스 수 (라벨 매수). 값이 없으면 1장 */
function getBoxCount(receipt: SeedGoodsReceiptResponse) {
  return receipt.boxQty && receipt.boxQty > 0 ? receipt.boxQty : 1;
}

export function SeedInboundManagePage() {
  const [summaries, setSummaries] = useState<SeedGoodsReceiptOrderSummaryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchFilters, setSearchFilters] = useState({ orderCode: "", status: "" });
  const [refreshKey, setRefreshKey] = useState(0);

  const [expandedOrderCodes, setExpandedOrderCodes] = useState<string[]>([]);
  const [receiptsByOrder, setReceiptsByOrder] = useState<Record<string, SeedGoodsReceiptResponse[]>>({});
  const [loadingOrderCodes, setLoadingOrderCodes] = useState<string[]>([]);

  const [editing, setEditing] = useState<InlineEditing | null>(null);
  const [form, setForm] = useState<InlineForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  const [selectedReceiptIds, setSelectedReceiptIds] = useState<number[]>([]);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isMarkingPrinted, setIsMarkingPrinted] = useState(false);

  const orderCodeRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);

  const searchFields: SearchField[] = useMemo(
    () => [
      {
        type: "input",
        label: "수주코드",
        ref: orderCodeRef,
        name: "orderCode",
        placeholder: "수주코드 검색 (예: SO-0002)",
      },
      {
        type: "select",
        label: "상태",
        ref: statusRef,
        name: "status",
        options: [{ label: "전체", value: "" }, ...STATUS_OPTIONS.map((s) => ({ label: s, value: s }))],
      },
    ],
    [],
  );

  // refreshKey: 등록·수정·삭제·인쇄 후 재조회 트리거
  useEffect(() => {
    let ignore = false;
    const params: { orderCode?: string; status?: string } = {};
    if (searchFilters.orderCode) params.orderCode = searchFilters.orderCode;
    if (searchFilters.status) params.status = searchFilters.status;

    SeedGoodsReceiptApi.getOrderSummary(params)
      .then((response) => {
        if (!ignore) setSummaries(response.data ?? []);
      })
      .catch((error) => {
        if (ignore) return;
        console.error("수주별 원료 입고 현황 조회 실패:", error);
        window.alert(getErrorMessage(error, "데이터를 불러오는 중 오류가 발생했습니다."));
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [searchFilters, refreshKey]);

  const loadOrderReceipts = useCallback(async (orderCode: string) => {
    setLoadingOrderCodes((prev) => (prev.includes(orderCode) ? prev : [...prev, orderCode]));
    try {
      const response = await SeedGoodsReceiptApi.getList({ orderCode, page: 0, size: RECEIPT_FETCH_SIZE });
      // 서버 orderCode 검색이 부분 일치일 수 있어 해당 수주 건만 남긴다
      const content = (response.data?.content ?? []).filter((r) => r.orderCode === orderCode);
      setReceiptsByOrder((prev) => ({ ...prev, [orderCode]: content }));
    } catch (error) {
      console.error("입고 내역 조회 실패:", error);
      window.alert(getErrorMessage(error, "입고 내역을 불러오는 중 오류가 발생했습니다."));
    } finally {
      setLoadingOrderCodes((prev) => prev.filter((code) => code !== orderCode));
    }
  }, []);

  /** 저장·삭제·인쇄 후: 집계와 해당 수주 입고 내역을 다시 조회 */
  const refreshOrders = (orderCodes: string[]) => {
    setRefreshKey((prev) => prev + 1);
    Array.from(new Set(orderCodes)).forEach((code) => {
      void loadOrderReceipts(code);
    });
  };

  const resetViewState = () => {
    setIsLoading(true);
    setExpandedOrderCodes([]);
    setReceiptsByOrder({});
    setEditing(null);
    setSelectedReceiptIds([]);
  };

  const handleSearch = () => {
    setSearchFilters({
      orderCode: orderCodeRef.current?.value.trim() || "",
      status: statusRef.current?.value || "",
    });
    resetViewState();
  };

  const handleReset = () => {
    if (orderCodeRef.current) orderCodeRef.current.value = "";
    if (statusRef.current) statusRef.current.value = "";
    setSearchFilters({ orderCode: "", status: "" });
    resetViewState();
  };

  const handleToggleOrder = (orderCode: string) => {
    if (expandedOrderCodes.includes(orderCode)) {
      const isEditingHere = editing?.orderCode === orderCode;
      // 저장 중에는 입력 행이 사라지지 않도록 접지 않는다
      if (isEditingHere && isSaving) return;
      // 접힌 수주 안에 입력 행이 숨어 다른 수주 버튼이 잠긴 채 남지 않도록 편집을 취소
      if (isEditingHere) {
        setEditing(null);
        setForm(EMPTY_FORM);
      }
      setExpandedOrderCodes((prev) => prev.filter((code) => code !== orderCode));
      return;
    }
    setExpandedOrderCodes((prev) => [...prev, orderCode]);
    if (!receiptsByOrder[orderCode]) void loadOrderReceipts(orderCode);
  };

  const handleStartCreate = (orderCode: string) => {
    if (editing || isSaving) return;
    setForm(EMPTY_FORM);
    setEditing({ mode: "create", orderCode });
  };

  const handleStartEdit = (receipt: SeedGoodsReceiptResponse) => {
    if (editing || isSaving || !receipt.orderCode) return;
    setForm({
      receivedAt: receipt.receivedAt ? receipt.receivedAt.slice(0, 16) : "",
      receiptQty: String(receipt.receiptQty ?? ""),
      note: receipt.note ?? "",
      boxQty: String(receipt.boxQty ?? 1),
    });
    setEditing({ mode: "edit", orderCode: receipt.orderCode, receiptId: receipt.receiptId });
  };

  const handleCancelEditing = () => {
    if (isSaving) return;
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  /** 저장 후 누적 입고수량이 계약 원료수량을 넘으면 확인. false 면 저장 중단 */
  const confirmOverReceipt = (summary: SeedGoodsReceiptOrderSummaryResponse, receiptQty: number) => {
    if (summary.orderQty == null || !editing) return true;

    const previousQty =
      editing.mode === "edit"
        ? (receiptsByOrder[editing.orderCode] ?? []).find((r) => r.receiptId === editing.receiptId)?.receiptQty ?? 0
        : 0;
    const nextReceivedQty = (summary.receivedQty ?? 0) - previousQty + receiptQty;
    const overQty = nextReceivedQty - summary.orderQty;
    if (overQty <= 0) return true;

    const overText = formatQty(overQty, summary.unit);
    if (form.note.trim()) {
      return window.confirm(
        `저장하면 누적 입고수량이 계약 원료수량보다 ${overText} 많아집니다.\n그대로 저장하시겠습니까?`,
      );
    }

    const proceed = window.confirm(
      `저장하면 누적 입고수량이 계약 원료수량보다 ${overText} 많아집니다.\n` +
        "비고에 초과 사유를 입력하지 않았습니다. 비고 없이 저장하시겠습니까?\n\n" +
        "[취소]를 누르면 비고 입력칸으로 이동합니다.",
    );
    if (!proceed) noteInputRef.current?.focus();
    return proceed;
  };

  const handleSaveInline = async (summary: SeedGoodsReceiptOrderSummaryResponse) => {
    if (!editing || isSaving) return;

    if (!form.receivedAt) {
      window.alert("입고일시를 입력해주세요.");
      return;
    }
    const receiptQty = Number(form.receiptQty);
    if (form.receiptQty.trim() === "" || !Number.isFinite(receiptQty) || receiptQty <= 0) {
      window.alert("입고수량은 0보다 커야 합니다.");
      return;
    }
    const boxQty = Number(form.boxQty);
    if (!Number.isInteger(boxQty) || boxQty < 1) {
      window.alert("박스수는 1 이상의 정수로 입력해주세요.");
      return;
    }
    if (!confirmOverReceipt(summary, receiptQty)) return;

    const payload = {
      orderCode: editing.orderCode,
      receiptQty,
      boxQty,
      receivedAt: form.receivedAt,
      note: form.note.trim(),
    };

    setIsSaving(true);
    try {
      const response =
        editing.mode === "create"
          ? await SeedGoodsReceiptApi.create(payload)
          : await SeedGoodsReceiptApi.update(editing.receiptId, payload);
      window.alert(response.message || (editing.mode === "create" ? "등록되었습니다." : "수정되었습니다."));
      setEditing(null);
      setForm(EMPTY_FORM);
      refreshOrders([editing.orderCode]);
    } catch (error) {
      console.error(editing.mode === "create" ? "등록 실패:" : "수정 실패:", error);
      window.alert(getErrorMessage(error, editing.mode === "create" ? "등록에 실패했습니다." : "수정에 실패했습니다."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (receipt: SeedGoodsReceiptResponse) => {
    if (deletingId !== null || editing || !receipt.orderCode) return;

    const confirmed = window.confirm(
      `[${receipt.orderCode}] ${receipt.receivedAt ? formatDateTime(receipt.receivedAt) : "-"} · ` +
        `${formatQty(receipt.receiptQty, receipt.unit)} 입고를 삭제하시겠습니까?`,
    );
    if (!confirmed) return;

    setDeletingId(receipt.receiptId);
    try {
      const response = await SeedGoodsReceiptApi.delete(receipt.receiptId);
      window.alert(response.message || "삭제되었습니다.");
      setSelectedReceiptIds((prev) => prev.filter((id) => id !== receipt.receiptId));
      refreshOrders([receipt.orderCode]);
    } catch (error) {
      console.error("삭제 실패:", error);
      window.alert(getErrorMessage(error, "삭제에 실패했습니다."));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleReceiptSelection = (receiptId: number) => {
    setSelectedReceiptIds((prev) =>
      prev.includes(receiptId) ? prev.filter((id) => id !== receiptId) : [...prev, receiptId],
    );
  };

  const toggleOrderSelection = (orderCode: string, checked: boolean) => {
    const ids = (receiptsByOrder[orderCode] ?? []).map((r) => r.receiptId);
    setSelectedReceiptIds((prev) =>
      checked ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id)),
    );
  };

  const allReceipts = useMemo(() => Object.values(receiptsByOrder).flat(), [receiptsByOrder]);

  const selectedReceipts = useMemo(
    () => allReceipts.filter((r) => selectedReceiptIds.includes(r.receiptId)),
    [allReceipts, selectedReceiptIds],
  );

  const selectedLabelCount = selectedReceipts.reduce((sum, r) => sum + getBoxCount(r), 0);

  // 박스 수만큼 같은 바코드 라벨을 n/N 표기로 나눠 만든다
  const labelItems: QrLabelItem[] = useMemo(
    () =>
      selectedReceipts.flatMap((r) => {
        const boxCount = getBoxCount(r);
        const receivedAtText = r.receivedAt ? formatDateTime(r.receivedAt) : "-";
        return Array.from({ length: boxCount }, (_, i) => ({
          id: `${r.receiptId}-${i + 1}`,
          qrValue: r.barcode || String(r.receiptId),
          title: `${r.orderCode ?? "-"} · ${i + 1}/${boxCount} · ${receivedAtText}`,
          name: r.itemNm || "",
          code: r.itemCode,
          qty: r.receiptQty,
          qtyLabel: "입고수량",
          unit: r.unit || "",
        }));
      }),
    [selectedReceipts],
  );

  const handleOpenLabelModal = () => {
    if (selectedReceipts.length === 0) {
      window.alert("인쇄할 입고 건을 먼저 선택해주세요.");
      return;
    }
    setIsLabelModalOpen(true);
  };

  const handlePrinted = async () => {
    const targets = selectedReceipts;
    if (targets.length === 0) return;
    setIsMarkingPrinted(true);
    try {
      await SeedGoodsReceiptApi.markPrinted(targets.map((r) => r.receiptId));
      setIsLabelModalOpen(false);
      setSelectedReceiptIds([]);
      refreshOrders(targets.map((r) => r.orderCode).filter((code): code is string => !!code));
    } catch (error) {
      console.error("라벨 인쇄 완료 표시 실패:", error);
      window.alert(getErrorMessage(error, "라벨 인쇄 완료 표시에 실패했습니다."));
    } finally {
      setIsMarkingPrinted(false);
    }
  };

  const renderInlineInputs = (summary: SeedGoodsReceiptOrderSummaryResponse, labelCell: ReactNode) => (
    <>
      <td>
        <input
          className="tableInput"
          type="datetime-local"
          aria-label="입고일시"
          value={form.receivedAt}
          onChange={(e) => setForm((prev) => ({ ...prev, receivedAt: e.target.value }))}
        />
      </td>
      <td>
        <QtyInput
          className="tableInput seedInboundQtyInput"
          aria-label="입고수량"
          placeholder={summary.unit ?? "수량"}
          value={form.receiptQty}
          onValueChange={(value) => setForm((prev) => ({ ...prev, receiptQty: value }))}
        />
      </td>
      <td>
        <input
          ref={noteInputRef}
          className="tableInput"
          type="text"
          maxLength={255}
          aria-label="비고"
          placeholder="메모 (선택)"
          value={form.note}
          onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
        />
      </td>
      <td>
        <input
          className="tableInput seedInboundBoxInput"
          type="number"
          min="1"
          step="1"
          aria-label="박스수"
          value={form.boxQty}
          onChange={(e) => setForm((prev) => ({ ...prev, boxQty: e.target.value }))}
        />
      </td>
      <td>{labelCell}</td>
      <td>
        <div className="rowActions">
          <button
            type="button"
            className="miniButton primary compact"
            disabled={isSaving}
            onClick={() => handleSaveInline(summary)}
          >
            {isSaving ? "저장 중" : "저장"}
          </button>
          <button type="button" className="miniButton danger" disabled={isSaving} onClick={handleCancelEditing}>
            취소
          </button>
        </div>
      </td>
    </>
  );

  const renderLabelBadge = (printed: boolean) => (
    <Badge tone={printed ? "good" : "muted"}>{printed ? "인쇄완료" : "미인쇄"}</Badge>
  );

  const renderOrderDetail = (summary: SeedGoodsReceiptOrderSummaryResponse) => {
    const { orderCode } = summary;
    const receipts = receiptsByOrder[orderCode] ?? [];
    const isOrderLoading = loadingOrderCodes.includes(orderCode);
    const isCreatingHere = editing?.mode === "create" && editing.orderCode === orderCode;
    const allSelected = receipts.length > 0 && receipts.every((r) => selectedReceiptIds.includes(r.receiptId));

    return (
      <div className="seedInboundDetail">
        <div className="seedInboundDetail__head">
          <span className="seedInboundDetail__title">{orderCode} 입고 내역</span>
          <button
            type="button"
            className="miniButton primary"
            disabled={editing !== null || isSaving}
            onClick={() => handleStartCreate(orderCode)}
          >
            + 입고 추가
          </button>
        </div>
        <table className="seedInboundDetail__table">
          <thead>
            <tr>
              <th className="seedInboundCheckCol">
                <input
                  type="checkbox"
                  className="checkbox"
                  aria-label={`${orderCode} 입고 전체 선택`}
                  checked={allSelected}
                  disabled={receipts.length === 0}
                  onChange={(e) => toggleOrderSelection(orderCode, e.target.checked)}
                />
              </th>
              <th>입고일시</th>
              <th>입고수량</th>
              <th>비고</th>
              <th>박스수</th>
              <th>라벨</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {isOrderLoading && receipts.length === 0 ? (
              <tr>
                <td colSpan={7} className="seedInboundDetail__empty">
                  불러오는 중...
                </td>
              </tr>
            ) : (
              <>
                {receipts.length === 0 && !isCreatingHere && (
                  <tr>
                    <td colSpan={7} className="seedInboundDetail__empty">
                      아직 등록된 입고가 없습니다. "입고 추가"를 눌러 등록하세요.
                    </td>
                  </tr>
                )}
                {receipts.map((r) => {
                  const isEditingRow = editing?.mode === "edit" && editing.receiptId === r.receiptId;
                  if (isEditingRow) {
                    return (
                      <tr key={r.receiptId}>
                        <td className="seedInboundCheckCol" />
                        {renderInlineInputs(summary, renderLabelBadge(r.labelPrinted))}
                      </tr>
                    );
                  }
                  const isDeleting = deletingId === r.receiptId;
                  const disableRow = editing !== null || deletingId !== null;
                  return (
                    <tr key={r.receiptId}>
                      <td className="seedInboundCheckCol">
                        <input
                          type="checkbox"
                          className="checkbox"
                          aria-label={`입고 ${r.receiptId} 선택`}
                          checked={selectedReceiptIds.includes(r.receiptId)}
                          onChange={() => toggleReceiptSelection(r.receiptId)}
                        />
                      </td>
                      <td>{r.receivedAt ? formatDateTime(r.receivedAt) : "-"}</td>
                      <td>{formatQty(r.receiptQty, r.unit)}</td>
                      <td className="seedInboundNoteCell">{r.note || "-"}</td>
                      <td>{getBoxCount(r)}박스</td>
                      <td>{renderLabelBadge(r.labelPrinted)}</td>
                      <td>
                        <div className="rowActions">
                          <button
                            type="button"
                            className="miniButton"
                            disabled={disableRow}
                            onClick={() => handleStartEdit(r)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="miniButton danger"
                            disabled={disableRow}
                            onClick={() => handleDelete(r)}
                          >
                            {isDeleting ? "삭제 중" : "삭제"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {isCreatingHere && (
                  <tr>
                    <td className="seedInboundCheckCol" />
                    {renderInlineInputs(summary, renderLabelBadge(false))}
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderProgress = (summary: SeedGoodsReceiptOrderSummaryResponse) => {
    const orderQty = summary.orderQty ?? 0;
    const receivedQty = summary.receivedQty ?? 0;
    const percent = orderQty > 0 ? (receivedQty / orderQty) * 100 : 0;
    const isOver = orderQty > 0 && receivedQty > orderQty;
    const remainingQty = Math.max(orderQty - receivedQty, 0);

    return (
      <div className="seedInboundProgress">
        <div
          className="seedInboundProgress__track"
          role="progressbar"
          aria-label={`${summary.orderCode} 입고 진행률`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(percent, 100))}
        >
          <div
            className={`seedInboundProgress__fill${isOver ? " seedInboundProgress__fill--over" : ""}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <span className="seedInboundProgress__text">
          {Math.round(percent)}%{isOver ? "" : ` · 잔여 ${formatQty(remainingQty, summary.unit)}`}
        </span>
      </div>
    );
  };

  const renderStatusBadge = (summary: SeedGoodsReceiptOrderSummaryResponse) => {
    const diff = (summary.receivedQty ?? 0) - (summary.orderQty ?? 0);
    let text = summary.status;
    if (summary.status === "미만입고") text = `미만입고 -${formatQty(Math.abs(diff), summary.unit)}`;
    if (summary.status === "초과입고") text = `초과입고 +${formatQty(Math.abs(diff), summary.unit)}`;
    return <Badge tone={STATUS_TONE[summary.status] ?? "muted"}>{text}</Badge>;
  };

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel
        title="수주별 원료 입고 현황"
        action={
          <div className="seedInboundPanelActions">
            <button type="button" className="ghostButton" onClick={handleOpenLabelModal}>
              선택 라벨 인쇄 ({selectedReceipts.length}건 · 라벨 {selectedLabelCount}장)
            </button>
            {selectedReceipts.length > 0 && (
              <button type="button" className="ghostButton" onClick={() => setSelectedReceiptIds([])}>
                일괄취소
              </button>
            )}
          </div>
        }
      >
        <div className="relative min-h-[300px]">
          {isLoading && summaries.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="tableWrap">
              <table className="seedInboundOrderTable">
                <thead>
                  <tr>
                    <th className="seedInboundChevronCol" aria-label="펼침" />
                    <th>수주코드</th>
                    <th>계약 원료수량</th>
                    <th>누적 입고수량</th>
                    <th>진행률</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.length === 0 ? (
                    <tr>
                      <td colSpan={6}>조회된 데이터가 없습니다.</td>
                    </tr>
                  ) : (
                    summaries.map((summary) => {
                      const isOpen = expandedOrderCodes.includes(summary.orderCode);
                      const isClosed = summary.status === CLOSED_STATUS;
                      const isOver = summary.status === "초과입고";
                      return (
                        <Fragment key={summary.orderCode}>
                          <tr
                            className={`seedInboundOrderRow${isOpen ? " is-open" : ""}${isClosed ? " is-closed" : ""}`}
                            aria-expanded={isOpen}
                            onClick={() => handleToggleOrder(summary.orderCode)}
                          >
                            <td className="seedInboundChevronCol">
                              <span className="seedInboundChevron" aria-hidden>
                                ▶
                              </span>
                            </td>
                            <td>
                              <div className="itemCell">
                                <span className="itemCell__name">{summary.orderCode}</span>
                                <span className="itemCell__code">{summary.bpNm || "-"}</span>
                              </div>
                            </td>
                            <td>{summary.orderQty == null ? "-" : formatQty(summary.orderQty, summary.unit)}</td>
                            <td className={isOver ? "seedInboundOverText" : undefined}>
                              {formatQty(summary.receivedQty, summary.unit)}
                            </td>
                            <td>{renderProgress(summary)}</td>
                            <td>{renderStatusBadge(summary)}</td>
                          </tr>
                          {isOpen && (
                            <tr className={`seedInboundDetailRow${isClosed ? " is-closed" : ""}`}>
                              <td colSpan={6}>{renderOrderDetail(summary)}</td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      <QrLabelPrintModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        items={labelItems}
        modalTitle={`라벨 인쇄 미리보기 (${selectedReceipts.length}건 · 라벨 ${labelItems.length}장)`}
        onPrinted={handlePrinted}
        isBusy={isMarkingPrinted}
      />
    </section>
  );
}
