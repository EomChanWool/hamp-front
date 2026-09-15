import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
    window.print(); // 실제 브라우저 인쇄 호출 기능 연결 가능
  };

  return (
    <div style={labelModalStyles.overlay}>
      <div style={labelModalStyles.container}>
        {/* 모달 헤더 */}
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

        {/* 모달 바디 (라벨 카드 리스트) */}
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
                  {/* 바코드 시각화 */}
                  <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ fontFamily: 'monospace', letterSpacing: '2px', fontSize: '18px', fontWeight: 'bold', lineHeight: '1', color: '#0f172a' }}>
                      ||||| ||| || |||| ||
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>
                      {line.barcode}
                    </span>
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

  // Mock 상세 데이터
  const [workOrder] = useState<WorkOrderMaster>({
    workOrderNo: id || "WO-20260908-01",
    title: "9월 2주차 CBD 원료 라인",
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
      {
        id: "line-2",
        orderCode: "SO-2026-0912",
        lineId: "#102",
        itemNm: "CBD 오일 원료",
        instructQty: "120 KG",
        barcode: "WO-20260908-01-102",
      },
    ],
  });

  // 체크박스 선택 상태 관리
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  // 라벨 인쇄 모달 오픈 상태 관리
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLines(workOrder.lines.map((l) => l.id));
    } else {
      setSelectedLines([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedLines((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // 선택 라벨 인쇄 버튼 클릭 핸들러
  const handleOpenLabelModal = () => {
    if (selectedLines.length === 0) {
      alert("인쇄할 라인을 최소 1개 이상 선택해주세요.");
      return;
    }
    setIsLabelModalOpen(true);
  };

  // 현재 선택된 라인 객체들 추출
  const targetLinesForPrint = workOrder.lines.filter((l) => selectedLines.includes(l.id));

  return (
    <section className="screenStack">
      <div className="createCard" style={{ padding: '32px', background: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* 상단 타이틀 및 수정 버튼 영역 */}
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
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{workOrder.workDate}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>상태</div>
            <div>
              <Badge tone={workOrder.status === '완료' ? 'good' : workOrder.status === '진행중' ? 'info' : 'muted'}>
                {workOrder.status}
              </Badge>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>담당자</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{workOrder.managerId}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>라인 수</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{workOrder.lines.length}건</div>
          </div>
        </div>

        {/* 작업지시 라인 섹션 */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>
              작업지시 라인
            </h2>
            <button
              type="button"
              className="ghostButton"
              style={{ fontSize: '13px', padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              onClick={handleOpenLabelModal}
            >
             선택 라벨 인쇄
            </button>
          </div>

          {/* 라인 테이블 영역 */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            
            {/* 테이블 헤더 */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '50px 2fr 2fr 1fr 2fr', 
              background: '#f1f5f9', 
              padding: '12px 16px', 
              fontSize: '13px', 
              fontWeight: 700, 
              color: '#334155', 
              borderBottom: '1px solid #cbd5e1',
              alignItems: 'center'
            }}>
              <span style={{ textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  onChange={handleToggleSelectAll}
                  checked={selectedLines.length === workOrder.lines.length && workOrder.lines.length > 0}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
              </span>
              <span>연결 수주라인</span>
              <span>품목</span>
              <span>지시수량</span>
              <span>바코드</span>
            </div>

            {/* 테이블 바디 */}
            {workOrder.lines.map((line, idx) => (
              <div 
                key={line.id} 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '50px 2fr 2fr 1fr 2fr', 
                  gap: '12px', 
                  padding: '16px', 
                  alignItems: 'center', 
                  borderBottom: idx === workOrder.lines.length - 1 ? 'none' : '1px solid #e2e8f0',
                  background: selectedLines.includes(line.id) ? '#f8fafc' : '#ffffff'
                }}
              >
                <span style={{ textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedLines.includes(line.id)}
                    onChange={() => handleToggleSelect(line.id)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </span>

                {/* 연결 수주라인 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#2563eb' }}>{line.orderCode}</span>
                  <span style={{ fontSize: '12px', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{line.lineId}</span>
                </div>

                {/* 품목 */}
                <div style={{ color: '#1e293b', fontWeight: 600 }}>
                  {line.itemNm}
                </div>

                {/* 지시수량 */}
                <div style={{ color: '#0f172a', fontWeight: 700 }}>
                  {line.instructQty}
                </div>

                {/* 바코드 시각화 영역 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ 
                    fontFamily: 'monospace', 
                    letterSpacing: '2px', 
                    fontSize: '20px', 
                    fontWeight: 'bold', 
                    lineHeight: '1',
                    color: '#0f172a',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    ||||| ||| || |||| ||
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>
                    {line.barcode}
                  </span>
                </div>

              </div>
            ))}

          </div>
        </div>

        {/* 하단 버튼 영역 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '36px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
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
            onClick={() => alert("수정 페이지로 이동")}
            style={{ padding: '8px 20px', fontSize: '14px', borderRadius: '6px', fontWeight: 600 }}
          >
            수정
          </button>
        </div>

      </div>

      {/* 라인 인쇄 미리보기 모달 연결 */}
      <LabelPrintModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        selectedLines={targetLinesForPrint}
        workOrderNo={workOrder.workOrderNo}
      />
    </section>
  );
}

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