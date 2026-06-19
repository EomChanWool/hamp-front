import { useMemo, useState } from "react";
import { Badge } from "../components/Badge";
import { DataTable } from "../components/DataTable";
import { Panel } from "../components/Panel";
import { menuGroups, screenTitles } from "../data/navigation";
import type { ScreenKey, StatusTone } from "../types";
import { RowDetailModal } from "../components/RowDetailModal";

type DemoRow = {
  id: string;
  name: string;
  category: string;
  status: string;
  owner: string;
  date: string;
  tone: StatusTone;
};

const permissionScreens: ScreenKey[] = [
  "systemUserPermissions",
  "systemGroupPermissions",
  "systemMenuPermissions",
  "facilityDataPermissions",
];

const realtimeScreens: ScreenKey[] = [
  "facilityAccessRealtime",
  "facilityEnvironmentRealtime",
  "facilityCctv",
  "equipmentStatus",
  "equipmentOperationRate",
  "qualityDefectTrends",
  "dataVisualization",
];

const sendScreens: ScreenKey[] = ["messageSend"];

const featureMap: Partial<Record<ScreenKey, string[]>> = {
  systemAdmins: ["관리자 목록 조회", "관리자 등록/수정", "관리자 상세정보", "삭제 mock 처리"],
  systemUserPermissions: ["사용자별 권한 체크", "권한그룹 변경", "저장 mock 처리"],
  systemGroupPermissions: ["그룹별 메뉴 접근 권한", "조회/등록/수정/삭제/출력 권한 체크"],
  systemMenuPermissions: ["메뉴 트리 확인", "권한그룹별 접근 가능 여부 설정"],
  systemMenus: ["대메뉴/중메뉴/소메뉴 구조 관리", "메뉴경로와 정렬순서 관리"],
  systemCodes: ["코드그룹 조회", "코드값 추가/수정/삭제"],
  facilityAccessRealtime: ["가공동별 현재 출입인원", "금일 출입 건수", "최근 출입 이벤트"],
  facilityAccessHistory: ["기간/가공동/출입자 검색", "출입일시와 출입위치 이력 조회"],
  facilityEnvironmentRealtime: ["온도/습도/미세먼지/가스 현황", "정상/주의/위험 상태 표시"],
  facilityEnvironmentHistory: ["환경 센서 이력 조회", "더미 그래프와 수집값 표시"],
  facilityCctv: ["CCTV 목록 그리드", "카메라 위치와 연결 상태 표시", "클릭 시 상세정보 mock 표시"],
  facilityDataPermissions: ["열람/다운로드/출력/관리 권한 체크", "사용자 또는 그룹별 권한 설정"],
  equipmentInfo: ["장비 목록 조회", "장비 등록/수정/삭제", "장비 상세정보"],
  equipmentStatus: ["설비별 현재 상태 표시", "현재 작업 정보", "최근 운행일시와 금일 가동시간"],
  equipmentOperationRate: ["기간별 장비 가동률 조회", "가동시간/비가동시간/진행바 표시"],
  equipmentMaintenance: ["장애/수리 이력 목록", "수리 조치 등록", "처리상태 변경"],
  equipmentAlerts: ["설비 및 장비 이상 알림", "처리완료 mock 변경"],
  masterWorkplaces: ["사업장명/사업자번호/주소 관리", "대표자와 사용여부 표시"],
  masterFactories: ["공장코드/공장명 관리", "사업장과 위치 표시"],
  masterDepartments: ["부서코드 관리", "상위부서와 사용여부 표시"],
  masterClients: ["거래처 목록 조회", "사업자번호/담당자/연락처 표시"],
  masterItems: ["품목 목록 조회", "규격/단위/품목구분 표시"],
  masterWarehouses: ["창고코드 관리", "위치와 창고구분 표시"],
  masterBom: ["제품별 BOM 관리", "원자재 소요수량과 적용일자 표시"],
  salesOrders: ["수주 목록 조회", "수주 등록/수정/삭제", "수주 상세보기"],
  salesOrderBacklog: ["미납 수주 현황", "미납수량과 지연여부 표시"],
  salesOrderMonthly: ["월별 수주 집계", "수량과 금액 더미 차트"],
  salesDeliveries: ["납품 목록 조회", "납품 등록/수정/삭제", "납품 상세보기"],
  salesPerformance: ["수주 대비 실적 비교", "달성률과 미달수량 표시"],
  productionWorkOrders: ["작업지시 목록 조회", "작업지시 등록/수정/삭제", "진행상태와 진행률 표시"],
  productionResults: ["생산실적 목록 조회", "생산실적 등록/수정/삭제"],
  productionResultStatus: ["생산실적 집계", "품목별/설비별 생산효율 표시", "더미 차트 표시"],
  materialReceipts: ["입고 등록/수정", "입고일자/품목/수량/창고 입력"],
  materialShipments: ["출고 등록/수정", "출고처와 출고수량 입력"],
  materialIssues: ["불출 등록/수정", "사용부서와 작업지시번호 입력"],
  materialReturns: ["환입 등록/수정", "환입사유와 창고 입력"],
  materialStocks: ["재고 현황 조회", "현재고/안전재고/가용재고 표시"],
  materialStockAdjustments: ["재고 조정 관리", "조정수량과 조정사유 입력"],
  qualityInspectionStandards: ["검사기준서 관리", "검사항목/기준값/허용오차 표시"],
  qualityWorkStandards: ["작업표준서 관리", "작업절차/주의사항/사용설비 표시"],
  qualityInspections: ["검사 목록 조회", "검사 등록/수정/삭제", "판정결과 표시"],
  qualityInspectionChanges: ["유무검사 변경 관리", "변경 전후 검사여부와 사유 표시"],
  qualityDefects: ["부적합 목록 조회", "부적합 등록/수정/삭제", "조치상태 표시"],
  qualityDefectTrends: ["부적합 추이 현황", "기간별/품목별/공정별 건수 표시"],
  dataList: ["데이터 목록 조회", "데이터명/유형/수집일시/처리상태 표시"],
  dataProcess: ["데이터 추출/적재", "데이터 파일 변환", "데이터 저장/출력", "처리 완료 mock"],
  dataVisualization: ["데이터 시각화", "생산량/가동률/불량률 더미 차트"],
  messageSend: ["발송대상 유형 선택", "그룹/사용자 선택", "실제 SMS 없이 발송 완료"],
  messageHistory: ["문자 발송 이력", "발송일시/내용/상태/발송자 표시"],
};

function createRows(title: string): DemoRow[] {
  return [
    {
      id: "MES-001",
      name: `${title} A`,
      category: "운영",
      status: "정상",
      owner: "관리자",
      date: "2026-06-18",
      tone: "good",
    },
    {
      id: "MES-002",
      name: `${title} B`,
      category: "검토",
      status: "주의",
      owner: "운영자",
      date: "2026-06-17",
      tone: "warn",
    },
    {
      id: "MES-003",
      name: `${title} C`,
      category: "이력",
      status: "완료",
      owner: "담당자",
      date: "2026-06-16",
      tone: "info",
    },
  ];
}

export function MesDemoPage({ screen }: { screen: ScreenKey }) {
  const title = screenTitles[screen];
  const groupTitle = menuGroups.find((group) => group.items.some((item) => item.key === screen))?.title ?? "MES";
  const features = featureMap[screen] ?? [`${title} 목록 조회`, `${title} 등록/수정`, `${title} 상세보기`];
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState<DemoRow[]>(() => createRows(title));
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");
  const [editingId, setEditingId] = useState("");
  const [editBackup, setEditBackup] = useState<DemoRow | null>(null);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];
  const isPermission = permissionScreens.includes(screen);
  const isRealtime = realtimeScreens.includes(screen);
  const isSend = sendScreens.includes(screen);

  const filteredRows = useMemo(
    () => rows.filter((row) => [row.id, row.name, row.category, row.status, row.owner].join(" ").includes(keyword)),
    [keyword, rows],
  );

  const handleAdd = () => {
    const nextIndex = rows.length + 1;
    const nextRow: DemoRow = {
      id: `NEW-${String(nextIndex).padStart(3, "0")}`,
      name: "",
      category: "",
      status: "",
      owner: "",
      date: "",
      tone: "muted",
    };
    setRows((current) => [nextRow, ...current]);
    setSelectedId(nextRow.id);
    setEditingId(nextRow.id);
    setEditBackup(null);
  };

  const handleEdit = (row: DemoRow) => {
    setSelectedId(row.id);
    setEditingId(row.id);
    setEditBackup({ ...row });
  };

  const handleCancel = () => {
    if (!editingId) return;

    if (editBackup) {
      setRows((current) => current.map((row) => (row.id === editingId ? editBackup : row)));
    } else {
      setRows((current) => current.filter((row) => row.id !== editingId));
    }

    setEditingId("");
    setEditBackup(null);
  };

  const handleSaveRow = () => {
    setEditingId("");
    setEditBackup(null);
    window.alert("실제 저장 없이 화면 상태에만 반영되었습니다.");
  };

  const handleDelete = (row: DemoRow) => {
    if (window.confirm(`${row.name || row.id} 항목을 화면에서 삭제할까요?`)) {
      setRows((current) => current.filter((item) => item.id !== row.id));
      if (selectedId === row.id) {
        setSelectedId("");
      }
      window.alert("화면 상태에서만 삭제되었습니다.");
    }
  };

  const updateRow = (rowId: string, field: keyof Omit<DemoRow, "tone">, value: string) => {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: value,
              tone: field === "status" ? getTone(value) : row.tone,
            }
          : row,
      ),
    );
  };

  const handleMock = (message: string) => {
    window.alert(message);
  };

  const [modalRow, setModalRow] = useState<DemoRow | null>(null);

  return (
    <section className="screenStack">
      <section className="metricGrid">
        {features.slice(0, 4).map((feature, index) => (
          <article key={feature} className={`metricCard ${index === 1 ? "warn" : index === 2 ? "info" : ""}`}>
            <span>{groupTitle}</span>
            <strong>{feature}</strong>
          </article>
        ))}
      </section>

      {isRealtime && (
        <Panel title="실시간 현황" action="상태 갱신" onAction={() => handleMock("더미 상태값이 갱신되었습니다.")}>
          <div className="equipmentGrid">
            {["A가공동", "B가공동", "C가공동"].map((name, index) => (
              <article key={name} className={`equipmentCard ${index === 1 ? "warn" : "good"}`}>
                <span>{name}</span>
                <h2>{index === 1 ? "주의" : "정상"}</h2>
                <strong>{index === 2 ? "87%" : index === 1 ? "점검중" : "가동"}</strong>
                <small>mock realtime</small>
              </article>
            ))}
          </div>
        </Panel>
      )}

      <div className="searchBand">
        {["검색어", "구분", "상태", "기간"].map((filter) => (
          <label key={filter}>
            {filter}
            <input
              value={filter === "검색어" ? keyword : undefined}
              onChange={(event) => filter === "검색어" && setKeyword(event.target.value)}
              placeholder={`${filter} 입력`}
            />
          </label>
        ))}
        <button
          type="button"
          className="primaryButton"
          onClick={() => handleMock("mock 데이터 기준으로 조회되었습니다.")}
        >
          검색
        </button>
      </div>

      <Panel title={`${title} 목록`} action="초기화" onAction={() => setKeyword("")}>
        <div className="toolbarRow">
          <button
            type="button"
            className="primaryButton"
            onClick={isSend ? () => handleMock("실제 SMS 발송 없이 발송 완료 처리되었습니다.") : handleAdd}
          >
            {isSend ? "발송" : "등록"}
          </button>
        </div>

        <DataTable
          headers={["선택", "코드", "명칭", "구분", "상태", "담당자", "일자", "관리"]}
          onRowClick={(index) => setModalRow(filteredRows[index])}
          rows={filteredRows.map((row) => {
            const isEditing = editingId === row.id;

            return [
              <input
                key={`${row.id}-select`}
                type="radio"
                checked={selectedId === row.id}
                onChange={() => setSelectedId(row.id)}
                aria-label={`${row.name || row.id} 선택`}
              />,
              row.id,
              isEditing ? (
                <input
                  className="tableInput"
                  value={row.name}
                  onChange={(event) => updateRow(row.id, "name", event.target.value)}
                  placeholder="명칭 입력"
                />
              ) : (
                row.name
              ),
              isEditing ? (
                <input
                  className="tableInput"
                  value={row.category}
                  onChange={(event) => updateRow(row.id, "category", event.target.value)}
                  placeholder="구분 입력"
                />
              ) : (
                row.category
              ),
              isEditing ? (
                <input
                  className="tableInput"
                  value={row.status}
                  onChange={(event) => updateRow(row.id, "status", event.target.value)}
                  placeholder="상태 입력"
                />
              ) : (
                <Badge tone={row.tone}>{row.status}</Badge>
              ),
              isEditing ? (
                <input
                  className="tableInput"
                  value={row.owner}
                  onChange={(event) => updateRow(row.id, "owner", event.target.value)}
                  placeholder="담당자 입력"
                />
              ) : (
                row.owner
              ),
              isEditing ? (
                <input
                  className="tableInput"
                  value={row.date}
                  onChange={(event) => updateRow(row.id, "date", event.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              ) : (
                row.date
              ),
              <div className="rowActions">
                {isEditing ? (
                  <>
                    <button type="button" className="miniButton primary" onClick={handleSaveRow}>
                      저장
                    </button>
                    <button type="button" className="miniButton" onClick={handleCancel}>
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="miniButton"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(row);
                      }}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      className="miniButton danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(row);
                      }}
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>,
            ];
          })}
        />
      </Panel>

      <RowDetailModal
        isOpen={modalRow !== null}
        onClose={() => setModalRow(null)}
        onSave={(updated) => {
          setRows((current) =>
            current.map((row) =>
              row.id === modalRow!.id
                ? {
                    ...row,
                    ...updated,
                    tone: getTone(updated.status ?? row.status),
                  }
                : row,
            ),
          );
          setModalRow(null);
        }}
        fields={[
          { label: "코드", key: "id" },
          { label: "명칭", key: "name" },
          { label: "구분", key: "category" },
          { label: "상태", key: "status" },
          { label: "담당자", key: "owner" },
          { label: "일자", key: "date" },
        ]}
        data={modalRow ?? {}}
      />

      <section className="contentGrid">
        <Panel
          title={isPermission ? "권한 설정" : "상세정보"}
          action={isPermission ? "권한 저장" : "상세 확인"}
          onAction={() => handleMock("실제 저장 없이 화면 상태만 변경되었습니다.")}
        >
          {isPermission ? (
            <div className="permissionGrid">
              {["조회", "등록", "수정", "삭제", "출력", "다운로드"].map((permission, index) => (
                <label key={permission} className="checkRow">
                  <input type="checkbox" defaultChecked={index < 3} />
                  {permission}
                </label>
              ))}
            </div>
          ) : (
            <div className="detailList">
              <div>
                <span>선택 항목</span>
                <strong>{selected?.name ?? "선택 없음"}</strong>
              </div>
              <div>
                <span>기능 설명</span>
                <strong>{features.join(" / ")}</strong>
              </div>
            </div>
          )}
        </Panel>
      </section>
    </section>
  );
}

function getTone(status: string): StatusTone {
  if (status.includes("위험") || status.includes("이상") || status.includes("삭제")) return "danger";
  if (status.includes("주의") || status.includes("점검") || status.includes("검토")) return "warn";
  if (status.includes("완료") || status.includes("조회")) return "info";
  if (status.includes("정상") || status.includes("가동")) return "good";
  return "muted";
}
