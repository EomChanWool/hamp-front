import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import axios from "axios";
import { SalesOrderApi } from "@/api/sales/SalesOrder";
import type {
  SalesOrderDetailResponse,
  SalesOrderUpdateRequest,
} from "@/api/sales/SalesOrder";
import Spinner from "@/components/common/Spinner";

/** 화면 표시용 필드 정의 */
type Field = {
  label: string;
  key: keyof SalesOrderDetailResponse | "createdAt" | "updatedAt";
  editable?: boolean;
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
  
  // 폼 상태: 단순 필드와 라인 데이터를 분리 관리
  const [form, setForm] = useState<Record<string, any>>({});

  const isBusy = isUpdating || isDeleting;

  const fields: Field[] = [
    { label: "수주코드", key: "orderCode", editable: false },
    { label: "거래처명", key: "bpNm", editable: false },
    { label: "거래처코드", key: "bpCode", editable: true },
    { label: "납기일자", key: "dueDate", editable: true },
    { label: "상태", key: "status", editable: true },
    { label: "비고", key: "note", editable: true },
  ];

  // 상세 데이터 조회
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
          lines: data.lines, // 품목 정보
        });
      }
    } catch (error) {
      console.error("수주 상세 조회 실패:", error);
      alert("상세 정보를 불러오는 중 오류가 발생했습니다.");
      navigate({ pathname: "/sales/sales-order", search: location.search });
    } finally {
      setIsLoading(false);
    }
  }, [orderCode, navigate, location.search]);

  useEffect(() => {
    fetchOrderDetail();
  }, [fetchOrderDetail]);

  // 저장 처리
  const handleSave = async () => {
    if (!order || isUpdating) return;

    setIsUpdating(true);
    try {
      const updatePayload: SalesOrderUpdateRequest = {
        bpCode: form.bpCode,
        dueDate: form.dueDate || null,
        status: form.status || null,
        note: form.note || null,
        lines: form.lines,
      };

      await SalesOrderApi.update(order.orderCode, updatePayload);
      alert("수정되었습니다.");
      await fetchOrderDetail();
      setIsEditing(false);
    } catch (err) {
      console.error("수주 수정 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 삭제 처리
  const handleDelete = async () => {
    if (!order || isDeleting) return;

    const confirmed = window.confirm(`${order.orderCode} 수주를 삭제하시겠습니까?`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await SalesOrderApi.delete(order.orderCode);
      alert("삭제되었습니다.");
      navigate({ pathname: "/sales/sales-order", search: location.search });
    } catch (error) {
      console.error("수주 삭제 실패:", error);
      alert("삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && !order) {
    return (
      <section className="screenStack">
        <Panel title="수주 상세 정보">
          <div className="flex justify-center p-10"><Spinner /></div>
        </Panel>
      </section>
    );
  }

  if (!order) return null;

  return (
    <section className="screenStack">
      <Panel title={isEditing ? "수주 정보 수정" : "수주 상세 정보"}>
        <form className="pageForm" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          {/* 기본 정보 필드 */}
          {fields.map(({ label, key, editable }) => (
            <div key={key} className="detailField">
              <label>{label}</label>
              {isEditing && editable ? (
                <input
                  className="tableInput"
                  value={form[key] ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              ) : (
                <div className="detailValue">{form[key] || "-"}</div>
              )}
            </div>
          ))}

          {/* 수주 품목 테이블 */}
          <div className="mt-6">
            <h3 className="text-lg font-bold mb-2">품목 정보</h3>
            <table className="w-full border-collapse border">
              <thead>
                <tr>
                  <th className="border p-2">품목코드</th>
                  <th className="border p-2">품목명</th>
                  <th className="border p-2">수량</th>
                  <th className="border p-2">금액</th>
                </tr>
              </thead>
              <tbody>
                {form.lines?.map((line: any, idx: number) => (
                  <tr key={idx}>
                    <td className="border p-2 text-center">{line.itemCode}</td>
                    <td className="border p-2">{line.itemNm}</td>
                    <td className="border p-2 text-right">{line.orderQty.toLocaleString()}</td>
                    <td className="border p-2 text-right">{line.orderAmount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 푸터 버튼 */}
          <div className="pageFormFooterSpaceBetween mt-6">
            <div>
              {isEditing && (
                <button type="button" className="dangerButton text-sm text-red-500 hover:underline" onClick={handleDelete} disabled={isBusy}>
                  수주 삭제
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {isEditing ? (
                <>
                  <button type="button" className="ghostButton" onClick={() => setIsEditing(false)}>취소</button>
                  <button type="button" className="primaryButton" onClick={handleSave} disabled={isBusy}>저장</button>
                </>
              ) : (
                <>
                  <button type="button" className="ghostButton" onClick={() => navigate(-1)}>목록</button>
                  <button type="button" className="primaryButton" onClick={() => setIsEditing(true)}>수정</button>
                </>
              )}
            </div>
          </div>
        </form>
      </Panel>
    </section>
  );
}