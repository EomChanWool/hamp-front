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
import { setLogoutCallback } from '@/api/apiClient'
import { AuthApi } from '@/api/auth/Auth'
import type {
  LoginRequest,
  LoginResponse,
  ChangePasswordRequest,
  ApiResponseTokenResponse,
} from '@/api/auth/Auth'

interface AuthContextValue {
  isAuthenticated: boolean
  user: LoginResponse | null
  login: (credentials: LoginRequest) => Promise<LoginResponse>
  logout: () => Promise<void>
  changePassword: (data: ChangePasswordRequest) => Promise<ApiResponseTokenResponse>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // 사용자의 직접 로그아웃 요청 중복 방지
  const isLoggingOut = useRef(false)

  // 동시 API 401(예: SESSION_REPLACED) 발생 시 강제 로그아웃 중복 처리 방지
  const isForcedLogout = useRef(false)

  // 로그인 처리 중 잔여 401 에러 및 스토리지 이벤트로 인한 상태 리셋 방지
  const isLoggingIn = useRef(false)

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
    isLoggingIn.current = true
    isForcedLogout.current = false

    try {
      const response = await AuthApi.login(credentials)

      const loginData = response.data
      const token = loginData.accessToken

      if (!token) {
        throw new Error(response.message || '응답에 토큰이 없습니다.')
      }

      localStorage.setItem('user', JSON.stringify(loginData))
      localStorage.setItem('token', token)

      setUser(loginData)
      setIsAuthenticated(true)

      setTimeout(() => {
        isLoggingIn.current = false
      }, 500)

      return loginData
    } catch (error: any) {
      isLoggingIn.current = false
      console.error('로그인 실패:', error)
      throw new Error(
        error.response?.data?.message ||
        error.message ||
        '로그인 중 오류가 발생했습니다.'
      )
    }
  }, [])

  // 비밀번호 변경
  const changePassword = useCallback(async (data: ChangePasswordRequest) => {
    try {
      const response = await AuthApi.changePassword(data)

      const newToken = response.data.accessToken

      if (!newToken) {
        throw new Error('새 토큰이 전달되지 않았습니다.')
      }

      // 1. LocalStorage 토큰 업데이트
      localStorage.setItem('token', newToken)

      // 2. LocalStorage 유저 정보 및 user state 토큰 업데이트
      if (user) {
        const updatedUser = { ...user, accessToken: newToken }
        localStorage.setItem('user', JSON.stringify(updatedUser))
        setUser(updatedUser)
      }
      return response

    } catch (error: any) {
      console.error('비밀번호 변경 실패:', error)
      throw new Error(
        error.response?.data?.message || '비밀번호 변경 중 오류가 발생했습니다.'
      )
    }
  }, [user])

  // 사용자 로그아웃
  const logout = useCallback(async () => {
    if (isLoggingOut.current) return
    isLoggingOut.current = true

    try {
      await AuthApi.logout()
    } catch (error) {
      console.warn('로그아웃 API 호출 실패 (토큰 만료 등):', error)
    } finally {
      clearAuthState()
      isLoggingOut.current = false
    }
  }, [clearAuthState])

  // apiClient interceptor에서 전달되는 강제 로그아웃 콜백 처리
  useEffect(() => {
    setLogoutCallback((code, message, requestToken) => {
      if (isLoggingIn.current || isForcedLogout.current) return

      const currentStoredToken = localStorage.getItem('token')
      if (
        code !== 'SESSION_REPLACED' &&
        requestToken &&
        currentStoredToken &&
        requestToken !== currentStoredToken
      ) {
        return
      }

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

  // StorageEvent 기반 실시간 동기화
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== 'token' && e.key !== 'user') return

      if (isLoggingIn.current) return

      // 삭제 이벤트(로그아웃)인 경우
      if (e.newValue === null) {
        clearAuthState()
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return
      }

      // 저장/변경 이벤트(로그인)인 경우 약간의 타이밍 오차 방지
      setTimeout(() => {
        const savedToken = localStorage.getItem('token')
        const savedUser = localStorage.getItem('user')

        if (savedToken && savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser)
            setUser(parsedUser)
            setIsAuthenticated(true)
            isForcedLogout.current = false

            // 현재 B탭이 /login 화면이면 메인 페이지로 즉시 이동
            if (window.location.pathname === '/login') {
              window.location.href = '/'
            }
          } catch (error) {
            console.error('Failed to parse user on storage change:', error)
            clearAuthState()
          }
        }
      }, 50)
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
      changePassword,
    }),
    [isAuthenticated, user, login, logout, changePassword],
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