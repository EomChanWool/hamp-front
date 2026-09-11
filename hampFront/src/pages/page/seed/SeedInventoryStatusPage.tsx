import { useState, useEffect, useMemo } from 'react'
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

export function SeedInventoryStatusPage() {
  const [activeTab, setActiveTab] = useState<'전체' | '원료' | '반제품' | '완제품'>('전체')
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [trendTab, setTrendTab] = useState<'월별' | '분기별' | '연도별'>('월별')

  // API 연동 상태
  const [items, setItems] = useState<SeedInventoryStatusRow[]>([])
  const [summaryData, setSummaryData] = useState<ItemStockSummaryResponse | null>(null)
  const [apiTrendData, setApiTrendData] = useState<ItemStockTrendResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // 1. 탭(activeTab)이 변경될 때마다 품목 리스트와 요약 정보 조회 API 호출
  useEffect(() => {
    const fetchListAndSummary = async () => {
      try {
        setLoading(true)

        // 탭에 따라 category 파라미터 매핑 (전체: undefined, 원료: 0, 반제품: 1, 완제품: 2)
        const categoryParam = 
          activeTab === '원료' ? 0 : 
          activeTab === '반제품' ? 1 : 
          activeTab === '완제품' ? 2 : undefined

        const [listRes, summaryRes] = await Promise.all([
          ItemStockApi.getList(categoryParam !== undefined ? { category: categoryParam } : undefined),
          ItemStockApi.getSummary(),
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

    fetchListAndSummary()
  }, [activeTab])

  // 품목 목록
  const displayedItems = items

  const selectedItem = displayedItems[selectedIndex] || displayedItems[0] || items[0]

  // 2. 선택된 품목 또는 추이 탭이 변경될 때마다 추이 데이터 API 호출
  useEffect(() => {
    if (!selectedItem) return

    const fetchTrend = async () => {
      try {
        const periodParam = trendTab === '월별' ? 'month' : trendTab === '분기별' ? 'quarter' : 'year'
        const res = await ItemStockApi.getTrend(selectedItem.itemCode, { period: periodParam })
        if (res && res.data) {
          setApiTrendData(res.data)
        }
      } catch (error) {
        console.error('재고 추이 데이터 조회 실패:', error)
        setApiTrendData(null)
      }
    }

    fetchTrend()
  }, [selectedItem, trendTab])

  const maxStock = useMemo(() => {
    if (items.length === 0) return 1000
    return Math.max(...items.map((i) => i.currentStock), 1000)
  }, [items])

  const currentTrendData = useMemo(() => {
    if (apiTrendData && apiTrendData.points && apiTrendData.points.length > 0) {
      return apiTrendData.points.map((p) => ({
        label: p.periodStart,
        value: p.qty,
      }))
    }
    return []
  }, [apiTrendData])

  const yAxisLabels = ['9,00', '8,00', '7,00', '6,00', '5,00', '4,00', '3,00', '2,00', '1,00', '0']

  const getCategorySummaryValues = (catCode: number) => {
    if (summaryData && summaryData.categories) {
      const found = summaryData.categories.find((c) => c.category === catCode)
      if (found) {
        return {
          currentQty: found.currentQty.toLocaleString(),
          todayIncrease: `${found.todayIncreaseQty} kg`,
          todayDecrease: `${found.todayDecreaseQty} kg`,
        }
      }
    }
    return { currentQty: '0', todayIncrease: '0 kg', todayDecrease: '0 kg' }
  }

  const rawSummary = getCategorySummaryValues(0)
  const semiSummary = getCategorySummaryValues(1)
  const finSummary = getCategorySummaryValues(2)

  const seedInventoryKpis: KpiItem[] = [
    {
      label: '원료 재고',
      value: '',
      tone: (activeTab === '원료' ? 'success' : 'default') as any,
      render: () => (
        <div
          onClick={() => {
            setActiveTab('원료')
            setSelectedIndex(0)
          }}
          style={{ cursor: 'pointer', width: '100%', height: '100%' }}
        >
          <div className="inventorySummaryCard">
            <div>
              <div className="inventorySummaryCard__header">원료 재고</div>
              <div className="inventorySummaryCard__valueArea">
                <span>{rawSummary.currentQty}</span>
                <span className="inventorySummaryCard__unit">kg</span>
              </div>
            </div>
            <div>
              <div className="inventorySummaryCard__divider" />
              <div className="inventorySummaryCard__footer">
                <div className="inventorySummaryCard__row">
                  <span>▲ 금일 입고</span>
                  <span className="inventorySummaryCard__inbound">{rawSummary.todayIncrease}</span>
                </div>
                <div className="inventorySummaryCard__row">
                  <span>▼ 금일 출고</span>
                  <span className="inventorySummaryCard__outbound">{rawSummary.todayDecrease}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      label: '반제품 재고',
      value: '',
      tone: (activeTab === '반제품' ? 'success' : 'default') as any,
      render: () => (
        <div
          onClick={() => {
            setActiveTab('반제품')
            setSelectedIndex(0)
          }}
          style={{ cursor: 'pointer', width: '100%', height: '100%' }}
        >
          <div className="inventorySummaryCard">
            <div>
              <div className="inventorySummaryCard__header">반제품 재고</div>
              <div className="inventorySummaryCard__valueArea">
                <span>{semiSummary.currentQty}</span>
                <span className="inventorySummaryCard__unit">kg</span>
              </div>
            </div>
            <div>
              <div className="inventorySummaryCard__divider" />
              <div className="inventorySummaryCard__footer">
                <div className="inventorySummaryCard__row">
                  <span>▲ 금일 입고</span>
                  <span className="inventorySummaryCard__inbound">{semiSummary.todayIncrease}</span>
                </div>
                <div className="inventorySummaryCard__row">
                  <span>▼ 금일 출고</span>
                  <span className="inventorySummaryCard__outbound">{semiSummary.todayDecrease}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      label: '완제품 재고',
      value: '',
      tone: (activeTab === '완제품' ? 'success' : 'default') as any,
      render: () => (
        <div
          onClick={() => {
            setActiveTab('완제품')
            setSelectedIndex(0)
          }}
          style={{ cursor: 'pointer', width: '100%', height: '100%' }}
        >
          <div className="inventorySummaryCard">
            <div>
              <div className="inventorySummaryCard__header">완제품 재고</div>
              <div className="inventorySummaryCard__valueArea">
                <span>{finSummary.currentQty}</span>
                <span className="inventorySummaryCard__unit">kg</span>
              </div>
            </div>
            <div>
              <div className="inventorySummaryCard__divider" />
              <div className="inventorySummaryCard__footer">
                <div className="inventorySummaryCard__row">
                  <span>▲ 금일 입고</span>
                  <span className="inventorySummaryCard__inbound">{finSummary.todayIncrease}</span>
                </div>
                <div className="inventorySummaryCard__row">
                  <span>▼ 금일 출고</span>
                  <span className="inventorySummaryCard__outbound">{finSummary.todayDecrease}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ]

  if (loading && items.length === 0) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>재고 현황 데이터를 불러오는 중입니다...</div>
  }

  return (
    <section className="screenStack">
      <KpiGrid kpis={seedInventoryKpis} />

      <Panel title="품목별 현재 재고">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              품목별 현재 재고 현황 · 재고 많은 순 (클릭하면 아래 추이 그래프로 이동)
            </div>
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
              {(['전체', '원료', '반제품', '완제품'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab)
                    setSelectedIndex(0)
                  }}
                  style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    background: activeTab === tab ? '#ffffff' : 'transparent',
                    color: activeTab === tab ? '#0f172a' : '#64748b',
                    boxShadow: activeTab === tab ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {displayedItems.map((item, index) => {
              const percentage = (item.currentStock / maxStock) * 100
              const isSelected = selectedIndex === index

              return (
                <div
                  key={item.itemCode}
                  onClick={() => setSelectedIndex(index)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid #d97706' : '1px solid #e2e8f0',
                    background: isSelected ? '#fffbeb' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <span style={{ color: '#64748b', fontWeight: 500 }}>{item.itemCode}</span>
                      <span style={{ color: '#cbd5e1' }}>·</span>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>{item.category}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>{item.stockText}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', minWidth: '140px' }}>
                      {item.itemName}
                    </div>
                    <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: '100%',
                          background: '#9a3412',
                          borderRadius: '4px',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', minWidth: '110px', textAlign: 'right' }}>
                      {item.updateTime}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Panel>

      <Panel title="품목별 재고 추이">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              선택한 품목의 기간별 현재수량 변화 (현재수량 기준, kg)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={selectedItem?.itemCode || ''}
                onChange={(e) => {
                  const foundIndex = displayedItems.findIndex((i) => i.itemCode === e.target.value)
                  if (foundIndex !== -1) setSelectedIndex(foundIndex)
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  cursor: 'pointer',
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

              <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
                {(['월별', '분기별', '연도별'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setTrendTab(tab)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      background: trendTab === tab ? '#ffffff' : 'transparent',
                      color: trendTab === tab ? '#0f172a' : '#64748b',
                      boxShadow: trendTab === tab ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', paddingBottom: '24px', textAlign: 'right', minWidth: '35px' }}>
              {yAxisLabels.map((lbl) => (
                <span key={lbl}>{lbl}</span>
              ))}
            </div>

            <div style={{ flex: 1, position: 'relative', height: '220px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: '24px', borderBottom: '1px solid #cbd5e1', borderLeft: '1px solid #cbd5e1', paddingLeft: '8px' }}>
              {[0, 100, 200, 300, 400, 500, 600, 700, 800].map((val) => (
                <div
                  key={val}
                  style={{
                    position: 'absolute',
                    left: '8px',
                    right: 0,
                    bottom: `${(val / 900) * 100}%`,
                    borderTop: '1px solid #f1f5f9',
                    pointerEvents: 'none',
                  }}
                />
              ))}

              {currentTrendData.length > 0 ? (
                currentTrendData.map((data) => {
                  const heightPercent = Math.min((data.value / 900) * 100, 100)
                  return (
                    <div key={data.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', zIndex: 1, position: 'relative' }}>
                      <div
                        style={{
                          width: '60%',
                          maxWidth: '28px',
                          height: `${heightPercent}%`,
                          background: '#9a3412',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s ease',
                        }}
                      />
                      <span style={{ position: 'absolute', bottom: '-22px', fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {data.label}
                      </span>
                    </div>
                  )
                })
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
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