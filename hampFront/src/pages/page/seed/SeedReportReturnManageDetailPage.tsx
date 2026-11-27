import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import type { ColumnDef } from "@tanstack/react-table";
import { Panel } from "@components/card/Panel";
import { CusTable } from "@components/table/CusTable";
import Spinner from "@/components/common/Spinner";
import { Badge } from "@/components/common/Badge";
import type { StatusTone } from "@/types";
import {
  HullReportApi,
  type HullReportLineResponse,
  type HullReportResponse,
  type HullReportStatus,
} from "@/api/seed/HullReport";
import "@pages/page/seed/Seed.css";

const NOTE_MAX_LENGTH = 255;

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

function getServerErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}

export function SeedReportReturnManageDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  return <SeedReportReturnManageDetailContent key={reportId ?? ""} reportId={reportId} />;
}

function SeedReportReturnManageDetailContent({ reportId }: { reportId?: string }) {
  const navigate = useNavigate();
  const numericReportId = Number(reportId);
  const isValidId = Number.isInteger(numericReportId) && numericReportId > 0;

  const [report, setReport] = useState<HullReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(isValidId);
  const [decisionNoteInput, setDecisionNoteInput] = useState("");

  // 메모 수정 모드 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editNote, setEditNote] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isMountedRef = useRef(true);
  const savingRef = useRef(false);
  const deletingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isValidId) return;

    let active = true;

    HullReportApi.getDetail(numericReportId)
      .then((response) => {
        if (!active) return;
        setReport(response.data ?? null);
      })
      .catch((error) => {
        console.error("껍질 신고 상세 조회 실패:", error);
        if (active) {
          window.alert(getServerErrorMessage(error, "신고 상세 정보를 불러오는 중 오류가 발생했습니다."));
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
  }, [isValidId, numericReportId]);

  const lineColumns: ColumnDef<HullReportLineResponse>[] = useMemo(
    () => [
      {
        accessorKey: "workId",
        header: "작업지시",
        enableSorting: false,
        meta: { width: "34%" },
        cell: ({ row }) => <span className="hullCodeCell">{row.original.workId}</span>,
      },
      {
        accessorKey: "bpNm",
        header: "거래처",
        enableSorting: false,
        meta: { width: "38%" },
        cell: ({ row }) => row.original.bpNm || row.original.bpCode || "-",
      },
      {
        accessorKey: "hullQty",
        header: "껍질수량",
        enableSorting: false,
        meta: { width: "28%" },
        cell: ({ row }) => `${(row.original.hullQty ?? 0).toLocaleString()} kg`,
      },
    ],
    [],
  );

  const handleGoList = () => {
    navigate("/seed/report-return-manage");
  };

  const handleClickApprove = () => {
    window.alert("승인 기능은 미구현 상태입니다.");
  };

  const handleClickReject = () => {
    window.alert("반려 기능은 미구현 상태입니다.");
  };

  const handleStartEdit = () => {
    if (!report || report.status !== "PENDING" || isDeleting) return;
    setEditNote(report.note ?? "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (isSaving) return;
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!report || savingRef.current) return;

    savingRef.current = true;
    setIsSaving(true);

    try {
      const response = await HullReportApi.update(report.reportId, {
        note: editNote.trim(),
      });

      if (!isMountedRef.current) return;
      if (response.data) {
        setReport(response.data);
      }
      setIsEditing(false);
      window.alert("껍질 신고가 수정되었습니다.");
    } catch (error) {
      console.error("껍질 신고 수정 실패:", error);
      if (isMountedRef.current) {
        window.alert(getServerErrorMessage(error, "껍질 신고 수정에 실패했습니다."));
      }
    } finally {
      savingRef.current = false;
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!report || report.status !== "PENDING" || deletingRef.current) return;

    const confirmed = window.confirm(`껍질 신고 #${report.reportId} 건을 삭제하시겠습니까?`);
    if (!confirmed) return;

    deletingRef.current = true;
    setIsDeleting(true);

    try {
      await HullReportApi.delete(report.reportId);

      if (!isMountedRef.current) return;
      window.alert("껍질 신고가 삭제되었습니다.");
      navigate("/seed/report-return-manage");
    } catch (error) {
      console.error("껍질 신고 삭제 실패:", error);
      if (isMountedRef.current) {
        window.alert(getServerErrorMessage(error, "껍질 신고 삭제에 실패했습니다."));
      }
    } finally {
      deletingRef.current = false;
      if (isMountedRef.current) {
        setIsDeleting(false);
      }
    }
  };

  const isPending = report?.status === "PENDING";
  const hasDecisionNote =
    report != null && !isPending && Boolean(report.decisionNote);

  return (
    <section className="screenStack">
      <div>
        <button
          type="button"
          className="hullBackLink"
          onClick={handleGoList}
          disabled={isSaving || isDeleting}
        >
          <ChevronLeftIcon className="hullBackLink__icon" aria-hidden="true" />
          <span>목록으로</span>
        </button>
      </div>

      {isLoading ? (
        <Panel title="껍질 신고 상세">
          <div className="relative min-h-[220px]">
            <div className="seedLoading">
              <Spinner />
            </div>
          </div>
        </Panel>
      ) : !report ? (
        <Panel title="껍질 신고 상세">
          <div className="seedEmptyState">신고 정보를 찾을 수 없습니다.</div>
        </Panel>
      ) : (
        <>
          <div className="hullSummaryCard">
            <div className="hullSummaryHead">
              <h2 className="hullSummaryTitle">껍질 신고 #{report.reportId}</h2>

              {isPending && (
                <div className="hullActionRow">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        className="hullGhostBtn"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        className="hullPrimaryBtn"
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                      >
                        {isSaving ? "저장 중..." : "저장"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="hullGhostBtn"
                        onClick={handleStartEdit}
                        disabled={isDeleting}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="hullDangerBtn"
                        onClick={handleDelete}
                        disabled={isDeleting}
                      >
                        {isDeleting ? "삭제 중..." : "삭제"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="hullSummaryKv">
              <div className="hullKvItem">
                <span className="hullKvLabel">신고일자</span>
                <span className="hullKvValue">{report.reportDate || "-"}</span>
              </div>

              <div className="hullKvItem">
                <span className="hullKvLabel">상태</span>
                <div>
                  <Badge tone={STATUS_TONE[report.status] ?? "muted"}>
                    {STATUS_LABEL[report.status] ?? report.status}
                  </Badge>
                </div>
              </div>

              <div className="hullKvItem">
                <span className="hullKvLabel">수량합계</span>
                <span className="hullKvValue">
                  {(report.totalQty ?? 0).toLocaleString()} kg
                </span>
              </div>

              {!isEditing && (
                <div className="hullKvItem">
                  <span className="hullKvLabel">등록 메모</span>
                  <span className="hullKvValue">{report.note || "-"}</span>
                </div>
              )}
            </div>

            {isEditing && (
              <div className="hullDecisionSection">
                <label htmlFor="hull-edit-note" className="hullKvLabel">
                  등록 메모 (선택)
                </label>
                <textarea
                  id="hull-edit-note"
                  className="hullTextarea"
                  rows={2}
                  maxLength={NOTE_MAX_LENGTH}
                  placeholder="예: 상자 2개로 나눠서 보관"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                />
              </div>
            )}

            {isPending && !isEditing && (
              <div className="hullDecisionSection">
                <label htmlFor="hull-decision-note" className="hullKvLabel">
                  승인/반려 사유 (선택)
                </label>
                <textarea
                  id="hull-decision-note"
                  className="hullTextarea"
                  rows={2}
                  maxLength={NOTE_MAX_LENGTH}
                  placeholder="예: 수량 불일치로 반려"
                  value={decisionNoteInput}
                  onChange={(e) => setDecisionNoteInput(e.target.value)}
                />
                <div className="hullActionRow">
                  <button
                    type="button"
                    className="hullPrimaryBtn"
                    onClick={handleClickApprove}
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    className="hullDangerBtn"
                    onClick={handleClickReject}
                  >
                    반려
                  </button>
                </div>
              </div>
            )}

            {hasDecisionNote && (
              <div className="hullDecisionNote">
                <span className="hullKvLabel">처리 사유</span>
                <span className="hullKvValue">{report.decisionNote}</span>
              </div>
            )}
          </div>

          <Panel title="포함된 배치">
            <CusTable
              data={report.lines ?? []}
              columns={lineColumns}
              noDataMessage="포함된 배치 정보가 없습니다."
            />
          </Panel>
        </>
      )}
    </section>
  );
}
