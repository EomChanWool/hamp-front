import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Barcode from "react-barcode";
import { type ColumnDef } from "@tanstack/react-table";
import { CusTable } from "@/components/table/CusTable";
import { Badge } from "@/components/common/Badge";
import Spinner from "@/components/common/Spinner";
import { WorkOrderApi } from "@/api/WorkOrder"; 
import { UserApi, type UserOptionResponse } from "@/api/User";
import { type SalesOrderStatusLineResponse } from "@/api/sales/SalesOrder"; 

import { SalesOrderModal } from "@/components/modal/SalesOrderModal"; 
import { LabelPrintModal, type WorkOrderLineDetail, type WorkOrderMaster } from "@/components/modal/LabelPrintModal";
import '@/pages/page/food/Food.css';

// ==========================================
// 메인 상세 페이지 컴포넌트
// ==========================================
export function FoodWorkOrderDetailPage() {
  const navigate = useNavigate();
  const { workId } = useParams<{ workId: string }>();

  const [isLoading, setIsLoading] = useState(false);
  const [userOptions, setUserOptions] = useState<UserOptionResponse[]>([]);

  const [workOrder, setWorkOrder] = useState<WorkOrderMaster>({
    workOrderNo: workId || "",
    title: "",
    workDate: "",
    status: "WAIT",
    managerId: "",
    managerNm: "",
    lines: [],
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<WorkOrderMaster>(workOrder);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isSalesOrderModalOpen, setIsSalesOrderModalOpen] = useState(false);

  // --- useRef 기반 지시수량 임시 저장소 (lineId를 키로 관리) ---
  const editQuantitiesRef = useRef<Record<string, number | ''>>({});

  useEffect(() => {
    const fetchUserOptions = async () => {
      try {
        const res = await UserApi.getOptions();
        if (res && res.data) {
          setUserOptions(res.data);
        }
      } catch (error) {
        console.error("회원 옵션 조회 실패:", error);
      }
    };
    fetchUserOptions();
  }, []);

  const fetchWorkOrderDetail = useCallback(async () => {
    if (!workId) return;
    setIsLoading(true);
    try {
      const response = await WorkOrderApi.getDetail(workId);
      const data = response.data as any; 
      
      const mappedData: WorkOrderMaster = {
        workOrderNo: data.workId || workId,
        title: data.title || data.workName || "작업 지시 상세",
        workDate: data.workDate || "",
        status: data.status || "WAIT",
        managerId: data.managerId || "",
        managerNm: data.managerNm || "",
        lines: (data.lines || []).map((l: any, idx: number) => ({
          id: l.workOrderLineId ? String(l.workOrderLineId) : `line-${idx}`,
          salesOrderLineId: l.salesOrderLineId || 0,
          orderCode: l.orderCode || "",
          lineId: `#${101 + idx}`,
          itemCode: l.itemCode || "",
          itemNm: l.itemNm || "",
          instructQty: Number(l.instructQty || 0),
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
    // 수정 모드 진입 시 현재 라인들의 수량을 ref에 초기화
    const initialQtyMap: Record<string, number | ''> = {};
    workOrder.lines.forEach(l => {
      initialQtyMap[l.id] = l.instructQty;
    });
    editQuantitiesRef.current = initialQtyMap;

    setIsEditing(true);
    setSelectedLines([]);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(workOrder);
  };

  const handleSaveEdit = async () => {
    try {
      setIsLoading(true);

      // 저장 시점 직전에 ref에 입력된 최신 수량을 editForm.lines에 반영
      const updatedLines = editForm.lines.map(l => ({
        ...l,
        instructQty: Number(editQuantitiesRef.current[l.id]) || 0,
      }));

      const payload = {
        workDate: editForm.workDate,
        status: editForm.status,
        managerId: editForm.managerId,
        lines: updatedLines.map((l) => ({
          salesOrderLineId: l.salesOrderLineId,
          instructQty: l.instructQty,
        })),
      };

      await WorkOrderApi.update(editForm.workOrderNo, payload);

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
      await WorkOrderApi.delete(workOrder.workOrderNo);
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
    delete editQuantitiesRef.current[lineId];
    setEditForm(prev => ({
      ...prev,
      lines: prev.lines.filter(l => l.id !== lineId)
    }));
    setSelectedLines(prev => prev.filter(item => item !== lineId));
  };

  const handleSelectSalesOrderLine = (selectedLine: SalesOrderStatusLineResponse) => {
    const activeLinesCount = editForm.lines.length;
    const newId = `line-${Date.now()}`;
    const defaultQty = Number(selectedLine.orderQty || 0);

    // 신규 추가된 라인의 수량도 ref에 등록
    editQuantitiesRef.current[newId] = defaultQty;

    const newLine: WorkOrderLineDetail = {
      id: newId,
      salesOrderLineId: selectedLine.salesOrderLineId,
      orderCode: selectedLine.orderCode,
      lineId: `#${101 + activeLinesCount}`,
      itemCode: selectedLine.itemCode,
      itemNm: selectedLine.itemNm,
      instructQty: defaultQty,
      barcode: `${editForm.workOrderNo}-${101 + activeLinesCount}`,
      unit: (selectedLine as any).unit || "",
    };

    setEditForm(prev => ({
      ...prev,
      lines: [...prev.lines, newLine]
    }));
  };

  const activeLines = isEditing ? editForm.lines : workOrder.lines;

  const columns = useMemo<ColumnDef<WorkOrderLineDetail>[]>(
    () => [
      ...(!isEditing
        ? [
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
              cell: ({ row }: { row: any }) => (
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
          ]
        : []),
      {
        accessorKey: "orderCode",
        header: "연결 수주라인",
        cell: ({ row }) => (
          <div className="food-cell-flex-wrap">
            <span className="food-cell-order-code">{row.original.orderCode}</span>
            <span className="food-cell-line-badge">
              {row.original.lineId}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "itemNm",
        header: "품목",
        cell: ({ row }) => (
          <div className="food-cell-item-name">
            {row.original.itemNm} 
            {row.original.itemCode && <span className="food-cell-item-code">({row.original.itemCode})</span>}
          </div>
        ),
      },
      {
        accessorKey: "instructQty",
        header: "지시수량",
        cell: ({ row }) => {
          const item = row.original;
          if (isEditing) {
            return (
              <input 
                type="number"
                className="food-line-input"
                defaultValue={editQuantitiesRef.current[item.id] ?? item.instructQty}
                onChange={(e) => {
                  editQuantitiesRef.current[item.id] = e.target.value === '' ? '' : Number(e.target.value);
                }}
              />
            );
          }
          return <div className="food-cell-qty">{item.instructQty}</div>;
        },
      },
      {
        accessorKey: "barcode",
        header: "바코드",
        cell: ({ row }) => (
          <div className="food-cell-center">
            <Barcode value={row.original.barcode || "NO-BARCODE"} width={1.2} height={38} fontSize={11} displayValue={true} margin={0} />
            {isEditing && (
              <button 
                type="button" 
                onClick={() => handleDeleteLine(row.original.id)}
                className="food-line-delete-btn-sm"
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DONE": return <Badge tone="good">완료</Badge>;
      case "PROGRESS": return <Badge tone="info">진행중</Badge>;
      case "DELAY": return <Badge tone="danger">지연</Badge>;
      default: return <Badge tone="muted">대기</Badge>;
    }
  };

  return (
    <section className="screenStack relative min-h-[400px]">
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 z-50 flex items-center justify-center">
          <Spinner />
        </div>
      )}

      <div className="createCard food-detail-card">
        
        <div className="food-detail-header">
          <div>
            <h1 className="food-detail-title">
              {workOrder.workOrderNo}
            </h1>
            <span className="food-detail-subtitle">
              {workOrder.title}
            </span>
          </div>
        </div>

        <div className="food-summary-grid-box">
          <div>
            <div className="food-summary-label">작업일자</div>
            {isEditing ? (
              <input 
                type="date"
                value={editForm.workDate}
                onChange={(e) => setEditForm({ ...editForm, workDate: e.target.value })}
                className="food-edit-input"
              />
            ) : (
              <div className="food-summary-value">{workOrder.workDate || '-'}</div>
            )}
          </div>
          <div>
            <div className="food-summary-label">상태</div>
            {isEditing ? (
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                className="food-edit-input"
              >
                <option value="WAIT">대기</option>
                <option value="PROGRESS">진행중</option>
                <option value="DONE">완료</option>
                <option value="DELAY">지연</option>
              </select>
            ) : (
              <div>{getStatusBadge(workOrder.status)}</div>
            )}
          </div>
          <div>
            <div className="food-summary-label">담당자</div>
            {isEditing ? (
              <select
                value={editForm.managerId}
                onChange={(e) => setEditForm({ ...editForm, managerId: e.target.value })}
                className="food-edit-input"
              >
                <option value="">담당자 선택</option>
                {userOptions.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.userNm} ({user.userId})
                  </option>
                ))}
              </select>
            ) : (
              <div className="food-summary-value">
                {workOrder.managerNm ? `${workOrder.managerNm} (${workOrder.managerId})` : workOrder.managerId || '-'}
              </div>
            )}
          </div>
          <div>
            <div className="food-summary-label">라인 수</div>
            <div className="food-summary-value">{activeLines.length}건</div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div className="food-section-header">
            <h2 className="food-section-title">
              작업지시 라인
            </h2>
            <div className="food-header-btn-group">
              {isEditing && (
                <button
                  type="button"
                  className="miniButton primary"
                  onClick={() => setIsSalesOrderModalOpen(true)}
                >
                  + 수주라인 추가
                </button>
              )}
              {!isEditing && (
                <button
                  type="button"
                  className="ghostButton food-label-print-btn"
                  onClick={handleOpenLabelModal}
                >
                  선택 라벨 인쇄
                </button>
              )}
            </div>
          </div>

          <CusTable
            data={activeLines}
            columns={columns}
            noDataMessage="등록된 작업지시 라인이 없습니다."
          />
        </div>

        <div className="food-detail-footer">
          <div>
            {isEditing && (
              <button
                type="button"
                className="dangerButton"
                onClick={handleDeleteWorkOrder}
              >
                지시서 삭제
              </button>
            )}
          </div>
          <div className="food-footer-btn-group">
            {isEditing ? (
              <>
                <button 
                  type="button" 
                  className="ghostButton" 
                  onClick={handleCancelEdit}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="primaryButton"
                  onClick={handleSaveEdit}
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
                >
                  목록
                </button>
                <button
                  type="button"
                  className="primaryButton"
                  onClick={handleStartEdit}
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