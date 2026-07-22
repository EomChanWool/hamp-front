import { createContext, useContext, useState, type ReactNode } from 'react'
import { apiClient } from '@/api/apiClient'
import type { LoginRequest, ApiResponseLoginResponse, LoginResponse } from '@/types/auth/Auth'

interface AuthContextValue {
  isAuthenticated: boolean
  user: LoginResponse | null
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // 1. 토큰 존재 여부로 로그인 상태 관리
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => !!localStorage.getItem('token'),
  )

  // 2. 유저 정보 객체 상태 관리 (LoginResponse 타입 활용)
  const [user, setUser] = useState<LoginResponse | null>(null)

  const login = async (credentials: LoginRequest) => {
    // 1) API 통신 단계: ApiResponseLoginResponse 타입을 지정합니다.
    const response = await apiClient.post<ApiResponseLoginResponse>('/auth/login', credentials)

    // response.data(Axios) -> .data(백엔드) -> 실제 로그인 결과 데이터 (LoginResponse)
    const loginData: LoginResponse = response.data.data

    const token = loginData?.accessToken

    if (!token) {
      throw new Error('응답에 토큰이 존재하지 않습니다.')
    }

    // 토큰 저장
    localStorage.setItem('token', token)

    // 2) 상태 저장 단계: 추출한 LoginResponse 데이터를 유저 상태에 저장합니다.
    setUser(loginData)
    setIsAuthenticated(true)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null) // 로그아웃 시 유저 정보 초기화
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}