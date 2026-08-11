import { useNavigate } from 'react-router-dom'
import { PermissionBoard } from '@components/permission/PermissionBoard'
import { Panel } from '@/components/card/Panel'

export function SystemUserPermissionsPage() {
  const navigate = useNavigate()

  return (
    <section className="screenStack">
      <Panel
        title="사용자 권한관리 목록"
        action="등록"
        onAction={() => {
          navigate("/system/auths/create")
        }}
      >
        <PermissionBoard />
      </Panel>
    </section>
  )
}