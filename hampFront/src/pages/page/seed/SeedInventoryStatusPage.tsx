import { useState, useEffect, useMemo, useRef, useId, type KeyboardEvent } from 'react'
import {
  CubeIcon,
  ArchiveBoxIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CheckIcon,
} from '@heroicons/react/24/solid'
import { KpiGrid, type KpiItem } from '@components/kpi/KpiGrid'
import { Panel } from '@components/card/Panel'
import { formatDateTime } from "@/utils/common";
import { ItemStockApi, type ItemStockResponse, type ItemStockTrendResponse, type ItemStockSummaryResponse } from '@/api/seed/ItemStock'
import '@pages/page/seed/Seed.css'

type SeedCategory = '원료' | '완제품'

interface SeedInventoryStatusRow {
  itemCode: string
  itemName: string
  category: SeedCategory
  currentStock: number
  unit: string;
  stockText: string
  updateTime: string
}

// 카테고리 → CSS modifier 클래스 매핑 (raw / finished)
const CATEGORY_CLASS_MAP: Record<SeedCategory, 'raw' | 'finished'> = {
  '원료': 'raw',
  '완제품': 'finished',
}

// 카테고리 → Heroicons 아이콘 매핑
const CATEGORY_ICON_MAP: Record<SeedCategory, typeof CubeIcon> = {
  '원료': CubeIcon,
  '완제품': ArchiveBoxIcon,
}

// 백엔드 category 코드 → 카테고리 문자열 (1 = 반제품은 화면에서 사용하지 않음)
const CATEGORY_CODE_MAP: Record<number, SeedCategory | undefined> = {
  0: '원료',
  2: '완제품',
}

// 탭 문자열 → 백엔드 category 코드
const TAB_TO_CATEGORY: Record<'전체' | SeedCategory, number | undefined> = {
  '전체': undefined,
  '원료': 0,
  '완제품': 2,
}

/* =========================================================================
   품목 선택 드롭다운 (div 기반 커스텀 select)
   - 트리거 버튼 + role="listbox" 패널
   - 키보드: ↑ ↓ Home End Enter Space Esc Tab
   - 포커스는 항상 트리거에 두고 aria-activedescendant 로 활성 옵션을 알림
   ========================================================================= */
interface ItemSelectGroup {
  label: SeedCategory
  items: SeedInventoryStatusRow[]
}

interface ItemSelectProps {
  groups: ItemSelectGroup[]
  value: string
  onChange: (itemCode: string) => void
  disabled?: boolean
}

function ItemSelect({ groups, value, onChange, disabled = false }: ItemSelectProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const selected = flatItems.find((item) => item.itemCode === value)

  // 그룹별 시작 인덱스 (flat 인덱스 계산용)
  const groupOffsets = useMemo(() => {
    let offset = 0
    return groups.map((g) => {
      const start = offset
      offset += g.items.length
      return start
    })
  }, [groups])

  const optionId = (index: number) => `${listId}-option-${index}`

  const openList = () => {
    if (disabled || flatItems.length === 0) return
    setActiveIndex(Math.max(flatItems.findIndex((item) => item.itemCode === value), 0))
    setOpen(true)
  }

  const selectIndex = (index: number) => {
    const item = flatItems[index]
    if (item) onChange(item.itemCode)
    setOpen(false)
  }

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    const handleMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  // 로딩 등으로 비활성화되면 닫기
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  // 활성 옵션이 보이도록 스크롤
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const lastIndex = flatItems.length - 1

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) openList()
        else setActiveIndex((prev) => Math.min(prev + 1, lastIndex))
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!open) openList()
        else setActiveIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Home':
        if (open) {
          e.preventDefault()
          setActiveIndex(0)
        }
        break
      case 'End':
        if (open) {
          e.preventDefault()
          setActiveIndex(lastIndex)
        }
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (open) selectIndex(activeIndex)
        else openList()
        break
      case 'Escape':
        if (open) {
          e.preventDefault()
          setOpen(false)
        }
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        break
    }
  }

  return (
    <div className={`seedDropdown${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        role="combobox"
        className="seedDropdown__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        aria-label="재고 추이를 조회할 품목 선택"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
      >
        <span className="seedDropdown__value">
          {selected ? `${selected.itemCode} · ${selected.itemName}` : '품목 없음'}
        </span>
        <ChevronDownIcon className="seedDropdown__chevron" width={16} height={16} aria-hidden />
      </button>

      {open && (
        <div
          id={listId}
          ref={listRef}
          role="listbox"
          className="seedDropdown__menu"
          // 옵션 클릭 시 트리거 포커스가 빠지지 않도록 방지
          onMouseDown={(e) => e.preventDefault()}
        >
          {groups.map((group, groupIndex) => (
            <div
              key={group.label}
              role="group"
              aria-label={group.label}
              className="seedDropdown__group"
            >
              <div className="seedDropdown__groupLabel" aria-hidden>
                {group.label}
              </div>
              {group.items.map((item, itemIndex) => {
                const flatIndex = groupOffsets[groupIndex] + itemIndex
                const isSelected = item.itemCode === value
                const isActive = flatIndex === activeIndex

                return (
                  <div
                    key={item.itemCode}
                    id={optionId(flatIndex)}
                    role="option"
                    aria-selected={isSelected}
                    data-active={isActive}
                    className={`seedDropdown__option${isSelected ? ' selected' : ''}${isActive ? ' active' : ''}`}
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    onClick={() => selectIndex(flatIndex)}
                  >
                    <span className="seedDropdown__optionCode">{item.itemCode}</span>
                    <span className="seedDropdown__optionName">{item.itemName}</span>
                    {isSelected && (
                      <CheckIcon className="seedDropdown__check" width={14} height={14} aria-hidden />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SeedInventoryStatusPage() {
  const [activeTab, setActiveTab] = useState<'전체' | SeedCategory>('전체')
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [trendTab, setTrendTab] = useState<'월별' | '분기별' | '연도별'>('월별')

  // API 연동 상태
  const [items, setItems] = useState<SeedInventoryStatusRow[]>([])
  const [summaryData, setSummaryData] = useState<ItemStockSummaryResponse | null>(null)
  const [apiTrendData, setApiTrendData] = useState<ItemStockTrendResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // 차트 막대 마우스 호버 시 툴팁 표시를 위한 상태 (현재 마우스가 올라간 데이터의 label 보관)
  const [hoveredBar, setHoveredBar] = useState<string | null>(null)

  // 1. 탭(`activeTab`)이 변경될 때마다 백엔드 API를 호출하여 해당 품목 리스트 및 요약 정보 조회
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true)
      try {
        const currentCategory = TAB_TO_CATEGORY[activeTab]

        const [listRes, summaryRes] = await Promise.all([
          ItemStockApi.getList({
            productType: 0,
            ...(currentCategory !== undefined && { category: currentCategory })
          }),
          ItemStockApi.getSummary({ productType: 0 }),
        ])

        if (cancelled) return;

        if (listRes && listRes.data) {
          const mappedItems: SeedInventoryStatusRow[] = listRes.data
            // '전체' 탭에서도 반제품(category 1)은 제외
            .filter((item: ItemStockResponse) => CATEGORY_CODE_MAP[item.category] !== undefined)
            .map((item: ItemStockResponse) => ({
              itemCode: item.itemCode,
              itemName: item.itemNm,
              category: CATEGORY_CODE_MAP[item.category] as SeedCategory,
              currentStock: item.currentQty,
              unit: item.unit,
              stockText: `${item.currentQty.toLocaleString()} ${item.unit}`,
              updateTime: formatDateTime(item.lastUpdatedAt),
            }))
          setItems(mappedItems)
        }

        if (summaryRes && summaryRes.data) {
          setSummaryData(summaryRes.data)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('재고 데이터 조회 실패:', error)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true;
    }
  }, [activeTab])

  // 탭이 변경될 때 선택된 인덱스 초기화 및 툴팁 초기화
  useEffect(() => {
    setSelectedIndex(0)
    setHoveredBar(null)
  }, [activeTab])

  // 이미 백엔드에서 카테고리별로 필터링되어 오므로 그대로 사용
  const displayedItems = items

  // 탭 변경이나 리스트 갱신 시 현재 탭에 속하는 아이템만 안전하게 선택
  const selectedItem = useMemo(() => {
    if (displayedItems.length === 0) return null
    return displayedItems[selectedIndex] || displayedItems[0]
  }, [displayedItems, selectedIndex])

  // 드롭다운용 카테고리별 그룹 (품목이 없는 카테고리는 제외)
  const itemSelectGroups = useMemo<ItemSelectGroup[]>(
    () =>
      (['원료', '완제품'] as const)
        .map((label) => ({
          label,
          items: displayedItems.filter((item) => item.category === label),
        }))
        .filter((group) => group.items.length > 0),
    [displayedItems],
  )

  useEffect(() => {
    if (!selectedItem) {
      setApiTrendData(null)
      return
    }

    let cancelled = false;

    const fetchTrend = async () => {
      try {
        const periodParam = trendTab === '월별' ? 'month' : trendTab === '분기별' ? 'quarter' : 'year'
        const res = await ItemStockApi.getTrend(selectedItem.itemCode, {
          period: periodParam,
          productType: 0
        })
        if (cancelled) return;

        if (res && res.data) {
          setApiTrendData(res.data)
        } else {
          setApiTrendData(null)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('재고 추이 데이터 조회 실패:', error)
          setApiTrendData(null)
        }
      }
    }

    fetchTrend()

    return () => {
      cancelled = true;
    }
  }, [selectedItem, trendTab])

  const currentTrendData = useMemo(() => {
    if (apiTrendData && apiTrendData.points && apiTrendData.points.length > 0) {
      return apiTrendData.points.map((p) => {
        let formattedLabel = p.periodStart

        if (trendTab === '월별') {
          formattedLabel = p.periodStart.substring(0, 7)
        } else if (trendTab === '분기별') {
          // 만약 백엔드에서 "2026-01" 또는 "2026-Q1" 등으로 올 때 변환
          const [year, monthOrQ] = p.periodStart.split(/[-Q]/)
          if (year && monthOrQ) {
            const shortYear = year.slice(-2)
            const m = parseInt(monthOrQ, 10)
            const q = m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4
            formattedLabel = `${shortYear} Q${q}`
          } else {
            // 이미 "2026-Q1" 형태인 경우 등
            formattedLabel = p.periodStart.replace(/^20/, '')
          }
        } else if (trendTab === '연도별') {
          formattedLabel = p.periodStart.substring(0, 4)
        }

        return {
          label: formattedLabel,
          value: p.qty,
        }
      })
    }
    return []
  }, [apiTrendData, trendTab])

  const trendMax = useMemo(() => {
    if (currentTrendData.length === 0) return 9000
    const rawMax = Math.max(...currentTrendData.map((d) => d.value))
    if (rawMax <= 0) return 9000
    const padded = rawMax * 1.1
    const step = padded > 10000 ? 2000 : 1000
    return Math.ceil(padded / step) * step
  }, [currentTrendData])

  const yAxisLabels = useMemo(() => {
    const step = trendMax / 9
    return Array.from({ length: 10 }, (_, i) => Math.round(trendMax - step * i).toLocaleString())
  }, [trendMax])

  const gridlineValues = useMemo(() => {
    const step = trendMax / 9
    return Array.from({ length: 9 }, (_, i) => Math.round(step * (i + 1)))
  }, [trendMax])

  const getCategorySummaryValues = (catCode: number) => {
    if (summaryData && summaryData.categories) {
      const found = summaryData.categories.find((c) => c.category === catCode)
      if (found) {
        return {
          currentQty: found.currentQty.toLocaleString(),
          todayIncrease: `${found.todayIncreaseQty.toLocaleString()} kg`,
          todayDecrease: `${found.todayDecreaseQty.toLocaleString()} kg`,
        }
      }
    }
    return { currentQty: '0', todayIncrease: '0 kg', todayDecrease: '0 kg' }
  }

  const rawSummary = getCategorySummaryValues(0)
  const finSummary = getCategorySummaryValues(2)

  // KPI 카드 콘텐츠 렌더 헬퍼 (뱃지 아이콘 + 라벨 + 화살표 + 값 + 입출고 요약)
  const renderSummaryCard = (
    category: SeedCategory,
    summary: { currentQty: string; todayIncrease: string; todayDecrease: string },
  ) => {
    const cls = CATEGORY_CLASS_MAP[category]
    const Icon = CATEGORY_ICON_MAP[category]
    return (
      <div className="inventorySummaryCard">
        <div>
          <div className="inventorySummaryCard__badge">
            <div className={`inventorySummaryCard__badgeIcon ${cls}`}>
              <Icon width={14} height={14} />
            </div>
            <span className="inventorySummaryCard__header">{category} 재고</span>
            <ChevronRightIcon className="inventorySummaryCard__go" width={14} height={14} aria-hidden />
          </div>
          <div className="inventorySummaryCard__valueArea">
            <span>{summary.currentQty}</span>
            <span className="inventorySummaryCard__unit">kg</span>
          </div>
        </div>
        <div className="inventorySummaryCard__stats">
          <div className="inventorySummaryCard__statChip in">
            <div className="inventorySummaryCard__statIcon in">
              <ArrowUpIcon width={12} height={12} />
            </div>
            <div className="inventorySummaryCard__statText">
              <span className="inventorySummaryCard__statLabel">금일 입고</span>
              <span className="inventorySummaryCard__statValue in">{summary.todayIncrease}</span>
            </div>
          </div>
          <div className="inventorySummaryCard__statChip out">
            <div className="inventorySummaryCard__statIcon out">
              <ArrowDownIcon width={12} height={12} />
            </div>
            <div className="inventorySummaryCard__statText">
              <span className="inventorySummaryCard__statLabel">금일 출고</span>
              <span className="inventorySummaryCard__statValue out">{summary.todayDecrease}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const seedInventoryKpis: KpiItem[] = [
    {
      label: '원료 재고',
      value: '',
      tone: 'muted',
      render: () => renderSummaryCard('원료', rawSummary),
    },
    {
      label: '완제품 재고',
      value: '',
      tone: 'muted',
      render: () => renderSummaryCard('완제품', finSummary),
    },
  ]

  // activeTab 상태에 따라 KpiGrid에 매칭될 선택된 라벨 결정 ('전체'일 때는 선택 해제)
  const currentSelectedLabel =
    activeTab === '원료' ? '원료 재고' :
      activeTab === '완제품' ? '완제품 재고' : undefined;

  return (
    // 로딩 중일 때 반투명 처리 및 클릭 차단 클래스 적용
    <section className={`screenStack${loading ? ' screenStack--loading' : ''}`}>
      {/* 품목별 현재 재고 패널 — 탭버튼을 타이틀과 같은 줄 우측에 배치 */}
      <Panel
        title={
          <div className="seedStatusPanel__titleRow">
            <span>품목별 현재 재고</span>
            <div className="seedTabGroup">
              {(['전체', '원료', '완제품'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`seedTabButton${activeTab === tab ? ' active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab)
                  }}
                  disabled={loading} // 로딩 중 연타 방지
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="seedStatusPanel">
          <div className="seedCaption">
            재고 많은 순 · {displayedItems.length}개 품목
          </div>

          <div className="seedTableHeader">
            <span>품목</span>
            <span>구분</span>
            <span>현재 수량</span>
            <span>최근 갱신</span>
          </div>

          <div className="seedItemList">
            {displayedItems.length > 0 ? (
              displayedItems.map((item, index) => {
                const isSelected = selectedIndex === index
                const cls = CATEGORY_CLASS_MAP[item.category]
                const Icon = CATEGORY_ICON_MAP[item.category]

                return (
                  <div
                    key={item.itemCode}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    className={`seedItemRow${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelectedIndex(index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedIndex(index)
                      }
                    }}
                  >
                    <div className="seedItemRow__identity">
                      <div className={`seedItemRow__avatar ${cls}`}>
                        <Icon width={14} height={14} />
                      </div>
                      <div>
                        <div className="seedItemRow__name">{item.itemName}</div>
                        <div className="seedItemRow__code">{item.itemCode}</div>
                      </div>
                    </div>

                    <span className={`seedCategoryBadge ${cls}`}>{item.category}</span>
                    <span className="seedItemRow__stock">{item.stockText}</span>
                    <span className="seedItemRow__time">{item.updateTime}</span>
                  </div>
                )
              })
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                해당 카테고리에 등록된 품목이 없습니다.
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* 원료 / 완제품 재고 KPI */}
      <KpiGrid
        kpis={seedInventoryKpis}
        selectedLabel={currentSelectedLabel}
        onCardClick={(kpi) => {
          if (loading) return; // 로딩 중 클릭 방지
          if (kpi.label.includes('원료')) setActiveTab('원료');
          else if (kpi.label.includes('완제품')) setActiveTab('완제품');
        }}
      />

      <Panel title="품목별 재고 추이">
        <div className="seedTrendPanel">
          <div className="seedTrendPanel__header">
            <div className="seedCaption">
              선택한 품목의 기간별 현재수량 변화 (현재수량 기준, {selectedItem?.unit || '단위 없음'})
            </div>
            <div className="seedTrendControls">
              <ItemSelect
                groups={itemSelectGroups}
                value={selectedItem?.itemCode || ''}
                onChange={(code) => {
                  const foundIndex = displayedItems.findIndex((i) => i.itemCode === code)
                  if (foundIndex !== -1) setSelectedIndex(foundIndex)
                }}
                disabled={loading}
              />

              <div className="seedTabGroup">
                {(['월별', '분기별', '연도별'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`seedTabButton${trendTab === tab ? ' active' : ''}`}
                    onClick={() => setTrendTab(tab)}
                    disabled={loading}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="seedChartWrapper">
            <div className="seedChartYAxis">
              {yAxisLabels.map((lbl) => (
                <span key={lbl}>{lbl}</span>
              ))}
            </div>

            <div className="seedChartArea">
              {gridlineValues.map((val) => (
                <div
                  key={val}
                  className="seedChartGridline"
                  style={{ bottom: `${(val / trendMax) * 100}%` }}
                />
              ))}

              {currentTrendData.length > 0 ? (
                currentTrendData.map((data, index) => {
                  const heightPercent = Math.min((data.value / trendMax) * 100, 100)
                  const isHovered = hoveredBar === data.label

                  return (
                    <div
                      key={`${data.label}-${index}`}
                      className="seedChartBarCol"
                      onMouseEnter={() => setHoveredBar(data.label)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {/* 마우스 호버 시 노출되는 커스텀 툴팁 UI */}
                      {isHovered && (
                        <div
                          className="seedChartTooltip"
                          style={{ bottom: `calc(${heightPercent}% + 12px)` }}
                        >
                          <div className="seedChartTooltip__title">
                            {data.label}
                          </div>
                          <div className="seedChartTooltip__content">
                            <span className="seedChartTooltip__colorBox" />
                            <span className="seedChartTooltip__value">{data.value.toLocaleString()}</span>
                            <span className="seedChartTooltip__unit">
                              {selectedItem?.unit || ''}
                            </span>
                          </div>
                        </div>
                      )}

                      <div
                        className="seedChartBar"
                        style={{ height: `${heightPercent}%` }}
                      />
                      <span className="seedChartBarLabel">{data.label}</span>
                    </div>
                  )
                })
              ) : (
                <div className="seedChartEmpty">
                  표시할 추이 데이터가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </Panel>
    </section>
  )
}
