import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

type DetailSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** 옵션이 많을 때 검색창 표시 */
  searchable?: boolean;
};

export function DetailSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "선택",
  disabled = false,
  searchable = false,
}: DetailSelectProps) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const selected = options.find((o) => o.value === value);
  const listId = `${uid}-list`;

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // 키보드 이동 시 활성 옵션이 보이도록 스크롤
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${uid}-opt-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open, uid]);

  const openPanel = () => {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const closePanel = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const commit = (opt?: SelectOption) => {
    if (!opt) return;
    onChange(opt.value);
    closePanel(true);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openPanel();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        commit(filtered[active]);
        break;
      case "Escape":
        e.preventDefault();
        closePanel(true);
        break;
      case "Tab":
        closePanel();
        break;
    }
  };

  return (
    <div className="selectBox" ref={rootRef} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="selectBoxTrigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? closePanel() : openPanel())}
      >
        {selected ? (
          <span className="selectBoxValue">{selected.label}</span>
        ) : (
          <span className="selectBoxPlaceholder">{placeholder}</span>
        )}
        <svg
          className="selectBoxChevron"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>

      {open && (
        <div className="selectBoxPanel">
          {searchable && (
            <input
              autoFocus
              className="selectBoxSearch"
              placeholder="검색"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
            />
          )}
          <div className="selectBoxList" role="listbox" id={listId}>
            {filtered.length === 0 ? (
              <div className="selectBoxEmpty">검색 결과가 없습니다</div>
            ) : (
              filtered.map((opt, i) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    id={`${uid}-opt-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    className={[
                      "selectBoxOption",
                      i === active ? "isActive" : "",
                      isSelected ? "isSelected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commit(opt)}
                  >
                    <span className="selectBoxOptionText">
                      <span className="selectBoxOptionLabel">{opt.label}</span>
                      {opt.description && (
                        <span className="selectBoxOptionDesc">{opt.description}</span>
                      )}
                    </span>
                    {isSelected && (
                      <svg
                        className="selectBoxCheck"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m4.5 10.5 3.5 3.5 7.5-8" />
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