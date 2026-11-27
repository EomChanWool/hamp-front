import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { Panel } from "@components/card/Panel";
import Spinner from "@/components/common/Spinner";
import {
  HullReportApi,
  type HullReportCandidateResponse,
} from "@/api/seed/HullReport";
import { formatDateTime } from "@/utils/common";
import "@pages/page/seed/Seed.css";

const NOTE_MAX_LENGTH = 255;

function getServerErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}

export function SeedReportReturnManageCreatePage() {
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState<HullReportCandidateResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    HullReportApi.getUnreportedBatches()
      .then((response) => {
        if (!active) return;
        setCandidates(response.data ?? []);
      })
      .catch((error) => {
        console.error("미신고 전처리 배치 목록 조회 실패:", error);
        if (active) {
          window.alert(getServerErrorMessage(error, "신고 대상 목록을 불러오는 중 오류가 발생했습니다."));
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
  }, []);

  const selectedWorkIdSet = useMemo(() => new Set(selectedWorkIds), [selectedWorkIds]);

  const isAllSelected =
    candidates.length > 0 && candidates.every((item) => selectedWorkIdSet.has(item.workId));

  const isSomeSelected =
    !isAllSelected && candidates.some((item) => selectedWorkIdSet.has(item.workId));

  const selectedTotalQty = useMemo(() => {
    const sum = candidates
      .filter((item) => selectedWorkIdSet.has(item.workId))
      .reduce((acc, item) => acc + (item.hullQty ?? 0), 0);
    return Math.round(sum * 100) / 100;
  }, [candidates, selectedWorkIdSet]);

  const handleToggleRow = (workId: string) => {
    setSelectedWorkIds((prev) =>
      prev.includes(workId) ? prev.filter((id) => id !== workId) : [...prev, workId],
    );
  };

  const handleToggleAll = (checked: boolean) => {
    setSelectedWorkIds(checked ? candidates.map((item) => item.workId) : []);
  };

  const handleGoList = () => {
    navigate("/seed/report-return-manage");
  };

  const handleSubmit = async () => {
    if (selectedWorkIds.length === 0 || submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const trimmedNote = note.trim();
      await HullReportApi.create({
        workIds: selectedWorkIds,
        ...(trimmedNote ? { note: trimmedNote } : {}),
      });

      if (!isMountedRef.current) return;
      window.alert("껍질 신고가 등록되었습니다.");
      navigate("/seed/report-return-manage");
    } catch (error) {
      console.error("껍질 신고 등록 실패:", error);
      if (isMountedRef.current) {
        window.alert(getServerErrorMessage(error, "껍질 신고 등록에 실패했습니다."));
      }
    } finally {
      submittingRef.current = false;
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <section className="screenStack">
      <div>
        <button
          type="button"
          className="hullBackLink"
          onClick={handleGoList}
          disabled={isSubmitting}
        >
          <ChevronLeftIcon className="hullBackLink__icon" aria-hidden="true" />
          <span>목록으로</span>
        </button>
      </div>

      <Panel
        title="신고 대상 선택"
        action={
          <span className="hullPanelSubtext">
            완료됐지만 아직 신고 안 된 전처리 배치만 표시됩니다
          </span>
        }
      >
        <div className="relative min-h-[220px]">
          {isLoading ? (
            <div className="seedLoading">
              <Spinner />
            </div>
          ) : candidates.length === 0 ? (
            <div className="seedEmptyState">신고 가능한 완료 전처리 배치가 없습니다.</div>
          ) : (
            <div className="hullCandidateTableWrap">
              <table className="hullCandidateTable">
                <thead>
                  <tr>
                    <th style={{ width: "44px" }}>
                      <input
                        type="checkbox"
                        className="checkbox"
                        aria-label="신고 대상 전체 선택"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeSelected;
                        }}
                        onChange={(e) => handleToggleAll(e.target.checked)}
                      />
                    </th>
                    <th style={{ width: "200px" }}>작업지시</th>
                    <th>거래처</th>
                    <th className="hullRightCell" style={{ width: "140px" }}>
                      껍질수량
                    </th>
                    <th style={{ width: "180px" }}>완료일시</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((item) => {
                    const checked = selectedWorkIdSet.has(item.workId);
                    return (
                      <tr
                        key={item.workId}
                        className={checked ? "is-selected" : undefined}
                        onClick={() => handleToggleRow(item.workId)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="checkbox"
                            aria-label={`배치 ${item.workId} 선택`}
                            checked={checked}
                            onChange={() => handleToggleRow(item.workId)}
                          />
                        </td>
                        <td>
                          <span className="hullCodeCell">{item.workId}</span>
                        </td>
                        <td>{item.bpNm || item.bpCode || "-"}</td>
                        <td className="hullRightCell">
                          {(item.hullQty ?? 0).toLocaleString()} kg
                        </td>
                        <td className="hullMutedCell">
                          {item.completedAt ? formatDateTime(item.completedAt) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="hullSelectionBar">
          <span className="hullSelectionText">
            선택 {selectedWorkIds.length}건 · 합계 {selectedTotalQty.toLocaleString()} kg
          </span>

          {selectedWorkIds.length > 0 ? (
            <button
              type="button"
              className="hullPrimaryBtn"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "등록 중..." : "신고 등록"}
            </button>
          ) : (
            <button type="button" className="hullDisabledBtn" disabled>
              신고할 배치를 선택해 주세요
            </button>
          )}
        </div>
      </Panel>

      <div className="hullNoteCard">
        <label htmlFor="hull-create-note" className="hullKvLabel">
          비고 (선택)
        </label>
        <textarea
          id="hull-create-note"
          className="hullTextarea"
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          placeholder="예: 상자 2개로 나눠서 보관"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </section>
  );
}
