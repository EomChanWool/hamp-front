import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { CusTable } from "@components/table/CusTable";
import Spinner from "@/components/common/Spinner";
import { Badge } from "@/components/common/Badge";
import type { StatusTone } from "@/types";
import {
  HullReportApi,
  type HullReportResponse,
  type HullReportStatus,
} from "@/api/seed/HullReport";
import "@pages/page/seed/Seed.css";

type StatusFilter = "ALL" | HullReportStatus;

const STATUS_LABEL: Record<HullReportStatus, string> = {
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "반려",
};

const STATUS_TONE: Record<HullReportStatus, StatusTone> = {
  PENDING: "warn",
  APPROVED: "good",
  REJECTED: "danger",
};

const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "PENDING", label: "대기" },
  { key: "APPROVED", label: "승인" },
  { key: "REJECTED", label: "반려" },
];

type KpiCounts = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

function getServerErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}

export function SeedReportReturnManagePage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<HullReportResponse[]>([]);
  const [kpiCounts, setKpiCounts] = useState<KpiCounts>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const params = statusFilter === "ALL" ? undefined : { status: statusFilter };

    HullReportApi.getList(params)
      .then((response) => {
        if (!active) return;
        const list = response.data ?? [];
        setReports(list);

        if (statusFilter === "ALL") {
          setKpiCounts({
            total: list.length,
            pending: list.filter((item) => item.status === "PENDING").length,
            approved: list.filter((item) => item.status === "APPROVED").length,
            rejected: list.filter((item) => item.status === "REJECTED").length,
          });
        }
      })
      .catch((error) => {
        console.error("껍질 신고 목록 조회 실패:", error);
        if (active) {
          window.alert(getServerErrorMessage(error, "데이터를 불러오는 중 오류가 발생했습니다."));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [statusFilter]);

  const handleSelectFilter = (next: StatusFilter) => {
    if (next === statusFilter) return;
    setIsLoading(true);
    setStatusFilter(next);
  };

  const handleClickCreate = () => {
    navigate("/seed/report-return-manage/create");
  };

  const columns: ColumnDef<HullReportResponse>[] = useMemo(
    () => [
      {
        accessorKey: "reportId",
        header: "신고ID",
        enableSorting: false,
        meta: { width: "120px" },
        cell: ({ row }) => <span className="hullCodeCell">#{row.original.reportId}</span>,
      },
      {
        accessorKey: "reportDate",
        header: "신고일자",
        enableSorting: false,
        meta: { width: "160px" },
        cell: ({ row }) => row.original.reportDate || "-",
      },
      {
        accessorKey: "status",
        header: "상태",
        enableSorting: false,
        meta: { width: "110px" },
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge tone={STATUS_TONE[status] ?? "muted"}>
              {STATUS_LABEL[status] ?? status}
            </Badge>
          );
        },
      },
      {
        accessorKey: "totalQty",
        header: "수량합계",
        enableSorting: false,
        cell: ({ row }) => `${(row.original.totalQty ?? 0).toLocaleString()} kg`,
      },
      {
        id: "lineCount",
        header: "배치건수",
        enableSorting: false,
        cell: ({ row }) => `${row.original.lines?.length ?? 0}건`,
      },
    ],
    [],
  );

  return (
    <section className="screenStack">
      {/* KPI 요약 카드 */}
      <div className="hullKpiRow">
        <div className="hullKpiCard">
          <span className="hullKpiLabel">전체</span>
          <span className="hullKpiValue">
            {kpiCounts.total.toLocaleString()} <span className="hullKpiUnit">건</span>
          </span>
        </div>
        <div className="hullKpiCard">
          <span className="hullKpiLabel">대기</span>
          <span className="hullKpiValue">
            {kpiCounts.pending.toLocaleString()} <span className="hullKpiUnit">건</span>
          </span>
        </div>
        <div className="hullKpiCard">
          <span className="hullKpiLabel">승인</span>
          <span className="hullKpiValue">
            {kpiCounts.approved.toLocaleString()} <span className="hullKpiUnit">건</span>
          </span>
        </div>
        <div className="hullKpiCard">
          <span className="hullKpiLabel">반려</span>
          <span className="hullKpiValue">
            {kpiCounts.rejected.toLocaleString()} <span className="hullKpiUnit">건</span>
          </span>
        </div>
      </div>

      {/* 상태 필터 칩 */}
      <div className="hullFilterRow" role="group" aria-label="상태 필터">
        <span className="hullFilterLabel">상태</span>
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`hullFilterChip${statusFilter === opt.key ? " active" : ""}`}
            aria-pressed={statusFilter === opt.key}
            onClick={() => handleSelectFilter(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 신고 목록 */}
      <Panel
        title={`신고 목록 · ${reports.length}건`}
        action={
          <button type="button" className="hullPrimaryBtn" onClick={handleClickCreate}>
            + 신고 등록
          </button>
        }
      >
        <div className="relative min-h-[260px]">
          {isLoading ? (
            <div className="seedLoading">
              <Spinner />
            </div>
          ) : (
            <CusTable
              data={reports}
              columns={columns}
              noDataMessage="조회된 껍질 신고가 없습니다."
            />
          )}
        </div>
      </Panel>
    </section>
  );
}
