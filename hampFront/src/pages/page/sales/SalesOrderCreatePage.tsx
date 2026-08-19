import { useState, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import axios from "axios";
import { 
  SalesOrderApi, 
  type SalesOrderCreateRequest,
  type SalesOrderLineRequest 
} from "@/api/sales/SalesOrder";

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
      <Panel title="신규 수주 등록">
        <form className="pageForm" onSubmit={handleSubmit}>
          {/* 수주 헤더 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="detailField">
              <label>수주코드 <span className="text-red-500">*</span></label>
              <input className="tableInput" value={form.orderCode} onChange={(e) => handleChange("orderCode", e.target.value)} disabled={isSubmitting} />
            </div>
            <div className="detailField">
              <label>거래처코드</label>
              <input className="tableInput" value={form.bpCode} onChange={(e) => handleChange("bpCode", e.target.value)} disabled={isSubmitting} />
            </div>
            <div className="detailField">
              <label>납기일자</label>
              <input type="date" className="tableInput" value={form.dueDate ?? ""} onChange={(e) => handleChange("dueDate", e.target.value)} disabled={isSubmitting} />
            </div>
            <div className="detailField">
              <label>비고</label>
              <input className="tableInput" value={form.note ?? ""} onChange={(e) => handleChange("note", e.target.value)} disabled={isSubmitting} />
            </div>
          </div>

          {/* 품목 리스트 */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold">품목 정보</h3>
              <button type="button" className="secondaryButton" onClick={addLine}>+ 품목 추가</button>
            </div>
            <table className="w-full border-collapse border">
              <thead>
                <tr>
                  <th className="border p-2">품목코드</th>
                  <th className="border p-2">수량</th>
                  <th className="border p-2">금액</th>
                  <th className="border p-2">삭제</th>
                </tr>
              </thead>
              <tbody>
                {form.lines?.map((line, idx) => (
                  <tr key={idx}>
                    <td className="border p-2"><input className="w-full" value={line.itemCode} onChange={(e) => handleLineChange(idx, "itemCode", e.target.value)} /></td>
                    <td className="border p-2"><input type="number" className="w-full text-right" value={line.orderQty} onChange={(e) => handleLineChange(idx, "orderQty", Number(e.target.value))} /></td>
                    <td className="border p-2"><input type="number" className="w-full text-right" value={line.orderAmount} onChange={(e) => handleLineChange(idx, "orderAmount", Number(e.target.value))} /></td>
                    <td className="border p-2 text-center"><button type="button" className="text-red-500" onClick={() => removeLine(idx)}>삭제</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 버튼 영역 */}
          <div className="pageFormFooter mt-6">
            <button type="button" className="ghostButton" onClick={handleCancel} disabled={isSubmitting}>취소</button>
            <button type="submit" className="primaryButton" disabled={isSubmitting}>
              {isSubmitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      </Panel>
    </section>
  );
}