import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  TagIcon,
  MapPinIcon,
  CheckCircleIcon,
  HashtagIcon,
  CpuChipIcon,
  BuildingOffice2Icon,
  CubeIcon,
  BanknotesIcon,
  PhoneIcon,
  EnvelopeIcon,
  ChatBubbleBottomCenterTextIcon,
  DocumentTextIcon,
  PlayIcon,
  StopIcon,
  BellIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  FlagIcon,
  FireIcon,
  CloudIcon,
  BeakerIcon,
  BoltIcon,
  ChartPieIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  TruckIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  WrenchScrewdriverIcon,
  QrCodeIcon,
} from "@heroicons/react/24/outline";

type IconType = ComponentType<{ className?: string }>;

/** 라벨 키워드 → 아이콘. 위에서부터 먼저 맞는 규칙이 적용되므로 순서가 중요 */
const ICON_RULES: [RegExp, IconType][] = [
  // 날짜·시간
  [/일시|일자|날짜|기간/, CalendarDaysIcon],
  [/시작/, PlayIcon],
  [/종료|중지/, StopIcon],
  [/시각|시간|주기/, ClockIcon],

  // 연락처 (전화번호가 '번호'에 먼저 잡히지 않도록 식별자보다 위)
  [/이메일|메일/, EnvelopeIcon],
  [/연락처|전화|휴대폰/, PhoneIcon],

  // 식별자 (출고번호, 품목코드, 장비ID가 도메인 규칙에 먼저 잡히지 않도록 위로 이동)
  [/id$|코드|번호|no$/i, QrCodeIcon],

  // 알림 (유형·등급보다 먼저)
  [/알림.*등급|경고|위험/, ExclamationTriangleIcon],
  [/알림/, BellIcon],

  // 사람·조직·장소
  [/이름|성명|자명|담당|승인|작성|자$/, UserIcon],
  [/부서|소속|팀|업체|회사|거래처|기업/, BuildingOffice2Icon],
  [/구역|위치|장소|구간|지역|주소|목적지/, MapPinIcon],
  [/목적/, FlagIcon],

  // 센서
  [/온도|temp/i, FireIcon],
  [/습도|humid/i, CloudIcon],
  [/co2|가스|농도|ppm|ph$/i, BeakerIcon],
  [/전압|전류|전력|전기/, BoltIcon],

  // 공정·생산
  [/진행|률$/, ChartPieIcon],
  [/공정/, Cog6ToothIcon],
  [/불량/, ExclamationCircleIcon],
  [/장비|설비|기기/, CpuChipIcon],
  [/상태|여부|결과/, CheckCircleIcon],
  [/납품/, TruckIcon],
  [/입고/, ArrowDownTrayIcon],
  [/출고/, ArrowUpTrayIcon],
  [/생산/, WrenchScrewdriverIcon],
  [/수량|재고|품목|품명|자재/, CubeIcon],

  // 기타
  [/금액|가격|비용|단가/, BanknotesIcon],
  [/구분|유형|종류|분류|등급/, TagIcon],
  [/비고|메모|내용|설명|사유|의견/, ChatBubbleBottomCenterTextIcon],
  [/압력|풍속|유량|조도|측정/, ChartBarIcon],
];

function resolveIcon(label: string): IconType {
  return ICON_RULES.find(([re]) => re.test(label))?.[1] ?? DocumentTextIcon;
}

export type DetailField = {
  label: string;
  key: string;
  editable?: boolean;
  /** 라벨 왼쪽 아이콘 (heroicons 24/outline 권장). 미지정 시 라벨 키워드로 자동 추론 */
  icon?: IconType;
  /** 조회 모드에서 값을 커스텀 렌더링 (배지 등) */
  render?: (value: string) => ReactNode;
};

type DetailModalAction = {
  label: string;
  loadingLabel?: string;
  onClick: () => void | Promise<void>;
  isLoading?: boolean;
};

type RowDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, string>) => void | Promise<void>;
  fields: DetailField[];
  data: Record<string, string>;
  dangerAction?: DetailModalAction;
  subtitle?: string;
};

/** 테이블 행 클릭 시 상세 정보를 보여주고, 수정 모드로 전환해 저장/취소할 수 있는 모달 */
export function RowDetailModal({
  isOpen,
  onClose,
  onSave,
  fields,
  data,
  dangerAction,
  subtitle = "사용자 정보 조회",
}: RowDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(data);
  const isBusy = dangerAction?.isLoading === true;

  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [JSON.stringify(data)]);

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setForm(data);
    } else if (!isEditing) {
      setForm(data);
    }
  }, [isOpen, isEditing, data]);

  const handleSave = async () => {
    await onSave(form);
    setIsEditing(false);
  };

  const handleClose = () => {
    if (isBusy) return;

    setForm(data);
    setIsEditing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(2px)",
          zIndex: 200,
        }}
      />

      <div className="detailModal">
        <div className="detailModalHeader">
          <div>
            <h3>{isEditing ? "정보 수정" : "상세 정보"}</h3>
            <span>{subtitle}</span>
          </div>

          <button
            type="button"
            className="detailModalClose"
            onClick={handleClose}
            disabled={isBusy}
          >
            ✕
          </button>
        </div>

        <div className="detailModalBody">
          <div className="detailRows">
            {fields.map(({ label, key, editable, icon, render }) => {
              const Icon = icon ?? resolveIcon(label);
              const value = data[key] || "";

              return (
                <div key={key} className="detailRow">
                  <div className="detailRowLabel">
                    <Icon className="detailRowIcon" aria-hidden="true" />
                    <span>{label}</span>
                  </div>

                  <div className="detailRowValue">
                    {isEditing && editable !== false ? (
                      <input
                        className="tableInput"
                        value={form[key] ?? ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      />
                    ) : value ? (
                      render ? render(value) : value
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="detailModalFooter">
          <div className="detailModalFooterLeft">
            {isEditing && dangerAction && (
              <button
                type="button"
                className="dangerButton detailModalDangerAction"
                onClick={() => void dangerAction.onClick()}
                disabled={isBusy}
              >
                {isBusy
                  ? (dangerAction.loadingLabel ?? dangerAction.label)
                  : dangerAction.label}
              </button>
            )}
          </div>

          <div className="detailModalFooterRight">
            {isEditing ? (
              <>
                <button
                  type="button"
                  className="ghostButton"
                  onClick={() => {
                    setForm(data);
                    setIsEditing(false);
                  }}
                  disabled={isBusy}
                >
                  취소
                </button>

                <button
                  type="button"
                  className="primaryButton"
                  onClick={handleSave}
                  disabled={isBusy}
                >
                  저장
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="ghostButton"
                  onClick={handleClose}
                >
                  닫기
                </button>

                <button
                  type="button"
                  className="primaryButton"
                  onClick={() => setIsEditing(true)}
                >
                  수정
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}