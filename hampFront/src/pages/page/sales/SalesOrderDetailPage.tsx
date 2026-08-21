import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { SalesOrderApi } from "@/api/sales/SalesOrder";
import type {
  SalesOrderDetailResponse,
  SalesOrderUpdateRequest,
} from "@/api/sales/SalesOrder";
import { BusinessPartnerApi } from "@/api/sales/BusinessPartner";
import { ItemApi } from "@/api/master/Item";
import Spinner from "@/components/common/Spinner";
import { formatDateTime } from "@/utils/common";
import { DetailLayout, type DetailSection } from "@/pages/layout/DetailLayout";

export function SalesOrderDetailPage() {
  const { orderCode } = useParams<{ orderCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [order, setOrder] = useState<SalesOrderDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState<Record<string, any>>({});
  const [businessPartnerOptions, setBusinessPartnerOptions] = useState<any[]>([]);
  const [itemOptions, setItemOptions] = useState<any[]>([]);

  const isBusy = isUpdating || isDeleting;

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
          renderEditor: (value, onChange, disabled) => (
            <select
              className="tableInput"
              value={value ?? ""}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">거래처를 선택해주세요</option>
              {businessPartnerOptions.map((opt) => (
                <option key={opt.bpCode} value={opt.bpCode}>
                  {opt.bpCode} ({opt.bpNm ?? "-"})
                </option>
              ))}
            </select>
          ),
        },
      ],
    },
    {
      title: "처리 정보",
      fields: [
        { label: "납기일자", key: "dueDate", editable: true },
        { label: "상태", key: "status", editable: true },
        { label: "비고", key: "note", editable: true, fullWidth: true },
      ],
    },
  ];

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
          createdAt: formatDateTime(data.createdAt),
          lines: data.lines || [],
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
        createdAt: formatDateTime(order.createdAt),
        lines: order.lines || [],
      });
    }
  }, [isEditing, order]);

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...(prev.lines || []), { itemCode: "", itemNm: "", orderQty: 0, orderAmount: 0 }],
    }));
  };

  const removeLine = (index: number) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines?.filter((_: any, i: number) => i !== index),
    }));
  };

  const handleLineChange = (index: number, fieldName: string, value: any) => {
    const updatedLines = [...(form.lines || [])];
    updatedLines[index] = {
      ...updatedLines[index],
      [fieldName]: value,
    };
    setForm((prev) => ({ ...prev, lines: updatedLines }));
  };

  const handleSave = async () => {
    if (!order || isUpdating) return;

    setIsUpdating(true);
    try {
      const updatePayload: SalesOrderUpdateRequest = {
        bpCode: form.bpCode,
        dueDate: form.dueDate || null,
        status: form.status || null,
        note: form.note || null,
        lines: (form.lines || []).map((line: any) => ({
          itemCode: line.itemCode,
          orderQty: Number(line.orderQty) || 0,
          orderAmount: Number(line.orderAmount) || 0,
        })),
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
        <div className="detailCard">
          <div className="flex justify-center p-10"><Spinner /></div>
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
            <button
              type="button"
              className="dangerButton text-sm text-red-500 hover:underline px-2 py-1"
              onClick={handleDelete}
              disabled={isBusy}
            >
              {isDeleting ? "삭제 처리 중..." : "수주 삭제"}
            </button>
          )
        }
        footerRight={
          isEditing ? (
            <>
              <button
                type="button"
                className="ghostButton"
                onClick={() => setIsEditing(false)}
                disabled={isBusy}
              >
                취소
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={handleSave}
                disabled={isBusy}
              >
                {isUpdating ? "저장 중..." : "저장"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ghostButton"
                onClick={() => navigate({ pathname: "/sales/sales-order", search: location.search })}
                disabled={isBusy}
              >
                목록
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={() => setIsEditing(true)}
                disabled={isBusy}
              >
                수정
              </button>
            </>
          )
        }
      >
        {/* 품목 정보 테이블 영역 */}
        <div className="detailSection">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <h3 className="detailSectionTitle" style={{ margin: 0 }}>품목 정보</h3>
            {isEditing && (
              <button type="button" className="miniButton primary" onClick={addLine} disabled={isBusy}>
                + 품목 추가
              </button>
            )}
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th><div className="th-content">품목코드</div></th>
                  <th><div className="th-content">품목명</div></th>
                  <th><div className="th-content">주문수량</div></th>
                  <th><div className="th-content">주문금액</div></th>
                  {isEditing && <th><div className="th-content">삭제</div></th>}
                </tr>
              </thead>
              <tbody>
                {form.lines?.map((line: any, idx: number) => (
                  <tr key={idx}>
                    <td>
                      {isEditing ? (
                        <select
                          className="tableInput"
                          value={line.itemCode ?? ""}
                          disabled={isBusy}
                          onChange={(e) => handleLineChange(idx, "itemCode", e.target.value)}
                        >
                          <option value="">품목을 선택해주세요</option>
                          {itemOptions.map((opt) => (
                            <option key={opt.itemCode} value={opt.itemCode}>
                              {opt.itemCode} ({opt.itemNm ?? "-"})
                            </option>
                          ))}
                        </select>
                      ) : (
                        line.itemCode || "-"
                      )}
                    </td>
                    <td>{line.itemNm || "-"}</td>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          className="tableInput"
                          style={{ textAlign: "right" }}
                          value={line.orderQty ?? 0}
                          disabled={isBusy}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, "");
                            handleLineChange(idx, "orderQty", val === "" ? 0 : Number(val));
                          }}
                        />
                      ) : (
                        (line.orderQty ?? 0).toLocaleString()
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          className="tableInput"
                          style={{ textAlign: "right" }}
                          value={line.orderAmount ?? 0}
                          disabled={isBusy}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, "");
                            handleLineChange(idx, "orderAmount", val === "" ? 0 : Number(val));
                          }}
                        />
                      ) : (
                        (line.orderAmount ?? 0).toLocaleString()
                      )}
                    </td>
                    {isEditing && (
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="miniButton danger"
                          onClick={() => removeLine(idx)}
                          disabled={isBusy}
                        >
                          삭제
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {(!form.lines || form.lines.length === 0) && (
                  <tr>
                    <td colSpan={isEditing ? 5 : 4} style={{ textAlign: "center", padding: "20px" }}>
                      등록된 품목 정보가 없습니다. {isEditing && "우측 상단의 [+ 품목 추가] 버튼을 눌러주세요."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DetailLayout>
    </section>
  );
}