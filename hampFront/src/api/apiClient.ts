import axios from 'axios'
import type { NavigateFunction } from 'react-router-dom'
import type { ApiResponseTokenResponse } from '@/types/auth/Auth'

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

// Refresh 전용 인스턴스
const refreshClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  withCredentials: true,
})

// ── Request interceptor ─────────────────────────────────────────────────────

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')

  if (token && config.headers) {
    if (typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`)
    } else {
      config.headers['Authorization'] = `Bearer ${token}`
    }
  }

  return config
})

// ── Logout callback ─────────────────────────────────────────────────────────

let logoutCallback: ((code?: string, message?: string) => void) | null = null

export const setLogoutCallback = (
  callback: ((code?: string, message?: string) => void) | null,
) => {
  logoutCallback = callback
}

// ── Refresh Token State ─────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null

// ── Server-down redirect ────────────────────────────────────────────────────

let navigateFn: NavigateFunction | null = null
let getCurrentPathFn: (() => string) | null = null
let isServerDownRedirecting = false

export const setApiNavigator = (
  navigate: NavigateFunction,
  getCurrentPath: () => string,
) => {
  navigateFn = navigate
  getCurrentPathFn = getCurrentPath
}

const getCurrentPath = () =>
  getCurrentPathFn?.() ??
  window.location.pathname +
  window.location.search +
  window.location.hash

const goServerDown = () => {
  if (!navigateFn || isServerDownRedirecting) return

  const nowPath = getCurrentPath()

  if (nowPath.startsWith('/server-down')) return

  isServerDownRedirecting = true

  sessionStorage.setItem('preServerDownPath', nowPath)

  navigateFn('/server-down', {
    replace: true,
    state: { from: nowPath },
  })

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
    // 1. 서버 다운 또는 네트워크 단절 에러 처리
    if (isServerDownError(error)) {
      goServerDown()
      return Promise.reject(error)
    }

    // 2. 401 Unauthorized 에러 핸들링
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const originalRequest = error.config
      const errorCode = error.response?.data?.code
      const errorMessage = error.response?.data?.message

      if (!originalRequest) {
        logoutCallback?.()
        return Promise.reject(error)
      }

      const url = originalRequest.url ?? ''

      // Auth 관련 엔드포인트에서 401 발생 시 바로 실패 반환
      if (
        url.includes('/auth/login') ||
        url.includes('/auth/logout') ||
        url.includes('/auth/refresh')
      ) {
        return Promise.reject(error)
      }

      // 다른 장치에서 중복 로그인된 경우 (즉시 강제 로그아웃)
      if (errorCode === 'SESSION_REPLACED') {
        logoutCallback?.(errorCode, errorMessage)
        return Promise.reject(error)
      }

      // 이미 재시도한 요청이 또 401인 경우 (재발급 토큰도 만료된 경우)
      if (originalRequest._retry) {
        logoutCallback?.(errorCode, errorMessage)
        return Promise.reject(error)
      }

      // Silent Refresh 시도
      originalRequest._retry = true

      try {
        if (!refreshPromise) {
          refreshPromise = (async () => {
            try {
              const response =
                await refreshClient.post<ApiResponseTokenResponse>(
                  '/auth/refresh',
                )

              const newToken = response.data?.data?.accessToken

              if (!newToken) {
                throw new Error('새 토큰이 없습니다.')
              }

              localStorage.setItem('token', newToken)
              return newToken
            } catch (refreshError) {
              // Refresh 실패 시 비로소 강제 로그아웃 처리
              let errCode = errorCode || 'AUTH_FAILED'
              let errMsg = errorMessage

              if (axios.isAxiosError(refreshError)) {
                errCode = refreshError.response?.data?.code || errCode
                errMsg = refreshError.response?.data?.message || errMsg
              }

              logoutCallback?.(errCode, errMsg)
              throw refreshError
            } finally {
              refreshPromise = null
            }
          })()
        }

        const newToken = await refreshPromise

        // 요청 헤더 업데이트 후 기존 요청 재시도
        if (originalRequest.headers) {
          if (typeof originalRequest.headers.set === 'function') {
            originalRequest.headers.set('Authorization', `Bearer ${newToken}`)
          } else {
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`
          }
        }

        return apiClient(originalRequest)
      } catch (refreshError) {
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)