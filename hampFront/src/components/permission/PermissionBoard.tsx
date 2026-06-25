import { useEffect, useState } from 'react'
import { CheckIcon } from '@heroicons/react/16/solid'
import { menuGroups } from '../../data/navigation'

const ROLES = [
  { name: '시스템관리자', count: 12, desc: '모든 메뉴 및 기능에 접근 가능한 최고 권한 그룹입니다.' },
  { name: '생산관리자', count: 9, desc: '생산, 재고, LOT 관련 메뉴에 대한 등록·수정 권한을 가집니다.' },
  { name: '품질관리자', count: 7, desc: '품질검사 및 불량관리 메뉴에 대한 접근 권한을 가집니다.' },
  { name: '설비관리자', count: 5, desc: '설비 운영 및 알람 메뉴의 조회·수정 권한을 가집니다.' },
  { name: '일반작업자', count: 11, desc: '지정된 메뉴의 조회 권한만 부여된 기본 작업자 그룹입니다.' },
]

const PERMISSIONS = ['조회', '등록', '수정', '삭제', '승인'] as const

function hasPermission(roleIndex: number, permIndex: number, menuIndex: number): boolean {
  const maxMenu = [999, 8, 7, 5, 4]
  const maxPerm = [5, 4, 3, 2, 1]
  return permIndex < maxPerm[roleIndex] && menuIndex < maxMenu[permIndex]
}

export function PermissionBoard() {
  const menus = menuGroups.flatMap((group) =>
    group.items.map((item) => ({ label: `${group.title} / ${item.label}`, key: item.key })),
  )

  const [activeRole, setActiveRole] = useState(0)
  const [permState, setPermState] = useState(() =>
    menus.map((_, mi) => PERMISSIONS.map((_, pi) => hasPermission(0, pi, mi))),
  )

  useEffect(() => {
    setPermState(menus.map((_, mi) => PERMISSIONS.map((_, pi) => hasPermission(activeRole, pi, mi))))
  }, [activeRole])

  return (
    <section className="permissionBoard">
      <div className="permissionTabs">
        <div className="permissionTabsBox">
          {ROLES.map((role, index) => (
            <button
              key={role.name}
              type="button"
              className={`permissionTab ${index === activeRole ? 'active' : ''}`}
              onClick={() => setActiveRole(index)}
            >
              <span>{role.name}</span>
              <span className="tabBadge">{role.count}명</span>
            </button>
          ))}
        </div>
        <p className="permissionDesc">{ROLES[activeRole].desc}</p>
      </div>

      <div className="permissionMatrix">
        <div className="matrixHeader">
          <span>메뉴 경로</span>
          {PERMISSIONS.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>

        {menus.slice(0, 12).map((menu, menuIndex) => (
          <div key={menu.key} className="matrixRow">
            <span className="matrixLabel">{menu.label}</span>
            {PERMISSIONS.map((p, permIndex) => {
              const checked = permState[menuIndex]?.[permIndex] ?? false
              return (
                <div key={p} className="matrixCheckCell">
                  <span
                    className={`customCheck ${checked ? 'checked' : ''}`}
                    onClick={() => {
                      setPermState((prev) =>
                        prev.map((row, mi) =>
                          mi === menuIndex
                            ? row.map((v, pi) => (pi === permIndex ? !v : v))
                            : row,
                        ),
                      )
                    }}
                  >
                    {checked && <CheckIcon />}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
