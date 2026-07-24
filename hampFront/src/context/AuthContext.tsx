import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { apiClient, setLogoutCallback } from '@/api/apiClient'
import type { 
  LoginRequest, 
  ApiResponseLoginResponse, 
  LoginResponse,
  ApiResponseTokenResponse,
  ApiResponseVoid
} from '@/types/auth/Auth'

interface AuthContextValue {
  isAuthenticated: boolean
  user: LoginResponse | null
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<string>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => !!localStorage.getItem('token'),
  )

  const [user, setUser] = useState<LoginResponse | null>(() => {
    const savedUser = localStorage.getItem('user')
    return savedUser ? JSON.parse(savedUser) : null
  })

  const refreshToken = useCallback(async (): Promise<string> => {
    try {
      const response = await apiClient.post<ApiResponseTokenResponse>('/auth/token')
      const newToken = response.data?.data?.accessToken

      if (!newToken) {
        throw new Error('재발급된 토큰이 존재하지 않습니다.')
      }

      localStorage.setItem('token', newToken)
      setIsAuthenticated(true)
      return newToken
    } catch (error) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
      setIsAuthenticated(false)
      throw error
    }
  }, [])

  const login = async (credentials: LoginRequest) => {
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
  }

  const logout = useCallback(async () => {
    try {
      await apiClient.post<ApiResponseVoid>('/auth/logout')
    } catch (error) {
      console.error('로그아웃 API 호출 중 오류 발생:', error)
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
      setIsAuthenticated(false)
    }
  }, [])

  useEffect(() => {
    setLogoutCallback(() => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
      setIsAuthenticated(false)
    })
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}