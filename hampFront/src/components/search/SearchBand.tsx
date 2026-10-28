import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  CheckIcon,
  ChevronDownIcon,
} from "@heroicons/react/16/solid";

type BaseField = {
  isPrimary?: boolean;
};

type SearchInputField = BaseField & {
  type: "input";
  label: string;
  ref: RefObject<HTMLInputElement | null>;
  placeholder?: string;
  name: string;
  // URL 쿼리 등 외부 값을 SearchBand에 전달하기 위한 값.
  value?: string;
};

type SearchSingleDateField = BaseField & {
  type: "single-date";
  label: string;
  ref: RefObject<HTMLInputElement | null>;
  name?: string;
  value?: string;
};

type SearchDateField = BaseField & {
  type: "date";
  label: string;
  startRef: RefObject<HTMLInputElement | null>;
  endRef: RefObject<HTMLInputElement | null>;
  name?: string;
  startValue?: string;
  endValue?: string;
};

type SearchSelectField = BaseField & {
  type: "select";
  label: string;
  ref: RefObject<HTMLSelectElement | null>;
  options: { value: string; label: string }[];
  name?: string;
  value?: string;
};

export type SearchField =
  | SearchInputField
  | SearchSingleDateField
  | SearchDateField
  | SearchSelectField;

type Props = {
  fields: SearchField[];
  onSearch: () => void;
  onReset?: () => void;
  initialExpanded?: boolean;
};

type SearchSelectProps = {
  label: string;
  selectRef: RefObject<HTMLSelectElement | null>;
  options: { value: string; label: string }[];
  resetKey: number;
};

// select의 기본(초기) 값: 빈 값("") 옵션이 있으면 그것, 없으면 첫 번째 옵션
const getSelectDefault = (options: { value: string; label: string }[]) =>
  options.some((option) => option.value === "") ? "" : (options[0]?.value ?? "");

function SearchSelect({
  label,
  selectRef,
  options,
  resetKey,
}: SearchSelectProps) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const listId = `${uid}-list`;

  const initialValue = getSelectDefault(options);

  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedLabel = options[selectedIndex]?.label ?? "";

  // resetKey가 바뀔 때마다 native select의 값을 읽어 화면 상태에 반영
  // (초기화 / URL 값 복원 시 사용)
  useEffect(() => {
    if (resetKey === 0) return;
    setValue(selectRef.current?.value ?? initialValue);
  }, [resetKey, selectRef, initialValue]);

  useEffect(() => {
    if (!open) return;

    const handleOutside = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${listId}-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, listId]);

  const openList = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;

    setValue(option.value);
    if (selectRef.current) {
      selectRef.current.value = option.value;
    }
    setOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (open) {
          setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        } else {
          openList();
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) {
          setActiveIndex((i) => Math.max(i - 1, 0));
        } else {
          openList();
        }
        break;
      case "Home":
        if (open) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (open) {
          e.preventDefault();
          setActiveIndex(options.length - 1);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) {
          choose(activeIndex);
        } else {
          openList();
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div className="searchSelectField" ref={wrapRef}>
      <p id={labelId}>{label}</p>

      <select
        ref={selectRef}
        className="selectNative"
        defaultValue={initialValue}
        tabIndex={-1}
        aria-hidden="true"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        role="combobox"
        className="selectTrigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => {
          if (e.key === " ") e.preventDefault();
        }}
      >
        <span className="selectValue">{selectedLabel}</span>
        <ChevronDownIcon />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="selectList"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;

            return (
              <div
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isSelected}
                className={[
                  "selectOption",
                  index === activeIndex ? "active" : "",
                  isSelected ? "selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {isSelected && <CheckIcon />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SCOPE_LIMIT = 2;

const QUICK_RANGES = [
  { key: "today", label: "오늘" },
  { key: "1w", label: "1주" },
  { key: "1m", label: "1개월" },
  { key: "3m", label: "3개월" },
  { key: "6m", label: "6개월" },
] as const;

type QuickRangeKey = (typeof QUICK_RANGES)[number]["key"];

const formatDate = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// 대상 월에 같은 날이 없으면 그 달 말일로 맞춤 (예: 3/31의 1개월 전 → 2/28)
const subtractMonths = (date: Date, months: number) => {
  const year = date.getFullYear();
  const month = date.getMonth() - months;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDay));
};

const getQuickRangeStart = (key: QuickRangeKey, today: Date) => {
  if (key === "1w") {
    const start = new Date(today);
    start.setDate(start.getDate() - 7);
    return start;
  }
  if (key === "1m") return subtractMonths(today, 1);
  if (key === "3m") return subtractMonths(today, 3);
  if (key === "6m") return subtractMonths(today, 6);
  return new Date(today);
};

// 통합 검색(검색조건 select + 검색어)에 사용되는 input 필드 (최대 SCOPE_LIMIT개)
const getScopeFields = (fields: SearchField[]) =>
  fields
    .filter((field): field is SearchInputField => field.type === "input")
    .slice(0, SCOPE_LIMIT);

// 필드 종류와 상관없이 "외부에서 내려준 값"을 배열로 꺼내는 헬퍼
// (date 필드는 시작/종료 2개, 나머지는 1개)
const getFieldValues = (field: SearchField): (string | undefined)[] => {
  switch (field.type) {
    case "date":
      return [field.startValue, field.endValue];
    default:
      return [field.value];
  }
};

export function SearchBand({
  fields,
  onSearch,
  onReset,
  initialExpanded = false,
}: Props) {
  const panelId = useId();
  const [resetKey, setResetKey] = useState(0);
  const keywordRef = useRef<HTMLInputElement>(null);
  const scopeRef = useRef<HTMLSelectElement>(null);

  // effect 안에서 항상 최신 fields를 참조하기 위한 ref (stale closure 방지)
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const scopeFields = getScopeFields(fields);
  const unified = scopeFields.length > 1; // input 2개 이상 → 통합 검색
  const single = scopeFields.length === 1 ? scopeFields[0] : null; // input 1개 → 단일 검색어
  const hasKeywordRow = scopeFields.length > 0; // 상단 키워드 행 표시 여부 (input 유무)

  // 상세검색 패널에 들어가는 필드: select + (통합검색에 쓰이지 않은) 보조 input
  const panelFields = fields.filter(
    (field) =>
      field.type === "select" ||
      (field.type === "input" && !scopeFields.includes(field)),
  );
  const dateFields = fields.filter(
    (field) => field.type === "date" || field.type === "single-date",
  );
  const hasFilters = panelFields.length + dateFields.length > 0;

  const filterOnly = !hasKeywordRow && hasFilters;

  // 상세검색 패널 안(select / 보조 input / 날짜)에 값이 채워져 있는지 여부
  // → 목록으로 돌아왔을 때 접힌 패널 속에 조건이 숨지 않도록 자동으로 펼친다.
  const hasActiveDetailFilter = [...panelFields, ...dateFields].some((field) =>
    getFieldValues(field).some((v) => !!v),
  );

  const [expanded, setExpanded] = useState(
    initialExpanded || hasActiveDetailFilter,
  );

  // 실제 패널 노출 여부: filterOnly면 항상 true, 아니면 사용자가 토글한 상태
  const isExpanded = filterOnly || expanded;

  // 통합 검색의 "검색 조건" select 옵션
  const scopeOptions = scopeFields.map((field, index) => ({
    value: String(index),
    label: field.label,
  }));

  /* ---------- 외부 값(URL 쿼리 등) 복원 ---------- */

  // 외부(URL 쿼리 등)에서 내려준 값이 하나라도 있는지
  const hasControlledValue = fields.some((field) =>
    getFieldValues(field).some((v) => v !== undefined),
  );
  // 외부 값 또는 select 옵션이 바뀌었는지 감지하기 위한 직렬화 키
  // (옵션이 비동기로 늦게 로드돼도 값을 다시 복원하기 위함)
  const controlledKey = JSON.stringify(
    fields.map((field) => [
      getFieldValues(field),
      field.type === "select" ? field.options.map((o) => o.value).join(",") : "",
    ]),
  );

  // 외부 값(URL 쿼리 등)이 바뀔 때마다 모든 입력 UI를 복원한다.
  // - 최초 진입(상세 → 목록 복귀 포함) 시에도 한 번 실행된다.
  // - page 처럼 검색조건이 아닌 값이 바뀌어도 controlledKey는 그대로라 입력 중인 값이 지워지지 않는다.
  useEffect(() => {
    if (!hasControlledValue) return;

    const currentFields = fieldsRef.current;
    const currentScopeFields = getScopeFields(currentFields);
    const isUnified = currentScopeFields.length > 1;

    // 1) 필드 종류별로 native 요소(ref)에 값 반영
    currentFields.forEach((field) => {
      switch (field.type) {
        case "input":
        case "single-date":
          // 통합 모드의 scope input은 hidden input에 값이 들어간다.
          if (field.value !== undefined && field.ref.current) {
            field.ref.current.value = field.value;
          }
          break;

        case "select":
          if (field.value !== undefined && field.ref.current) {
            // 빈 값이면 해당 select의 기본 옵션으로 되돌림
            field.ref.current.value =
              field.value === "" ? getSelectDefault(field.options) : field.value;
          }
          break;

        case "date":
          if (field.startValue !== undefined && field.startRef.current) {
            field.startRef.current.value = field.startValue;
          }
          if (field.endValue !== undefined && field.endRef.current) {
            field.endRef.current.value = field.endValue;
          }
          break;
      }
    });

    // 2) 통합 모드일 때만 보이는 검색어 + 검색조건(scope) 복원
    if (isUnified) {
      const filledIndex = currentScopeFields.findIndex(
        (field) => (field.value ?? "") !== "",
      );
      // 값이 있는 필드가 없으면(초기화 상태) 첫 번째 조건으로 되돌림
      const scopeIndex = filledIndex >= 0 ? filledIndex : 0;

      if (scopeRef.current) scopeRef.current.value = String(scopeIndex);
      if (keywordRef.current) {
        keywordRef.current.value = currentScopeFields[scopeIndex]?.value ?? "";
      }
    }

    // 3) SearchSelect(커스텀 select)가 native select 값을 다시 읽어 표시 라벨을 갱신하도록 신호
    setResetKey((prev) => prev + 1);

    // 4) 상세검색 패널 안에 값이 있으면 펼친다. (접는 동작은 사용자가 직접)
    //    filterOnly 모드에서는 isExpanded가 항상 true라 영향 없음
    const hasDetailValue = currentFields.some(
      (field) =>
        !currentScopeFields.includes(field as SearchInputField) &&
        getFieldValues(field).some((v) => !!v),
    );
    if (hasDetailValue) setExpanded(true);
  }, [controlledKey, hasControlledValue]);

  const handleSearch = () => {
    if (unified) {
      const keyword = keywordRef.current?.value ?? "";
      const scope = scopeRef.current?.value ?? "0";

      scopeFields.forEach((field, index) => {
        if (field.ref.current) {
          field.ref.current.value = String(index) === scope ? keyword : "";
        }
      });
    }
    onSearch();
  };

  // 초기화: 모든 입력 UI를 비우고 부모(onReset)에 알린다.
  const handleReset = () => {
    // 모든 종류의 입력 UI를 직접 비운다. (페이지에서는 URL 쿼리만 초기화하면 됨)
    fields.forEach((field) => {
      switch (field.type) {
        case "input":
        case "single-date":
          if (field.ref.current) field.ref.current.value = "";
          break;
        case "select":
          if (field.ref.current) {
            field.ref.current.value = getSelectDefault(field.options);
          }
          break;
        case "date":
          if (field.startRef.current) field.startRef.current.value = "";
          if (field.endRef.current) field.endRef.current.value = "";
          break;
      }
    });

    if (keywordRef.current) keywordRef.current.value = "";
    if (scopeRef.current) scopeRef.current.value = "0";

    onReset?.();
    // SearchSelect 표시 라벨 갱신
    setResetKey((prev) => prev + 1);
  };

  // 텍스트/단일날짜 input에서 Enter → 조회
  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  // 날짜 빠른 선택 (오늘 / 1주 / 1개월 ...)
  const applyQuickRange = (field: SearchDateField, key: QuickRangeKey) => {
    const today = new Date();
    if (field.startRef.current) {
      field.startRef.current.value = formatDate(getQuickRangeStart(key, today));
    }
    if (field.endRef.current) {
      field.endRef.current.value = formatDate(today);
    }
  };

  /* ---------- 필드 렌더링 ---------- */

  const renderField = (field: SearchField, index: number) => {
    // select는 커스텀 SearchSelect로 렌더링
    if (field.type === "select") {
      return (
        <SearchSelect
          key={`${field.label}-${index}`}
          label={field.label}
          selectRef={field.ref}
          options={field.options}
          resetKey={resetKey}
        />
      );
    }

    // input / single-date / date 공통 라벨 래퍼
    const fieldLabel = (
      <label
        key={`${field.label}-${index}`}
        className={[
          "searchField",
          field.type === "date" ? "dateRangeField" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <p>{field.label}</p>

        {field.type === "input" && (
          <input
            ref={field.ref}
            type="text"
            defaultValue=""
            name={field.name}
            placeholder={field.placeholder ?? `${field.label} 입력`}
            onKeyDown={handleInputKeyDown}
          />
        )}

        {field.type === "single-date" && (
          <input
            ref={field.ref}
            type="date"
            defaultValue=""
            name={field.name}
            onKeyDown={handleInputKeyDown}
          />
        )}

        {field.type === "date" && (
          <div className="dateRangeGroup">
            <input
              ref={field.startRef}
              type="date"
              defaultValue=""
              name={field.name ? `${field.name}Start` : undefined}
            />
            <span aria-hidden="true">~</span>
            <input
              ref={field.endRef}
              type="date"
              defaultValue=""
              name={field.name ? `${field.name}End` : undefined}
            />
          </div>
        )}
      </label>
    );

    if (field.type !== "date") return fieldLabel;

    // 기간 필드는 라벨 옆에 빠른 선택 버튼 그룹을 함께 렌더링
    return (
      <Fragment key={`${field.label}-${index}`}>
        {fieldLabel}
        <div
          className="dateQuickRange"
          role="group"
          aria-label={`${field.label} 빠른 기간 선택`}
        >
          {QUICK_RANGES.map((range) => (
            <button
              key={range.key}
              type="button"
              onClick={() => applyQuickRange(field, range.key)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </Fragment>
    );
  };

  /* ---------- 액션 버튼 (상세검색 / 초기화 / 조회) ---------- */

  // 일반 모드: 키워드 행 오른쪽에 배치
  // filterOnly 모드: 필터 패널 맨 끝에 배치
  const actions = (
    <div className="searchHeaderActions">
      {/* filterOnly에서는 항상 펼쳐져 있으므로 상세검색 토글을 숨긴다 */}
      {hasFilters && !filterOnly && (
        <button
          type="button"
          className="resetButton detailToggle"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <span>상세검색</span>
          <ChevronDownIcon />
        </button>
      )}
      {onReset && (
        <button type="button" className="resetButton" onClick={handleReset}>
          <ArrowPathIcon />
          <span>초기화</span>
        </button>
      )}
      <button type="button" className="primaryButton" onClick={handleSearch}>
        <span>조회</span>
      </button>
    </div>
  );

  /* ---------- 최종 렌더링 ---------- */

  return (
    <section className="searchBand">
      {/* 타이틀 */}
      <div className="searchBandTop">
        <div className="searchTitle">
          <div className="searchTitleIcon">
            <AdjustmentsHorizontalIcon />
          </div>
          <div>
            <h2>Search</h2>
          </div>
        </div>
      </div>

      {/* 키워드 행: input이 있을 때만 렌더링 (없으면 actions만 덩그러니 남는 문제 방지) */}
      {hasKeywordRow && (
        <div className="searchKeywordRow">
          {/* 통합 모드: 검색 조건 select */}
          {unified && (
            <SearchSelect
              label="검색 조건"
              selectRef={scopeRef}
              options={scopeOptions}
              resetKey={resetKey}
            />
          )}

          {/* 검색어 input (단일 모드면 해당 필드의 ref를 그대로 사용) */}
          <label className="searchField keywordField">
            <p>{single ? single.label : "검색어"}</p>
            <input
              ref={single ? single.ref : keywordRef}
              type="text"
              defaultValue=""
              name={single?.name}
              placeholder={
                single
                  ? (single.placeholder ?? `${single.label} 입력`)
                  : "검색어 입력"
              }
              onKeyDown={handleInputKeyDown}
            />
          </label>

          {/* 통합 모드: 실제 값을 담는 hidden input (조회 시 선택된 조건에만 값이 들어감) */}
          {unified &&
            scopeFields.map((field, index) => (
              <input
                key={`${field.name}-${index}`}
                ref={field.ref}
                type="text"
                name={field.name}
                defaultValue=""
                hidden
              />
            ))}

          {actions}
        </div>
      )}

      {/* 필터 패널 (select / 보조 input / 날짜) */}
      {hasFilters && (
        <div
          id={panelId}
          className={["searchFilterPanel", filterOnly ? "filterOnly" : ""]
            .filter(Boolean)
            .join(" ")}
          hidden={!isExpanded}
        >
          {panelFields.map(renderField)}

          {dateFields.length > 0 && (
            <div className="searchDateGroup">{dateFields.map(renderField)}</div>
          )}

          {/* filterOnly: 키워드 행이 없으므로 버튼을 패널 끝에 배치 */}
          {filterOnly && actions}
        </div>
      )}
    </section>
  );
}
