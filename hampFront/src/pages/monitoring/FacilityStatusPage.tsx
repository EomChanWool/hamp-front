import { Badge } from "../../components/Badge";
import { ManagementScreen } from "../../components/ManagementScreen";

export function FacilityStatusPage() {
  return (
    <ManagementScreen
      title="시설 현황"
      filters={["시설", "구역", "구성상태", "장비구조물"]}
      primary="이미지맵 갱신"
      table={{
        headers: ["구역", "주요시설", "장비구조물", "구성상태", "비고"],
        rows: [
          [
            "가공동",
            "추출/건조 설비 구역",
            "추출기, 건조기, 배관",
            <Badge tone="good">정상</Badge>,
            "구성 완료",
          ],
          [
            "보관동",
            "원료 및 완제품 보관 구역",
            "랙, 냉장 보관함",
            <Badge tone="good">정상</Badge>,
            "구성 완료",
          ],
          [
            "유틸리티실",
            "전력/공조 지원 구역",
            "분전반, 공조기",
            <Badge tone="warn">점검</Badge>,
            "구조물 정보 확인 필요",
          ],
        ],
      }}
    >
      <div className="noteBox">
        주요시설물 구성현황과 장비구조물 정보를 표출합니다.
      </div>
    </ManagementScreen>
  );
}
