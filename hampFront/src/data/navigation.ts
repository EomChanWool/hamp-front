import type { MenuGroup, ScreenKey } from '../types'

export const menuGroups: MenuGroup[] = [
  {
    title: '대시보드',
    items: [{ key: 'dashboard', label: '메인' }],
  },
  {
    title: '시스템 관리',
    items: [
      { key: 'systemAdmins', label: '관리자 관리' },
      { key: 'systemUserPermissions', label: '사용자 권한 관리' },
      { key: 'systemGroupPermissions', label: '그룹 권한 관리' },
      { key: 'systemMenuPermissions', label: '메뉴 접근 권한 관리' },
      { key: 'systemMenus', label: '메뉴 관리' },
      { key: 'systemCodes', label: '시스템 코드 관리' },
    ],
  },
  {
    title: '시설 관리',
    items: [
      { key: 'facilityAccessRealtime', label: '출입 실시간 현황' },
      { key: 'facilityAccessHistory', label: '출입 이력 조회' },
      { key: 'facilityEnvironmentRealtime', label: '환경 실시간 현황' },
      { key: 'facilityEnvironmentHistory', label: '환경 이력 조회' },
      { key: 'facilityCctv', label: 'CCTV 현황' },
      { key: 'facilityDataPermissions', label: '데이터 권한 관리' },
    ],
  },
  {
    title: '장비 관리',
    items: [
      { key: 'equipmentInfo', label: '장비 정보 관리' },
      { key: 'equipmentStatus', label: '설비 가동 현황' },
      { key: 'equipmentOperationRate', label: '장비 가동률 분석' },
      { key: 'equipmentMaintenance', label: '장애·수리 이력 관리' },
      { key: 'equipmentAlerts', label: '설비/장비 이상 알림' },
    ],
  },
  {
    title: '기준정보 관리',
    items: [
      { key: 'masterWorkplaces', label: '사업장 관리' },
      { key: 'masterFactories', label: '공장 관리' },
      { key: 'masterDepartments', label: '부서코드 관리' },
      { key: 'masterClients', label: '거래처 관리' },
      { key: 'masterItems', label: '품목 관리' },
      { key: 'masterWarehouses', label: '창고 관리' },
      { key: 'masterBom', label: 'BOM 관리' },
    ],
  },
  {
    title: '영업 관리',
    items: [
      { key: 'salesOrders', label: '수주 관리' },
      { key: 'salesOrderBacklog', label: '수주 미납 현황' },
      { key: 'salesOrderMonthly', label: '수주 월별 집계' },
      { key: 'salesDeliveries', label: '납품 관리' },
      { key: 'salesPerformance', label: '수주 대비 실적 현황' },
    ],
  },
  {
    title: '생산 관리',
    items: [
      { key: 'productionWorkOrders', label: '작업지시 관리' },
      { key: 'productionResults', label: '생산실적 관리' },
      { key: 'productionResultStatus', label: '생산실적 현황' },
    ],
  },
  {
    title: '자재 관리',
    items: [
      { key: 'materialReceipts', label: '입고 관리' },
      { key: 'materialShipments', label: '출고 관리' },
      { key: 'materialIssues', label: '불출 관리' },
      { key: 'materialReturns', label: '환입 관리' },
      { key: 'materialStocks', label: '재고 현황' },
      { key: 'materialStockAdjustments', label: '재고 조정 관리' },
    ],
  },
  {
    title: '품질 관리',
    items: [
      { key: 'qualityInspectionStandards', label: '검사기준서 관리' },
      { key: 'qualityWorkStandards', label: '작업표준서 관리' },
      { key: 'qualityInspections', label: '검사 관리' },
      { key: 'qualityInspectionChanges', label: '유무검사 변경 관리' },
      { key: 'qualityDefects', label: '부적합 관리' },
      { key: 'qualityDefectTrends', label: '부적합 추이 현황' },
    ],
  },
  {
    title: '데이터 관리',
    items: [
      { key: 'dataList', label: '데이터 목록 조회' },
      { key: 'dataProcess', label: '데이터 처리 관리' },
      { key: 'dataVisualization', label: '데이터 시각화' },
    ],
  },
  {
    title: '메시지 관리',
    items: [
      { key: 'messageSend', label: '문자 발송' },
      { key: 'messageHistory', label: '문자 발송 이력' },
    ],
  },
]

export const screenTitles: Record<ScreenKey, string> = Object.fromEntries(
  menuGroups.flatMap((group) => group.items.map((item) => [item.key, item.label])),
) as Record<ScreenKey, string>
