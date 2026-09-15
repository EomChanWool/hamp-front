import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Barcode from "react-barcode";
import { type ColumnDef } from "@tanstack/react-table";
import { CusTable } from "@/components/table/CusTable";
import { Badge } from "@/components/common/Badge";
import '@/pages/page/master/MasterItem.css';

interface WorkOrderLineDetail {
  id: string;
  orderCode: string;
  lineId: string;
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
// 수주라인 선택 모달 컴포넌트
// ==========================================
interface SalesOrderLine {
  id: string;
  orderCode: string;
  customer: string;
  dueDate: string;
  itemName: string;
  orderQty: number;
  remainQty: number;
  unit: string;
  isClosed: boolean;
}

interface SalesOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (line: SalesOrderLine) => void;
}

const dummySalesOrderLines: SalesOrderLine[] = [
  { id: '1', orderCode: 'SO-2026-0912', customer: '그린테라 농협', dueDate: '2026-09-20', itemName: '헴프 원료(건조)', orderQty: 800, remainQty: 120, unit: 'KG', isClosed: false },
  { id: '2', orderCode: 'SO-2026-0912', customer: '그린테라 농협', dueDate: '2026-09-20', itemName: 'CBD 오일 원료', orderQty: 150, remainQty: 30, unit: 'KG', isClosed: false },
  { id: '3', orderCode: 'SO-2026-0915', customer: '네이처바이오', dueDate: '2026-09-25', itemName: 'CBD 아이솔레이트 반제품', orderQty: 65, remainQty: 0, unit: 'KG', isClosed: true },
  { id: '4', orderCode: 'SO-2026-0918', customer: '헴프코리아', dueDate: '2026-09-28', itemName: '헴프 오일 반제품', orderQty: 300, remainQty: 50, unit: 'L', isClosed: false },
  { id: '5', orderCode: 'SO-2026-0918', customer: '헴프코리아', dueDate: '2026-09-28', itemName: 'CBD 오일 30ml', orderQty: 5000, remainQty: 500, unit: 'EA', isClosed: false },
  { id: '6', orderCode: 'SO-2026-0921', customer: '오가닉웰니스', dueDate: '2026-10-02', itemName: '헴프 그래놀 완제품', orderQty: 1200, remainQty: 300, unit: 'KG', isClosed: false },
  { id: '7', orderCode: 'SO-2026-0921', customer: '오가닉웰니스', dueDate: '2026-10-02', itemName: 'CBDA 캡슐 완제품', orderQty: 8000, remainQty: 800, unit: 'EA', isClosed: false },
  { id: '8', orderCode: 'SO-2026-0925', customer: '그린테라 농협', dueDate: '2026-10-05', itemName: '헴프 원료(건조)', orderQty: 1000, remainQty: 360, unit: 'KG', isClosed: false },
];

function SalesOrderModal({ isOpen, onClose, onSelect }: SalesOrderModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLines = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return dummySalesOrderLines;
    return dummySalesOrderLines.filter(
      (item) =>
        item.orderCode.toLowerCase().includes(term) ||
        item.customer.toLowerCase().includes(term) ||
        item.itemName.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const columns = useMemo<ColumnDef<SalesOrderLine>[]>(
    () => [
      {
        accessorKey: 'orderCode',
        header: '수주코드',
        cell: ({ row }) => <span style={{ fontWeight: 600, color: '#1e293b' }}>{row.original.orderCode}</span>,
      },
      {
        accessorKey: 'customer',
        header: '거래처',
        cell: ({ row }) => <span>{row.original.customer}</span>,
      },
      {
        accessorKey: 'dueDate',
        header: '납기일',
        cell: ({ row }) => <span>{row.original.dueDate}</span>,
      },
      {
        accessorKey: 'itemName',
        header: '품목',
        cell: ({ row }) => <span style={{ fontWeight: 500 }}>{row.original.itemName}</span>,
      },
      {
        accessorKey: 'orderQty',
        header: '주문수량',
        cell: ({ row }) => (
          <div style={{ textAlign: 'right' }}>
            {row.original.orderQty.toLocaleString()} <span style={{ fontSize: '11px', color: '#64748b' }}>{row.original.unit}</span>
          </div>
        ),
      },
      {
        accessorKey: 'remainQty',
        header: '잔여수량',
        cell: ({ row }) => (
          <div style={{ textAlign: 'right', fontWeight: 600 }}>
            {row.original.isClosed ? (
              <Badge tone="danger">마감</Badge>
            ) : (
              <>
                {row.original.remainQty.toLocaleString()} <span style={{ fontSize: '11px', color: '#64748b' }}>{row.original.unit}</span>
              </>
            )}
          </div>
        ),
      },
      {
        id: 'action',
        header: '관리',
        enableSorting: false,
        cell: ({ row }) => (
          <div style={{ textAlign: 'center' }}>
            {!row.original.isClosed ? (
              <button
                type="button"
                style={modalStyles.selectButton}
                onClick={() => {
                  onSelect(row.original);
                  onClose();
                }}
              >
                선택
              </button>
            ) : (
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>-</span>
            )}
          </div>
        ),
        meta: { width: '80px' },
      },
    ],
    [onSelect, onClose]
  );

  if (!isOpen) return null;

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.container}>
        <div style={modalStyles.header}>
          <div>
            <h2 style={modalStyles.title}>수주라인 선택</h2>
            <p style={modalStyles.subtitle}>수주코드·거래처·품목명으로 검색할 수 있어요. 잔여수량이 없는 라인은 선택할 수 없습니다.</p>
          </div>
          <button type="button" onClick={onClose} style={modalStyles.closeButton}>
            ✕
          </button>
        </div>

        <div style={modalStyles.searchWrapper}>
          <input
            type="text"
            placeholder="예: SO-2026-0918, 헴프코리아, CBD 오일"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={modalStyles.searchInput}
          />
        </div>

        <div style={modalStyles.tableContainer}>
          <CusTable
            data={filteredLines}
            columns={columns}
            noDataMessage="검색 결과가 없습니다."
            onRowClick={(row) => {
              if (!row.isClosed) {
                onSelect(row);
                onClose();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
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

  const handlePrintAction = () => {
    window.print();
  };

  return (
    <div style={labelModalStyles.overlay}>
      <div style={labelModalStyles.container}>
        <div style={labelModalStyles.header}>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>생산관리 &gt; 작업지시 &gt; 라벨 인쇄</div>
            <h2 style={labelModalStyles.title}>라벨 인쇄 미리보기</h2>
            <p style={labelModalStyles.subtitle}>
              선택한 라인만 라벨로 출력됩니다. 라벨지 크기(100×50mm 가정)에 맞춰 배치돼요. (총 {selectedLines.length}건)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" className="ghostButton" onClick={onClose} style={{ fontSize: '13px', padding: '6px 12px' }}>
              ← 상세로
            </button>
            <button type="button" className="primaryButton" onClick={handlePrintAction} style={{ fontSize: '13px', padding: '6px 16px' }}>
              인쇄
            </button>
          </div>
        </div>

        <div style={labelModalStyles.body}>
          {selectedLines.length > 0 ? (
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
                  
                  <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px', overflowX: 'auto' }}>
                    <Barcode 
                      value={line.barcode || workOrderNo} 
                      width={1.3} 
                      height={40} 
                      fontSize={11} 
                      displayValue={true} 
                      margin={0}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
              선택된 라인이 없습니다. 목록에서 인쇄할 라인을 체크해주세요.
            </div>
          )}
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
  const { id } = useParams<{ id: string }>();

  // Mock 상세 데이터 (state로 관리하여 수정/삭제 가능)
  const [workOrder, setWorkOrder] = useState<WorkOrderMaster>({
    workOrderNo: id || "WO-20260908-01",
    title: "9월 2주차 작업 지시",
    workDate: "2026-09-08",
    status: "완료",
    managerId: "전지윤",
    lines: [
      {
        id: "line-1",
        orderCode: "SO-2026-0912",
        lineId: "#101",
        itemNm: "헴프 원료(건조)",
        instructQty: "480 KG",
        barcode: "WO-20260908-01-101",
      },
    ],
  });

  // 수정 모드 상태 관리
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<WorkOrderMaster>(workOrder);

  // 체크박스 선택 상태 관리 (id 배열)
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  
  // 수주라인 선택 모달 오픈 상태 관리
  const [isSalesOrderModalOpen, setIsSalesOrderModalOpen] = useState(false);

  // 수정 모드 진입 시 폼 데이터 초기화
  const handleStartEdit = () => {
    setEditForm(workOrder);
    setIsEditing(true);
  };

  // 수정 취소
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(workOrder);
  };

  // 수정 저장
  const handleSaveEdit = () => {
    setWorkOrder(editForm);
    setIsEditing(false);
    alert("성공적으로 수정되었습니다.");
  };

  // 작업지시 전체 삭제
  const handleDeleteWorkOrder = () => {
    if (window.confirm("정말 이 작업지시를 삭제하시겠습니까?")) {
      alert("삭제되었습니다.");
      navigate(-1);
    }
  };

  // 라인 개별 삭제
  const handleDeleteLine = (lineId: string) => {
    if (isEditing) {
      setEditForm(prev => ({
        ...prev,
        lines: prev.lines.filter(l => l.id !== lineId)
      }));
    } else {
      setWorkOrder(prev => ({
        ...prev,
        lines: prev.lines.filter(l => l.id !== lineId)
      }));
    }
    setSelectedLines(prev => prev.filter(item => item !== lineId));
  };

  // 수주라인 모달에서 선택 완료 시 처리 함수
  const handleSelectSalesOrderLine = (selectedLine: SalesOrderLine) => {
    const newLine: WorkOrderLineDetail = {
      id: `line-${Date.now()}`,
      orderCode: selectedLine.orderCode,
      lineId: `#${101 + editForm.lines.length}`,
      itemNm: selectedLine.itemName,
      instructQty: `${selectedLine.remainQty} ${selectedLine.unit}`,
      barcode: `${editForm.workOrderNo}-${101 + editForm.lines.length}`,
    };

    setEditForm(prev => ({
      ...prev,
      lines: [...prev.lines, newLine]
    }));
  };

  // 라인 필드 값 변경 핸들러 (수정 모드 시)
  const handleLineChange = (lineId: string, field: keyof WorkOrderLineDetail, value: string) => {
    setEditForm(prev => ({
      ...prev,
      lines: prev.lines.map(l => l.id === lineId ? { ...l, [field]: value } : l)
    }));
  };

  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentLines = isEditing ? editForm.lines : workOrder.lines;
    if (e.target.checked) {
      setSelectedLines(currentLines.map((l) => l.id));
    } else {
      setSelectedLines([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedLines((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const activeLines = isEditing ? editForm.lines : workOrder.lines;

  // TanStack Table 컬럼 정의
  const columns = useMemo<ColumnDef<WorkOrderLineDetail>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <input 
            type="checkbox" 
            onChange={handleToggleSelectAll}
            checked={selectedLines.length === activeLines.length && activeLines.length > 0}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
        ),
        cell: ({ row }) => (
          <input 
            type="checkbox" 
            checked={selectedLines.includes(row.original.id)}
            onChange={() => handleToggleSelect(row.original.id)}
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
            <div style={{ color: '#1e293b', fontWeight: 600 }}>{row.original.itemNm}</div>
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
          <div style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', overflowX: 'auto', gap: '8px' }}>
            <Barcode 
              value={row.original.barcode || "NO-BARCODE"} 
              width={1.2} 
              height={38} 
              fontSize={11} 
              displayValue={true} 
              margin={0}
            />
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

  const targetLinesForPrint = workOrder.lines.filter((l) => selectedLines.includes(l.id));

  return (
    <section className="screenStack">
      <div className="createCard" style={{ padding: '32px', background: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* 상단 타이틀 영역 */}
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

        {/* 기본 정보 요약 카드 박스 */}
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
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{workOrder.workDate}</div>
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
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{workOrder.managerId}</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>라인 수</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{activeLines.length}건</div>
          </div>
        </div>

        {/* 작업지시 라인 섹션 */}
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

        {/* 하단 버튼 영역 */}
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

      <LabelPrintModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        selectedLines={targetLinesForPrint}
        workOrderNo={workOrder.workOrderNo}
      />

      <SalesOrderModal
        isOpen={isSalesOrderModalOpen}
        onClose={() => setIsSalesOrderModalOpen(false)}
        onSelect={handleSelectSalesOrderLine}
      />
    </section>
  );
}

// 모달 스타일 객체
const modalStyles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: '#ffffff',
    width: '900px',
    maxWidth: '95vw',
    maxHeight: '85vh',
    borderRadius: '12px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 24px 16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid #f1f5f9',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: '#0f172a',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#64748b',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#64748b',
    padding: '4px',
  },
  searchWrapper: {
    padding: '16px 24px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #f1f5f9',
  },
  searchInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#ffffff',
  },
  tableContainer: {
    padding: '16px 24px 24px 24px',
    overflowY: 'auto',
    maxHeight: '500px',
  },
  selectButton: {
    padding: '4px 12px',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#334155',
    cursor: 'pointer',
  },
};

// 라벨 모달 전용 스타일 객체
const labelModalStyles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  },
  container: {
    backgroundColor: '#f8fafc',
    width: '850px',
    maxWidth: '95vw',
    maxHeight: '85vh',
    borderRadius: '12px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 24px',
    backgroundColor: '#ffffff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e2e8f0',
  },
  title: {
    margin: '0 0 4px 0',
    fontSize: '20px',
    fontWeight: 700,
    color: '#0f172a',
  },
  subtitle: {
    margin: 0,
    fontSize: '13px',
    color: '#64748b',
  },
  body: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  labelCard: {
    backgroundColor: '#ffffff',
    border: '1px dashed #cbd5e1',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  },
};