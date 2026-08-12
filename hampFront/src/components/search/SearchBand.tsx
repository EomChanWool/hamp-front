import { useState, type RefObject } from "react";
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
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

  // 필요할 때만 상세검색을 처음부터 열어둘 수 있음
  initialExpanded?: boolean;
};

export function SearchBand({
  fields,
  onSearch,
  onReset,
  initialExpanded = false,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  const handleToggleExpand = () => {
    setIsExpanded((prev) => !prev);
  };

  const getInitialVisibleFields = () => {
    const primaryFields = fields.filter((f) => f.isPrimary);

    if (primaryFields.length > 0) {
      return primaryFields;
    }

    let currentSpan = 0;
    const visibleList: SearchField[] = [];

    for (const field of fields) {
      const fieldSpan = field.type === "date" ? 2 : 1;

      if (currentSpan + fieldSpan <= 3) {
        visibleList.push(field);
        currentSpan += fieldSpan;
      } else {
        break;
      }
    }

    return visibleList;
  };

  const baseVisibleFields = getInitialVisibleFields();
  const hasMoreFields = fields.length > baseVisibleFields.length;
  const visibleFields = isExpanded ? fields : baseVisibleFields;

  return (
    <div className="searchBand">
      <div className="searchBandTop">
        <h2>
          <AdjustmentsHorizontalIcon className="w-5 h-5" />
          Search
        </h2>

        {onReset && (
          <button
            type="button"
            className="resetButton"
            onClick={onReset}
          >
            <ArrowPathIcon className="w-5 h-5" />
            초기화
          </button>
        )}
      </div>

      <div className="serchItem">
        {visibleFields.map((field, index) => {
          return (
            <label
              key={`${field.label}-${index}`}
              className={
                field.type === "date" ? "dateRangeLabel" : ""
              }
            >
              <p>{field.label}</p>

              {field.type === "input" && (
                <input
                  ref={field.ref}
                  type="text"
                  defaultValue=""
                  placeholder={
                    field.placeholder ?? `${field.label} 입력`
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onSearch();
                    }
                  }}
                />
              )}

              {field.type === "single-date" && (
                <input
                  ref={field.ref}
                  type="date"
                  defaultValue=""
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onSearch();
                    }
                  }}
                />
              )}

              {field.type === "date" && (
                <div className="dateRangeGroup">
                  <input
                    ref={field.startRef}
                    type="date"
                    defaultValue=""
                  />

                  <span>~</span>

                  <input
                    ref={field.endRef}
                    type="date"
                    defaultValue=""
                  />
                </div>
              )}

              {field.type === "select" && (
                <select
                  ref={field.ref}
                  defaultValue=""
                >
                  {field.options.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </label>
          );
        })}

        <div className="searchActions">
          {hasMoreFields && (
            <button
              type="button"
              className="expandButton"
              onClick={handleToggleExpand}
            >
              {isExpanded ? (
                <>
                  접기
                  <ChevronUpIcon className="w-4 h-4" />
                </>
              ) : (
                <>
                  상세검색
                  <ChevronDownIcon className="w-4 h-4" />
                </>
              )}
            </button>
          )}

          <button
            type="button"
            className="primaryButton"
            onClick={onSearch}
          >
            <span>조회</span>
          </button>
        </div>
      </div>
    </div>
  );
}