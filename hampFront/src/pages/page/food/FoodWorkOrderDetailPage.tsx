import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Barcode from "react-barcode";
import { type ColumnDef } from "@tanstack/react-table";
import { CusTable } from "@/components/table/CusTable";
import { Badge } from "@/components/common/Badge";
import Spinner from "@/components/common/Spinner";
import { WorkOrderApi } from "@/api/WorkOrder"; 
import { type SalesOrderStatusLineResponse } from "@/api/sales/SalesOrder"; 

import { SalesOrderModal } from "@/components/modal/SalesOrderModal"; 
import '@/pages/page/master/MasterItem.css';

interface WorkOrderLineDetail {
  id: string;
  orderCode: string;
  lineId: string;
  itemCode: string; // 추가: 품목코드 저장용
  itemNm: string;
  instructQty: string;
  barcode: string;
}

interface WorkOrderMaster {
  workOrderNo: string;
  title: string;
  workDate: string;
  status: "대기" | "진행중" | "완료" | "지연";
  managerId: string;
  lines: WorkOrderLineDetail[];
}

// ==========================================
// 라벨 인쇄 미리보기 모달 컴포넌트
// ==========================================
interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLines: WorkOrderLineDetail[];
  workOrderNo: string;
}

function LabelPrintModal({ isOpen, onClose, selectedLines, workOrderNo }: LabelPrintModalProps) {
  if (!isOpen) return null;

  return (
    <div style={labelModalStyles.overlay}>
      <div style={labelModalStyles.container}>
        <div style={labelModalStyles.header}>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>생산관리 &gt; 작업지시 &gt; 라벨 인쇄</div>
            <h2 style={labelModalStyles.title}>라벨 인쇄 미리보기</h2>
            <p style={labelModalStyles.subtitle}>선택한 라인만 라벨로 출력됩니다. (총 {selectedLines.length}건)</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" className="ghostButton" onClick={onClose} style={{ fontSize: '13px', padding: '6px 12px' }}>
              닫기
            </button>
            <button type="button" className="primaryButton" onClick={() => window.print()} style={{ fontSize: '13px', padding: '6px 16px' }}>
              인쇄
            </button>
          </div>
        </div>

        <div style={labelModalStyles.body}>
          <div style={labelModalStyles.grid}>
            {selectedLines.map((line) => (
              <div key={line.id} style={labelModalStyles.labelCard}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                  {workOrderNo}
                </div>
                <div style={{ fontSize: '13px', color: '#334155', marginBottom: '8px', fontWeight: 500 }}>
                  {line.itemNm} <span style={{ color: '#64748b', fontSize: '12px' }}>({line.orderCode})</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '12px' }}>
                  지시수량 <span style={{ fontWeight: 700 }}>{line.instructQty}</span>
                </div>
                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px' }}>
                  <Barcode value={line.barcode || workOrderNo} width={1.3} height={40} fontSize={11} displayValue={true} margin={0} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 메인 상세 페이지 컴포넌트
// ==========================================
export function FoodWorkOrderDetailPage() {
  const navigate = useNavigate();
  const { workId } = useParams<{ workId: string }>();

  const [isLoading, setIsLoading] = useState(false);
  const [workOrder, setWorkOrder] = useState<WorkOrderMaster>({
    workOrderNo: workId || "",
    title: "",
    workDate: "",
    status: "대기",
    managerId: "",
    lines: [],
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<WorkOrderMaster>(workOrder);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isSalesOrderModalOpen, setIsSalesOrderModalOpen] = useState(false);

  const fetchWorkOrderDetail = useCallback(async () => {
    if (!workId) return;
    setIsLoading(true);
    try {
      const response = await WorkOrderApi.getDetail(workId);
      const data = response.data as any; 
      
      const mappedData: WorkOrderMaster = {
        workOrderNo: data.workId || workId,
        title: data.title || data.workName || data.note || "작업 지시 상세",
        workDate: data.workDate || "",
        status: data.status === "DONE" || data.status === "완료" ? "완료" : 
                data.status === "PROGRESS" || data.status === "진행중" ? "진행중" : 
                data.status === "DELAY" || data.status === "지연" ? "지연" : "대기",
        managerId: data.managerNm ? `${data.managerNm} (${data.managerId})` : data.managerId || "",
        lines: (data.lines || data.workOrderLines || []).map((l: any, idx: number) => ({
          id: l.id || `line-${idx}`,
          orderCode: l.orderCode || l.salesOrderCode || "",
          lineId: l.lineId || `#${101 + idx}`,
          itemCode: l.itemCode || "",
          itemNm: l.itemNm || l.itemName || "",
          instructQty: String(l.instructQty || l.qty || ""),
          barcode: l.barcode || `${data.workId || workId}-${101 + idx}`,
        })),
      };

      setWorkOrder(mappedData);
      setEditForm(mappedData);
    } catch (error) {
      console.error("작업지시 상세 조회 실패:", error);
      alert("작업지시 상세 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    fetchWorkOrderDetail();
  }, [fetchWorkOrderDetail]);

  const handleStartEdit = () => {
    setEditForm(workOrder);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(workOrder);
  };

  const handleSaveEdit = async () => {
    try {
      setIsLoading(true);
      const payload: Record<string, any> = {
        workId: editForm.workOrderNo,
        title: editForm.title,
        workDate: editForm.workDate,
        status: editForm.status === "완료" ? "DONE" : editForm.status === "진행중" ? "PROGRESS" : editForm.status === "지연" ? "DELAY" : "WAIT",
        lines: editForm.lines,
      };

      if (WorkOrderApi.update) {
        await WorkOrderApi.update(editForm.workOrderNo, payload as any);
      }

      setWorkOrder(editForm);
      setIsEditing(false);
      alert("성공적으로 수정되었습니다.");
      fetchWorkOrderDetail();
    } catch (error) {
      console.error("작업지시 수정 실패:", error);
      alert("수정 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWorkOrder = async () => {
    if (!window.confirm("정말 이 작업지시를 삭제하시겠습니까?")) return;
    try {
      setIsLoading(true);
      if (WorkOrderApi.delete) {
        await WorkOrderApi.delete(workOrder.workOrderNo);
      }
      alert("삭제되었습니다.");
      navigate(-1);
    } catch (error) {
      console.error("작업지시 삭제 실패:", error);
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLine = (lineId: string) => {
    setEditForm(prev => ({
      ...prev,
      lines: prev.lines.filter(l => l.id !== lineId)
    }));
    setSelectedLines(prev => prev.filter(item => item !== lineId));
  };

  // 모달에서 선택한 실제 API 응답 타입 기반 라인 추가 처리
  const handleSelectSalesOrderLine = (selectedLine: SalesOrderStatusLineResponse) => {
    const activeLinesCount = editForm.lines.length;
    const newLine: WorkOrderLineDetail = {
      id: `line-${Date.now()}`,
      orderCode: selectedLine.orderCode,
      lineId: `#${101 + activeLinesCount}`,
      itemCode: selectedLine.itemCode,
      itemNm: selectedLine.itemNm,
      instructQty: String(selectedLine.orderQty || 0),
      barcode: `${editForm.workOrderNo}-${101 + activeLinesCount}`,
    };

    setEditForm(prev => ({
      ...prev,
      lines: [...prev.lines, newLine]
    }));
  };

  const activeLines = isEditing ? editForm.lines : workOrder.lines;

  const handleLineChange = (lineId: string, field: keyof WorkOrderLineDetail, value: string) => {
    setEditForm(prev => ({
      ...prev,
      lines: prev.lines.map(l => l.id === lineId ? { ...l, [field]: value } : l)
    }));
  };

  const columns = useMemo<ColumnDef<WorkOrderLineDetail>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <input 
            type="checkbox" 
            onChange={(e) => {
              if (e.target.checked) setSelectedLines(activeLines.map(l => l.id));
              else setSelectedLines([]);
            }}
            checked={selectedLines.length === activeLines.length && activeLines.length > 0}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
        ),
        cell: ({ row }) => (
          <input 
            type="checkbox" 
            checked={selectedLines.includes(row.original.id)}
            onChange={() => {
              setSelectedLines(prev => prev.includes(row.original.id) ? prev.filter(i => i !== row.original.id) : [...prev, row.original.id]);
            }}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
        ),
        meta: { width: '50px' },
      },
      {
        accessorKey: "orderCode",
        header: "연결 수주라인",
        cell: ({ row }) => (
          isEditing ? (
            <input 
              type="text"
              value={row.original.orderCode}
              onChange={(e) => handleLineChange(row.original.id, 'orderCode', e.target.value)}
              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '130px' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, color: '#2563eb' }}>{row.original.orderCode}</span>
              <span style={{ fontSize: '12px', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                {row.original.lineId}
              </span>
            </div>
          )
        ),
      },
      {
        accessorKey: "itemNm",
        header: "품목",
        cell: ({ row }) => (
          isEditing ? (
            <input 
              type="text"
              value={row.original.itemNm}
              onChange={(e) => handleLineChange(row.original.id, 'itemNm', e.target.value)}
              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100%' }}
            />
          ) : (
            <div style={{ color: '#1e293b', fontWeight: 600 }}>
              {row.original.itemNm} 
              {row.original.itemCode && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>({row.original.itemCode})</span>}
            </div>
          )
        ),
      },
      {
        accessorKey: "instructQty",
        header: "지시수량",
        cell: ({ row }) => (
          isEditing ? (
            <input 
              type="text"
              value={row.original.instructQty}
              onChange={(e) => handleLineChange(row.original.id, 'instructQty', e.target.value)}
              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100px' }}
            />
          ) : (
            <div style={{ color: '#0f172a', fontWeight: 700 }}>{row.original.instructQty}</div>
          )
        ),
      },
      {
        accessorKey: "barcode",
        header: "바코드",
        cell: ({ row }) => (
          <div style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Barcode value={row.original.barcode || "NO-BARCODE"} width={1.2} height={38} fontSize={11} displayValue={true} margin={0} />
            {isEditing && (
              <button 
                type="button" 
                onClick={() => handleDeleteLine(row.original.id)}
                style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                삭제
              </button>
            )}
          </div>
        ),
        meta: { width: '450px' },
      },
    ],
    [selectedLines, activeLines, isEditing]
  );

  const handleOpenLabelModal = () => {
    if (selectedLines.length === 0) {
      alert("인쇄할 라인을 최소 1개 이상 선택해주세요.");
      return;
    }
    setIsLabelModalOpen(true);
  };

  return (
    <section className="screenStack relative min-h-[400px]">
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 z-50 flex items-center justify-center">
          <Spinner />
        </div>
      )}

      <div className="createCard" style={{ padding: '32px', background: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 4px 0' }}>
              {workOrder.workOrderNo}
            </h1>
            <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>
              {workOrder.title}
            </span>
          </div>
        </div>

        <div style={{ 
          background: '#f8fafc', 
          border: '1px solid #e2e8f0', 
          borderRadius: '10px', 
          padding: '20px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px',
          marginBottom: '36px',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>작업일자</div>
            {isEditing ? (
              <input 
                type="date"
                value={editForm.workDate}
                onChange={(e) => setEditForm({ ...editForm, workDate: e.target.value })}
                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100%' }}
              />
            ) : (
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{workOrder.workDate || '-'}</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>상태</div>
            {isEditing ? (
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100%' }}
              >
                <option value="대기">대기</option>
                <option value="진행중">진행중</option>
                <option value="완료">완료</option>
                <option value="지연">지연</option>
              </select>
            ) : (
              <div>
                <Badge tone={workOrder.status === '완료' ? 'good' : workOrder.status === '진행중' ? 'info' : 'muted'}>
                  {workOrder.status}
                </Badge>
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>담당자</div>
            {isEditing ? (
              <input 
                type="text"
                value={editForm.managerId}
                onChange={(e) => setEditForm({ ...editForm, managerId: e.target.value })}
                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100%' }}
              />
            ) : (
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{workOrder.managerId || '-'}</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>라인 수</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{activeLines.length}건</div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>
              작업지시 라인
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setIsSalesOrderModalOpen(true)}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '13px', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  + 수주라인 추가
                </button>
              )}
              <button
                type="button"
                className="ghostButton"
                style={{ fontSize: '13px', padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                onClick={handleOpenLabelModal}
              >
                선택 라벨 인쇄
              </button>
            </div>
          </div>

          <CusTable
            data={activeLines}
            columns={columns}
            noDataMessage="등록된 작업지시 라인이 없습니다."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '36px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleDeleteWorkOrder}
                style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
              >
                지시서 삭제
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {isEditing ? (
              <>
                <button 
                  type="button" 
                  className="ghostButton" 
                  onClick={handleCancelEdit}
                  style={{ padding: '8px 20px', fontSize: '14px', borderRadius: '6px', fontWeight: 600 }}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="primaryButton"
                  onClick={handleSaveEdit}
                  style={{ padding: '8px 20px', fontSize: '14px', borderRadius: '6px', fontWeight: 600 }}
                >
                  저장
                </button>
              </>
            ) : (
              <>
                <button 
                  type="button" 
                  className="ghostButton" 
                  onClick={() => navigate(-1)}
                  style={{ padding: '8px 20px', fontSize: '14px', borderRadius: '6px', fontWeight: 600 }}
                >
                  목록
                </button>
                <button
                  type="button"
                  className="primaryButton"
                  onClick={handleStartEdit}
                  style={{ padding: '8px 20px', fontSize: '14px', borderRadius: '6px', fontWeight: 600 }}
                >
                  수정
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      <SalesOrderModal
        isOpen={isSalesOrderModalOpen}
        onClose={() => setIsSalesOrderModalOpen(false)}
        onSelect={handleSelectSalesOrderLine}
      />
      <LabelPrintModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        selectedLines={workOrder.lines.filter(l => selectedLines.includes(l.id))}
        workOrderNo={workOrder.workOrderNo}
      />
    </section>
  );
}

const labelModalStyles: { [key: string]: React.CSSProperties } = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 },
  container: { backgroundColor: '#f8fafc', width: '850px', maxWidth: '95vw', maxHeight: '85vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '20px 24px', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' },
  title: { margin: '0 0 4px 0', fontSize: '20px', fontWeight: 700 },
  subtitle: { margin: 0, fontSize: '13px', color: '#64748b' },
  body: { padding: '24px', overflowY: 'auto', flex: 1 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' },
  labelCard: { backgroundColor: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '20px' },
};