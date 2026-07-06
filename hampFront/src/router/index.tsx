import type { ComponentType, ReactNode, SVGProps } from 'react'
import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router-dom'
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
import { MainLayout } from '@pages/layout/MainLayout'
import { LoginPage } from '@pages/auth/LoginPage'
import { NotFound } from '@pages/error/NotFound'
import type { ScreenKey } from '@/types'

//메인페이지
import { MainDashboardPage } from '@pages/page/dashboard/MainDashboardPage'

// 시스템관리
import { SystemUsersPage } from '@pages/page/system/SystemUsersPage'
import { SystemUserPermissionsPage } from '@pages/page/system/SystemUserPermissionsPage'
import { SystemAccessLogsPage } from '@pages/page/system/SystemAccessLogsPage'

// 시설관리
import { FacilityAccessManagePage } from '@pages/page/facility/FacilityAccessManagePage'
import { FacilityAccessRealtimePage } from '@pages/page/facility/FacilityAccessRealtimePage'
import { FacilityAccessHistoryPage } from '@pages/page/facility/FacilityAccessHistoryPage'
import { FacilityEnvironmentRealtimePage } from '@pages/page/facility/FacilityEnvironmentRealtimePage'
import { FacilityEnvironmentHistoryPage } from '@pages/page/facility/FacilityEnvironmentHistoryPage'
import { FacilityCctvPage } from '@pages/page/facility/FacilityCctvPage'
import { FacilityDataManagePage } from '@pages/page/facility/FacilityDataManagePage'

// 기준정보관리
import { MasterFactoriesPage } from '@pages/page/master/MasterFactoriesPage'
import { MasterEquipmentPage } from '@pages/page/master/MasterEquipmentPage'
import { MasterProcessesPage } from '@pages/page/master/MasterProcessesPage'
import { MasterItemsPage } from '@pages/page/master/MasterItemsPage'
import { MasterDefectsPage } from '@pages/page/master/MasterDefectsPage'

// 설비관리
import { EquipmentListPage } from '@pages/page/equipment/EquipmentListPage'
import { EquipmentOperationStatusPage } from '@pages/page/equipment/EquipmentOperationStatusPage'
import { EquipmentOperationHistoryPage } from '@pages/page/equipment/EquipmentOperationHistoryPage'
import { EquipmentAlarmSystemPage } from '@pages/page/equipment/EquipmentAlarmSystemPage'
import { EquipmentRepairHistoryPage } from '@pages/page/equipment/EquipmentRepairHistoryPage'

// 씨드관리
import { SeedInventoryStatusPage } from '@pages/page/seed/SeedInventoryStatusPage'
import { SeedReportReturnManagePage } from '@pages/page/seed/SeedReportReturnManagePage'
import { SeedInventoryManagePage } from '@pages/page/seed/SeedInventoryManagePage'

//출고관리
import { SeedInboundManagePage } from '@pages/page/ioSeed/SeedInboundManagePage'
import { SeedOutboundManagePage } from '@pages/page/ioSeed/SeedOutboundManagePage'
import { InpiInboundManagePage } from '@pages/page/ioInpi/InpiInboundManagePage'
import { InpiOutboundManagePage } from '@pages/page/ioInpi/InpiOutboundManagePage'

// 식품생산관리 + 식품품질검사
import { FoodWorkOrdersPage } from '@pages/page/food/FoodWorkOrdersPage'
import { FoodProductionResultsPage } from '@pages/page/food/FoodProductionResultsPage'
import { FoodProductionStatusPage } from '@pages/page/food/FoodProductionStatusPage'
import { FoodLotManagePage } from '@pages/page/food/FoodLotManagePage'
import { FoodInspectionStandardsPage } from '@pages/page/food/FoodInspectionStandardsPage'
import { FoodDefectManagePage } from '@pages/page/food/FoodDefectManagePage'
import { FoodDefectStatusPage } from '@pages/page/food/FoodDefectStatusPage'

// 인피관리 + 인피생산관리 + 인피품질관리
import { InpiInventoryStatusPage } from '@pages/page/inpi/InpiInventoryStatusPage'
import { InpiInventoryManagePage } from '@pages/page/inpi/InpiInventoryManagePage'
import { InpiWorkOrdersPage } from '@pages/page/inpi/InpiWorkOrdersPage'
import { InpiProductionResultsPage } from '@pages/page/inpi/InpiProductionResultsPage'
import { InpiProductionStatusPage } from '@pages/page/inpi/InpiProductionStatusPage'
import { InpiLotManagePage } from '@pages/page/inpi/InpiLotManagePage'
import { InpiInspectionStandardsPage } from '@pages/page/inpi/InpiInspectionStandardsPage'
import { InpiDefectManagePage } from '@pages/page/inpi/InpiDefectManagePage'
import { InpiDefectStatusPage } from '@pages/page/inpi/InpiDefectStatusPage'

//영업관리
import { DeliveryManagePage } from '@pages/page/sales/DeliveryManagePage'
import { DeliveryStatusPage } from '@pages/page/sales/DeliveryStatusPage'
import { OrderManagePage } from '@pages/page/sales/OrderManagePage'
import { OrderStatusPage } from '@pages/page/sales/OrderStatusPage'
import { OrderPerformancePage } from '@pages/page/sales/OrderPerformancePage'

export const defaultScreen: ScreenKey = 'dashboard'

export interface MenuRouteItem {
  key: ScreenKey
  label: string
  element: ReactNode
}

export interface MenuRouteGroup {
  title: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  items: MenuRouteItem[]
}

/** 사이드 메뉴(대메뉴+소메뉴)와 라우트 element를 함께 관리하는 단일 소스 */
export const menuRoutes: MenuRouteGroup[] = [
  {
    title: '시스템관리',
    icon: Cog6ToothIcon,
    items: [
      { key: 'systemUsers', label: '사용자관리', element: <SystemUsersPage /> },
      { key: 'systemUserPermissions', label: '사용자 권한관리', element: <SystemUserPermissionsPage /> },
      { key: 'systemAccessLogs', label: '사용자접속기록', element: <SystemAccessLogsPage /> },
    ],
  },
  {
    title: '시설관리',
    icon: BuildingOffice2Icon,
    items: [
      { key: 'facilityAccessManage', label: '출입 관리', element: <FacilityAccessManagePage /> },
      { key: 'facilityAccessRealtime', label: '출입 실시간 현황', element: <FacilityAccessRealtimePage /> },
      { key: 'facilityAccessHistory', label: '출입 이력 조회', element: <FacilityAccessHistoryPage /> },
      {
        key: 'facilityEnvironmentRealtime',
        label: '환경 데이터 실시간 현황',
        element: <FacilityEnvironmentRealtimePage />,
      },
      {
        key: 'facilityEnvironmentHistory',
        label: '환경 데이터 이력 조회',
        element: <FacilityEnvironmentHistoryPage />,
      },
      { key: 'facilityCctv', label: 'CCTV 현황', element: <FacilityCctvPage /> },
      { key: 'facilityDataManage', label: '데이터 관리', element: <FacilityDataManagePage /> },
    ],
  },
  {
    title: '기준정보 관리',
    icon: RectangleStackIcon,
    items: [
      { key: 'masterFactories', label: '공장관리', element: <MasterFactoriesPage /> },
      { key: 'masterEquipment', label: '장비관리', element: <MasterEquipmentPage /> },
      { key: 'masterProcesses', label: '공정관리', element: <MasterProcessesPage /> },
      { key: 'masterItems', label: '품목관리', element: <MasterItemsPage /> },
      { key: 'masterDefects', label: '불량관리', element: <MasterDefectsPage /> },
    ],
  },
  {
    title: '설비관리',
    icon: CpuChipIcon,
    items: [
      { key: 'equipmentList', label: '설비목록', element: <EquipmentListPage /> },
      { key: 'equipmentOperationStatus', label: '설비가동현황', element: <EquipmentOperationStatusPage /> },
      { key: 'equipmentOperationHistory', label: '설비가동이력', element: <EquipmentOperationHistoryPage /> },
      { key: 'equipmentAlarmSystem', label: '설비알림시스템', element: <EquipmentAlarmSystemPage /> },
      { key: 'equipmentRepairHistory', label: '수리이력관리', element: <EquipmentRepairHistoryPage /> },
    ],
  },
  {
    title: '영업관리',
    icon: ClipboardDocumentCheckIcon,
    items: [
      { key: 'orderManage', label: '수주관리', element: <OrderManagePage /> },
      { key: 'deliveryManage', label: '납품관리', element: <DeliveryManagePage /> },
      { key: 'orderStatus', label: '수주현황', element: <OrderStatusPage /> },
      { key: 'deliveryStatus', label: '납품현황', element: <DeliveryStatusPage /> },
      { key: 'orderPerformance', label: '수주실적현황', element: <OrderPerformancePage /> },
    ],
  },
  {
    title: '씨드관리',
    icon: CubeIcon,
    items: [
      { key: 'seedInventoryStatus', label: '재고현황', element: <SeedInventoryStatusPage /> },
      { key: 'seedReportReturnManage', label: '신고반납관리', element: <SeedReportReturnManagePage /> },
      { key: 'seedInventoryManage', label: '재고관리', element: <SeedInventoryManagePage /> },
    ],
  },
  {
    title: '식품생산관리',
    icon: WrenchScrewdriverIcon,
    items: [
      { key: 'foodWorkOrders', label: '작업지시관리', element: <FoodWorkOrdersPage /> },
      { key: 'foodProductionResults', label: '생산실적관리', element: <FoodProductionResultsPage /> },
      { key: 'foodProductionStatus', label: '생산현황', element: <FoodProductionStatusPage /> },
      { key: 'foodLotManage', label: 'LOT관리', element: <FoodLotManagePage /> },
    ],
  },
  {
    title: '식품 품질검사',
    icon: ShieldCheckIcon,
    items: [
      { key: 'foodInspectionStandards', label: '검사기준서', element: <FoodInspectionStandardsPage /> },
      { key: 'foodDefectManage', label: '불량관리', element: <FoodDefectManagePage /> },
      { key: 'foodDefectStatus', label: '불량현황', element: <FoodDefectStatusPage /> },
    ],
  },
  {
    title: '인피관리',
    icon: CircleStackIcon,
    items: [
      { key: 'inpiInventoryStatus', label: '재고현황', element: <InpiInventoryStatusPage /> },
      { key: 'inpiInventoryManage', label: '재고관리', element: <InpiInventoryManagePage /> },
    ],
  },
  {
    title: '인피생산관리',
    icon: AdjustmentsHorizontalIcon,
    items: [
      { key: 'inpiWorkOrders', label: '작업지시관리', element: <InpiWorkOrdersPage /> },
      { key: 'inpiProductionResults', label: '생산실적관리', element: <InpiProductionResultsPage /> },
      { key: 'inpiProductionStatus', label: '생산현황', element: <InpiProductionStatusPage /> },
      { key: 'inpiLotManage', label: 'LOT관리', element: <InpiLotManagePage /> },
    ],
  },
  {
    title: '인피품질관리',
    icon: ClipboardDocumentCheckIcon,
    items: [
      { key: 'inpiInspectionStandards', label: '검사기준서', element: <InpiInspectionStandardsPage /> },
      { key: 'inpiDefectManage', label: '불량관리', element: <InpiDefectManagePage /> },
      { key: 'inpiDefectStatus', label: '불량현황', element: <InpiDefectStatusPage /> },
    ],
  },
  {
    title: '출고관리',
    icon: CubeIcon,
    items: [
      { key: 'seedInboundManage', label: '씨드입고관리', element: <SeedInboundManagePage /> },
      { key: 'seedOutboundManage', label: '씨드출고관리', element: <SeedOutboundManagePage /> },
      { key: 'inpiInboundManage', label: '인피입고관리', element: <InpiInboundManagePage /> },
      { key: 'inpiOutboundManage', label: '인피출고관리', element: <InpiOutboundManagePage /> },
    ],
  },
]

export const routeObj: RouteObject[] = [
  {
    path: '/',
    element: <MainLayout />,
    children: [
      // 메인페이지
      { index: true, element: <MainDashboardPage /> },

      // 대메뉴 안의 소메뉴들을 라우트로 펼침
      ...menuRoutes.flatMap((group) =>
        group.items.map(({ key, element }) => ({ path: key, element })),
      ),

      // 매칭되지 않는 하위 경로는 대시보드로
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
]

const RootRouter = () => {
  const router = createBrowserRouter(routeObj)
  return <RouterProvider router={router} />
}

export default RootRouter
