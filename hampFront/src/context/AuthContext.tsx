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
  // 사용자의 직접 로그아웃 요청 중복 방지
  const isLoggingOut = useRef(false)

  // 동시 API 401(예: SESSION_REPLACED) 발생 시 강제 로그아웃 중복 처리 방지
  const isForcedLogout = useRef(false)

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => !!localStorage.getItem('token'),
  )

  // 저장된 사용자 정보 복원
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

  // 클라이언트 인증 상태 및 로컬 저장소 초기화
  const clearAuthState = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')

    setUser(null)
    setIsAuthenticated(false)
  }, [])

  // 로그인 처리
  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      const response = await apiClient.post<ApiResponseLoginResponse>(
        '/auth/login',
        credentials,
      )

      const loginData = response.data.data
      const token = loginData.accessToken

      if (!token) {
        throw new Error(response.data.message || '응답에 토큰이 없습니다.')
      }

      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(loginData))

      isForcedLogout.current = false

      setUser(loginData)
      setIsAuthenticated(true)

    } catch (error: any) {
      console.error('로그인 실패:', error)

      throw new Error(
        error.response?.data?.message ||
        '아이디 또는 비밀번호가 올바르지 않습니다.'
      )
    }
  }, [])

  // 사용자 로그아웃
  const logout = useCallback(async () => {
    if (isLoggingOut.current) return

    isLoggingOut.current = true

    try {
      await apiClient.post<ApiResponseVoid>('/auth/logout')
    } catch (error) {
      console.warn('로그아웃 API 호출 실패 (토큰 만료 등):', error)
    } finally {
      clearAuthState()
      isLoggingOut.current = false
    }
  }, [clearAuthState])

  // apiClient interceptor에서 전달되는 강제 로그아웃 콜백 처리
  useEffect(() => {
    setLogoutCallback((code, message) => {
      if (isForcedLogout.current) return

      isForcedLogout.current = true
      clearAuthState()

      if (message) {
        alert(message)
      } else {
        switch (code) {
          case 'SESSION_REPLACED':
            alert('다른 곳에서 로그인되어 이 세션은 종료되었습니다.')
            break

          case 'AUTH_FAILED':
            alert('인증 정보가 만료되었습니다. 다시 로그인해주세요.')
            break

          default:
            alert('로그인이 만료되었습니다. 다시 로그인해주세요.')
        }
      }
      window.location.href = '/login'
    })
    return () => {
      setLogoutCallback(null)
    }
  }, [clearAuthState])

  // 멀티탭 로그인/로그아웃 동기화
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== 'token' && e.key !== 'user') return

      const savedToken = localStorage.getItem('token')
      const savedUser = localStorage.getItem('user')

      // 다른 탭에서 로그아웃된 경우
      if (!savedToken || !savedUser) {
        clearAuthState()
        return
      }

      // 다른 탭에서 로그인된 경우
      try {
        setUser(JSON.parse(savedUser))
        setIsAuthenticated(true)
      } catch (error) {
        console.error('Failed to parse user on storage change:', error)
        clearAuthState()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [clearAuthState])

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
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}