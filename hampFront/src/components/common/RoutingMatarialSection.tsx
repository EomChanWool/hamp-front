import { useEffect, useMemo, useState } from "react";
import {
  ItemApi,
  type ItemOptionResponse,
  type ItemRoutingResponse,
  type RoutingMaterialRequest,
  type MaterialIoType,
  type ProductType,
} from "@/api/master/Item";
import "@/pages/page/master/MasterItem.css";

export type { MaterialIoType };

/** 화면에서 다루는 자재 1건 (표시용 itemNm / unit 포함) */
export interface RoutingMaterialDraft {
  itemCode: string;
  itemNm: string;
  unit: string;
  ioType: MaterialIoType;
  /**
   * 계획 수율(%) (0 ~ 100)
   * - 산출(OUT) 자재에만 입력 가능, 미입력이면 null
   * - 투입(IN) 자재는 항상 null
   */
  // 계획 수율
  yieldRate?: number | null;
}

/** 서버 응답(routings[].materials) → { [operCode]: 자재[] } 맵으로 변환 (상세 페이지 로딩용) */
export const buildMaterialMap = (
  routings?: ItemRoutingResponse[] | null
): Record<string, RoutingMaterialDraft[]> => {
  const map: Record<string, RoutingMaterialDraft[]> = {};
  (routings ?? []).forEach((r) => {
    if (!r.operCode) return;
    map[r.operCode] = (r.materials ?? []).map((m) => {
      const ioType: MaterialIoType = m.ioType === "OUT" ? "OUT" : "IN";
      return {
        itemCode: m.itemCode,
        itemNm: m.itemNm,
        unit: m.unit,
        ioType,
        // 수율은 OUT 자재만 의미가 있으므로 IN 은 null 로 정리
        yieldRate: ioType === "OUT" ? m.yieldRate ?? null : null,
      };
    });
  });
  return map;
};

/** 화면용 자재 → 서버 요청용 자재 (저장 시 사용) */
export const toMaterialRequests = (
  list?: RoutingMaterialDraft[] | null
): RoutingMaterialRequest[] =>
  (list ?? []).map(({ itemCode, ioType, yieldRate }) =>
    ioType === "OUT"
      ? // OUT 자재만 yieldRate 전송 (미입력이면 null)
      { itemCode, ioType, yieldRate: yieldRate ?? null }
      : // IN 자재는 yieldRate 를 보내지 않음 (서버에서 OUT 에만 입력 가능)
      { itemCode, ioType }
  );

/* ============================================================
   IN 또는 OUT 한 묶음 (헤더 + [+ 추가] + 스크롤 목록)
============================================================ */
interface MaterialGroupProps {
  ioType: MaterialIoType;
  title: string;
  list: RoutingMaterialDraft[];
  availableOptions: ItemOptionResponse[]; // 아직 추가되지 않은 선택 가능 품목
  disabled?: boolean;
  onAdd: (option: ItemOptionResponse) => void;
  onRemove: (itemCode: string) => void;
  // 수율 변경 (OUT 그룹에서만 사용)
  onYieldChange?: (itemCode: string, yieldRate: number | null) => void;
}

function MaterialGroup({
  ioType,
  title,
  list,
  availableOptions,
  disabled,
  onAdd,
  onRemove,
  onYieldChange,
}: MaterialGroupProps) {
  // [+ 추가] 클릭 시 나타나는 품목 선택 select 노출 여부
  const [isPicking, setIsPicking] = useState(false);

  const handlePick = (itemCode: string) => {
    const picked = availableOptions.find((o) => o.itemCode === itemCode);
    if (!picked) return;
    onAdd(picked);
    setIsPicking(false); // 하나 추가하면 닫기 (연속 추가는 [+ 추가] 다시 클릭)
  };

  // 수율 입력값 → number | null 변환
  //  - 빈 문자열이면 null (미입력)
  //  - 0 ~ 100 범위로 보정
  const handleYieldInput = (itemCode: string, raw: string) => {
    if (!onYieldChange) return;

    if (raw === "") {
      onYieldChange(itemCode, null);
      return;
    }

    const num = Number(raw);
    if (Number.isNaN(num)) return;

    onYieldChange(itemCode, Math.min(100, Math.max(0, num)));
  };

  return (
    <div className="routing-mtrl-group">
      <div className="routing-mtrl-group-header">
        <span
          className={`routing-mtrl-group-title ${ioType === "IN" ? "is-in" : "is-out"}`}
        >
          {title} ({list.length})
        </span>
        <button
          type="button"
          className="routing-mtrl-add-btn"
          disabled={disabled}
          onClick={() => setIsPicking((prev) => !prev)}
        >
          {isPicking ? "닫기" : "+ 추가"}
        </button>
      </div>

      {/* 품목 선택 (추가 모드일 때만) */}
      {isPicking && (
        <select
          className="tableInput routing-mtrl-picker"
          value=""
          disabled={disabled}
          onChange={(e) => handlePick(e.target.value)}
        >
          <option value="">
            {availableOptions.length === 0 ? "추가 가능한 품목이 없습니다" : "품목을 선택하세요"}
          </option>
          {availableOptions.map((o) => (
            <option key={o.itemCode} value={o.itemCode}>
              {o.itemCode} · {o.itemNm}
              {o.unit ? ` (${o.unit})` : ""}
            </option>
          ))}
        </select>
      )}

      {/* 자재 목록 - 종류가 많아지면 .routing-mtrl-list 에서 세로 스크롤 */}
      <div className="routing-mtrl-list">
        {list.length === 0 ? (
          <div className="routing-mtrl-empty">등록된 자재가 없습니다.</div>
        ) : (
          list.map((m) => (
            <div key={`${m.ioType}-${m.itemCode}`} className="routing-mtrl-item">
              {/* 품목코드 칩: 라이트=IN 초록/OUT 빨강 톤, 다크=시안 이미지처럼 회색 칩 (CSS에서 분기) */}
              <span className={`routing-mtrl-code ${m.ioType === "IN" ? "is-in" : "is-out"}`}>
                {m.itemCode}
              </span>
              <span className="routing-mtrl-name" title={m.itemNm}>
                {m.itemNm}
              </span>
              {m.unit && <span className="routing-mtrl-unit">{m.unit}</span>}

              {/* 산출(OUT) 자재만 계획 수율(%) 입력 (비워두면 미확정) */}
              {m.ioType === "OUT" && (
                <span className="routing-mtrl-yield">
                  <input
                    type="number"
                    className="tableInput routing-mtrl-yield-input"
                    min={0}
                    max={100}
                    step="any"
                    placeholder="수율"
                    title="계획 수율(%) - 비워두면 미확정"
                    value={m.yieldRate ?? ""}
                    disabled={disabled}
                    onChange={(e) => handleYieldInput(m.itemCode, e.target.value)}
                  />
                  <span className="routing-mtrl-yield-unit">%</span>
                </span>
              )}

              <button
                type="button"
                className="routing-mtrl-remove"
                disabled={disabled}
                onClick={() => onRemove(m.itemCode)}
              >
                삭제
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ============================================================
   공정 1건의 "투입/산출 자재" 섹션 (등록/상세 페이지 우측 패널에서 사용)
============================================================ */
interface RoutingMaterialSectionProps {
  /** 현재 선택된 공정의 자재 목록 (IN/OUT 섞여 있음) */
  materials: RoutingMaterialDraft[];
  /** 자재 목록이 바뀔 때 호출 (전체 목록을 새로 넘겨줌) */
  onChange: (next: RoutingMaterialDraft[]) => void;
  /** 자기 자신 품목은 자재로 선택 못 하도록 제외 (등록 시엔 입력 중인 품목코드) */
  excludeItemCode?: string;
  disabled?: boolean;
  /** 공정이 바뀔 때 [+ 추가] 열림 상태를 초기화하기 위한 key (보통 operCode) */
  resetKey?: string;
  // 현재 품목 종류 (0: 식품, 1: 작물)
  productType?: ProductType;
  // 최종공정 여부 (Y: 최종공정, N: 일반공정)
  finalYn: string;

  // 신규 등록 중인 품목 정보
  currentItem?: ItemOptionResponse;
}

export function RoutingMaterialSection({
  materials,
  onChange,
  excludeItemCode,
  disabled,
  resetKey,
  productType,
  finalYn,
  currentItem,
}: RoutingMaterialSectionProps) {
  const [inOptions, setInOptions] = useState<ItemOptionResponse[]>([]);
  const [outOptions, setOutOptions] = useState<ItemOptionResponse[]>([]);

  // 투입/산출 자재 옵션 조회
  useEffect(() => {
    let alive = true;

    const fetchOptions = async () => {
      // 제품 종류가 선택되지 않았으면 조회하지 않음
      if (productType === undefined) {
        setInOptions([]);
        setOutOptions([]);
        return;
      }

      try {
        const [inRes, outRes] = await Promise.all([
          // 투입: 원료 + 반제품
          ItemApi.getOptions({
            productType,
            category: [0, 1],
          }),

          // 산출: 최종공정이면 완제품만, 일반공정이면 원료 + 반제품
          ItemApi.getOptions({
            productType,
            category: finalYn === "Y" ? [2] : [0, 1],
          }),
        ]);

        if (alive) {
          setInOptions(inRes.data ?? []);
          setOutOptions(outRes.data ?? []);
        }
      } catch (error) {
        console.error("품목 옵션 목록 조회 실패:", error);

        if (alive) {
          setInOptions([]);
          setOutOptions([]);
        }
      }
    };

    fetchOptions();

    return () => {
      alive = false;
    };
  }, [productType, finalYn]);

  // 이미 사용 중인 품목 + 자기 자신 제외
  const used = useMemo(
    () => new Set(materials.map((m) => m.itemCode)),
    [materials]
  );

  const availableInOptions = useMemo(
    () =>
      inOptions.filter(
        (o) => o.itemCode !== excludeItemCode && !used.has(o.itemCode)
      ),
    [inOptions, excludeItemCode, used]
  );

  const availableOutOptions = useMemo(() => {
    const options = [...outOptions];

    // 최종공정이면 자기 자신(완제품/반제품)을 산출 옵션에 추가
    if (
      finalYn === "Y" &&
      currentItem?.itemCode &&
      currentItem.itemNm &&
      !options.some((o) => o.itemCode === currentItem.itemCode)
    ) {
      options.unshift(currentItem);
    }

    // 이미 이 공정에 추가된 품목은 제외
    return options.filter((o) => !used.has(o.itemCode));
  }, [outOptions, used, finalYn, currentItem]);

  const inList = materials.filter((m) => m.ioType === "IN");
  const outList = materials.filter((m) => m.ioType === "OUT");

  const handleAdd = (ioType: MaterialIoType, option: ItemOptionResponse) => {
    onChange([
      ...materials,
      {
        itemCode: option.itemCode,
        itemNm: option.itemNm,
        unit: option.unit,
        ioType,
        // 새로 추가한 자재의 수율은 미입력(null)으로 시작 (OUT 에서만 입력 UI 노출)
        yieldRate: null,
      },
    ]);
  };

  const handleRemove = (ioType: MaterialIoType, itemCode: string) => {
    onChange(materials.filter((m) => !(m.ioType === ioType && m.itemCode === itemCode)));
  };

  // 산출(OUT) 자재의 계획 수율 변경
  const handleYieldChange = (itemCode: string, yieldRate: number | null) => {
    onChange(
      materials.map((m) =>
        m.ioType === "OUT" && m.itemCode === itemCode ? { ...m, yieldRate } : m
      )
    );
  };

  return (
    <div className="routing-mtrl-section">
      <div className="routing-mtrl-title">이 공정의 투입/산출 자재</div>

      <MaterialGroup
        key={`${resetKey ?? ""}-IN`}
        ioType="IN"
        title="투입 자재 (IN)"
        list={inList}
        availableOptions={availableInOptions}
        disabled={disabled}
        onAdd={(o) => handleAdd("IN", o)}
        onRemove={(code) => handleRemove("IN", code)}
      />

      <MaterialGroup
        key={`${resetKey ?? ""}-OUT`}
        ioType="OUT"
        title="산출 자재 (OUT)"
        list={outList}
        availableOptions={availableOutOptions}
        disabled={disabled}
        onAdd={(o) => handleAdd("OUT", o)}
        onRemove={(code) => handleRemove("OUT", code)}
        onYieldChange={handleYieldChange}
      />
    </div>
  );
}