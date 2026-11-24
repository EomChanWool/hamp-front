import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";

export type SelectBoxOption = {
  value: string;
  label: string;
  description?: string;
};

type SelectBoxProps = {
  /** 선택 버튼(트리거)에 연결 (검증 실패 시 포커스 이동 등) */
  ref?: Ref<HTMLButtonElement>;
  id?: string;
  value: string;
  options: SelectBoxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** 지정하면 목록 맨 위에 "선택 안 함"(value "") 옵션을 추가 (선택 해제가 필요한 선택 항목용) */
  clearLabel?: string;
  /** true면 패널 상단에 검색 input 노출 (label / description 기준 필터) */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  /** label 연결이 없는 곳(테이블 행 등)에서 접근 가능한 이름 지정 */
  ariaLabel?: string;
  className?: string;
  /** 검증 실패 표시 (aria-invalid) */
  invalid?: boolean;
};

export function SelectBox({
  ref,
  id,
  value,
  options,
  onChange,
  placeholder = "선택해주세요",
  disabled = false,
  clearLabel,
  searchable = false,
  searchPlaceholder = "검색",
  emptyText = "검색 결과가 없습니다",
  ariaLabel,
  className,
  invalid = false,
}: SelectBoxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement, []);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const allOptions = useMemo<SelectBoxOption[]>(
    () => (clearLabel ? [{ value: "", label: clearLabel }, ...options] : options),
    [clearLabel, options]
  );

  // value가 비어 있으면 placeholder를 보여준다
  const selected = value ? options.find((opt) => opt.value === value) : undefined;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description ?? "").toLowerCase().includes(q)
    );
  }, [allOptions, query]);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const openPanel = () => {
    if (disabled) return;
    const idx = allOptions.findIndex((opt) => opt.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
    setOpen(true);
  };

  const selectOption = (opt: SelectBoxOption) => {
    onChange(opt.value);
    close();
  };

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, close]);

  // 검색형이면 열릴 때 검색 input으로 포커스
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  // 키보드로 이동한 항목이 보이도록 스크롤
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (!open) {
      if (
        (e.key === "ArrowDown" || e.key === "ArrowUp") &&
        e.target === triggerRef.current
      ) {
        e.preventDefault();
        openPanel();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        if (!searchable) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (!searchable) {
          e.preventDefault();
          setActiveIndex(filtered.length - 1);
        }
        break;
      case "Enter":
        e.preventDefault(); // form submit 방지
        if (filtered[activeIndex]) selectOption(filtered[activeIndex]);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "Tab":
        close(false);
        break;
    }
  };

  const activeOptionId =
    open && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined;

  return (
    <div
      ref={rootRef}
      className={`selectBox${className ? ` ${className}` : ""}`}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="selectBoxTrigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={searchable ? undefined : activeOptionId}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : openPanel())}
      >
        <span className={selected ? "selectBoxValue" : "selectBoxPlaceholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className="selectBoxChevron"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 7.5 10 12.5 15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="selectBoxPanel">
          {searchable && (
            <input
              ref={searchRef}
              type="text"
              className="selectBoxSearch"
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
            />
          )}

          <div id={listboxId} role="listbox" className="selectBoxList">
            {filtered.length === 0 ? (
              <div className="selectBoxEmpty">{emptyText}</div>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    id={`${listboxId}-opt-${idx}`}
                    data-index={idx}
                    role="option"
                    aria-selected={isSelected}
                    className={`selectBoxOption${
                      idx === activeIndex ? " isActive" : ""
                    }${isSelected ? " isSelected" : ""}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => e.preventDefault()} // 포커스 유지
                    onClick={() => selectOption(opt)}
                  >
                    <span className="selectBoxOptionText">
                      <span className="selectBoxOptionLabel">{opt.label}</span>
                      {opt.description && (
                        <span className="selectBoxOptionDesc">
                          {opt.description}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <svg
                        className="selectBoxCheck"
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="m4.5 10.5 3.5 3.5 7.5-8"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}