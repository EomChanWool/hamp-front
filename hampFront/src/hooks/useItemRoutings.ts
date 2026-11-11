import { useRef, useState } from "react";
import type { ItemRoutingRequest, ItemRoutingResponse } from "@/api/master/Item";
import {
  toMaterialDrafts,
  type RoutingMaterialDraft,
} from "@/components/common/RoutingMatarialSection";

export type RoutingStep = Omit<
  ItemRoutingRequest,
  "operCode" | "operSeq" | "finalYn" | "materials"
> & {
  /** 단계 고유 키 (같은 공정이 여러 번 있어도 유일) */
  rowKey: string;
  operCode: string;
  /** 1부터 시작하는 순서 (항상 배열 순서로 재계산) */
  operSeq: number;
  /** 마지막 단계만 "Y" (항상 자동 지정) */
  finalYn: "Y" | "N";
  /** 이 "단계"의 투입/산출 자재 */
  materials: RoutingMaterialDraft[];
};

/** 순번(operSeq) / 최종공정(finalYn)을 배열 순서 기준으로 재계산 */
const normalize = (steps: RoutingStep[]): RoutingStep[] =>
  steps.map((s, i) => ({
    ...s,
    operSeq: i + 1,
    finalYn: i === steps.length - 1 ? "Y" : "N",
  }));

export function useItemRoutings() {
  const [routings, setRoutings] = useState<RoutingStep[]>([]);
  const keySeq = useRef(0);
  const newKey = () => `step-${++keySeq.current}`;

  /**
   * 새 단계 목록 확정.
   * 최종공정(마지막 단계)이 바뀌면 확인창을 띄우고, 영향받는 단계의 자재를 비웁니다.
   * 사용자가 취소하면 false (아무것도 바뀌지 않음)
   */
  const commit = (next: RoutingStep[]): boolean => {
    const prevFinalKey = routings[routings.length - 1]?.rowKey;
    const nextFinalKey = next[next.length - 1]?.rowKey;

    let result = next;

    if (prevFinalKey !== nextFinalKey) {
      // 이전 최종 단계(아직 남아있다면) + 새 최종 단계 중 자재가 있는 것만 영향받음
      const affectedKeys = [prevFinalKey, nextFinalKey].filter(
        (key): key is string =>
          !!key && next.some((s) => s.rowKey === key && s.materials.length > 0)
      );

      if (affectedKeys.length > 0) {
        const ok = window.confirm(
          "최종공정이 변경되어 해당 공정의 투입/산출 자재가 모두 삭제됩니다.\n계속하시겠습니까?"
        );
        if (!ok) return false;

        result = next.map((s) =>
          affectedKeys.includes(s.rowKey) ? { ...s, materials: [] } : s
        );
      }
    }

    setRoutings(normalize(result));
    return true;
  };

  /**
   * 서버 응답(routings[]) → 단계 목록 (상세 조회 / 수정 취소 복원용)
   * - 같은 공정이 여러 번 있어도 각 행이 별도 단계가 되고, 자재도 행별로 들어갑니다.
   */
  const loadRoutings = (list?: ItemRoutingResponse[] | null) => {
    const sorted = [...(list ?? [])]
      .filter((r) => !!r.operCode)
      .sort((a, b) => (a.operSeq ?? 0) - (b.operSeq ?? 0));

    setRoutings(
      normalize(
        sorted.map((r) => ({
          rowKey: newKey(),
          operCode: r.operCode as string,
          operSeq: 0, // normalize 에서 재계산
          finalYn: "N" as const, // normalize 에서 재계산
          materials: toMaterialDrafts(r.materials),
        }))
      )
    );
  };

  /** 모든 단계 초기화 (원료 선택 시) - 확인창 없음 */
  const clearRoutings = () => setRoutings([]);

  /**
   * 공정 선택 모달 확정: 공정코드 배열(중복 허용, 순서 유지) → 단계 목록
   * - 같은 공정코드는 "앞에서부터 n번째 = 기존 n번째 단계"로 매칭해 자재를 그대로 보존
   * - 모달에서 수량을 줄이면 뒤쪽 단계부터 제거, 늘리면 뒤에 새 단계 추가
   * @returns 취소했으면 false
   */
  const syncRoutings = (codes: string[]): boolean => {
    const pool = new Map<string, RoutingStep[]>();
    routings.forEach((s) => {
      const arr = pool.get(s.operCode) ?? [];
      arr.push(s);
      pool.set(s.operCode, arr);
    });

    const next: RoutingStep[] = codes.map(
      (code) =>
        pool.get(code)?.shift() ?? {
          rowKey: newKey(),
          operCode: code,
          operSeq: 0,
          finalYn: "N",
          materials: [],
        }
    );

    return commit(next);
  };

  /** 단계 순서 이동 (취소/잘못된 인덱스면 false) */
  const moveRouting = (from: number, to: number): boolean => {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= routings.length ||
      to >= routings.length
    ) {
      return false;
    }
    const next = [...routings];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return commit(next);
  };

  /** 단계 1건 제외 (해당 단계의 자재도 함께 사라짐). 취소하면 false */
  const removeRouting = (index: number): boolean => {
    if (!routings[index]) return false;
    return commit(routings.filter((_, i) => i !== index));
  };

  /** 특정 "단계"(rowKey)의 자재 목록 교체 - 다른 단계에는 영향 없음 */
  const setStepMaterials = (rowKey: string, materials: RoutingMaterialDraft[]) => {
    setRoutings((prev) => prev.map((s) => (s.rowKey === rowKey ? { ...s, materials } : s)));
  };

  /**
   * 기존 훅의 updateRouting 호환 유지 (인덱스 기준 필드 1개 수정).
   * ※ operCode/operSeq/finalYn 은 훅이 자동 관리하므로 가급적 그 외 필드에만 사용하세요.
   */
  const updateRouting = (index: number, field: keyof RoutingStep, value: unknown) => {
    setRoutings((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  return {
    routings,
    updateRouting,
    loadRoutings,
    clearRoutings,
    syncRoutings,
    moveRouting,
    removeRouting,
    setStepMaterials,
  };
}
