import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  SalesOrderApi,
  type SalesOrderCreateRequest
} from "@/api/sales/SalesOrder";
import { BusinessPartnerApi } from "@/api/sales/BusinessPartner";
import { ItemApi, type ItemOptionResponse } from "@/api/master/Item";
import { AmountInput } from "@/components/common/AmountInput";
import { SelectBox, type SelectBoxOption } from "@/components/common/SelectBox";
import { parseDecimalInput, sanitizeDecimalInput } from "@/utils/common";
import "@/pages/layout/Layout.css";
type SalesOrderLineDraft = {
  itemCode: string;
  planQty: string;
};

type SalesOrderCreateForm = Omit<SalesOrderCreateRequest, "lines"> & {
  lines: SalesOrderLineDraft[];
};

const REQUIRED_TOTAL = 4;

export function SalesOrderCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 상태 관리
  const [form, setForm] = useState<SalesOrderCreateForm>({
    bpCode: "",
    dueDate: "",
    note: "",
    itemCode: "",
    orderQty: null,
    orderAmount: null,
    lines: [],
  });

  const [businessPartnerOptions, setBusinessPartnerOptions] = useState<any[]>([]);
  const [itemOptions, setItemOptions] = useState<any[]>([]);
  const [rawItemOptions, setRawItemOptions] = useState<ItemOptionResponse[]>([]);

  // 옵션 목록 조회 함수
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [bpRes, itemRes, rawItemRes] = await Promise.all([
          BusinessPartnerApi.getOptions(),
          ItemApi.getOptions({ category: [2] }),
          ItemApi.getOptions({ category: [0] }),
        ]);
        setBusinessPartnerOptions(bpRes.data ?? []);
        setItemOptions(itemRes.data ?? []);
        setRawItemOptions(rawItemRes.data ?? []);
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

  const rawItemSelectOptions = useMemo<SelectBoxOption[]>(
    () =>
      rawItemOptions.map((opt) => ({
        value: opt.itemCode,
        label: opt.itemNm ?? opt.itemCode,
        description: opt.itemCode,
      })),
    [rawItemOptions]
  );

  const itemSelectOptions = useMemo<SelectBoxOption[]>(
    () =>
      itemOptions.map((opt) => ({
        value: opt.itemCode,
        label: opt.itemNm ?? opt.itemCode,
        description: opt.itemCode,
      })),
    [itemOptions]
  );

  const handleChange = (key: keyof SalesOrderCreateForm, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 품목(Line) 추가
  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { itemCode: "", planQty: "" }]
    }));
  };

  // 품목(Line) 변경
  const handleLineChange = (index: number, key: keyof SalesOrderLineDraft, value: string) => {
    const newLines = [...form.lines];
    newLines[index] = { ...newLines[index], [key]: value };
    setForm((prev) => ({ ...prev, lines: newLines }));
  };

  // 품목(Line) 삭제
  const removeLine = (index: number) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  };

  const handleCancel = () => {
    const queryString = searchParams.toString();
    navigate(queryString ? `/sales/sales-order?${queryString}` : "/sales/sales-order");
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (!form.bpCode) {
      alert("거래처를 선택해주세요.");
      return;
    }
    if (!form.itemCode) {
      alert("투입원료를 선택해주세요.");
      return;
    }
    if (form.orderQty == null) {
      alert("투입수량을 입력해주세요.");
      return;
    }
    if (form.orderAmount == null) {
      alert("가공비를 입력해주세요.");
      return;
    }

    const payload: SalesOrderCreateRequest = {
      ...form,
      itemCode: form.itemCode || null,
      lines: form.lines.map((line) => ({
        itemCode: line.itemCode,
        planQty: parseDecimalInput(line.planQty),
      })),
    };

    setIsSubmitting(true);
    try {
      await SalesOrderApi.create(payload);
      alert("성공적으로 등록되었습니다.");
      navigate("/sales/sales-order", { replace: true });
    } catch (error) {
      console.error("수주 등록 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      alert(message || "수주 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- 요약 패널용 파생 값 ----
  const selectedBp = businessPartnerOptions.find((opt) => opt.bpCode === form.bpCode);
  const selectedRawItem = rawItemOptions.find((opt) => opt.itemCode === form.itemCode);
  const rawUnit = selectedRawItem?.unit ?? "";

  const requiredDone = [form.bpCode, form.itemCode, form.orderQty, form.orderAmount].filter(
    (v) => v !== "" && v != null
  ).length;

  const summaryRows: { label: string; value: string }[] = [
    { label: "거래처", value: selectedBp ? (selectedBp.bpNm ?? selectedBp.bpCode) : "" },
    { label: "납기일자", value: form.dueDate ?? "" },
    {
      label: "투입원료",
      value: selectedRawItem ? (selectedRawItem.itemNm ?? selectedRawItem.itemCode) : "",
    },
    {
      label: "투입수량",
      value:
        form.orderQty != null
          ? `${form.orderQty.toLocaleString("ko-KR")}${rawUnit ? ` ${rawUnit}` : ""}`
          : "",
    },
    {
      label: "가공비",
      value: form.orderAmount != null ? `${form.orderAmount.toLocaleString("ko-KR")}원` : "",
    },
    { label: "생산 품목", value: `${form.lines.length}개` },
  ];

  return (
    <section className="screenStack">
      <form className="formPage" onSubmit={handleSubmit}>
        <div className="formPageHead">
          <h1 className="formPageTitle">신규 수주 등록</h1>
          <span className="formPageMeta">
            <span className="required" aria-hidden="true">*</span> 표시는 필수 입력 항목입니다
          </span>
        </div>

        <div className="formLayout">
          {/* ===== 좌측: 입력 섹션 카드 ===== */}
          <div className="formMain">
            {/* 1. 기본정보 */}
            <section className="formCard" aria-labelledby="order-sec-basic">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle" id="order-sec-basic">기본정보</h2>
                  <p className="formCardDesc">거래처와 납기 정보를 입력합니다.</p>
                </div>
              </div>

              <div className="formGrid">
                <div className="formField col4">
                  <label className="formLabel" htmlFor="order-bp">
                    거래처명 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <SelectBox
                    id="order-bp"
                    value={form.bpCode}
                    options={bpSelectOptions}
                    placeholder="거래처를 선택해주세요"
                    searchPlaceholder="거래처명 또는 코드 검색"
                    searchable
                    disabled={isSubmitting}
                    onChange={(v) => handleChange("bpCode", v)}
                  />
                </div>

                <div className="formField col2">
                  <label className="formLabel" htmlFor="order-due">납기일자</label>
                  <input
                    id="order-due"
                    type="date"
                    className="formInput"
                    value={form.dueDate ?? ""}
                    onChange={(e) => handleChange("dueDate", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="formField col6">
                  <label className="formLabel" htmlFor="order-note">비고</label>
                  <input
                    id="order-note"
                    className="formInput"
                    placeholder="전달이 필요한 내용을 입력해주세요"
                    value={form.note ?? ""}
                    onChange={(e) => handleChange("note", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </section>

            {/* 2. 투입원료 */}
            <section className="formCard" aria-labelledby="order-sec-input">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle" id="order-sec-input">투입원료</h2>
                  <p className="formCardDesc">가공에 투입할 원료와 수량, 가공비를 입력합니다.</p>
                </div>
              </div>

              <div className="formGrid">
                <div className="formField col6">
                  <label className="formLabel" htmlFor="order-item">
                    투입원료 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <SelectBox
                    id="order-item"
                    value={form.itemCode ?? ""}
                    options={rawItemSelectOptions}
                    placeholder="투입원료를 선택해주세요"
                    searchPlaceholder="원료명 또는 코드 검색"
                    searchable
                    disabled={isSubmitting}
                    onChange={(v) => handleChange("itemCode", v)}
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="order-qty">
                    투입수량 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <div className="formInputWrap">
                    <input
                      id="order-qty"
                      type="text"
                      inputMode="numeric"
                      className="formInput hasSuffix"
                      placeholder="0"
                      value={form.orderQty ?? ""}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        handleChange("orderQty", val === "" ? null : Number(val));
                      }}
                    />
                    {rawUnit && <span className="formInputSuffix">{rawUnit}</span>}
                  </div>
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="order-amount">
                    가공비 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <div className="formInputWrap">
                    <AmountInput
                      id="order-amount"
                      className="formInput hasSuffix"
                      value={form.orderAmount}
                      disabled={isSubmitting}
                      onValueChange={(amount) => handleChange("orderAmount", amount)}
                    />
                    <span className="formInputSuffix">원</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. 생산 품목 */}
            <section className="formCard" aria-labelledby="order-sec-lines">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle" id="order-sec-lines">생산 품목</h2>
                  <p className="formCardDesc">가공 후 산출되는 품목과 예정 수량을 입력합니다.</p>
                </div>
                {form.lines.length > 0 && (
                  <button
                    type="button"
                    className="miniButton primary"
                    onClick={addLine}
                    disabled={isSubmitting}
                  >
                    + 품목 추가
                  </button>
                )}
              </div>

              {form.lines.length === 0 ? (
                <div className="formEmpty">
                  <span className="formEmptyIcon" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="none" width="22" height="22">
                      <path
                        d="M10 4.5v11M4.5 10h11"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <strong className="formEmptyTitle">등록된 생산 품목이 없습니다</strong>
                  <p className="formEmptyDesc">산출 예정인 품목을 추가해주세요.</p>
                  <button
                    type="button"
                    className="miniButton primary"
                    onClick={addLine}
                    disabled={isSubmitting}
                  >
                    + 품목 추가
                  </button>
                </div>
              ) : (
                <>
                  <div className="orderLineHead" aria-hidden="true">
                    <span>품목</span>
                    <span>예정 산출수량</span>
                    <span />
                  </div>

                  <div className="orderLineList">
                    {form.lines.map((line, idx) => {
                      const unit =
                        itemOptions.find((opt) => opt.itemCode === line.itemCode)?.unit ?? "";

                      return (
                        <div className="orderLineRow" key={idx}>
                          <SelectBox
                            ariaLabel={`생산 품목 ${idx + 1} 품목`}
                            value={line.itemCode}
                            options={itemSelectOptions}
                            placeholder="품목을 선택해주세요"
                            searchPlaceholder="품목명 또는 코드 검색"
                            searchable
                            disabled={isSubmitting}
                            onChange={(v) => handleLineChange(idx, "itemCode", v)}
                          />

                          <div className="formInputWrap">
                            <input
                              type="text"
                              inputMode="decimal"
                              className="formInput hasSuffix"
                              aria-label={`생산 품목 ${idx + 1} 예정 산출수량`}
                              value={line.planQty}
                              placeholder="미정"
                              disabled={isSubmitting}
                              onChange={(e) =>
                                handleLineChange(idx, "planQty", sanitizeDecimalInput(e.target.value))
                              }
                            />
                            {unit && <span className="formInputSuffix">{unit}</span>}
                          </div>

                          <button
                            type="button"
                            className="formIconBtn"
                            aria-label={`생산 품목 ${idx + 1} 삭제`}
                            onClick={() => removeLine(idx)}
                            disabled={isSubmitting}
                          >
                            <svg viewBox="0 0 20 20" fill="none" width="18" height="18" aria-hidden="true">
                              <path
                                d="M4 6h12M8 6V4.5h4V6m-6 0 .6 9h6.8l.6-9M8.5 9v4M11.5 9v4"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
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