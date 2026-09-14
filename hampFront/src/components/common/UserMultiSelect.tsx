import { useEffect, useMemo, useRef, useState } from "react";
import type { UserOptionResponse } from "@/api/User";
import "@/pages/layout/Layout.css";

/**
 * UserMultiSelect
 * -----------------------------------------------------------------------
 * 담당자 등 "이름/아이디로 검색해서 여러 명을 태그로 선택"하는 공용 컴포넌트.
 * - 바깥 영역 클릭 시 드롭다운 자동 닫힘.
 * - 설비 상세(수정모드) / 설비 등록 화면 양쪽에서 그대로 재사용한다.
 * ----------------------------------------------------------------------- */

interface UserMultiSelectProps {
    /** 선택 가능한 전체 사용자 목록 */
    options: UserOptionResponse[];
    /** 현재 선택된 userId 배열 */
    value: string[];
    /** 선택 변경 시 호출 (변경된 전체 userId 배열을 넘겨줌) */
    onChange: (userIds: string[]) => void;
    disabled?: boolean;
    /** 검색창 placeholder (기본값 있음) */
    placeholder?: string;
}

export default function UserMultiSelect({
    options,
    value,
    onChange,
    disabled = false,
    placeholder = "담당자 이름 또는 아이디 검색 (예: 홍길동)...",
}: UserMultiSelectProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // 바깥 영역을 클릭하면 드롭다운을 닫는다.
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 선택된 사용자 객체 목록 (태그 렌더링용)
    const selectedUsers = useMemo(
        () => options.filter((u) => value.includes(u.userId)),
        [options, value]
    );

    // 검색어로 필터링된 드롭다운 목록
    const filteredOptions = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase();
        if (!keyword) return options;
        return options.filter(
            (u) =>
                u.userNm.toLowerCase().includes(keyword) ||
                u.userId.toLowerCase().includes(keyword)
        );
    }, [options, searchTerm]);

    const toggleUser = (userId: string) => {
        if (disabled) return;
        if (value.includes(userId)) {
            onChange(value.filter((id) => id !== userId));
        } else {
            onChange([...value, userId]);
        }
    };

    const removeUser = (userId: string) => {
        if (disabled) return;
        onChange(value.filter((id) => id !== userId));
    };

    return (
        <div className="userMultiSelect" ref={containerRef}>
            {/* 선택된 담당자 태그 목록 */}
            {selectedUsers.length > 0 && (
                <div className="userMultiSelectTags">
                    {selectedUsers.map((u) => (
                        <span key={u.userId} className="userMultiSelectTag">
                            {u.userNm} ({u.userId})
                            <button
                                type="button"
                                className="userMultiSelectTagRemove"
                                aria-label={`${u.userNm} 담당자 선택 해제`}
                                onClick={() => removeUser(u.userId)}
                                disabled={disabled}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* 검색창 + 드롭다운 */}
            <div className="userMultiSelectSearchWrap">
                <input
                    type="text"
                    className="userMultiSelectSearchInput"
                    placeholder={placeholder}
                    value={searchTerm}
                    disabled={disabled}
                    onFocus={() => setIsOpen(true)}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                    }}
                />

                {isOpen && !disabled && (
                    <div className="userMultiSelectDropdown">
                        {filteredOptions.length === 0 ? (
                            <div className="userMultiSelectEmpty">검색 결과가 없습니다.</div>
                        ) : (
                            filteredOptions.map((u) => {
                                const isSelected = value.includes(u.userId);
                                return (
                                    <div
                                        key={u.userId}
                                        className={`userMultiSelectOption${isSelected ? " selected" : ""}`}
                                        onClick={() => toggleUser(u.userId)}
                                        role="option"
                                        aria-selected={isSelected}
                                    >
                                        <span>
                                            {u.userNm} ({u.userId})
                                        </span>
                                        {isSelected && <span className="userMultiSelectCheck">✓</span>}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
