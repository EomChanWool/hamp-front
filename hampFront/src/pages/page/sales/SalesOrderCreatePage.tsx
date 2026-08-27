import { useEffect, useState, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  SalesOrderApi,
  type SalesOrderCreateRequest,
  type SalesOrderLineRequest
} from "@/api/sales/SalesOrder";
import { BusinessPartnerApi } from "@/api/sales/BusinessPartner";
import { ItemApi } from "@/api/master/Item";

export function SalesOrderCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 상태 관리
  const [form, setForm] = useState<SalesOrderCreateRequest>({
    orderCode: "",
    bpCode: "",
    dueDate: "",
    status: "OPEN",
    note: "",
    lines: [],
  });

  const [businessPartnerOptions, setBusinessPartnerOptions] = useState<any[]>([]);
  const [itemOptions, setItemOptions] = useState<any[]>([]);

  // 옵션 목록 조회 함수
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [bpRes, itemRes] = await Promise.all([
          BusinessPartnerApi.getOptions(),
          ItemApi.getOptions(),
        ]);
        setBusinessPartnerOptions(bpRes.data ?? []);
        setItemOptions(itemRes.data ?? []);
      } catch (error) {
        console.error("옵션 목록 조회 실패:", error);
      }
    };
    fetchOptions();
  }, []);

  const handleChange = (key: keyof SalesOrderCreateRequest, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 품목(Line) 추가
  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...(prev.lines || []), { itemCode: "", orderQty: 0, orderAmount: 0 }]
    }));
  };

  // 품목(Line) 변경
  const handleLineChange = (index: number, key: keyof SalesOrderLineRequest, value: any) => {
    const newLines = [...(form.lines || [])];
    newLines[index] = { ...newLines[index], [key]: value };
    setForm((prev) => ({ ...prev, lines: newLines }));
  };

  // 품목(Line) 삭제
  const removeLine = (index: number) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines?.filter((_, i) => i !== index)
    }));
  };

  const handleCancel = () => {
    const queryString = searchParams.toString();
    navigate(queryString ? `/sales/sales-order?${queryString}` : "/sales/sales-order");
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (!form.orderCode.trim()) {
      alert("수주코드를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await SalesOrderApi.create(form);
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

  return (
    <section className="screenStack">
      <div className="createCard">
        <div className="createHeader">
          <h1 className="createTitle">신규 수주 등록</h1>
          <span className="createMeta">* 표시는 필수 입력 항목입니다</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="createBody">
            {/* 1. 기본 정보 섹션 */}
            <div className="createSection">
              <h2 className="createSectionTitle">기본정보</h2>
              <div className="createGrid2Cols">
                <div className="createField">
                  <label className="requiredLabel">
                    수주코드 <span className="required">*</span>
                  </label>
                  <input
                    className="tableInput"
                    value={form.orderCode}
                    onChange={(e) => handleChange("orderCode", e.target.value)}
                    disabled={isSubmitting}
                    placeholder="예: ORD001"
                  />
                </div>

                <div className="createField">
                  <label className="requiredLabel">
                    거래처코드 <span className="required">*</span>
                  </label>
                  <select
                    className="tableInput"
                    value={form.bpCode}
                    onChange={(e) => handleChange("bpCode", e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="">거래처를 선택해주세요</option>
                    {businessPartnerOptions.map((opt) => (
                      <option key={opt.bpCode} value={opt.bpCode}>
                        {opt.bpCode} ({opt.bpNm ?? "-"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="createField">
                  <label>납기일자</label>
                  <input
                    type="date"
                    className="tableInput"
                    value={form.dueDate ?? ""}
                    onChange={(e) => handleChange("dueDate", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="createField">
                  <label>상태</label>
                  <input
                    className="tableInput"
                    value={form.status ?? ""}
                    onChange={(e) => handleChange("status", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="createField fullWidth">
                  <label>비고</label>
                  <input
                    className="tableInput"
                    value={form.note ?? ""}
                    onChange={(e) => handleChange("note", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* 2. 품목 정보 섹션 */}
            <div className="createSection">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label className="requiredLabel" style={{ margin: 0, fontWeight: 600 }}>품목 정보</label>
                <button type="button" className="miniButton primary" onClick={addLine} disabled={isSubmitting}>
                  + 품목 추가
                </button>
              </div>

              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <div className="th-content">품목코드</div>
                      </th>
                      <th>
                        <div className="th-content">주문수량</div>
                      </th>
                      <th>
                        <div className="th-content">주문금액</div>
                      </th>
                      <th>
                        <div className="th-content">삭제</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.lines?.map((line, idx) => (
                      <tr key={idx}>
                        <td>
                          <select
                            className="tableInput"
                            value={line.itemCode}
                            onChange={(e) => handleLineChange(idx, "itemCode", e.target.value)}
                            disabled={isSubmitting}
                          >
                            <option value="">품목을 선택해주세요</option>
                            {itemOptions.map((opt) => (
                              <option key={opt.itemCode} value={opt.itemCode}>
                                {opt.itemCode} ({opt.itemNm ?? "-"})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="tableInput"
                            style={{ textAlign: "right" }}
                            value={line.orderQty}
                            disabled={isSubmitting}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, "");
                              handleLineChange(idx, "orderQty", val === "" ? 0 : Number(val));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="tableInput"
                            style={{ textAlign: "right" }}
                            value={line.orderAmount}
                            disabled={isSubmitting}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, "");
                              handleLineChange(idx, "orderAmount", val === "" ? 0 : Number(val));
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="miniButton danger"
                            onClick={() => removeLine(idx)}
                            disabled={isSubmitting}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!form.lines || form.lines.length === 0) && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", padding: "20px" }}>
                          등록된 품목 정보가 없습니다. 우측 상단의 [+ 품목 추가] 버튼을 눌러주세요.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="createFooter">
            <button type="button" className="ghostButton" onClick={handleCancel} disabled={isSubmitting}>
              취소
            </button>
            <button type="submit" className="primaryButton" disabled={isSubmitting}>
              {isSubmitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
