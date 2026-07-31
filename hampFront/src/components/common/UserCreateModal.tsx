import { useEffect, useState } from "react";
import type { UserCreateRequest } from "@/types/User";

interface UserCreateModalProps {
    isOpen: boolean;
    isLoading: boolean;
    onClose: () => void;
    onSubmit: (data: UserCreateRequest) => void;
}

export function UserCreateModal({
    isOpen,
    isLoading,
    onClose,
    onSubmit,
}: UserCreateModalProps) {
    const [form, setForm] = useState<UserCreateRequest>({
        userId: "",
        userNm: "",
        phone: "",
        position: "",
    });

    // 모달이 닫힐 때 Form 입력값 초기화
    useEffect(() => {
        if (!isOpen) {
            setForm({
                userId: "",
                userNm: "",
                phone: "",
                position: "",
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleChange = (key: keyof UserCreateRequest, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = () => {
        if (!form.userId.trim() || !form.userNm.trim()) {
            window.alert("사용자ID, 이름은 필수 입력 항목입니다.");
            return;
        }
        onSubmit(form);
    };

    return (
        <>
            {/* 배경 오버레이 */}
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

            {/* 모달 창 (기존 detailModal CSS 100% 사용) */}
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
                    <div className="detailField">
                        <label style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            사용자ID <span style={{ color: "#ef4444", fontWeight: "bold" }}>*</span>
                        </label>
                        <input
                            className="tableInput"
                            value={form.userId}
                            onChange={(e) => handleChange("userId", e.target.value)}
                            placeholder="아이디 입력"
                        />
                    </div>

                    <div className="detailField">
                        <label style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            이름 <span style={{ color: "#ef4444", fontWeight: "bold" }}>*</span>
                        </label>
                        <input
                            className="tableInput"
                            value={form.userNm}
                            onChange={(e) => handleChange("userNm", e.target.value)}
                            placeholder="이름 입력"
                        />
                    </div>

                    <div className="detailField">
                        <label>전화번호</label>
                        <input
                            className="tableInput"
                            value={form.phone}
                            onChange={(e) => handleChange("phone", e.target.value)}
                            placeholder="010-0000-0000"
                        />
                    </div>

                    <div className="detailField">
                        <label>부서</label>
                        <input
                            className="tableInput"
                            value={form.position}
                            onChange={(e) => handleChange("position", e.target.value)}
                            placeholder="부서 입력"
                        />
                    </div>
                </div>

                <div className="detailModalFooter">
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
        </>
    );
}