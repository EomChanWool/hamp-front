import type { ComponentType, SVGProps } from 'react'
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


// 비밀번호 변경 페이지
import { ChangePasswordPage } from '@pages/auth/ChangePasswordPage'

// 메인페이지
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

const RootRouter = () => {
  const router = createBrowserRouter(routeObj)
  return <RouterProvider router={router} />
}

export default RootRouter

export interface CustomRouteObject extends Omit<RouteObject, 'children'> {
  /** 메뉴 아이콘 */
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  /** 헤더 메뉴에 표출할 이름 */
  name?: string;
  /** 라우트에 대한 설명 */
  description?: string;
  /** 메뉴 식별 키 */
  key?: string;
  /** true이면 인증이 필요한 보호된 페이지 */
  protected?: boolean;
  /** true이면 헤더를 표출 */
  showHeader?: boolean;
  /** 중첩 라우트 (재귀 구조) */
  children?: CustomRouteObject[];
  /** useMatches()로 접근 가능한 페이지 메타 정보 */
  // handle?: HandleMeta;
  /** 탭 UI 존재 여부 */
  hasTabs?: boolean;
  /** 메뉴 ID */
  menuId?: number;
  /** 접근 가능한 역할 목록 (미지정 시 모든 역할 허용) */
  // requiredRoles?: import('@/types/auth').UserRole[];
  /** 접근 가능한 기업 목록 (미지정 시 모든 기업 허용) */
  // requiredCompanies?: import('@/types/auth').Company[];
}

export interface MenuRouteGroup extends Omit<RouteObject, 'children'> {
  title: string
  path: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  items: CustomRouteObject[]
}


/**
 * CustomRouteObject 배열에서 React Router가 인식하지 못하는 커스텀 필드를 제거하고
 * 표준 RouteObject 배열로 변환한다.
 * children이 존재하면 재귀적으로 동일한 처리를 수행한다.
 *
 * @param routes - 커스텀 필드가 포함된 라우트 설정 배열
 * @returns React Router 표준 RouteObject 배열
 */
const stripCustomFields = (routes: CustomRouteObject[]): RouteObject[] => {
  return routes.map(
    ({ icon, name, description, showHeader, hasTabs, key, children, ...rest }) => {
      // 커스텀 필드(name, description, showHeader)를 제외한 나머지만 유지
      const route: RouteObject = {
        ...rest,
      };

      // children이 있으면 재귀적으로 커스텀 필드 제거
      if (children) {
        route.children = stripCustomFields(children);
      }
      // console.log(route)
      return route;
    },
  );
};


/** 사이드 메뉴(대메뉴+소메뉴)와 라우트 element를 함께 관리하는 단일 소스 */
export const menuRoutes: MenuRouteGroup[] = [
  {
    title: '시스템관리',
    path: '/system',
    icon: Cog6ToothIcon,
    items: [
      { path: 'users', name: '사용자관리', element: <SystemUsersPage /> },
      { path: 'auths', name: '사용자 권한관리', element: <SystemUserPermissionsPage /> },
      { path: 'userlog', name: '사용자접속기록', element: <SystemAccessLogsPage /> },
    ],
  },
    {
      title: '시설관리',
      icon: BuildingOffice2Icon,
      path: '/facility',
      items: [
        { path: 'access-manage', name: '출입 관리', element: <FacilityAccessManagePage /> },
        { path: 'access-realtime', name: '출입 실시간 현황', element: <FacilityAccessRealtimePage /> },
        { path: 'access-history', name: '출입 이력 조회', element: <FacilityAccessHistoryPage /> },
        {
          path: 'env-realtime',
          name: '환경 데이터 실시간 현황',
          element: <FacilityEnvironmentRealtimePage />,
        },
        {
          path: 'env-history',
          name: '환경 데이터 이력 조회',
          element: <FacilityEnvironmentHistoryPage />,
        },
        { path: 'cctv', name: 'CCTV 현황', element: <FacilityCctvPage /> },
        { path: 'data-manage', name: '데이터 관리', element: <FacilityDataManagePage /> },
      ],
    },
    {
      title: '기준정보 관리',
      icon: RectangleStackIcon,
      path: '/master',
      items: [
        { path: 'factories', name: '공장관리', element: <MasterFactoriesPage /> },
        { path: 'equipment', name: '장비관리', element: <MasterEquipmentPage /> },
        { path: 'processes', name: '공정관리', element: <MasterProcessesPage /> },
        { path: 'items', name: '품목관리', element: <MasterItemsPage /> },
        { path: 'defects', name: '불량관리', element: <MasterDefectsPage /> },
      ],
    },
    {
      title: '설비관리',
      icon: CpuChipIcon,
       path: '/equipment',
      items: [
        { path: 'list', name: '설비목록', element: <EquipmentListPage /> },
        { path: 'ops-status', name: '설비가동현황', element: <EquipmentOperationStatusPage /> },
        { path: 'ops-history', name: '설비가동이력', element: <EquipmentOperationHistoryPage /> },
        { path: 'alarm-system', name: '설비알림시스템', element: <EquipmentAlarmSystemPage /> },
        { path: 'repair-history', name: '수리이력관리', element: <EquipmentRepairHistoryPage /> },
      ],
    },
    {
      title: '영업관리',
      icon: ClipboardDocumentCheckIcon,
       path: '/sales',
      items: [
        { path: 'order-manage', name: '수주관리', element: <OrderManagePage /> },
        { path: 'delivery-manage', name: '납품관리', element: <DeliveryManagePage /> },
        { path: 'order-status', name: '수주현황', element: <OrderStatusPage /> },
        { path: 'delivery-status', name: '납품현황', element: <DeliveryStatusPage /> },
        { path: 'order-performance', name: '수주실적현황', element: <OrderPerformancePage /> },
      ],
    },
    {
      title: '씨드관리',
      icon: CubeIcon,
       path: '/seed',
      items: [
        { path: 'inv-status', name: '재고현황', element: <SeedInventoryStatusPage /> },
        { path: 'report-return-manage', name: '신고반납관리', element: <SeedReportReturnManagePage /> },
        { path: 'inv-manage', name: '재고관리', element: <SeedInventoryManagePage /> },
      ],
    },
    {
      title: '식품생산관리',
      icon: WrenchScrewdriverIcon,
       path: '/food',
      items: [
        { path: 'work-orders', name: '작업지시관리', element: <FoodWorkOrdersPage /> },
        { path: 'prod-results', name: '생산실적관리', element: <FoodProductionResultsPage /> },
        { path: 'prod-status', name: '생산현황', element: <FoodProductionStatusPage /> },
        { path: 'lot-manage', name: 'LOT관리', element: <FoodLotManagePage /> },
      ],
    },
    {
      title: '식품 품질검사',
      icon: ShieldCheckIcon,
       path: '/food',
      items: [
        { path: 'insp-standards', name: '검사기준서', element: <FoodInspectionStandardsPage /> },
        { path: 'defect-manage', name: '불량관리', element: <FoodDefectManagePage /> },
        { path: 'defect-status', name: '불량현황', element: <FoodDefectStatusPage /> },
      ],
    },
    {
      title: '인피관리',
      icon: CircleStackIcon,
       path: '/inpi',
      items: [
        { path: 'inv-status', name: '재고현황', element: <InpiInventoryStatusPage /> },
        {  path: 'inv-manage', name: '재고관리', element: <InpiInventoryManagePage /> },
      ],
    },
    {
      title: '인피생산관리',
      icon: AdjustmentsHorizontalIcon,
       path: '/inpi',
      items: [
        { path: 'work-orders', name: '작업지시관리', element: <InpiWorkOrdersPage /> },
        { path: 'prod-results', name: '생산실적관리', element: <InpiProductionResultsPage /> },
        { path: 'prod-status', name: '생산현황', element: <InpiProductionStatusPage /> },
        { path: 'lot-manage', name: 'LOT관리', element: <InpiLotManagePage /> },
      ],
    },
    {
      title: '인피품질관리',
      icon: ClipboardDocumentCheckIcon,
       path: '/inpi',
      items: [
        { path: 'insp-standards', name: '검사기준서', element: <InpiInspectionStandardsPage /> },
        { path: 'defect-manage', name: '불량관리', element: <InpiDefectManagePage /> },
        { path: 'defect-status', name: '불량현황', element: <InpiDefectStatusPage /> },
      ],
    },
    {
      title: '출고관리',
      icon: CubeIcon,
       path: '/io',
      items: [
        { path: 'seed-inbound-manage', name: '씨드입고관리', element: <SeedInboundManagePage /> },
        { path: 'seed-outbound-manage', name: '씨드출고관리', element: <SeedOutboundManagePage /> },
        { path: 'inpi-inbound-manage', name: '인피입고관리', element: <InpiInboundManagePage /> },
        { path: 'inpi-outbound-manage', name: '인피출고관리', element: <InpiOutboundManagePage /> },
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
        group.items.map(({ path, element }) => {
          // group.path와 item의 path를 조합하여 슬래시(//) 중복을 방지합니다.
          const fullPath = `${group.path}/${path}`.replace(/\/+/g, '/');
          
          return { 
            path: fullPath,
            element 
          };
        }),
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
    path: '/change-password',
    element: <ChangePasswordPage />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
]