import type { ScreenKey } from '../types'

// 시스템관리
import { SystemUsersPage } from './system/SystemUsersPage'
import { SystemUserPermissionsPage } from './system/SystemUserPermissionsPage'
import { SystemAccessLogsPage } from './system/SystemAccessLogsPage'

// 시설관리
import { FacilityAccessManagePage } from './facility/FacilityAccessManagePage'
import { FacilityAccessRealtimePage } from './facility/FacilityAccessRealtimePage'
import { FacilityAccessHistoryPage } from './facility/FacilityAccessHistoryPage'
import { FacilityEnvironmentRealtimePage } from './facility/FacilityEnvironmentRealtimePage'
import { FacilityEnvironmentHistoryPage } from './facility/FacilityEnvironmentHistoryPage'
import { FacilityCctvPage } from './facility/FacilityCctvPage'
import { FacilityDataManagePage } from './facility/FacilityDataManagePage'

// 기준정보관리
import { MasterFactoriesPage } from './master/MasterFactoriesPage'
import { MasterEquipmentPage } from './master/MasterEquipmentPage'
import { MasterProcessesPage } from './master/MasterProcessesPage'
import { MasterItemsPage } from './master/MasterItemsPage'
import { MasterDefectsPage } from './master/MasterDefectsPage'

// 설비관리
import { EquipmentListPage } from './equipment/EquipmentListPage'
import { EquipmentOperationStatusPage } from './equipment/EquipmentOperationStatusPage'
import { EquipmentOperationHistoryPage } from './equipment/EquipmentOperationHistoryPage'
import { EquipmentAlarmSystemPage } from './equipment/EquipmentAlarmSystemPage'
import { EquipmentRepairHistoryPage } from './equipment/EquipmentRepairHistoryPage'

// 씨드관리
import { SeedInventoryStatusPage } from './seed/SeedInventoryStatusPage'
import { SeedReportReturnManagePage } from './seed/SeedReportReturnManagePage'
import { SeedInventoryManagePage } from './seed/SeedInventoryManagePage'

// 식품생산관리 + 식품품질검사
import { FoodWorkOrdersPage } from './food/FoodWorkOrdersPage'
import { FoodProductionResultsPage } from './food/FoodProductionResultsPage'
import { FoodProductionStatusPage } from './food/FoodProductionStatusPage'
import { FoodLotManagePage } from './food/FoodLotManagePage'
import { FoodInspectionStandardsPage } from './food/FoodInspectionStandardsPage'
import { FoodDefectManagePage } from './food/FoodDefectManagePage'
import { FoodDefectStatusPage } from './food/FoodDefectStatusPage'

// 인피관리 + 인피생산관리 + 인피품질관리
import { InpiInventoryStatusPage } from './inpi/InpiInventoryStatusPage'
import { InpiInventoryManagePage } from './inpi/InpiInventoryManagePage'
import { InpiWorkOrdersPage } from './inpi/InpiWorkOrdersPage'
import { InpiProductionResultsPage } from './inpi/InpiProductionResultsPage'
import { InpiProductionStatusPage } from './inpi/InpiProductionStatusPage'
import { InpiLotManagePage } from './inpi/InpiLotManagePage'
import { InpiInspectionStandardsPage } from './inpi/InpiInspectionStandardsPage'
import { InpiDefectManagePage } from './inpi/InpiDefectManagePage'
import { InpiDefectStatusPage } from './inpi/InpiDefectStatusPage'

type Props = {
  activeScreen: ScreenKey
  setActiveScreen: (key: ScreenKey) => void
}

export function PageRenderer({ activeScreen }: Props) {
  switch (activeScreen) {
    // 시스템관리
    case 'systemUsers':              return <SystemUsersPage />
    case 'systemUserPermissions':    return <SystemUserPermissionsPage />
    case 'systemAccessLogs':         return <SystemAccessLogsPage />

    // 시설관리
    case 'facilityAccessManage':          return <FacilityAccessManagePage />
    case 'facilityAccessRealtime':        return <FacilityAccessRealtimePage />
    case 'facilityAccessHistory':         return <FacilityAccessHistoryPage />
    case 'facilityEnvironmentRealtime':   return <FacilityEnvironmentRealtimePage />
    case 'facilityEnvironmentHistory':    return <FacilityEnvironmentHistoryPage />
    case 'facilityCctv':                  return <FacilityCctvPage />
    case 'facilityDataManage':            return <FacilityDataManagePage />

    // 기준정보관리
    case 'masterFactories':  return <MasterFactoriesPage />
    case 'masterEquipment':  return <MasterEquipmentPage />
    case 'masterProcesses':  return <MasterProcessesPage />
    case 'masterItems':      return <MasterItemsPage />
    case 'masterDefects':    return <MasterDefectsPage />

    // 설비관리
    case 'equipmentList':              return <EquipmentListPage />
    case 'equipmentOperationStatus':   return <EquipmentOperationStatusPage />
    case 'equipmentOperationHistory':  return <EquipmentOperationHistoryPage />
    case 'equipmentAlarmSystem':       return <EquipmentAlarmSystemPage />
    case 'equipmentRepairHistory':     return <EquipmentRepairHistoryPage />

    // 씨드관리
    case 'seedInventoryStatus':      return <SeedInventoryStatusPage />
    case 'seedReportReturnManage':   return <SeedReportReturnManagePage />
    case 'seedInventoryManage':      return <SeedInventoryManagePage />

    // 식품생산관리 + 식품품질검사
    case 'foodWorkOrders':            return <FoodWorkOrdersPage />
    case 'foodProductionResults':     return <FoodProductionResultsPage />
    case 'foodProductionStatus':      return <FoodProductionStatusPage />
    case 'foodLotManage':             return <FoodLotManagePage />
    case 'foodInspectionStandards':   return <FoodInspectionStandardsPage />
    case 'foodDefectManage':          return <FoodDefectManagePage />
    case 'foodDefectStatus':          return <FoodDefectStatusPage />

    // 인피관리 + 인피생산관리 + 인피품질관리
    case 'inpiInventoryStatus':       return <InpiInventoryStatusPage />
    case 'inpiInventoryManage':       return <InpiInventoryManagePage />
    case 'inpiWorkOrders':            return <InpiWorkOrdersPage />
    case 'inpiProductionResults':     return <InpiProductionResultsPage />
    case 'inpiProductionStatus':      return <InpiProductionStatusPage />
    case 'inpiLotManage':             return <InpiLotManagePage />
    case 'inpiInspectionStandards':   return <InpiInspectionStandardsPage />
    case 'inpiDefectManage':          return <InpiDefectManagePage />
    case 'inpiDefectStatus':          return <InpiDefectStatusPage />

    default:
      return null
  }
}
