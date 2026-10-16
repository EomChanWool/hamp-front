import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { type ColumnDef } from "@tanstack/react-table";
import { CusTable } from "@/components/table/CusTable";
import { Badge } from "@/components/common/Badge";
import Spinner from "@/components/common/Spinner";
import {
  ShipmentOrderApi,
  type ShipmentOrderResponse,
  type ShipmentOrderLineResponse,
} from "@/api/ShipmentOrder";
import Barcode from "react-barcode";
import "@/pages/page/food/Food.css";

/** 상태 코드 → 뱃지 변환 */
const getStatusBadge = (status?: string) => {
  switch (status?.trim()) {
    case "DONE":
    case "완료":
      return <Badge tone="good">완료</Badge>;
    case "PROGRESS":
    case "진행중":
      return <Badge tone="info">진행중</Badge>;
    case "DELAY":
    case "지연":
      return <Badge tone="danger">지연</Badge>;
    case "WAIT":
    case "대기":
      return <Badge tone="muted">대기</Badge>;
    default:
      return <Badge tone="muted">{status || "-"}</Badge>;
  }
};

export function SeedOutboundManageDetailPage() {
  const navigate = useNavigate();
  const { shipId } = useParams<{ shipId: string }>();

  // 목록에서 넘어온 검색조건(쿼리스트링) — 목록 복귀 시 그대로 되돌려준다
  const [searchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [shipment, setShipment] = useState<ShipmentOrderResponse | null>(null);

  /** 목록 페이지로 이동 (검색조건 유지) */
  const goToList = useCallback(() => {
    const queryString = searchParams.toString();
    navigate(`/io/seed-outbound-manage${queryString ? `?${queryString}` : ""}`);
  }, [navigate, searchParams]);

  // ------------------------------------------
  // 출고지시서 단건 조회
  // ------------------------------------------
  const fetchShipmentDetail = useCallback(async () => {
    if (!shipId) return;

    setIsLoading(true);
    try {
      const response = await ShipmentOrderApi.getDetail(shipId);
      setShipment(response.data);
    } catch (error) {
      console.error("출고지시서 상세 조회 실패:", error);
      window.alert("출고지시서 상세 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [shipId]);

  useEffect(() => {
    fetchShipmentDetail();
  }, [fetchShipmentDetail]);

  // 라인 목록 / 지시수량 합계 (shipment 가 없을 때를 대비해 기본값 처리)
  const lines = useMemo(() => shipment?.lines ?? [], [shipment]);

  // ------------------------------------------
  // 출고지시 라인 테이블 컬럼
  // ------------------------------------------
  const columns = useMemo<ColumnDef<ShipmentOrderLineResponse>[]>(
    () => [
      {
        accessorKey: "shipOrderLineId",
        header: "출고라인ID",
        cell: ({ getValue }) => (
          <span className="food-table-code-cell">#{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: "salesOrderLineId",
        header: "수주라인ID",
        cell: ({ getValue }) => `#${getValue<number>()}`,
      },
      {
        accessorKey: "itemNm",
        header: "품목",
        cell: ({ row }) => (
          <span className="food-cell-item-name">
            {row.original.itemNm || "-"}
            {row.original.itemCode && (
              <span className="food-cell-item-code">
                ({row.original.itemCode})
              </span>
            )}
          </span>
        ),
      },
      {
        accessorKey: "instructQty",
        header: "지시수량",
        cell: ({ getValue }) => (
          <div className="food-cell-qty">
            {(getValue<number>() ?? 0).toLocaleString()}
          </div>
        ),
      },
    ],
    []
  );

  // ------------------------------------------
  // 렌더링
  // ------------------------------------------
  return (
    <section className="screenStack relative min-h-[400px] shipment-detail-page">
      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 z-50 flex items-center justify-center">
          <Spinner />
        </div>
      )}

      <div className="createCard food-detail-card">
        {/* 헤더: 출고지시ID + 연결 수주번호 */}
        <div className="food-detail-header">
          <div>
            <h1 className="food-detail-title">{shipment?.shipId ?? shipId}</h1>
            <span className="food-detail-subtitle">
              {shipment?.orderCode ? `수주번호 ${shipment.orderCode}` : ""}
            </span>
          </div>


          {/* 라벨 인쇄 전용 영역 */}
          <div className="shipment-label-print-area">
            <div className="shipment-label">
              <div className="shipment-label-title">출고지시 라벨</div>

              <Barcode
                value={shipment?.shipId ?? ""}
                format="CODE128"
                width={1.2}
                height={38}
                fontSize={11}
                displayValue={true}
                margin={0}
              />
            </div>
          </div>
        </div>

        {/* 요약 정보 */}
        <div className="food-summary-grid-box">
          <div>
            <div className="food-summary-label">출고일자</div>
            <div className="food-summary-value">{shipment?.shipDate || "-"}</div>
          </div>
          <div>
            <div className="food-summary-label">상태</div>
            <div>{getStatusBadge(shipment?.status)}</div>
          </div>
          <div>
            <div className="food-summary-label">담당자</div>
            <div className="food-summary-value">
              {shipment?.managerNm
                ? `${shipment.managerNm} (${shipment.managerId})`
                : shipment?.managerId || "-"}
            </div>
          </div>
          <div>
            <div className="food-summary-label">라인 수</div>
            <div className="food-summary-value">{lines.length}건</div>
          </div>
        </div>

        {/* 출고지시 라인 */}
        <div style={{ marginBottom: "24px" }}>
          <div className="food-section-header">
            <h2 className="food-section-title">출고지시 라인</h2>

          </div>

          <CusTable
            data={lines}
            columns={columns}
            noDataMessage="등록된 출고지시 라인이 없습니다."
            getRowId={(line) => String(line.shipOrderLineId)}
          />
        </div>

        {/* 하단 버튼 (수정/삭제 API 가 생기면 여기에 추가) */}
        <div className="food-detail-footer">
          <div />
          <div className="food-footer-btn-group">
            <button type="button" className="ghostButton" onClick={goToList}>
              목록
            </button>
          </div>
        </div>
      </div>


    </section>
  );
}
