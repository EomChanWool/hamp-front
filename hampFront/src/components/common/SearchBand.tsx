import { useState } from 'react'
import { AdjustmentsHorizontalIcon, ArrowPathIcon } from '@heroicons/react/16/solid'

type Props = {
  filters: string[]
  onSearch?: (keyword: string) => void
  onReset?: () => void
}

export function SearchBand({ filters, onSearch, onReset }: Props) {
  const [keyword, setKeyword] = useState('')
  const [filterKey, setFilterKey] = useState(0)

  const handleReset = () => {
    setKeyword('')
    setFilterKey((k) => k + 1)
    onReset?.()
  }

  return (
    <div className="searchBand">
      <div className="searchBandTop">
        <h2>
          <AdjustmentsHorizontalIcon className="w-5 h-5" /> Search
        </h2>
        <button className="resetButton" onClick={handleReset}>
          <ArrowPathIcon className="w-5 h-5" /> 초기화
        </button>
      </div>
      <div className="serchItem">
        {filters.map((filter, index) => (
          <label key={`${filterKey}-${filter}`}>
            <p>{filter}</p>
            <input
              type={filter.includes('일') ? 'date' : 'text'}
              value={index === 0 && !filter.includes('일') ? keyword : undefined}
              onChange={(e) => {
                if (index === 0 && !filter.includes('일')) {
                  setKeyword(e.target.value)
                  onSearch?.(e.target.value)
                }
              }}
              placeholder={`${filter} 입력`}
            />
          </label>
        ))}
        <button
          type="button"
          className="primaryButton"
          onClick={() => window.alert('mock data 기준으로 조회되었습니다.')}
        >
          조회
        </button>
      </div>
    </div>
  )
}
