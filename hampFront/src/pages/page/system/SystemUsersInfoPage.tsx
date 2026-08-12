import { useEffect, useState } from "react";
import { Panel } from "@components/card/Panel";
import { Badge } from "@components/common/Badge";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import { useAuth } from "@/context/AuthContext";
import type { 
  UserDetailResponse, 
  ApiResponseUserDetailResponse, 
  UserUpdateRequest 
} from "@/types/User";
import type { AuthGroupResponse, ApiResponseListAuthGroupResponse } from "@/types/auth/Auth";
import Spinner from "@/components/common/Spinner";
import './SystemUser.css';

export function SystemUsersInfoPage() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<UserDetailResponse | null>(null);
  const [, setAuthGroups] = useState<AuthGroupResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    userNm: "",
    phone: "",
    position: "",
    authIds: [] as string[],
  });

  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });

  const isBusy = isUpdating || isLoadingGroups;

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (!authUser?.userId) return;
      setIsLoading(true);
      setIsLoadingGroups(true);
      try {
        const [groupsRes, userRes] = await Promise.all([
          apiClient.get<ApiResponseListAuthGroupResponse>("/auth-groups"),
          apiClient.get<ApiResponseUserDetailResponse>(`/users/${encodeURIComponent(authUser.userId)}`)
        ]);
        if (isMounted) {
          setAuthGroups(groupsRes.data.data ?? []);
          const userData = userRes.data.data;
          if (userData) {
            setUser(userData);
            setForm({
              userNm: userData.userNm || "",
              phone: userData.phone || "",
              position: userData.position || "",
              authIds: userData.authGroups?.map((g) => g.authId) || [],
            });
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsLoadingGroups(false);
        }
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [authUser?.userId]);

  useEffect(() => {
    if (user && !isEditing) {
      setForm({
        userNm: user.userNm || "",
        phone: user.phone || "",
        position: user.position || "",
        authIds: user.authGroups?.map((g) => g.authId) || [],
      });
      setPasswordForm({ current: "", new: "", confirm: "" });
    }
  }, [isEditing, user]);

  const handleSave = async () => {
    if (!user || isUpdating) return;
    if (!form.userNm?.trim()) { alert("이름을 입력해주세요."); return; }
    if (isEditing && passwordForm.new && passwordForm.new !== passwordForm.confirm) {
      alert("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsUpdating(true);
    try {
      const updatePayload: UserUpdateRequest = {
        userNm: form.userNm.trim(),
        phone: form.phone?.trim() || null,
        position: form.position?.trim() || null,
        authIds: form.authIds,
      };
      await apiClient.put(`/users/${encodeURIComponent(user.userId)}`, updatePayload);

      if (passwordForm.new) {
        await apiClient.put(`/users/${encodeURIComponent(user.userId)}/password`, {
          currentPassword: passwordForm.current,
          newPassword: passwordForm.new
        });
      }

      alert("정보가 수정되었습니다.");
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert("저장에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) return <div className="screenStack"><Spinner /></div>;
  if (!user) return <div className="screenStack">사용자 정보를 불러올 수 없습니다.</div>;

  return (
    <section className="screenStack">
      <Panel title={isEditing ? "내 정보 수정" : "내 정보 상세"}>
        <form className="pageForm" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          
          <div className="detailField">
            <label>사용자ID</label>
            <div className="detailValue">{user.userId}</div>
          </div>

          <div className="detailField">
            {/* flex를 사용하여 필수 표시가 옆으로만 붙도록 설정 */}
            <label style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              이름 {isEditing && <span style={{ color: "red" }}>*</span>}
            </label>
            {isEditing ? (
              <input 
                className="tableInput" 
                style={{ height: '36px' }}
                disabled={isUpdating}
                value={form.userNm} 
                onChange={(e) => setForm({...form, userNm: e.target.value})} 
              />
            ) : <div className="detailValue">{user.userNm}</div>}
          </div>

          <div className="detailField">
            <label>전화번호</label>
            {isEditing ? (
              <input 
                className="tableInput" 
                style={{ height: '36px' }}
                disabled={isUpdating}
                value={form.phone} 
                onChange={(e) => setForm({...form, phone: e.target.value})} 
              />
            ) : <div className="detailValue">{user.phone || "-"}</div>}
          </div>

          <div className="detailField">
            <label>부서</label>
            {isEditing ? (
              <input 
                className="tableInput" 
                style={{ height: '36px' }}
                disabled={isUpdating}
                value={form.position} 
                onChange={(e) => setForm({...form, position: e.target.value})} 
              />
            ) : <div className="detailValue">{user.position || "-"}</div>}
          </div>

          <div className="detailField">
            <label>사용여부</label>
            <div className="detailValue">
              <Badge tone={user.use ? "good" : "muted"}>
                {user.use ? "사용" : "미사용"}
              </Badge>
            </div>
          </div>

          <div className="detailField">
            <label>생성일시</label>
            <div className="detailValue">{formatDateTime(user.createdAt)}</div>
          </div>

          <div style={{ 
            display: isEditing ? "block" : "none",
            marginTop: isEditing ? "20px" : "0",
            borderTop: isEditing ? "1px solid #eee" : "none",
            paddingTop: isEditing ? "20px" : "0"
          }}>
            <div className="detailField">
              <label>현재 비밀번호</label>
              <input type="password" placeholder="변경 시 필수 입력" className="tableInput" style={{ height: '36px' }} disabled={isUpdating} value={passwordForm.current} onChange={(e) => setPasswordForm({...passwordForm, current: e.target.value})} />
            </div>
            <div className="detailField" style={{ marginTop: "12px" }}>
              <label>새 비밀번호</label>
              <input type="password" className="tableInput" style={{ height: '36px' }} disabled={isUpdating} value={passwordForm.new} onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})} />
            </div>
            <div className="detailField" style={{ marginTop: "12px" }}>
              <label>새 비밀번호 확인</label>
              <input type="password" className="tableInput" style={{ height: '36px' }} disabled={isUpdating} value={passwordForm.confirm} onChange={(e) => setPasswordForm({...passwordForm, confirm: e.target.value})} />
            </div>
          </div>

          <div className="pageFormFooterSpaceBetween" style={{ marginTop: "20px" }}>
            <div />
            <div style={{ display: "flex", gap: "8px" }}>
              {isEditing ? (
                <>
                  <button type="button" className="ghostButton" onClick={() => setIsEditing(false)} disabled={isUpdating}>취소</button>
                  <button type="button" className="primaryButton" onClick={handleSave} disabled={isBusy}>{isUpdating ? "저장 중..." : "저장"}</button>
                </>
              ) : (
                <button type="button" className="primaryButton" onClick={() => setIsEditing(true)}>수정</button>
              )}
            </div>
          </div>
        </form>
      </Panel>
    </section>
  );
}