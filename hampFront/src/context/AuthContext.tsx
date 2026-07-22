import { createContext, useContext, useState, type ReactNode } from 'react'

const TOKEN_KEY = 'token'

interface AuthContextValue {
  isAuthenticated: boolean
  login: (token: string) => void // 
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // 앱 실행 시 localStorage에 토큰이 있는지 확인해서 로그인 여부 결정
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => !!localStorage.getItem(TOKEN_KEY),
  )

  // 실제 로그인: API 성공 후 전달받은 토큰을 저장
  const login = (token: string) => {
    const tokenValue = token.startsWith('Bearer ') ? token : `Bearer ${token}`
    localStorage.setItem(TOKEN_KEY, tokenValue)
    setIsAuthenticated(true)
  }

  // 실제 로그아웃: 토큰 삭제 후 상태 변경
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}