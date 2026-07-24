import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { apiClient, setLogoutCallback } from '@/api/apiClient'
import type {
  LoginRequest,
  ApiResponseLoginResponse,
  LoginResponse,
  ApiResponseVoid,
} from '@/types/auth/Auth'

interface AuthContextValue {
  isAuthenticated: boolean
  user: LoginResponse | null
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // 중복 로그아웃 요청 방지를 위한 Ref
  const isLoggingOut = useRef(false)

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => !!localStorage.getItem('token'),
  )

  // 안전한 JSON 파싱 적용
  const [user, setUser] = useState<LoginResponse | null>(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) return null
    try {
      return JSON.parse(savedUser)
    } catch (error) {
      console.error('Failed to parse user from localStorage:', error)
      localStorage.removeItem('user')
      return null
    }
  })

  // 로그인 처리
  const login = useCallback(async (credentials: LoginRequest) => {
    const response = await apiClient.post<ApiResponseLoginResponse>('/auth/login', credentials)

    const apiResult = response.data
    const loginData: LoginResponse = apiResult?.data
    const token = loginData?.accessToken

    if (!token) {
      throw new Error(apiResult?.message || '응답에 토큰이 존재하지 않습니다.')
    }

    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(loginData))

    setUser(loginData)
    setIsAuthenticated(true)
  }, [])

  // 로그아웃 처리 (중복 실행 방지 추가)
  const logout = useCallback(async () => {
    if (isLoggingOut.current) return
    isLoggingOut.current = true

    try {
      await apiClient.post<ApiResponseVoid>('/auth/logout')
    } catch (error) {
      console.error('로그아웃 API 호출 중 오류 발생:', error)
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
      setIsAuthenticated(false)
      isLoggingOut.current = false
    }
  }, [])

  // apiClient 인터셉터에 로그아웃 콜백 바인딩
  useEffect(() => {
    setLogoutCallback(logout)
  }, [logout])

  // 멀티 탭 로그인/로그아웃 상태 동기화
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        if (!e.newValue) {
          setUser(null)
          setIsAuthenticated(false)
        } else {
          const savedUser = localStorage.getItem('user')
          if (savedUser) {
            try {
              setUser(JSON.parse(savedUser))
              setIsAuthenticated(true)
            } catch {
              // parse 실패 시 무시
            }
          }
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Context value 메모이제이션
  const contextValue = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      user,
      login,
      logout,
    }),
    [isAuthenticated, user, login, logout],
  )

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}