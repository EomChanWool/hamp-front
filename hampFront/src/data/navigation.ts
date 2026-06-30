import {
  AdjustmentsHorizontalIcon,
  BuildingOffice2Icon,
  CircleStackIcon,
  ClipboardDocumentCheckIcon,
  Cog6ToothIcon,
  CpuChipIcon,
  CubeIcon,
  RectangleStackIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import type { MenuGroup, ScreenKey } from '../types'

export const menuGroups: MenuGroup[] = [
  {
    title: '시스템관리',
    icon: Cog6ToothIcon,
    items: [
      { key: 'systemUsers', label: '사용자관리' },
      { key: 'systemUserPermissions', label: '사용자 권한관리' },
      { key: 'systemAccessLogs', label: '사용자접속기록' },
    ],
  },
  {
    title: '시설관리',
    icon: BuildingOffice2Icon,
    items: [
      { key: 'facilityAccessManage', label: '출입 관리' },
      { key: 'facilityAccessRealtime', label: '출입 실시간 현황' },
      { key: 'facilityAccessHistory', label: '출입 이력 조회' },
      { key: 'facilityEnvironmentRealtime', label: '환경 데이터 실시간 현황' },
      { key: 'facilityEnvironmentHistory', label: '환경 데이터 이력 조회' },
      { key: 'facilityCctv', label: 'CCTV 현황' },
      { key: 'facilityDataManage', label: '데이터 관리' },
    ],
  },
  {
    title: '기준정보 관리',
    icon: RectangleStackIcon,
    items: [
      { key: 'masterFactories', label: '공장관리' },
      { key: 'masterEquipment', label: '장비관리' },
      { key: 'masterProcesses', label: '공정관리' },
      { key: 'masterItems', label: '품목관리' },
      { key: 'masterDefects', label: '불량관리' },
    ],
  },
  {
    title: '설비관리',
    icon: CpuChipIcon,
    items: [
      { key: 'equipmentList', label: '설비목록' },
      { key: 'equipmentOperationStatus', label: '설비가동현황' },
      { key: 'equipmentOperationHistory', label: '설비가동이력' },
      { key: 'equipmentAlarmSystem', label: '설비알림시스템' },
      { key: 'equipmentRepairHistory', label: '수리이력관리' },
    ],
  },
  {
    title: '씨드관리',
    icon: CubeIcon,
    items: [
      { key: 'seedInventoryStatus', label: '재고현황' },
      { key: 'seedReportReturnManage', label: '신고반납관리' },
      { key: 'seedInventoryManage', label: '재고관리' },
    ],
  },
  {
    title: '식품생산관리',
    icon: WrenchScrewdriverIcon,
    items: [
      { key: 'foodWorkOrders', label: '작업지시관리' },
      { key: 'foodProductionResults', label: '생산실적관리' },
      { key: 'foodProductionStatus', label: '생산현황' },
      { key: 'foodLotManage', label: 'LOT관리' },
    ],
  },
  {
    title: '식품 품질검사',
    icon: ShieldCheckIcon,
    items: [
      { key: 'foodInspectionStandards', label: '검사기준서' },
      { key: 'foodDefectManage', label: '불량관리' },
      { key: 'foodDefectStatus', label: '불량현황' },
    ],
  },
  {
    title: '인피관리',
    icon: CircleStackIcon,
    items: [
      { key: 'inpiInventoryStatus', label: '재고현황' },
      { key: 'inpiInventoryManage', label: '재고관리' },
    ],
  },
  {
    title: '인피생산관리',
    icon: AdjustmentsHorizontalIcon,
    items: [
      { key: 'inpiWorkOrders', label: '작업지시관리' },
      { key: 'inpiProductionResults', label: '생산실적관리' },
      { key: 'inpiProductionStatus', label: '생산현황' },
      { key: 'inpiLotManage', label: 'LOT관리' },
    ],
  },
  {
    title: '인피품질관리',
    icon: ClipboardDocumentCheckIcon,
    items: [
      { key: 'inpiInspectionStandards', label: '검사기준서' },
      { key: 'inpiDefectManage', label: '불량관리' },
      { key: 'inpiDefectStatus', label: '불량현황' },
    ],
  },
]

export const defaultScreen: ScreenKey = 'systemUsers'

export const screenTitles: Record<ScreenKey, string> = {
  dashboard: '메인 대시보드',
  ...Object.fromEntries(
    menuGroups.flatMap((group) => group.items.map((item) => [item.key, item.label])),
  ),
} as Record<ScreenKey, string>
