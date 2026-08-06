import { useState, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/16/solid'

// 공통 필드 속성에 isPrimary 추가
type BaseField = {
  /** true 지정 시 기본(접힌) 상태에서 우선 노출 */
  isPrimary?: boolean
}

type SearchInputField = BaseField & {
  type: 'input'
  label: string
  ref: RefObject<HTMLInputElement | null>
  placeholder?: string
}

type SearchSingleDateField = BaseField & {
  type: 'single-date'
  label: string
  ref: RefObject<HTMLInputElement | null>
}

type SearchDateField = BaseField & {
  type: 'date'
  label: string
  startRef: RefObject<HTMLInputElement | null>
  endRef: RefObject<HTMLInputElement | null>
}

type SearchSelectField = BaseField & {
  type: 'select'
  label: string
  ref: RefObject<HTMLSelectElement | null>
  options: { value: string; label: string }[]
}

export type SearchField =
  | SearchInputField
  | SearchSingleDateField
  | SearchDateField
  | SearchSelectField

type Props = {
  fields: SearchField[]
  onSearch: () => void
  onReset?: () => void
}

/** 목록 화면 상단의 검색/필터 입력 영역. 값은 ref로 읽고, '조회' 클릭(또는 Enter)에만 onSearch를 호출한다 */
export function SearchBand({ fields, onSearch, onReset }: Props) {
  const location = useLocation()
  // 페이지 주소(예: /master/operation)마다 고유한 키 생성
  const storageKey = `searchBand_expanded_${location.pathname}`

  const [isExpanded, setIsExpanded] = useState(() => {
    return sessionStorage.getItem(storageKey) === "true"
  })

  const handleToggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev
      sessionStorage.setItem(storageKey, String(next))
      return next
    })
  }

  // 1. isPrimary: true 가 붙은 필터를 우선 추출하고, 없으면 순서대로 앞에서 가져옴
  const getInitialVisibleFields = () => {
    const primaryFields = fields.filter((f) => f.isPrimary)

    // isPrimary 지정된 필터가 있으면 해당 필터들을 사용
    if (primaryFields.length > 0) {
      return primaryFields
    }

    // 따로 지정한 게 없다면 1행(Span 3 이하)에 맞춰 순서대로 자름
    let currentSpan = 0
    const visibleList: SearchField[] = []

    for (const field of fields) {
      const fieldSpan = field.type === 'date' ? 2 : 1
      if (currentSpan + fieldSpan <= 3) {
        visibleList.push(field)
        currentSpan += fieldSpan
      } else {
        break
      }
    }
    return visibleList
  }

  const baseVisibleFields = getInitialVisibleFields()
  const hasMoreFields = fields.length > baseVisibleFields.length
  
  // 접혀있을 때는 isPrimary 필터만, 펼쳐졌을 때는 전체 필터를 노출
  const visibleFields = isExpanded ? fields : baseVisibleFields

  return (
    <div className="searchBand">
      {/* 1. 상단 제목 / 초기화 영역 */}
      <div className="searchBandTop">
        <h2>
          <AdjustmentsHorizontalIcon className="w-5 h-5" /> Search
        </h2>
        {onReset && (
          <button type="button" className="resetButton" onClick={onReset}>
            <ArrowPathIcon className="w-5 h-5" /> 초기화
          </button>
        )}
      </div>

      {/* 2. 필터 + 버튼 통합 그리드 영역 */}
      <div className="serchItem">
        {visibleFields.map((field, index) => (
          <label
            key={`${field.label}-${index}`}
            className={field.type === 'date' ? 'dateRangeLabel' : ''}
          >
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

        {/* 3. 액션 버튼 영역 (4열에 고정 배치) */}
        <div className="searchActions">
          {hasMoreFields && (
            <button
              type="button"
              className="expandButton"
              onClick={handleToggleExpand}
            >
              {isExpanded ? (
                <>
                  접기 <ChevronUpIcon className="w-4 h-4" />
                </>
              ) : (
                <>
                  상세검색 <ChevronDownIcon className="w-4 h-4" />
                </>
              )}
            </button>
          )}

          <button type="button" className="primaryButton" onClick={onSearch}>
            <span>조회</span>
          </button>
        </div>
      </div>
    </div>
  )
}