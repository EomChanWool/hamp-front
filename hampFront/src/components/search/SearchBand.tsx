import {
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
};

type SearchSingleDateField = BaseField & {
  type: "single-date";
  label: string;
  ref: RefObject<HTMLInputElement | null>;
  name?: string;
};

type SearchDateField = BaseField & {
  type: "date";
  label: string;
  startRef: RefObject<HTMLInputElement | null>;
  endRef: RefObject<HTMLInputElement | null>;
  name?: string;
};

type SearchSelectField = BaseField & {
  type: "select";
  label: string;
  ref: RefObject<HTMLSelectElement | null>;
  options: { value: string; label: string }[];
  name?: string;
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

function SearchSelect({
  label,
  selectRef,
  options,
  resetKey,
}: SearchSelectProps) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const listId = `${uid}-list`;

  const initialValue = options.some((option) => option.value === "")
    ? ""
    : (options[0]?.value ?? "");

  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedLabel = options[selectedIndex]?.label ?? "";

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

export function SearchBand({ fields, onSearch, onReset }: Props) {
  const [resetKey, setResetKey] = useState(0);

  const handleReset = () => {
    onReset?.();
    setResetKey((prev) => prev + 1);
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSearch();
    }
  };

  return (
    <section className="searchBand">
      <div className="searchBandTop">
        <div className="searchTitle">
          <div className="searchTitleIcon">
            <AdjustmentsHorizontalIcon />
          </div>
          <div>
            <h2>Search</h2>
          </div>
        </div>

        <div className="searchHeaderActions">
          {onReset && (
            <button type="button" className="resetButton" onClick={handleReset}>
              <ArrowPathIcon />
              <span>초기화</span>
            </button>
          )}
          <button type="button" className="primaryButton" onClick={onSearch}>
            <span>조회</span>
          </button>
        </div>
      </div>

      <div className="searchFields">
        {fields.map((field, index) => {
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

          return (
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
        })}
      </div>
    </section>
  );
}