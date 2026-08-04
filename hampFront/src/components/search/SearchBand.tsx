import type { RefObject } from 'react'
import { AdjustmentsHorizontalIcon, ArrowPathIcon } from '@heroicons/react/16/solid'

type SearchInputField = {
  type: 'input'
  label: string
  ref: RefObject<HTMLInputElement | null>
  placeholder?: string
}

type SearchSingleDateField = {
  type: 'single-date'
  label: string
  ref: RefObject<HTMLInputElement | null>
}

type SearchDateField = {
  type: 'date'
  label: string
  startRef: RefObject<HTMLInputElement | null>
  endRef: RefObject<HTMLInputElement | null>
}

type SearchSelectField = {
  type: 'select'
  label: string
  ref: RefObject<HTMLSelectElement | null>
  options: { value: string; label: string }[]
}

export type SearchField = SearchInputField | SearchSingleDateField |SearchDateField | SearchSelectField

type Props = {
  fields: SearchField[]
  onSearch: () => void
  onReset?: () => void
}

/** 목록 화면 상단의 검색/필터 입력 영역. 값은 ref로 읽고, '조회' 클릭(또는 Enter)에만 onSearch를 호출한다 */
export function SearchBand({ fields, onSearch, onReset }: Props) {
  return (
    <div className="searchBand">
      <div className="searchBandTop">
        <h2>
          <AdjustmentsHorizontalIcon className="w-5 h-5" /> Search
        </h2>
        <button type="button" className="resetButton" onClick={onReset}>
          <ArrowPathIcon className="w-5 h-5" /> 초기화
        </button>
      </div>
      <div className="serchItem">
        {fields.map((field, index) => (
          <label key={`${field.label}-${index}`} className={field.type === 'date' ? 'dateRangeLabel' : ''}>
            <p>{field.label}</p>

            {field.type === 'input' && (
              <input
                ref={field.ref}
                type="text"
                placeholder={field.placeholder ?? `${field.label} 입력`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSearch()
                }}
              />
            )}

            {field.type === 'single-date' && (
              <input
                ref={field.ref}
                type="date"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSearch()
                }}
              />
            )}

            {field.type === 'date' && (
              <div className="dateRangeGroup">
                <input ref={field.startRef} type="date" />
                <span>~</span>
                <input ref={field.endRef} type="date" />
              </div>
            )}

            {field.type === 'select' && (
              <select ref={field.ref}>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </label>
        ))}
        <button type="button" className="primaryButton" onClick={onSearch}>
          조회
        </button>
      </div>
    </div>
  )
}
