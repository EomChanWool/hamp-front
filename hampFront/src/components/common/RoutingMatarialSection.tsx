import { useEffect, useMemo, useRef, useState } from "react";
import {
  ItemApi,
  type ItemOptionResponse,
  type ItemRoutingResponse,
  type RoutingMaterialRequest,
  type MaterialIoType,
  type ProductType,
} from "@/api/master/Item";
import { SelectBox, type SelectBoxOption } from "./SelectBox";
import "@/pages/page/master/MasterItem.css";

export type { MaterialIoType };

/** 화면에서 다루는 자재 1건 (표시용 itemNm / unit 포함) */
export interface RoutingMaterialDraft {
  itemCode: string;
  itemNm: string;
  unit: string;
  ioType: MaterialIoType;
  /**
   * 계획 수율(%) (0 ~ 100, 소수점 2자리까지)
   * - 산출(OUT) 자재에만 입력 가능, 미입력이면 null
   * - 투입(IN) 자재는 항상 null
   */
  // 계획 수율
  yieldRate?: number | null;
}

/** 수율 소수점 최대 자리수 */
const YIELD_MAX_DECIMALS = 2;

/** 수율 입력 허용 패턴: 숫자 + 소수점 1개 + 소수 2자리까지 (음수/문자/3자리 이상 소수 차단) */
const YIELD_INPUT_PATTERN = new RegExp(`^\\d*\\.?\\d{0,${YIELD_MAX_DECIMALS}}$`);

/** 수율을 소수점 2자리로 반올림 (부동소수점 오차 정리용) */
const roundYield = (value: number): number => {
  const factor = 10 ** YIELD_MAX_DECIMALS;
  return Math.round(value * factor) / factor;
};

export const toMaterialDrafts = (
  materials?: ItemRoutingResponse["materials"] | null
): RoutingMaterialDraft[] =>
  (materials ?? []).map((m) => {
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

/**
 * 서버 응답(routings[].materials) → { [operCode]: 자재[] } 맵
 * @deprecated [중복 공정 지원] */
export const buildMaterialMap = (
  routings?: ItemRoutingResponse[] | null
): Record<string, RoutingMaterialDraft[]> => {
  const map: Record<string, RoutingMaterialDraft[]> = {};
  (routings ?? []).forEach((r) => {
    if (!r.operCode) return;
    map[r.operCode] = toMaterialDrafts(r.materials);
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
      // 저장 직전에도 소수점 2자리로 정리
      { itemCode, ioType, yieldRate: yieldRate == null ? null : roundYield(yieldRate) }
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
  // [+ 추가] 클릭 시 나타나는 품목 선택 영역 노출 여부
  const [isPicking, setIsPicking] = useState(false);
  const pickerRef = useRef<HTMLButtonElement>(null);

  // 범위(0~100) 밖 입력이 자동 보정된 자재 표시용 (itemCode → true)
  const [yieldAdjusted, setYieldAdjusted] = useState<Record<string, boolean>>({});

  // 수율 입력 중인 문자열 (itemCode → 입력값)
  //  - "5." 처럼 입력 도중의 문자열을 그대로 보여주기 위해 숫자 값과 별도로 보관
  //  - 입력칸에서 포커스가 빠지면(blur) 삭제하고 확정된 숫자 값을 표시
  const [yieldDraft, setYieldDraft] = useState<Record<string, string>>({});

  // 선택 박스가 나타나면 바로 포커스 (키보드로 이어서 선택 가능)
  useEffect(() => {
    if (isPicking) pickerRef.current?.focus();
  }, [isPicking]);

  const pickerOptions = useMemo<SelectBoxOption[]>(
    () =>
      availableOptions.map((o) => ({
        value: o.itemCode,
        label: o.itemNm,
        description: o.unit ? `${o.itemCode} · ${o.unit}` : o.itemCode,
      })),
    [availableOptions]
  );

  const handlePick = (itemCode: string) => {
    const picked = availableOptions.find((o) => o.itemCode === itemCode);
    if (!picked) return;
    onAdd(picked);
    setIsPicking(false); // 하나 추가하면 닫기 (연속 추가는 [+ 추가] 다시 클릭)
  };

  // 수율 입력값 → number | null 변환
  //  - 숫자와 소수점 1개, 소수 2자리까지만 허용 (그 외 입력/붙여넣기는 무시)
  //  - 빈 문자열(또는 "." 만 입력)이면 null (미입력)
  //  - 0 ~ 100 범위로 보정 (기존 동작 유지)
  //  - 보정이 일어난 경우(범위 밖 입력) 안내 메시지를 띄우기 위해 플래그 저장
  const handleYieldInput = (itemCode: string, raw: string) => {
    if (!onYieldChange) return;

    // 허용되지 않는 형식(문자, 음수, 소수 3자리 이상 등)은 입력 자체를 반영하지 않음
    if (!YIELD_INPUT_PATTERN.test(raw)) return;

    if (raw === "" || raw === ".") {
      setYieldDraft((prev) => ({ ...prev, [itemCode]: raw }));
      setYieldAdjusted((prev) => ({ ...prev, [itemCode]: false })); // 안내 해제
      onYieldChange(itemCode, null);
      return;
    }

    const num = Number(raw);
    if (Number.isNaN(num)) return;

    // 보정 전 값이 범위 밖이면 안내 표시, 정상 범위로 다시 입력하면 해제
    const isOver = num > 100;
    setYieldAdjusted((prev) => ({ ...prev, [itemCode]: isOver }));

    if (isOver) {
      // 100 초과 → 100으로 보정하고 입력칸에도 보정값을 표시
      setYieldDraft((prev) => ({ ...prev, [itemCode]: "100" }));
      onYieldChange(itemCode, 100);
      return;
    }

    setYieldDraft((prev) => ({ ...prev, [itemCode]: raw }));
    onYieldChange(itemCode, roundYield(num));
  };

  // 포커스가 빠지면 입력 중 문자열을 버리고 확정 값(숫자)으로 표시 ("5." → "5")
  const handleYieldBlur = (itemCode: string) => {
    setYieldDraft((prev) => {
      if (!(itemCode in prev)) return prev;
      const next = { ...prev };
      delete next[itemCode];
      return next;
    });
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
          aria-expanded={isPicking}
          onClick={() => setIsPicking((prev) => !prev)}
        >
          {isPicking ? "닫기" : "+ 추가"}
        </button>
      </div>

      {/* 품목 선택 (추가 모드일 때만) */}
      {isPicking && (
        <SelectBox
          ref={pickerRef}
          className="routing-mtrl-picker"
          ariaLabel={`${title} 품목 선택`}
          value=""
          options={pickerOptions}
          disabled={disabled}
          searchable
          searchPlaceholder="품목명 또는 코드 검색"
          emptyText={
            availableOptions.length === 0 ? "추가 가능한 품목이 없습니다" : "검색 결과가 없습니다"
          }
          placeholder={availableOptions.length === 0 ? "추가 가능한 품목이 없습니다" : "품목을 선택하세요"}
          onChange={handlePick}
        />
      )}

      {/* 자재 목록 - 종류가 많아지면 .routing-mtrl-list 에서 세로 스크롤 */}
      <div className="routing-mtrl-list">
        {list.length === 0 ? (
          <div className="routing-mtrl-empty">등록된 자재가 없습니다.</div>
        ) : (
          list.map((m) => (
            <div key={`${m.ioType}-${m.itemCode}`}>
              <div className="routing-mtrl-item">
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
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="tableInput routing-mtrl-yield-input"
                      placeholder="수율"
                      title="계획 수율(%) - 0~100, 소수점 둘째 자리까지 / 비워두면 미확정"
                      aria-label={`${m.itemNm} 계획 수율(%)`}
                      value={yieldDraft[m.itemCode] ?? m.yieldRate ?? ""}
                      disabled={disabled}
                      onChange={(e) => handleYieldInput(m.itemCode, e.target.value)}
                      onBlur={() => handleYieldBlur(m.itemCode)}
                    />
                    <span className="routing-mtrl-yield-unit">%</span>
                  </span>
                )}

                <button
                  type="button"
                  className="routing-mtrl-remove"
                  disabled={disabled}
                  aria-label={`${m.itemNm} 삭제`}
                  onClick={() => onRemove(m.itemCode)}
                >
                  삭제
                </button>
              </div>

              {/* 범위 밖 입력으로 자동 보정된 경우 안내 메시지 표시 */}
              {m.ioType === "OUT" && yieldAdjusted[m.itemCode] && m.yieldRate != null && (
                <div className="routing-mtrl-yield-error" role="alert">
                  수율은 0~100 사이로 입력해주세요. (범위를 벗어나 {m.yieldRate}%로 조정되었습니다)
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ============================================================
   공정 "1단계"의 투입/산출 자재 섹션 (등록/상세 페이지 우측 패널에서 사용)
============================================================ */
interface RoutingMaterialSectionProps {
  /** 현재 선택된 "단계"의 자재 목록 (IN/OUT 섞여 있음) */
  materials: RoutingMaterialDraft[];
  /** 자재 목록이 바뀔 때 호출 (전체 목록을 새로 넘겨줌) */
  onChange: (next: RoutingMaterialDraft[]) => void;
  /** 자기 자신 품목은 자재로 선택 못 하도록 제외 (등록 시엔 입력 중인 품목코드) */
  excludeItemCode?: string;
  disabled?: boolean;
  /**
   * 단계가 바뀔 때 [+ 추가] 열림 상태를 초기화하기 위한 key
   * [중복 공정 지원] operCode 가 아니라 단계 고유 키(rowKey)를 넘겨야 합니다.
   */
  resetKey?: string;
  // 현재 품목 종류 (0: 식품, 1: 작물)
  productType?: ProductType;
  // 최종공정 여부 (Y: 전체공정 최종, G: 일반공정 최종/수율 확정 지점, N: 일반공정)
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

  /**
   * 최종 산출물(완제품/자기 자신)을 산출 자재로 쓸 수 있는 공정 여부
   * - Y: 전체공정 최종 (마지막 단계)
   * - G: 일반공정 최종 (마지막은 아니지만 수율이 확정되는 지점, 예: 포장)
   */
  const isFinalOutputStep = finalYn === "Y" || finalYn === "G";

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

          // 산출: 최종공정(Y/G)이면 완제품만, 일반공정이면 원료 + 반제품
          ItemApi.getOptions({
            productType,
            category: isFinalOutputStep ? [2] : [0, 1],
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
  }, [productType, isFinalOutputStep]);

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

    // 최종공정(Y/G)이면 자기 자신(완제품/반제품)을 산출 옵션에 추가
    if (
      isFinalOutputStep &&
      currentItem?.itemCode &&
      currentItem.itemNm &&
      !options.some((o) => o.itemCode === currentItem.itemCode)
    ) {
      options.unshift(currentItem);
    }

    // 이미 이 공정에 추가된 품목은 제외
    return options.filter((o) => !used.has(o.itemCode));
  }, [outOptions, used, isFinalOutputStep, currentItem]);

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

      <div className="routing-mtrl-grid">
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
    </div>
  );
}