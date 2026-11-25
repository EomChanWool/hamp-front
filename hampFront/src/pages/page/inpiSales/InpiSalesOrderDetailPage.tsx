import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { FiberSalesOrderApi } from "@/api/sales/FiberSalesOrder";
import type {
  FiberSalesOrderDetailResponse,
  FiberSalesOrderUpdateRequest,
} from "@/api/sales/FiberSalesOrder";
import { BusinessPartnerApi } from "@/api/sales/BusinessPartner";
import { ItemApi, type ItemOptionResponse } from "@/api/master/Item";
import Spinner from "@/components/common/Spinner";
import { NumberInput } from "@/components/common/NumberInput";
import { focusField, formatDateTime } from "@/utils/common";
import { DetailLayout, type DetailSection } from "@/pages/layout/DetailLayout";
import { type SelectOption } from "@/pages/layout/DetailSelect";
import {
  FIBER_ALLOCATION_ELEMENT_ID,
  FiberAllocationBar,
  FiberSalesOrderAllocationSection,
  type FiberAllocationSegment,
} from "@/components/common/FiberSalesOrderAllocationSection";
import {
  FIBER_PRODUCT_ITEM_CATEGORY,
  FIBER_QTY_UNIT,
  FIBER_RAW_ITEM_CATEGORY,
  FIBER_STATUS_LABEL,
  FIBER_STATUS_OPTIONS,
  buildLineRequests,
  formatKg,
  formatWon,
  r2,
  toAllocationLines,
  validateFiberOrder,
  type FiberAllocationLine,
  type FiberOrderValidationField,
} from "@/utils/fiberSalesOrderAllocation";
import "@/pages/page/inpiSales/InpiSales.css";

const LIST_PATH = "/inpi-sales/sales-order";

// 폼은 문자열로 들고 있어 숫자 입력칸에 넘길 때만 바꾼다 (빈 값이면 null)
const toNumberOrNull = (value: string | null | undefined) => (value == null || value === "" ? null : Number(value));

// 상세 응답 → 폼 값 (읽기 모드 표시 / 수정 모드 초기값 공용)
const toForm = (data: FiberSalesOrderDetailResponse): Record<string, any> => ({
  orderCode: data.orderCode,
  bpCode: data.bpCode,
  bpNm: data.bpNm,
  rawItemCode: data.rawItemCode,
  rawItemNm: data.rawItemNm,
  requestInputQty: data.requestInputQty != null ? String(data.requestInputQty) : "",
  processingFee: data.processingFee != null ? String(data.processingFee) : "",
  requestSpec: data.requestSpec ?? "",
  orderDate: data.orderDate ?? "",
  dueDate: data.dueDate ?? "",
  status: data.status,
  note: data.note ?? "",
  receivedQty: data.receivedQty ?? 0,
  receiptCount: data.receiptCount ?? 0,
  createdAt: formatDateTime(data.createdAt),
});

export function InpiSalesOrderDetailPage() {
  const { orderCode } = useParams<{ orderCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [order, setOrder] = useState<FiberSalesOrderDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // 저장을 한 번 눌러 검증에 걸린 뒤부터 비어 있는 필수 칸을 빨갛게 표시 (수정을 새로 시작하면 초기화)
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Record<string, any>>({});
  // 수정 중인 제품별 원물 배분 라인
  const [lines, setLines] = useState<FiberAllocationLine[]>([]);

  const [businessPartnerOptions, setBusinessPartnerOptions] = useState<any[]>([]);
  const [rawItemOptions, setRawItemOptions] = useState<ItemOptionResponse[]>([]);
  const [productOptions, setProductOptions] = useState<ItemOptionResponse[]>([]);

  const isBusy = isUpdating || isDeleting;

  // 입고 내역이 있으면 거래처/투입원료 품목은 바꿀 수 없다
  const isLocked = (order?.receiptCount ?? 0) > 0;

  const bpSelectOptions = useMemo<SelectOption[]>(
    () =>
      businessPartnerOptions.map((opt) => ({
        value: opt.bpCode,
        label: `${opt.bpCode} (${opt.bpNm ?? "-"})`,
      })),
    [businessPartnerOptions]
  );

  const rawSelectOptions = useMemo<SelectOption[]>(
    () =>
      rawItemOptions.map((opt) => ({
        value: opt.itemCode,
        label: `${opt.itemCode} (${opt.itemNm ?? "-"})`,
      })),
    [rawItemOptions]
  );

  // 섹션 정의 (거래처/투입원료/상태는 셀렉트박스)
  const sections: DetailSection<FiberSalesOrderDetailResponse>[] = [
    {
      title: "거래처 정보",
      fields: [
        { label: "거래처명", key: "bpNm", editable: false },
        {
          label: "거래처코드",
          key: "bpCode",
          editable: !isLocked,
          options: bpSelectOptions,
          placeholder: "거래처를 선택해주세요",
          searchable: true,
          // 읽기 모드는 코드만 표시 (거래처명은 위 필드에 이미 있음)
          renderValue: (value) => value || "-",
        },
      ],
    },
    {
      title: "처리 정보",
      fields: [
        {
          label: "수주일",
          key: "orderDate",
          editable: true,
          required: true,
          renderEditor: (value, onChange, disabled) => (
            <input
              type="date"
              className="tableInput"
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
            />
          ),
        },
        {
          label: "납기일",
          key: "dueDate",
          editable: true,
          renderEditor: (value, onChange, disabled) => (
            <input
              type="date"
              className="tableInput"
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
            />
          ),
          renderValue: (value) => value || "-",
        },
        {
          label: "상태",
          key: "status",
          editable: true,
          options: FIBER_STATUS_OPTIONS,
          renderValue: (value) => FIBER_STATUS_LABEL[value] ?? (value || "-"),
        },
        { label: "비고", key: "note", editable: true },
      ],
    },
    {
      title: "투입원료",
      fields: [
        {
          label: "투입원료",
          key: "rawItemCode",
          editable: !isLocked,
          options: rawSelectOptions,
          placeholder: "투입원료를 선택해주세요",
          searchable: true,
          renderValue: (value) => (!value ? "-" : form.rawItemNm ? `${value} (${form.rawItemNm})` : value),
        },
        {
          label: "투입원료 수량",
          key: "requestInputQty",
          editable: true,
          required: true,
          renderEditor: (value, onChange, disabled, inputId) => (
            <NumberInput
              ref={qtyInputRef}
              id={inputId}
              className="tableInput"
              style={{ textAlign: "right" }}
              wrapClassName="soNumberEdit"
              suffix={<span>{FIBER_QTY_UNIT}</span>}
              decimalScale={2}
              aria-invalid={(showRequiredErrors && !value) || undefined}
              value={toNumberOrNull(value)}
              disabled={disabled}
              onValueChange={(qty) => onChange(qty == null ? "" : String(qty))}
            />
          ),
          renderValue: (value) => (value ? `${formatKg(Number(value))} ${FIBER_QTY_UNIT}` : "-"),
        },
        {
          label: "약정 총 가공비",
          key: "processingFee",
          editable: true,
          renderEditor: (value, onChange, disabled, inputId) => (
            <NumberInput
              id={inputId}
              className="tableInput"
              style={{ textAlign: "right" }}
              wrapClassName="soNumberEdit"
              suffix={<span>원</span>}
              value={toNumberOrNull(value)}
              disabled={disabled}
              onValueChange={(fee) => onChange(fee == null ? "" : String(fee))}
            />
          ),
          renderValue: (value) => (value ? formatWon(Number(value)) : "-"),
        },
        {
          label: "요청 규격 및 포장 조건",
          key: "requestSpec",
          editable: true,
          renderValue: (value) => value || "-",
        },
      ],
    },
    {
      // 입고 현황은 서버 집계값이라 읽기 전용
      title: "입고 현황",
      fields: [
        {
          label: "누적 입고",
          key: "receivedQty",
          editable: false,
          renderValue: (value) => `${formatKg(Number(value ?? 0))} ${FIBER_QTY_UNIT}`,
        },
        {
          label: "입고 건수 · 차이",
          key: "receiptCount",
          editable: false,
          renderValue: (value) => {
            // 차이 = 실제 누적 입고 - 투입원료 수량
            const diff = r2(Number(form.receivedQty ?? 0) - Number(form.requestInputQty ?? 0));
            return `${value ?? 0}건 · ${diff > 0 ? "+" : ""}${formatKg(diff)} ${FIBER_QTY_UNIT}`;
          },
        },
      ],
    },
  ];

  const fetchOptions = async () => {
    try {
      const [bpRes, rawItemRes, productRes] = await Promise.all([
        BusinessPartnerApi.getOptions(),
        ItemApi.getOptions({ productType: 1, category: FIBER_RAW_ITEM_CATEGORY }),
        ItemApi.getOptions({ productType: 1, category: FIBER_PRODUCT_ITEM_CATEGORY }),
      ]);
      setBusinessPartnerOptions(bpRes.data ?? []);
      setRawItemOptions(rawItemRes.data ?? []);
      setProductOptions(productRes.data ?? []);
    } catch (error) {
      console.error("옵션 목록 조회 실패:", error);
    }
  };

  const fetchOrderDetail = useCallback(async () => {
    if (!orderCode) return;
    setIsLoading(true);

    try {
      const response = await FiberSalesOrderApi.getDetail(orderCode);
      if (response.data) setOrder(response.data);
    } catch (error) {
      console.error("섬유 수주 상세 조회 실패:", error);
      alert("상세 정보를 불러오는 중 오류가 발생했습니다.");
      navigate({ pathname: LIST_PATH, search: location.search });
    } finally {
      setIsLoading(false);
    }
  }, [orderCode, navigate, location.search]);

  useEffect(() => {
    if (orderCode) {
      fetchOrderDetail();
      fetchOptions();
    }
  }, [orderCode]);

  // 읽기 모드(또는 수정 취소)일 때는 항상 서버 값으로 폼을 되돌린다
  useEffect(() => {
    if (order && !isEditing) {
      setForm(toForm(order));
    }
  }, [isEditing, order]);

  const startEditing = () => {
    if (order) setLines(toAllocationLines(order.lines));
    setShowRequiredErrors(false);
    setIsEditing(true);
  };

  // 검증 실패한 칸으로 이동 (상세 레이아웃은 수량 칸만 ref 로 포커스)
  const moveToInvalidField = (field: FiberOrderValidationField) => {
    if (field === "requestInputQty") {
      focusField(qtyInputRef.current);
    } else if (field === "lines") {
      document
        .getElementById(FIBER_ALLOCATION_ELEMENT_ID)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleSave = async () => {
    if (!order || isUpdating) return;

    const error = validateFiberOrder({
      bpCode: form.bpCode,
      rawItemCode: form.rawItemCode,
      requestInputQty: toNumberOrNull(form.requestInputQty),
      lines,
      orderDate: form.orderDate,
      dueDate: form.dueDate,
    });
    if (error) {
      setShowRequiredErrors(true);
      alert(error.message);
      moveToInvalidField(error.field);
      return;
    }

    setIsUpdating(true);
    try {
      const updatePayload: FiberSalesOrderUpdateRequest = {
        bpCode: form.bpCode,
        rawItemCode: form.rawItemCode,
        requestInputQty: Number(form.requestInputQty),
        // 기존 라인은 fiberSalesOrderLineId 로 수정, 신규 라인은 ID 없이 추가, 빠진 라인은 서버에서 삭제 처리
        lines: buildLineRequests(lines),
        processingFee: toNumberOrNull(form.processingFee),
        requestSpec: form.requestSpec || null,
        orderDate: form.orderDate,
        dueDate: form.dueDate || null,
        status: form.status,
        note: form.note || null,
      };

      await FiberSalesOrderApi.update(order.orderCode, updatePayload);
      alert("수정되었습니다.");
      setIsEditing(false);
      await fetchOrderDetail();
    } catch (err) {
      console.error("섬유 수주 수정 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!order || isDeleting) return;

    const confirmed = window.confirm(`${order.orderCode} 수주를 삭제하시겠습니까?`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await FiberSalesOrderApi.delete(order.orderCode);
      alert("삭제되었습니다.");
      navigate({ pathname: LIST_PATH, search: location.search });
    } catch (error) {
      // 입고가 연결된 수주 등 서버가 막는 경우 서버 메시지를 그대로 보여준다
      console.error("섬유 수주 삭제 실패:", error);
      const errorMessage = axios.isAxiosError(error) ? error.response?.data?.message : null;
      alert(errorMessage || "삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && !order) {
    return (
      <section className="screenStack">
        <div className="detailCard">
          <div className="flex justify-center p-10">
            <Spinner />
          </div>
        </div>
      </section>
    );
  }

  if (!order) return null;

  // 읽기 모드 배분 막대용 구간: 서버 라인 → 공용 막대 구간 (수정 모드와 같은 모양/글자)
  const viewSegments: FiberAllocationSegment[] = (order.lines ?? []).map((line, index) => ({
    key: String(line.fiberSalesOrderLineId ?? `${line.productItemCode}-${index}`),
    label: line.productItemNm || line.productItemCode || "-",
    qty: line.allocatedInputQty ?? 0,
    colorIndex: index,
  }));

  return (
    <section className="screenStack">
      <DetailLayout
        title={order.orderCode}
        subtitle={FIBER_STATUS_LABEL[order.status] ?? order.status}
        meta={`등록일자 ${form.createdAt ?? ""}`}
        sections={sections}
        form={form}
        isEditing={isEditing}
        isBusy={isBusy}
        onChangeField={(key, val) => setForm((prev) => ({ ...prev, [key]: val }))}
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        footerLeft={
          isEditing && (
            <button type="button" className="btnDanger" onClick={handleDelete} disabled={isBusy}>
              {isDeleting ? "삭제 처리 중..." : "수주 삭제"}
            </button>
          )
        }
        footerRight={
          isEditing ? (
            <>
              <button type="button" className="ghostButton" onClick={() => setIsEditing(false)} disabled={isBusy}>
                취소
              </button>
              <button type="button" className="primaryButton" onClick={handleSave} disabled={isBusy}>
                {isUpdating ? "저장 중..." : "저장"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ghostButton"
                onClick={() => navigate({ pathname: LIST_PATH, search: location.search })}
                disabled={isBusy}
              >
                목록
              </button>
              <button type="button" className="primaryButton" onClick={startEditing} disabled={isBusy}>
                수정
              </button>
            </>
          )
        }
      >
        {isEditing ? (
          <>
            {isLocked && (
              <div className="detailSection detailSection--full">
                <p className="fsoLockNote" role="note">
                  입고 내역이 있는 수주라 거래처와 투입원료 품목은 바꿀 수 없습니다.
                </p>
              </div>
            )}
            {/* 제품별 원물 배분 편집 (배분 막대 + 라인 편집) */}
            <FiberSalesOrderAllocationSection
              variant="detail"
              totalQty={toNumberOrNull(form.requestInputQty)}
              lines={lines}
              productOptions={productOptions}
              onChange={setLines}
              disabled={isBusy}
              showErrors={showRequiredErrors}
            />
          </>
        ) : (
          <div className="detailSection detailSection--full fsoAlloc">
            <h3 className="detailSectionTitle">제품별 원물 배분</h3>

            {/* 수정 모드와 같은 배분 막대(막대 안 제품명 + kg, 합계/상태 문구 포함) */}
            <div className="fsoViewBar">
              <FiberAllocationBar segments={viewSegments} totalQty={order.requestInputQty} />
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <div className="th-content">제품코드</div>
                    </th>
                    <th>
                      <div className="th-content">제품명</div>
                    </th>
                    <th>
                      <div className="th-content">단위</div>
                    </th>
                    <th>
                      <div className="th-content">배분 원물({FIBER_QTY_UNIT})</div>
                    </th>
                    <th>
                      <div className="th-content">배분 비율</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(order.lines || []).map((line) => (
                    <tr key={line.fiberSalesOrderLineId ?? line.productItemCode}>
                      <td>{line.productItemCode || "-"}</td>
                      <td>{line.productItemNm || "-"}</td>
                      <td>{line.productUnit || "-"}</td>
                      <td>{formatKg(line.allocatedInputQty)}</td>
                      <td>{line.allocationPercent != null ? `${line.allocationPercent}%` : "-"}</td>
                    </tr>
                  ))}
                  {(!order.lines || order.lines.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "20px" }}>
                        등록된 제품별 배분이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="fsoViewHint">
              배분 비율은 투입원료 총량 대비 표시용 계산값입니다. 배분 원물 합계는 투입원료 수량과 같아야 합니다.
            </p>
          </div>
        )}
      </DetailLayout>
    </section>
  );
}
