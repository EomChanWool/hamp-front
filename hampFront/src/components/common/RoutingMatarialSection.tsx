import { useEffect, useMemo, useState } from "react";
import {
  ItemApi,
  type ItemOptionResponse,
  type ItemRoutingResponse,
  type RoutingMaterialRequest,
} from "@/api/master/Item";
import "@/pages/page/master/MasterItem.css";


/** 투입(IN) / 산출(OUT) 구분 ※ 백엔드 ioType 실제 값이 다르면 여기만 수정 */
export type MaterialIoType = "IN" | "OUT";

/** 화면에서 다루는 자재 1건 (표시용 itemNm / unit 포함) */
export interface RoutingMaterialDraft {
  itemCode: string;
  itemNm: string;
  unit: string;
  ioType: MaterialIoType;
}

/** 서버 응답(routings[].materials) → { [operCode]: 자재[] } 맵으로 변환 (상세 페이지 로딩용) */
export const buildMaterialMap = (
  routings?: ItemRoutingResponse[] | null
): Record<string, RoutingMaterialDraft[]> => {
  const map: Record<string, RoutingMaterialDraft[]> = {};
  (routings ?? []).forEach((r) => {
    if (!r.operCode) return;
    map[r.operCode] = (r.materials ?? []).map((m) => ({
      itemCode: m.itemCode,
      itemNm: m.itemNm,
      unit: m.unit,
      ioType: m.ioType === "OUT" ? "OUT" : "IN",
    }));
  });
  return map;
};

/** 화면용 자재 → 서버 요청용 자재 (저장 시 사용) */
export const toMaterialRequests = (
  list?: RoutingMaterialDraft[] | null
): RoutingMaterialRequest[] =>
  (list ?? []).map(({ itemCode, ioType }) => ({ itemCode, ioType }));

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
}

function MaterialGroup({
  ioType,
  title,
  list,
  availableOptions,
  disabled,
  onAdd,
  onRemove,
}: MaterialGroupProps) {
  // [+ 추가] 클릭 시 나타나는 품목 선택 select 노출 여부
  const [isPicking, setIsPicking] = useState(false);

  const handlePick = (itemCode: string) => {
    const picked = availableOptions.find((o) => o.itemCode === itemCode);
    if (!picked) return;
    onAdd(picked);
    setIsPicking(false); // 하나 추가하면 닫기 (연속 추가는 [+ 추가] 다시 클릭)
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
  // 현재 품목 종류 (0: 식품, 1: 섬유)
  productType?: 0 | 1;
  // 최종공정 여부 (Y: 최종공정, N: 일반공정)
  finalYn: string;
}

export function RoutingMaterialSection({
  materials,
  onChange,
  excludeItemCode,
  disabled,
  resetKey,
  productType,
  finalYn,
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

  const availableOutOptions = useMemo(
    () => outOptions.filter(
      (o) => !used.has(o.itemCode) || o.itemCode === excludeItemCode
    ),
    [outOptions, excludeItemCode, used]
  );

  const inList = materials.filter((m) => m.ioType === "IN");
  const outList = materials.filter((m) => m.ioType === "OUT");

  const handleAdd = (ioType: MaterialIoType, option: ItemOptionResponse) => {
    onChange([
      ...materials,
      { itemCode: option.itemCode, itemNm: option.itemNm, unit: option.unit, ioType },
    ]);
  };

  const handleRemove = (ioType: MaterialIoType, itemCode: string) => {
    onChange(materials.filter((m) => !(m.ioType === ioType && m.itemCode === itemCode)));
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
      />
    </div>
  );
}
