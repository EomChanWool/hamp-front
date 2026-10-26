import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import Barcode from "react-barcode";
import QRCode from "react-qr-code";
import { type ColumnDef } from "@tanstack/react-table";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { CusTable } from "@/components/table/CusTable";
import { Badge } from "@/components/common/Badge";
import Spinner from "@/components/common/Spinner";
import { WorkOrderApi, type WorkOrderRoutingStepResponse } from "@/api/WorkOrder";
import { UserApi, type UserOptionResponse } from "@/api/User";
import { SalesOrderApi, type SalesOrderStatusLineResponse } from "@/api/sales/SalesOrder";
import { SalesOrderModal } from "@/components/modal/SalesOrderModal";
import '@/pages/page/food/Food.css';
import { WorkOrderPrintModal, type WorkOrderLineDetail, type WorkOrderMaster } from "@/components/modal/WorkOrderPrintModal";

// ==========================================
// 공정순서도 (세로 타임라인) 컴포넌트
// ==========================================
function RoutingTimeline({ steps }: { steps: WorkOrderRoutingStepResponse[] }) {
  if (steps.length === 0) {
    return (
      <div className="food-routing-content">
        <div className="food-routing-label">공정순서도</div>
        <p className="food-routing-empty">등록된 라우팅 공정이 없습니다.</p>
      </div>
    );
  }

  // 진행 중인 공정이 없으면, 아직 끝나지 않은 첫 공정을 "다음" 공정으로 표시
  const hasInProgress = steps.some((s) => s.inProgress && !s.done);
  const nextSeq = hasInProgress
    ? null
    : steps.find((s) => !s.done)?.operSeq ?? null;

  return (
    <div className="food-routing-content">
      <div className="food-routing-label">공정순서도</div>

      <ol className="food-routing-timeline">
        {steps.map((step) => {
          const isFinal = step.finalYn === "Y";
          const isDone = !!step.done;
          const isInProgress = !isDone && !!step.inProgress;
          const isNext = nextSeq === step.operSeq;

          const equipmentText =
            step.equipments?.map((eq) => eq.eqNm).join(", ") || "";

          const hasPerformance =
            isDone ||
            isInProgress ||
            step.inputQty != null ||
            step.outputQty != null ||
            step.defectQty != null;

          const stateClass = isDone
            ? "is-done"
            : isInProgress
              ? "is-inprogress"
              : isNext
                ? "is-next"
                : "";

          return (
            <li
              key={`${step.operCode}-${step.operSeq}`}
              className={`food-routing-step ${stateClass} ${isFinal ? "is-final" : ""}`}
            >
              <span className="food-routing-marker">
                {isDone ? "✓" : step.operSeq}
              </span>

              <div className="food-routing-step-body">
                <div className="food-routing-step-head">
                  <div className="food-routing-step-text">
                    <span className="food-routing-step-name">{step.operNm}</span>
                    <span className="food-routing-step-meta">
                      ({step.operCode}
                      {equipmentText && <> &nbsp;·&nbsp; {equipmentText}</>})
                    </span>
                  </div>

                  <div className="food-routing-tags">
                    {isDone && (
                      <span className="food-routing-tag food-routing-tag--done">완료</span>
                    )}
                    {isInProgress && (
                      <span className="food-routing-tag food-routing-tag--progress">진행중</span>
                    )}
                    {isNext && (
                      <span className="food-routing-tag food-routing-tag--next">다음</span>
                    )}
                    {isFinal && (
                      <span className="food-routing-tag food-routing-tag--final">최종공정</span>
                    )}
                  </div>
                </div>

                {hasPerformance && (
                  <div className="food-routing-stats">
                    <div className="food-routing-stat">
                      <span className="food-routing-stat-label">투입</span>
                      <span className="food-routing-stat-value">{step.inputQty ?? "-"}</span>
                    </div>
                    <div className="food-routing-stat">
                      <span className="food-routing-stat-label">산출</span>
                      <span className="food-routing-stat-value">{step.outputQty ?? "-"}</span>
                    </div>
                    <div className="food-routing-stat">
                      <span className="food-routing-stat-label">불량</span>
                      <span className="food-routing-stat-value">{step.defectQty ?? "-"}</span>
                    </div>
                    <div className="food-routing-stat">
                      <span className="food-routing-stat-label">수율</span>
                      <span className="food-routing-stat-value">
                        {step.yieldRate == null ? "-" : `${step.yieldRate}%`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
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
  const [printLines, setPrintLines] = useState<WorkOrderLineDetail[]>([]);
  const [isWorkOrderPrintModalOpen, setIsWorkOrderPrintModalOpen] = useState(false);
  const [includeRouting, setIncludeRouting] = useState(false);
  const [isSalesOrderModalOpen, setIsSalesOrderModalOpen] = useState(false);

  // --- useRef 기반 지시수량 임시 저장소 (lineId를 키로 관리) ---
  const editQuantitiesRef = useRef<Record<string, number | ''>>({});

  // 라우팅 아코디언 상태 (펼쳐진 라인 id)
  const [expandedRoutingLineId, setExpandedRoutingLineId] = useState<string | null>(null);

  const [routingStepsByLineId, setRoutingStepsByLineId] = useState<
    Record<string, WorkOrderRoutingStepResponse[]>
  >({});

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
      const routingMap: Record<string, WorkOrderRoutingStepResponse[]> = {};

      (data.lines ?? []).forEach((line: any) => {
        routingMap[String(line.workOrderLineId)] = [...(line.routingSteps ?? [])]
          .sort((a: WorkOrderRoutingStepResponse, b: WorkOrderRoutingStepResponse) =>
            a.operSeq - b.operSeq
          );
      });

      setRoutingStepsByLineId(routingMap);
      setExpandedRoutingLineId(null);

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
          lineId: `#${l.workOrderLineId}`,
          bpCode: l.bpCode || "",
          bpNm: l.bpNm || "",
          dueDate: l.dueDate || "",
          itemCode: l.itemCode || "",
          itemNm: l.itemNm || "",
          instructQty: Number(l.instructQty || 0),
          unit: l.unit || "",
          barcode: l.barcode || `${data.workId || workId}-${l.workOrderLineId || (101 + idx)}`,
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

    setExpandedRoutingLineId(null); // 수정 모드에서는 라우팅 아코디언 접기
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
      const errorMessage = axios.isAxiosError(error) ? error.response?.data?.message : null;
      alert(errorMessage || "수정 중 오류가 발생했습니다.");
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
      const errorMessage = axios.isAxiosError(error) ? error.response?.data?.message : null;
      alert(errorMessage || "삭제 중 오류가 발생했습니다.");
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
      lineId: `#NEW-${activeLinesCount + 1}`,
      itemCode: selectedLine.itemCode,
      itemNm: selectedLine.itemNm,
      instructQty: defaultQty,
      barcode: `${editForm.workOrderNo}-NEW`,
      unit: (selectedLine as any).unit || "",
    };

    setEditForm(prev => ({
      ...prev,
      lines: [...prev.lines, newLine]
    }));

    // 수주라인 목록 응답에는 거래처·납기일자가 없어 수주 상세로 채운다.
    SalesOrderApi.getDetail(selectedLine.orderCode)
      .then((res) => {
        const order = res.data;
        if (!order) return;
        setEditForm(prev => ({
          ...prev,
          lines: prev.lines.map(l =>
            l.id === newId
              ? { ...l, bpCode: order.bpCode ?? "", bpNm: order.bpNm ?? "", dueDate: order.dueDate ?? "" }
              : l
          )
        }));
      })
      .catch((error) => {
        console.error("수주 정보 조회 실패:", error);
        alert("수주 정보를 불러오지 못했습니다.");
      });
  };

  // 행 클릭 시 라우팅(공정순서도) 아코디언 토글
  const handleRowClick = (
    line: WorkOrderLineDetail,
    event: React.MouseEvent<HTMLTableRowElement>
  ) => {
    if (isEditing) return;

    // 체크박스/버튼/입력창 등 상호작용 요소를 눌렀을 때는 아코디언을 토글하지 않음
    const target = event.target as HTMLElement;
    if (target.closest("input, button, select, a, label")) return;

    setExpandedRoutingLineId((prev) => (prev === line.id ? null : line.id));
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
                className="checkbox"
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
                className="checkbox"
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
        accessorKey: "bpNm",
        header: "거래처",
        cell: ({ row }) => (
          <div className="food-cell-item-name">
            <span>{row.original.bpNm || "-"}</span>
            {row.original.bpCode && (
              <span className="food-cell-item-code">
                ({row.original.bpCode})
              </span>
            )}
          </div>
        ),
      },

      {
        accessorKey: "itemNm",
        header: "품목",
        cell: ({ row }) => {
          const line = row.original;
          const isExpanded = expandedRoutingLineId === line.id;

          return (
            <div className="food-item-cell">
              <span className="food-cell-item-name">
                {line.itemNm}
                {line.itemCode && (
                  <span className="food-cell-item-code">
                    ({line.itemCode})
                  </span>
                )}
              </span>

              {/* 행 클릭으로 펼쳐진다는 힌트 (조회 모드에서만) */}
              {!isEditing && (
                <ChevronDownIcon
                  className={`food-item-chevron ${isExpanded ? "is-open" : ""}`}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        },
      },

      {
        accessorKey: "dueDate",
        header: "납기일자",
        cell: ({ row }) => (
          <div className="food-cell-item-name">
            {row.original.dueDate}
          </div>
        ),
      },
      {
        accessorKey: "instructQty",
        header: "지시수량",
        cell: ({ row }) => {
          const item = row.original;

          return (
            <div className="food-qty-unit-wrapper">
              {isEditing ? (
                <input
                  type="number"
                  className="food-line-input"
                  defaultValue={
                    editQuantitiesRef.current[item.id] ?? item.instructQty
                  }
                  onChange={(e) => {
                    editQuantitiesRef.current[item.id] =
                      e.target.value === ""
                        ? ""
                        : Number(e.target.value);
                  }}
                />
              ) : (
                <div className="food-cell-qty">
                  {item.instructQty}
                </div>
              )}

              <span className="food-qty-unit">
                {item.unit || ""}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "barcode",
        header: isEditing ? "관리" : "바코드 / QR",
        cell: ({ row }) => {
          if (isEditing) {
            return (
              <div className="food-cell-center">
                <button
                  type="button"
                  onClick={() => handleDeleteLine(row.original.id)}
                  className="miniButton danger"
                >
                  삭제
                </button>
              </div>
            );
          }

          const codeValue = row.original.barcode || "NO-BARCODE";

          return (
            <div className="food-cell-center food-code-cell">
              <Barcode
                value={codeValue}
                width={1.2}
                height={38}
                fontSize={11}
                displayValue={true}
                margin={0}
              />

              {/* 바코드와 동일한 값을 QR 로도 제공 (스캐너/모바일 카메라 겸용) */}
              <div className="food-qr-wrap">
                <QRCode
                  value={codeValue}
                  size={48}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
            </div>
          );
        },
        meta: {
          width: isEditing ? "200px" : "400px",
        },
      },
    ],
    [selectedLines, activeLines, isEditing, expandedRoutingLineId]
  );

  const handleOpenLabelModal = (withRouting = false) => {
    if (selectedLines.length === 0) {
      alert("인쇄할 라인을 최소 1개 이상 선택해주세요.");
      return;
    }

    const linesToPrint = workOrder.lines
      .filter((line) => selectedLines.includes(line.id))
      .map((line) => ({
        ...line,
        routingSteps: routingStepsByLineId[line.id] ?? [],
      }));

    setPrintLines(linesToPrint);
    setIncludeRouting(withRouting);
    setIsWorkOrderPrintModalOpen(true);
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
                <option value="" disabled>담당자 선택</option>
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
                <>
                  <button
                    type="button"
                    className="ghostButton food-label-print-btn"
                    onClick={() => handleOpenLabelModal(false)}
                  >
                    선택 라벨 인쇄
                  </button>

                  <button
                    type="button"
                    className="ghostButton food-label-print-btn"
                    onClick={() => handleOpenLabelModal(true)}
                  >
                    공정순서포함 인쇄
                  </button>
                </>
              )}
            </div>
          </div>

          <CusTable
            data={activeLines}
            columns={columns}
            noDataMessage="등록된 작업지시 라인이 없습니다."
            getRowId={(line) => line.id}
            onRowClick={!isEditing ? handleRowClick : undefined}
            expandedRowId={!isEditing ? expandedRoutingLineId : null}
            renderExpandedRow={(line) => (
              <RoutingTimeline steps={routingStepsByLineId[line.id] ?? []} />
            )}
          />

        </div>

        <div className="food-detail-footer">
          <div>
            {isEditing && (
              <button
                type="button"
                className="btnDanger"
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
      <WorkOrderPrintModal
        isOpen={isWorkOrderPrintModalOpen}
        onClose={() => setIsWorkOrderPrintModalOpen(false)}
        selectedLines={printLines}
        workOrder={workOrder}
        includeRouting={includeRouting}
      />
    </section>
  );
}
