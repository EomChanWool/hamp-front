import { useEffect, useState } from "react";
import type { UserCreateRequest } from "@/types/User";
import type { AuthGroupResponse } from "@/types/auth/Auth";

interface UserCreateModalProps {
  isOpen: boolean;
  isLoading: boolean;
  authGroups: AuthGroupResponse[];
  onClose: () => void;
  onSubmit: (data: UserCreateRequest) => void;
}

export function UserCreateModal({
  isOpen,
  isLoading,
  authGroups,
  onClose,
  onSubmit,
}: UserCreateModalProps) {
  const [form, setForm] = useState<UserCreateRequest>({
    userId: "",
    userNm: "",
    phone: "",
    position: "",
    authIds: [],
  });

  // 모달 닫힐 때 초기화
  useEffect(() => {
    if (!isOpen) {
      setForm({
        userId: "",
        userNm: "",
        phone: "",
        position: "",
        authIds: [],
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (key: keyof UserCreateRequest, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 체크박스 토글 핸들러
  const handleAuthCheck = (authId: string, checked: boolean) => {
    setForm((prev) => {
      const currentAuthIds = prev.authIds || [];
      return {
        ...prev,
        authIds: checked
          ? [...currentAuthIds, authId]
          : currentAuthIds.filter((id) => id !== authId),
      };
    });
  };

  const handleSubmit = () => {
    const payload: UserCreateRequest = {
      userId: form.userId,
      userNm: form.userNm,
      phone: form.phone?.trim() ? form.phone.trim() : null,
      position: form.position?.trim() ? form.position.trim() : null,
      authIds: form.authIds ?? [],
    };

    onSubmit(payload);
  };

  return (
    <>
      <div
        onClick={isLoading ? undefined : onClose}
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
            <h3>신규 회원 등록</h3>
            <span>사용자 정보 등록</span>
          </div>
          <button
            type="button"
            className="detailModalClose"
            onClick={onClose}
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        <div className="detailModalBody">
          {/* 사용자 ID */}
          <div className="detailField">
            <label className="requiredLabel">
              사용자ID <span className="required">*</span>
            </label>
            <input
              className="tableInput"
              value={form.userId}
              disabled={isLoading}
              onChange={(e) => handleChange("userId", e.target.value)}
              placeholder="아이디 입력"
            />
          </div>

          {/* 이름 */}
          <div className="detailField">
            <label className="requiredLabel">
              이름 <span className="required">*</span>
            </label>
            <input
              className="tableInput"
              value={form.userNm}
              disabled={isLoading}
              onChange={(e) => handleChange("userNm", e.target.value)}
              placeholder="이름 입력"
            />
          </div>

          {/* 전화번호 */}
          <div className="detailField">
            <label>전화번호</label>
            <input
              className="tableInput"
              value={form.phone ?? ""}
              disabled={isLoading}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="010-0000-0000"
            />
          </div>

          {/* 부서 */}
          <div className="detailField">
            <label>부서</label>
            <input
              className="tableInput"
              value={form.position ?? ""}
              disabled={isLoading}
              onChange={(e) => handleChange("position", e.target.value)}
              placeholder="부서 입력"
            />
          </div>

          {/* 권한 그룹 선택 (다중 체크박스) */}
          <div className="detailField authGroupField">
            <label className="requiredLabel">
              권한 그룹 <span className="required">*</span>
            </label>
            
            {authGroups.length === 0 ? (
              <div className="authGroupEmpty">
                선택 가능한 권한 그룹이 없습니다.
              </div>
            ) : (
              <div 
                className="authGroupList"
              >
                {authGroups.map((auth) => {
                  const isChecked = form.authIds?.includes(auth.authId) ?? false;
                  return (
                    <label 
                      key={auth.authId} 
                      className={`authGroupItem ${isChecked ? "checked" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isLoading}
                        onChange={(e) => handleAuthCheck(auth.authId, e.target.checked)}
                      />
                      <span>{auth.authNm}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="detailModalFooter">
          <div className="detailModalFooterRight">
            <button
              type="button"
              className="ghostButton"
              onClick={onClose}
              disabled={isLoading}
            >
              취소
            </button>
            <button
              type="button"
              className="primaryButton"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? "등록 중..." : "등록"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}