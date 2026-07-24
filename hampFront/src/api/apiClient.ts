import axios from 'axios'
import type { NavigateFunction } from 'react-router-dom'

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 60000,
  withCredentials: true,
})

// ── Request interceptor ─────────────────────────────────────────────────────

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')

  // Authorization token Bearer 여부 체크
  if (token) {
    config.headers.Authorization = token.startsWith('Bearer ') 
      ? token 
      : `Bearer ${token}`
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
        // 1) 로그인 요청이나 토큰 재발급 요청 자체가 401을 받은 경우 (리프레시 토큰까지 만료됨)
        if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/token')) {
          logoutCallback?.()
          return Promise.reject(error)
        }

        // 2) 이미 한 번 재시도했던 요청인데 또 401인 경우 (중복 순환 방지)
        if ((originalRequest as { _retry?: boolean })._retry) {
          logoutCallback?.()
          return Promise.reject(error)
        }

        ;(originalRequest as { _retry?: boolean })._retry = true

        try {
          // 3) 이미 진행 중인 재발급이 없다면 새롭게 재발급 Promise 실행
          if (!refreshPromise) {
            refreshPromise = (async () => {
              try {
                const response = await axios.post('/api/auth/token', {}, { withCredentials: true })
                const newToken = response.data?.data?.accessToken

                if (!newToken) {
                  throw new Error('새 토큰이 존재하지 않습니다.')
                }

                localStorage.setItem('token', newToken)
                return newToken
              } catch (refreshError) {
                // 리프레시 토큰 만료 시 안내 및 로그아웃
                alert('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.')
                logoutCallback?.()
                throw refreshError
              } finally {
                // 재발급 작업이 끝나면 Promise 변수 초기화
                refreshPromise = null
              }
            })()
          }

          // 4) 401을 맞이한 모든 요청이 '동일한 refreshPromise'의 결과(newToken)를 같이 기다렸다가 받음
          const newToken = await refreshPromise

          // 원래 실패했던 요청에 새 토큰을 싣고 다시 실행
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return apiClient(originalRequest)

        } catch (refreshError) {
          return Promise.reject(refreshError)
        }
      }

      // config가 없는 예외적인 401의 경우 바로 로그아웃
      logoutCallback?.()
    }

    return Promise.reject(error)
  },
)