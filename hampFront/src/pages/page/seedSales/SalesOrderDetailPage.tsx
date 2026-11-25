import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { SalesOrderApi } from "@/api/sales/SalesOrder";
import type { SalesOrderDetailResponse, SalesOrderUpdateRequest } from "@/api/sales/SalesOrder";
import { BusinessPartnerApi } from "@/api/sales/BusinessPartner";
import { ItemApi, type ItemOptionResponse } from "@/api/master/Item";
import Spinner from "@/components/common/Spinner";
import { NumberInput } from "@/components/common/NumberInput";
import { focusField, formatDateTime, parseDecimalInput } from "@/utils/common";
import { DetailLayout, type DetailSection } from "@/pages/layout/DetailLayout";
import { type SelectOption } from "@/pages/layout/DetailSelect";
import { SalesOrderAllocationSection } from "@/components/common/SalesOrderAllocationSection";
import {
  DEFAULT_OIL_PERCENT,
  DEFAULT_POWDER_PERCENT,
  RAW_ITEM_CODE,
  buildAllocationLines,
  formatQty,
  hasLegacyLines,
  readAllocationPercents,
  type AllocationPercents,
} from "@/utils/salesOrderAllocation";

// 폼은 문자열로 들고 있어 숫자 입력칸에 넘길 때만 바꾼다 (빈 값이면 null)
const toNumberOrNull = (value: string | null | undefined) => (value == null || value === "" ? null : Number(value));

const ALLOCATION_GROUP_LABEL: Record<string, string> = {
  RAW: "원물(RAW)",
  PARK: "헴프박(PARK)",
};

export function SalesOrderDetailPage() {
  const { orderCode } = useParams<{ orderCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [order, setOrder] = useState<SalesOrderDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // 저장을 한 번 눌러 필수값 검증에 걸린 뒤부터 비어 있는 필수 칸을 빨갛게 표시 (수정을 새로 시작하면 초기화)
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Record<string, any>>({});
  const [percents, setPercents] = useState<AllocationPercents>({
    oilPercent: DEFAULT_OIL_PERCENT,
    powderPercent: DEFAULT_POWDER_PERCENT,
  });
  const [businessPartnerOptions, setBusinessPartnerOptions] = useState<any[]>([]);
  const [rawItemOptions, setRawItemOptions] = useState<ItemOptionResponse[]>([]);

  const isBusy = isUpdating || isDeleting;

  const toSelectOptions = (list: any[]): SelectOption[] =>
    list.map((opt) => ({
      value: opt.itemCode ?? opt.bpCode,
      label: `${opt.itemCode ?? opt.bpCode} (${opt.itemNm ?? opt.bpNm ?? "-"})`,
    }));

  const bpSelectOptions = useMemo(() => toSelectOptions(businessPartnerOptions), [businessPartnerOptions]);

  // 섹션 정의 (bpCode 셀렉트박스 포함)
  const sections: DetailSection<SalesOrderDetailResponse>[] = [
    {
      title: "거래처 정보",
      fields: [
        { label: "거래처명", key: "bpNm", editable: false },
        {
          label: "거래처코드",
          key: "bpCode",
          editable: true,
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
          label: "납기일자",
          key: "dueDate",
          editable: true,
          renderEditor: (value, onchange, disabled) => (
            <input
              type="date"
              className="tableInput"
              value={value ?? ""}
              onChange={(e) => onchange(e.target.value)}
              disabled={disabled}
            />
          ),
        },
        { label: "상태", key: "status", editable: true },
        { label: "비고", key: "note", editable: true },
      ],
    },
    {
      title: "투입원료",
      fields: [
        {
          label: "투입원료",
          key: "itemCode",
          // 생산 배분 시뮬레이션이 헴프 원물 기준으로 고정돼 있어 수정 불가 (저장 시 항상 헴프 원물)
          editable: false,
          renderValue: (value) => {
            const current = !value ? "-" : form.itemNm ? `${value} (${form.itemNm})` : value;
            if (!isEditing || value === RAW_ITEM_CODE) return current;
            const rawItem = rawItemOptions.find((opt) => opt.itemCode === RAW_ITEM_CODE);
            const rawLabel = rawItem?.itemNm ? `${RAW_ITEM_CODE} (${rawItem.itemNm})` : RAW_ITEM_CODE;
            return `${current} → 저장 시 ${rawLabel}로 변경됩니다`;
          },
        },
        {
          label: "투입수량",
          key: "orderQty",
          editable: true,
          required: true,
          renderEditor: (value, onChange, disabled, inputId) => (
            <NumberInput
              ref={qtyInputRef}
              id={inputId}
              className="tableInput"
              style={{ textAlign: "right" }}
              wrapClassName="soNumberEdit"
              suffix={<span>{form.unit}</span>}
              aria-invalid={(showRequiredErrors && !value) || undefined}
              value={toNumberOrNull(value)}
              disabled={disabled}
              onValueChange={(qty) => onChange(qty == null ? "" : String(qty))}
            />
          ),
          renderValue: (value) =>
            value ? `${Number(value).toLocaleString("ko-KR")}${form.unit ? ` ${form.unit}` : ""}` : "-",
        },
        {
          label: "오차범위",
          key: "toleranceRate",
          editable: true,
          renderEditor: (value, onChange, disabled, inputId) => (
            <NumberInput
              id={inputId}
              className="tableInput"
              style={{ textAlign: "right" }}
              wrapClassName="soNumberEdit"
              suffix={<span>%</span>}
              placeholder="0 ~ 100"
              // 서버 허용 범위(0~100), DB decimal(12,2)
              decimalScale={2}
              max={100}
              thousandSeparator={false}
              value={toNumberOrNull(value)}
              disabled={disabled}
              onValueChange={(rate) => onChange(rate == null ? "" : String(rate))}
            />
          ),
          renderValue: (value) => (value ? `${value}%` : "-"),
        },
        {
          label: "가공비",
          key: "orderAmount",
          editable: true,
          required: true,
          renderEditor: (value, onChange, disabled, inputId) => (
            <NumberInput
              ref={amountInputRef}
              id={inputId}
              className="tableInput"
              style={{ textAlign: "right" }}
              wrapClassName="soNumberEdit"
              suffix={<span>원</span>}
              aria-invalid={(showRequiredErrors && !value) || undefined}
              value={toNumberOrNull(value)}
              disabled={disabled}
              onValueChange={(amount) => onChange(amount == null ? "" : String(amount))}
            />
          ),
          renderValue: (value) => (value ? `${Number(value).toLocaleString("ko-KR")} 원` : "-"),
        },
      ],
    },
  ];

  const fetchOptions = async () => {
    try {
      const [bpRes, rawItemRes] = await Promise.all([
        BusinessPartnerApi.getOptions(),
        ItemApi.getOptions({ category: [0] }),
      ]);
      setBusinessPartnerOptions(bpRes.data ?? []);
      setRawItemOptions(rawItemRes.data ?? []);
    } catch (error) {
      console.error("옵션 목록 조회 실패:", error);
    }
  };

  const fetchOrderDetail = useCallback(async () => {
    if (!orderCode) return;
    setIsLoading(true);

    try {
      const response = await SalesOrderApi.getDetail(orderCode);
      const data = response.data;

      if (data) {
        setOrder(data);
        setForm({
          orderCode: data.orderCode,
          bpNm: data.bpNm,
          bpCode: data.bpCode,
          dueDate: data.dueDate,
          status: data.status,
          note: data.note,
          itemCode: data.itemCode ?? "",
          itemNm: data.itemNm ?? "",
          unit: data.unit ?? "",
          orderQty: data.orderQty != null ? String(data.orderQty) : "",
          orderAmount: data.orderAmount != null ? String(data.orderAmount) : "",
          toleranceRate: data.toleranceRate != null ? String(data.toleranceRate) : "",
          createdAt: formatDateTime(data.createdAt),
          lines: data.lines || [],
        });
      }
    } catch (error) {
      console.error("수주 상세 조회 실패:", error);
      alert("상세 정보를 불러오는 중 오류가 발생했습니다.");
      navigate({ pathname: "/seed-sales/sales-order", search: location.search });
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

  useEffect(() => {
    if (order && !isEditing) {
      setForm({
        orderCode: order.orderCode,
        bpNm: order.bpNm,
        bpCode: order.bpCode,
        dueDate: order.dueDate,
        status: order.status,
        note: order.note,
        itemCode: order.itemCode ?? "",
        itemNm: order.itemNm ?? "",
        unit: order.unit ?? "",
        orderQty: order.orderQty != null ? String(order.orderQty) : "",
        orderAmount: order.orderAmount != null ? String(order.orderAmount) : "",
        toleranceRate: order.toleranceRate != null ? String(order.toleranceRate) : "",
        createdAt: formatDateTime(order.createdAt),
        lines: order.lines || [],
      });
    }
  }, [isEditing, order]);

  const startEditing = () => {
    if (order) setPercents(readAllocationPercents(order.lines || []));
    setShowRequiredErrors(false);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!order || isUpdating) return;
    // 비어 있는 첫 필수 칸을 안내하고 그 칸으로 이동
    if (!form.orderQty || !form.orderAmount) {
      setShowRequiredErrors(true);
      alert(!form.orderQty ? "투입수량을 입력해주세요." : "가공비를 입력해주세요.");
      focusField(!form.orderQty ? qtyInputRef.current : amountInputRef.current);
      return;
    }

    setIsUpdating(true);
    try {
      const updatePayload: SalesOrderUpdateRequest = {
        bpCode: form.bpCode,
        dueDate: form.dueDate || null,
        status: form.status || null,
        note: form.note || null,
        itemCode: RAW_ITEM_CODE,
        orderQty: form.orderQty ? Number(form.orderQty) : null,
        orderAmount: form.orderAmount ? Number(form.orderAmount) : null,
        toleranceRate: parseDecimalInput(form.toleranceRate ?? ""),
        // 기존 라인은 같은 품목의 salesOrderLineId를 이어받아 갱신한다
        lines: buildAllocationLines(percents, order.lines || []),
      };

      await SalesOrderApi.update(order.orderCode, updatePayload);
      alert("수정되었습니다.");
      setIsEditing(false);
      await fetchOrderDetail();
    } catch (err) {
      console.error("수주 수정 실패:", err);
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
      await SalesOrderApi.delete(order.orderCode);
      alert("삭제되었습니다.");
      navigate({ pathname: "/seed-sales/sales-order", search: location.search });
    } catch (error) {
      console.error("수주 삭제 실패:", error);
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

  return (
    <section className="screenStack">
      <DetailLayout
        title={order.orderCode}
        subtitle={order.status}
        meta={`등록일자 ${form.createdAt}`}
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
                onClick={() => navigate({ pathname: "/seed-sales/sales-order", search: location.search })}
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
            {hasLegacyLines(order.lines || []) && (
              <div className="detailSection detailSection--full">
                <p className="soAllocLegacyNotice" role="note">
                  이 수주에는 배분 비율 없이 등록된 기존 품목 라인이 있습니다. 저장하면 아래 배분 비율 기준의 4개 라인(헴프오일·헴프씨드·헴프 파우더·헴프박 농축액)으로 다시 저장되고, 그 밖의 품목 라인은 저장 요청에서 빠집니다.
                </p>
              </div>
            )}
            <SalesOrderAllocationSection
              variant="detail"
              rawWeight={form.orderQty ? Number(form.orderQty) : null}
              percents={percents}
              onChange={setPercents}
              disabled={isBusy}
            />
          </>
        ) : (
          <div className="detailSection detailSection--full">
            <h3 className="detailSectionTitle">품목 정보</h3>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <div className="th-content">품목코드</div>
                    </th>
                    <th>
                      <div className="th-content">품목명</div>
                    </th>
                    <th>
                      <div className="th-content">배분 그룹</div>
                    </th>
                    <th>
                      <div className="th-content">배분 비율</div>
                    </th>
                    <th>
                      <div className="th-content">배분 투입량</div>
                    </th>
                    <th>
                      <div className="th-content">예정 산출수량</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(order.lines || []).map((line) => (
                    <tr key={line.salesOrderLineId ?? line.itemCode}>
                      <td>{line.itemCode || "-"}</td>
                      <td>{line.itemNm || "-"}</td>
                      <td>{line.allocationGroup ? (ALLOCATION_GROUP_LABEL[line.allocationGroup] ?? line.allocationGroup) : "-"}</td>
                      <td>{line.allocationPercent != null ? `${line.allocationPercent}%` : "-"}</td>
                      <td>{formatQty(line.allocatedInputQty)}</td>
                      <td>{line.planQty != null ? formatQty(line.planQty, line.unit) : "미정"}</td>
                    </tr>
                  ))}
                  {(!order.lines || order.lines.length === 0) && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>
                        등록된 품목 정보가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="soAllocTableHint">
              배분 투입량은 원물(RAW) 그룹은 탈피씨드, 헴프박(PARK) 그룹은 건조 헴프박 기준입니다. 예정 산출수량이 미정인 품목은 수율이 확정되지 않은 분기입니다.
            </p>
          </div>
        )}
      </DetailLayout>
    </section>
  );
}
