import axios from 'axios'
import type { NavigateFunction } from 'react-router-dom'

// Axios Request Config 타입 확장 (_retry 지원)
declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean
  }
}

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 60000,
  withCredentials: true,
})

// ── Request interceptor ─────────────────────────────────────────────────────

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')

  if (token) {
    const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`
    config.headers.set('Authorization', authHeader)
  }
  return config
})

// ── Logout callback ─────────────────────────────────────────────────────────

let logoutCallback: (() => void) | null = null

export const setLogoutCallback = (callback: () => void) => {
  logoutCallback = callback
}

// ── Refresh Token State (Promise 공유 방식) ────────────────────────────────

let refreshPromise: Promise<string> | null = null

// ── Server-down redirect ────────────────────────────────────────────────────

let navigateFn: NavigateFunction | null = null
let getCurrentPathFn: (() => string) | null = null
let isServerDownRedirecting = false

export const setApiNavigator = (navigate: NavigateFunction, getCurrentPath: () => string) => {
  navigateFn = navigate
  getCurrentPathFn = getCurrentPath
}

const getCurrentPath = () =>
  getCurrentPathFn?.() ?? window.location.pathname + window.location.search + window.location.hash

const goServerDown = () => {
  if (!navigateFn || isServerDownRedirecting) return
  const nowPath = getCurrentPath()
  if (nowPath.startsWith('/server-down')) return

  isServerDownRedirecting = true
  sessionStorage.setItem('preServerDownPath', nowPath)
  navigateFn('/server-down', { replace: true, state: { from: nowPath } })
  setTimeout(() => {
    isServerDownRedirecting = false
  }, 500)
}

const isServerDownError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false
  const status = error.response?.status
  const code = error.code
  if (status && [502, 503, 504].includes(status)) return true
  if (code && ['ECONNABORTED', 'ERR_NETWORK'].includes(code)) return true
  return false
}

// ── Response interceptor ────────────────────────────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (isServerDownError(error)) {
      goServerDown()
      return Promise.reject(error)
    }

    if (axios.isAxiosError(error) && error.response?.data?.message) {
      error.message = error.response.data.message
    }

    // 401 Unauthorized 발생 시 자동 토큰 재발급(Silent Refresh) 처리
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const originalRequest = error.config

      if (originalRequest) {
        const url = originalRequest.url ?? ''

        // 로그인, 토큰 재발급, 로그아웃 요청 자체가 401인 경우 즉시 로그아웃
        if (url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout')) {
          return Promise.reject(error)
        }

        // 재시도했던 요청이 또 401인 경우 무한 루프 방지
        if (originalRequest._retry) {
          logoutCallback?.()
          return Promise.reject(error)
        }

        originalRequest._retry = true

        try {
          // 이미 재발급 중인 요청이 없다면 단 하나의 Promise 생성 (동시 요청 처리)
          if (!refreshPromise) {
            refreshPromise = (async () => {
              try {
                const baseURL = apiClient.defaults.baseURL ?? ''
                const refreshUrl = `${baseURL.replace(/\/$/, '')}/auth/refresh`

                const response = await axios.post(refreshUrl, {}, { withCredentials: true })
                const newToken = response.data?.data?.accessToken

                if (!newToken) {
                  throw new Error('새 토큰이 존재하지 않습니다.')
                }

                localStorage.setItem('token', newToken)
                return newToken
              } catch (refreshError) {
                localStorage.removeItem('token')
                logoutCallback?.()
                throw refreshError
              } finally {
                refreshPromise = null
              }
            })()
          }

          // 모든 401 요청이 동일한 재발급 결과를 대기
          const newToken = await refreshPromise
          
          // 새 토큰으로 헤더 교체 후 요청 재시도
          originalRequest.headers.set('Authorization', `Bearer ${newToken}`)
          return apiClient(originalRequest)

        } catch (refreshError) {
          return Promise.reject(refreshError)
        }
      }
      logoutCallback?.()
    }
    return Promise.reject(error)
  },
)