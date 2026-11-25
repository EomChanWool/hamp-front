import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  FiberSalesOrderApi,
  type FiberSalesOrderCreateRequest,
} from "@/api/sales/FiberSalesOrder";
import { BusinessPartnerApi } from "@/api/sales/BusinessPartner";
import { ItemApi, type ItemOptionResponse } from "@/api/master/Item";
import { NumberInput } from "@/components/common/NumberInput";
import { focusField } from "@/utils/common";
import { SelectBox, type SelectBoxOption } from "@/components/common/SelectBox";
import {
  FIBER_ALLOCATION_ELEMENT_ID,
  FiberSalesOrderAllocationSection,
} from "@/components/common/FiberSalesOrderAllocationSection";
import {
  FIBER_PRODUCT_ITEM_CATEGORY,
  FIBER_QTY_UNIT,
  FIBER_RAW_ITEM_CATEGORY,
  buildLineRequests,
  calcPercent,
  createEmptyLine,
  formatKg,
  formatWon,
  r2,
  sumAllocated,
  todayString,
  validateFiberOrder,
  type FiberAllocationLine,
  type FiberOrderValidationField,
} from "@/utils/fiberSalesOrderAllocation";
import "@/pages/layout/Layout.css";
import "@/pages/page/inpiSales/InpiSales.css";

/** 등록 폼 상태 (제품별 배분 lines 는 별도 상태로 관리) */
interface FiberSalesOrderCreateForm {
  bpCode: string;
  rawItemCode: string;
  requestInputQty: number | null;
  processingFee: number | null;
  requestSpec: string;
  orderDate: string;
  dueDate: string;
  note: string;
}

// 필수: 거래처 · 투입원료 · 투입원료 수량 · 수주일 · 제품별 원물 배분(합계 일치)
const REQUIRED_TOTAL = 5;

const LIST_PATH = "/inpi-sales/sales-order";

export function InpiSalesOrderCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 상태 관리
  const [form, setForm] = useState<FiberSalesOrderCreateForm>({
    bpCode: "",
    rawItemCode: "",
    requestInputQty: null,
    processingFee: null,
    requestSpec: "",
    orderDate: todayString(),
    dueDate: "",
    note: "",
  });
  // 제품별 원물 배분 (처음엔 빈 라인 1개)
  const [lines, setLines] = useState<FiberAllocationLine[]>(() => [createEmptyLine()]);

  // 등록을 한 번 눌러 필수값 검증에 걸린 뒤부터 비어 있는 필수 칸을 빨갛게 표시
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);

  // 검증 실패 시 포커스를 줄 칸
  const bpSelectRef = useRef<HTMLButtonElement>(null);
  const rawSelectRef = useRef<HTMLButtonElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const orderDateRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);

  const [businessPartnerOptions, setBusinessPartnerOptions] = useState<any[]>([]);
  const [rawItemOptions, setRawItemOptions] = useState<ItemOptionResponse[]>([]);
  const [productOptions, setProductOptions] = useState<ItemOptionResponse[]>([]);

  // 옵션 목록 조회 (거래처 / 투입원료 / 가공 요청 제품)
  useEffect(() => {
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
    fetchOptions();
  }, []);

  // SelectBox용 옵션 (이름 + 코드 2줄 표기)
  const bpSelectOptions = useMemo<SelectBoxOption[]>(
    () =>
      businessPartnerOptions.map((opt) => ({
        value: opt.bpCode,
        label: opt.bpNm ?? opt.bpCode,
        description: opt.bpCode,
      })),
    [businessPartnerOptions]
  );

  const rawSelectOptions = useMemo<SelectBoxOption[]>(
    () =>
      rawItemOptions.map((opt) => ({
        value: opt.itemCode,
        label: opt.itemNm ?? opt.itemCode,
        description: opt.itemCode,
      })),
    [rawItemOptions]
  );

  const handleChange = <K extends keyof FiberSalesOrderCreateForm>(
    key: K,
    value: FiberSalesOrderCreateForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ---- 필수값 표시용 ----
  const total = form.requestInputQty ?? 0;
  const allocationDone =
    total > 0 &&
    sumAllocated(lines) === r2(total) &&
    lines.every((l) => l.productItemCode && (l.allocatedInputQty ?? 0) > 0);

  const missingRequired = {
    bpCode: !form.bpCode,
    rawItemCode: !form.rawItemCode,
    requestInputQty: !(total > 0),
    orderDate: !form.orderDate,
  };
  const isInvalid = (key: keyof typeof missingRequired) =>
    (showRequiredErrors && missingRequired[key]) || undefined;

  // 납기일이 수주일보다 빠르면 인라인 오류 표시
  const dueDateInvalid = !!form.orderDate && !!form.dueDate && form.dueDate < form.orderDate;

  const handleCancel = () => {
    const queryString = searchParams.toString();
    navigate(queryString ? `${LIST_PATH}?${queryString}` : LIST_PATH);
  };

  // 검증 실패한 칸으로 이동
  const moveToInvalidField = (field: FiberOrderValidationField) => {
    switch (field) {
      case "bpCode":
        return focusField(bpSelectRef.current);
      case "rawItemCode":
        return focusField(rawSelectRef.current);
      case "requestInputQty":
        return focusField(qtyInputRef.current);
      case "orderDate":
        return focusField(orderDateRef.current);
      case "dueDate":
        return focusField(dueDateRef.current);
      case "lines":
        return document
          .getElementById(FIBER_ALLOCATION_ELEMENT_ID)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    // 비어 있는 첫 필수 칸 / 배분 오류를 안내하고 그 칸으로 이동
    const error = validateFiberOrder({
      bpCode: form.bpCode,
      rawItemCode: form.rawItemCode,
      requestInputQty: form.requestInputQty,
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

    const payload: FiberSalesOrderCreateRequest = {
      bpCode: form.bpCode,
      rawItemCode: form.rawItemCode,
      requestInputQty: Number(form.requestInputQty),
      lines: buildLineRequests(lines),
      processingFee: form.processingFee,
      requestSpec: form.requestSpec.trim() || null,
      orderDate: form.orderDate,
      dueDate: form.dueDate || null,
      note: form.note.trim() || null,
    };

    setIsSubmitting(true);
    try {
      await FiberSalesOrderApi.create(payload);
      alert("성공적으로 등록되었습니다.");
      navigate(LIST_PATH, { replace: true });
    } catch (err) {
      console.error("섬유 수주 등록 실패:", err);
      const message = axios.isAxiosError(err) ? err.response?.data?.message : null;
      alert(message || "섬유 수주 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- 요약 패널용 파생 값 ----
  const selectedBp = businessPartnerOptions.find((opt) => opt.bpCode === form.bpCode);
  const selectedRawItem = rawItemOptions.find((opt) => opt.itemCode === form.rawItemCode);
  const productName = (code: string) =>
    productOptions.find((opt) => opt.itemCode === code)?.itemNm ?? code;

  const requiredDone = [
    !!form.bpCode,
    !!form.rawItemCode,
    total > 0,
    !!form.orderDate,
    allocationDone,
  ].filter(Boolean).length;

  // 제품명 + 배분량(비율) 요약
  const allocationSummary = lines
    .filter((l) => l.productItemCode && (l.allocatedInputQty ?? 0) > 0)
    .map(
      (l) =>
        `${productName(l.productItemCode)} ${formatKg(l.allocatedInputQty)}${FIBER_QTY_UNIT}${total > 0 ? ` (${calcPercent(l.allocatedInputQty ?? 0, total)}%)` : ""
        }`
    )
    .join(", ");

  const summaryRows: { label: string; value: string }[] = [
    { label: "거래처", value: selectedBp ? (selectedBp.bpNm ?? selectedBp.bpCode) : "" },
    {
      label: "투입원료",
      value: selectedRawItem
        ? `${selectedRawItem.itemNm ?? selectedRawItem.itemCode}${total > 0 ? ` ${formatKg(total)} ${FIBER_QTY_UNIT}` : ""}`
        : "",
    },
    { label: "배분", value: allocationSummary },
    { label: "가공비", value: form.processingFee != null ? formatWon(form.processingFee) : "" },
    { label: "수주일", value: form.orderDate },
    { label: "납기일", value: form.dueDate },
  ];

  return (
    <section className="screenStack">
      <form className="formPage" onSubmit={handleSubmit}>
        <div className="formPageHead">
          <h1 className="formPageTitle">신규 섬유 수주 등록</h1>
          <span className="formPageMeta">
            <span className="required" aria-hidden="true">*</span> 표시는 필수 입력 항목입니다
          </span>
        </div>

        <div className="formLayout">
          {/* ===== 좌측: 입력 섹션 카드 ===== */}
          <div className="formMain">
            {/* 1. 기본정보 */}
            <section className="formCard" aria-labelledby="fso-sec-basic">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle" id="fso-sec-basic">기본정보</h2>
                  <p className="formCardDesc">원물을 맡기는 거래처와 일정을 입력합니다.</p>
                </div>
              </div>

              <div className="formGrid">
                <div className="formField col6">
                  <label className="formLabel" htmlFor="fso-bp">
                    거래처명 (원물 소유자) <span className="required" aria-hidden="true">*</span>
                  </label>
                  <SelectBox
                    ref={bpSelectRef}
                    id="fso-bp"
                    value={form.bpCode}
                    options={bpSelectOptions}
                    placeholder="거래처를 선택해주세요"
                    searchPlaceholder="거래처명 또는 코드 검색"
                    searchable
                    disabled={isSubmitting}
                    invalid={isInvalid("bpCode")}
                    onChange={(v) => handleChange("bpCode", v)}
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="fso-order-date">
                    수주일 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <input
                    ref={orderDateRef}
                    id="fso-order-date"
                    type="date"
                    className="formInput"
                    value={form.orderDate}
                    aria-invalid={isInvalid("orderDate")}
                    onChange={(e) => handleChange("orderDate", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="fso-due-date">납기일</label>
                  <input
                    ref={dueDateRef}
                    id="fso-due-date"
                    type="date"
                    className="formInput"
                    value={form.dueDate}
                    aria-invalid={dueDateInvalid || undefined}
                    onChange={(e) => handleChange("dueDate", e.target.value)}
                    disabled={isSubmitting}
                  />
                  {dueDateInvalid && (
                    <span className="fsoFieldError">납기일은 수주일보다 빠를 수 없습니다.</span>
                  )}
                </div>

                <div className="formField col6">
                  <label className="formLabel" htmlFor="fso-note">비고</label>
                  <input
                    id="fso-note"
                    className="formInput"
                    maxLength={255}
                    placeholder="전달이 필요한 내용을 입력해주세요"
                    value={form.note}
                    onChange={(e) => handleChange("note", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </section>

            {/* 2. 투입원료 */}
            <section className="formCard" aria-labelledby="fso-sec-input">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle" id="fso-sec-input">투입원료</h2>
                  <p className="formCardDesc">거래처가 맡기는 인피 원물과 총량, 약정 가공비를 입력합니다.</p>
                </div>
              </div>

              <div className="formGrid">
                <div className="formField col2">
                  <label className="formLabel" htmlFor="fso-raw">
                    투입원료 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <SelectBox
                    ref={rawSelectRef}
                    id="fso-raw"
                    value={form.rawItemCode}
                    options={rawSelectOptions}
                    placeholder="투입원료 선택"
                    searchPlaceholder="품목명 또는 코드 검색"
                    searchable
                    disabled={isSubmitting}
                    invalid={isInvalid("rawItemCode")}
                    onChange={(v) => handleChange("rawItemCode", v)}
                  />
                </div>

                <div className="formField col2">
                  <label className="formLabel" htmlFor="fso-qty">
                    투입원료 수량 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <NumberInput
                    ref={qtyInputRef}
                    id="fso-qty"
                    className="formInput hasSuffix"
                    wrapClassName="formInputWrap"
                    suffix={<span className="formInputSuffix">{FIBER_QTY_UNIT}</span>}
                    placeholder="0"
                    decimalScale={2}
                    aria-invalid={isInvalid("requestInputQty")}
                    value={form.requestInputQty}
                    disabled={isSubmitting}
                    onValueChange={(qty) => handleChange("requestInputQty", qty)}
                  />
                </div>

                <div className="formField col2">
                  <label className="formLabel" htmlFor="fso-fee">약정 총 가공비</label>
                  <NumberInput
                    id="fso-fee"
                    className="formInput hasSuffix"
                    wrapClassName="formInputWrap"
                    suffix={<span className="formInputSuffix">원</span>}
                    placeholder="0"
                    value={form.processingFee}
                    disabled={isSubmitting}
                    onValueChange={(fee) => handleChange("processingFee", fee)}
                  />
                </div>

                <div className="formField col6">
                  <label className="formLabel" htmlFor="fso-spec">요청 규격 및 포장 조건</label>
                  <textarea
                    id="fso-spec"
                    className="formInput"
                    maxLength={255}
                    placeholder="예) 솜 20kg 압축포대, 슬라이버 캔 포장"
                    value={form.requestSpec}
                    onChange={(e) => handleChange("requestSpec", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </section>

            {/* 3. 제품별 원물 배분 */}
            <FiberSalesOrderAllocationSection
              variant="form"
              totalQty={form.requestInputQty}
              lines={lines}
              productOptions={productOptions}
              onChange={setLines}
              disabled={isSubmitting}
              showErrors={showRequiredErrors}
            />
          </div>

          {/* ===== 우측: 요약 + 액션 ===== */}
          <aside className="formCard formAside" aria-label="수주 요약">
            <h2 className="formCardTitle">수주 요약</h2>

            <div className="formProgress">
              <div className="formProgressText">
                <span>필수 입력</span>
                <strong>
                  {requiredDone}/{REQUIRED_TOTAL}
                </strong>
              </div>
              <div
                className="formProgressBar"
                role="progressbar"
                aria-label="필수 입력 진행률"
                aria-valuemin={0}
                aria-valuemax={REQUIRED_TOTAL}
                aria-valuenow={requiredDone}
              >
                <div
                  className="formProgressFill"
                  style={{ width: `${(requiredDone / REQUIRED_TOTAL) * 100}%` }}
                />
              </div>
            </div>

            <dl className="formSummaryList">
              {summaryRows.map((row) => (
                <div className="formSummaryRow" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd className={row.value ? undefined : "isEmpty"}>{row.value || "미입력"}</dd>
                </div>
              ))}
            </dl>

            <div className="formActions">
              <button type="submit" className="primaryButton" disabled={isSubmitting}>
                {isSubmitting ? "등록 중..." : "등록"}
              </button>
              <button
                type="button"
                className="ghostButton"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                취소
              </button>
            </div>
          </aside>
        </div>
      </form>
    </section>
  );
}
