import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'

type ProductionCategoryPageProps = {
  title: string
  filters: string[]
  rows: string[]
}

function ProductionCategoryPage({ title, filters, rows }: ProductionCategoryPageProps) {
  return (
    <ManagementScreen
      title={title}
      filters={filters}
      primary="등록/수정/삭제"
      table={{
        headers: ['관리 항목', '주요 기능', '상태', '처리'],
        rows: rows.map((row) => [
          row.replace(' (등록/수정/삭제)', ''),
          row.includes('현황') || row.includes('조회') ? '조회' : '등록/수정/삭제',
          <Badge tone={row.includes('현황') || row.includes('조회') ? 'info' : 'good'}>관리</Badge>,
          row.includes('현황') || row.includes('조회') ? '조회' : '관리',
        ]),
      }}
    />
  )
}

export function ProductionStandardManagementPage() {
  return (
    <ProductionCategoryPage
      title="기준정보관리"
      filters={['사업장', '공장', '품목', '공정']}
      rows={[
        '사업장정보관리 (등록/수정/삭제)',
        '공장관리 (등록/수정/삭제)',
        '부서코드관리 (등록/수정/삭제)',
        '거래처코드관리 (등록/수정/삭제)',
        '품목코드관리 (등록/수정/삭제)',
        '창고관리 (등록/수정/삭제)',
        'BOM관리 (등록/수정/삭제)',
      ]}
    />
  )
}

export function SalesManagementPage() {
  return (
    <ProductionCategoryPage
      title="영업관리"
      filters={['수주', '납품', '수주자재', '기간']}
      rows={[
        '수주관리 (등록/수정/삭제)',
        '납품관리 (등록/수정/삭제)',
        '수주현황조회',
        '수주미납현황조회',
        '수주열지제조회',
        '납품현황조회',
        '수주대실적현황',
      ]}
    />
  )
}

export function ProductionOperationsManagementPage() {
  return (
    <ProductionCategoryPage
      title="생산관리"
      filters={['작업지시', '생산실적', '공정', '기간']}
      rows={[
        '작업지시관리 (등록/수정/삭제)',
        '작업지시진행현황',
        '생산실적관리 (등록/수정/삭제)',
        '생산집계현황',
      ]}
    />
  )
}

export function MaterialManagementPage() {
  return (
    <ProductionCategoryPage
      title="자재관리"
      filters={['입고', '출고', '재고', '품목']}
      rows={[
        '입고관리 (등록/수정/삭제)',
        '불출관리 (등록/수정/삭제)',
        '환입관리 (등록/수정/삭제)',
        '재고조정관리 (등록/수정/삭제)',
        '재고현황',
        '출고관리 (등록/수정/삭제)',
      ]}
    />
  )
}

export function ProductionQualityManagementPage() {
  return (
    <ProductionCategoryPage
      title="품질관리"
      filters={['검사', '작업표준서', '부적합', '기간']}
      rows={[
        '검사기준서관리 (등록/수정/삭제)',
        '작업표준서관리 (등록/수정/삭제)',
        '유무검사변경관리 (등록/수정/삭제)',
        '부적합관리 (등록/수정/삭제)',
        '부적합추이현황',
        '검사관리 (등록/수정/삭제)',
        '검사현황',
      ]}
    />
  )
}
