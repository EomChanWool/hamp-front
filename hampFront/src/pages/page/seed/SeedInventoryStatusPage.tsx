import { useState, useEffect, useMemo } from 'react'
import { CubeIcon, BeakerIcon, ArchiveBoxIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid'
import { KpiGrid, type KpiItem } from '@components/kpi/KpiGrid'
import { Panel } from '@components/card/Panel'
import { formatDateTime } from "@/utils/common";
import { ItemStockApi, type ItemStockResponse, type ItemStockTrendResponse, type ItemStockSummaryResponse } from '@/api/seed/ItemStock' 
import '@pages/page/seed/Seed.css'

interface SeedInventoryStatusRow {
  itemCode: string
  itemName: string
  category: '원료' | '반제품' | '완제품'
  currentStock: number
  stockText: string
  updateTime: string
}

// 카테고리 → CSS modifier 클래스 매핑 (raw / semi / finished)
const CATEGORY_CLASS_MAP: Record<SeedInventoryStatusRow['category'], 'raw' | 'semi' | 'finished'> = {
  '원료': 'raw',
  '반제품': 'semi',
  '완제품': 'finished',
}

// 카테고리 → Heroicons 아이콘 매핑
const CATEGORY_ICON_MAP: Record<SeedInventoryStatusRow['category'], typeof CubeIcon> = {
  '원료': CubeIcon,
  '반제품': BeakerIcon,
  '완제품': ArchiveBoxIcon,
}

export function SeedInventoryStatusPage() {
  const [activeTab, setActiveTab] = useState<'전체' | '원료' | '반제품' | '완제품'>('전체')
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [trendTab, setTrendTab] = useState<'월별' | '분기별' | '연도별'>('월별')

  // API 연동 상태
  const [items, setItems] = useState<SeedInventoryStatusRow[]>([])
  const [summaryData, setSummaryData] = useState<ItemStockSummaryResponse | null>(null)
  const [apiTrendData, setApiTrendData] = useState<ItemStockTrendResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // 탭 문자열을 백엔드 category 코드(number)로 변환하는 매핑
  const tabToCategoryMap: Record<'전체' | '원료' | '반제품' | '완제품', number | undefined> = {
    '전체': undefined,
    '원료': 0,
    '반제품': 1,
    '완제품': 2,
  }

  // 1. 탭(`activeTab`)이 변경될 때마다 백엔드 API를 호출하여 해당 품목 리스트 및 요약 정보 조회
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const currentCategory = tabToCategoryMap[activeTab]

        const [listRes, summaryRes] = await Promise.all([
          ItemStockApi.getList({ 
            productType: 0, 
            ...(currentCategory !== undefined && { category: currentCategory }) 
          }),
          ItemStockApi.getSummary({ productType: 0 }),
        ])

        if (listRes && listRes.data) {
          const mappedItems: SeedInventoryStatusRow[] = listRes.data.map((item: ItemStockResponse) => {
            const categoryMap: Record<number, '원료' | '반제품' | '완제품'> = { 0: '원료', 1: '반제품', 2: '완제품' }
            const catStr = categoryMap[item.category] || '원료'

            return {
              itemCode: item.itemCode,
              itemName: item.itemNm,
              category: catStr,
              currentStock: item.currentQty,
              stockText: `${item.currentQty.toLocaleString()} ${item.unit}`,
              updateTime: formatDateTime(item.lastUpdatedAt),
            }
          })
          setItems(mappedItems)
        }

        if (summaryRes && summaryRes.data) {
          setSummaryData(summaryRes.data)
        }
      } catch (error) {
        console.error('재고 데이터 조회 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [activeTab])

  // 탭이 변경될 때 선택된 인덱스 초기화
  useEffect(() => {
    setSelectedIndex(0)
  }, [activeTab])

  // 이미 백엔드에서 카테고리별로 필터링되어 오므로 그대로 사용
  const displayedItems = items

  // 탭 변경이나 리스트 갱신 시 현재 탭에 속하는 아이템만 안전하게 선택
  const selectedItem = useMemo(() => {
    if (displayedItems.length === 0) return null
    return displayedItems[selectedIndex] || displayedItems[0]
  }, [displayedItems, selectedIndex])

  useEffect(() => {
    if (!selectedItem) {
      setApiTrendData(null)
      return
    }

    const fetchTrend = async () => {
      try {
        const periodParam = trendTab === '월별' ? 'month' : trendTab === '분기별' ? 'quarter' : 'year'
        const res = await ItemStockApi.getTrend(selectedItem.itemCode, { 
          period: periodParam, 
          productType: 0 
        })
        if (res && res.data) {
          setApiTrendData(res.data)
        } else {
          setApiTrendData(null)
        }
      } catch (error) {
        console.error('재고 추이 데이터 조회 실패:', error)
        setApiTrendData(null)
      }
    }

    fetchTrend()
  }, [selectedItem, trendTab])

  const currentTrendData = useMemo(() => {
    if (apiTrendData && apiTrendData.points && apiTrendData.points.length > 0) {
      return apiTrendData.points.map((p) => ({
        label: p.periodStart,
        value: p.qty,
      }))
    }
    return []
  }, [apiTrendData])

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
  const semiSummary = getCategorySummaryValues(1)
  const finSummary = getCategorySummaryValues(2)

  // KPI 카드 콘텐츠 렌더 헬퍼 (뱃지 아이콘 + 라벨 + 값 + 입출고 요약)
  const renderSummaryCard = (
    category: SeedInventoryStatusRow['category'],
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
      label: '반제품 재고',
      value: '',
      tone: 'muted',
      render: () => renderSummaryCard('반제품', semiSummary),
    },
    {
      label: '완제품 재고',
      value: '',
      tone: 'muted',
      render: () => renderSummaryCard('완제품', finSummary),
    },
  ]

  if (loading && items.length === 0) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>재고 현황 데이터를 불러오는 중입니다...</div>
  }

  // activeTab 상태에 따라 KpiGrid에 매칭될 선택된 라벨 결정 ('전체'일 때는 선택 해제)
  const currentSelectedLabel = 
    activeTab === '원료' ? '원료 재고' :
    activeTab === '반제품' ? '반제품 재고' :
    activeTab === '완제품' ? '완제품 재고' : undefined;

  return (
    <section className="screenStack">
      {/* 품목별 현재 재고 패널 — 위로 이동, 탭버튼을 타이틀과 같은 줄 우측에 배치 */}
      <Panel
        title={
          <div className="seedStatusPanel__titleRow">
            <span>품목별 현재 재고</span>
            <div className="seedTabGroup">
              {(['전체', '원료', '반제품', '완제품'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`seedTabButton${activeTab === tab ? ' active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab)
                  }}
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
                    className={`seedItemRow${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelectedIndex(index)}
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

      {/* 원료 / 반제품 / 완제품 재고 KPI — 아래로 이동 */}
      <KpiGrid 
        kpis={seedInventoryKpis} 
        selectedLabel={currentSelectedLabel}
        onCardClick={(kpi) => {
          if (kpi.label.includes('원료')) setActiveTab('원료');
          else if (kpi.label.includes('반제품')) setActiveTab('반제품');
          else if (kpi.label.includes('완제품')) setActiveTab('완제품');
        }}
      />

      <Panel title="품목별 재고 추이">
        <div className="seedTrendPanel">
          <div className="seedTrendPanel__header">
            <div className="seedCaption">
              선택한 품목의 기간별 현재수량 변화 (현재수량 기준, kg)
            </div>
            <div className="seedTrendControls">
              <select
                className="seedSelect"
                value={selectedItem?.itemCode || ''}
                onChange={(e) => {
                  const foundIndex = displayedItems.findIndex((i) => i.itemCode === e.target.value)
                  if (foundIndex !== -1) setSelectedIndex(foundIndex)
                }}
              >
                {(['원료', '반제품', '완제품'] as const).map((categoryName) => {
                  const categoryItems = displayedItems.filter((item) => item.category === categoryName)
                  if (categoryItems.length === 0) return null

                  return (
                    <optgroup key={categoryName} label={`[ ${categoryName} ]`}>
                      {categoryItems.map((item) => (
                        <option key={item.itemCode} value={item.itemCode}>
                          {item.itemCode} · {item.itemName}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>

              <div className="seedTabGroup">
                {(['월별', '분기별', '연도별'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`seedTabButton${trendTab === tab ? ' active' : ''}`}
                    onClick={() => setTrendTab(tab)}
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
                currentTrendData.map((data) => {
                  const heightPercent = Math.min((data.value / trendMax) * 100, 100)
                  return (
                    <div key={data.label} className="seedChartBarCol">
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