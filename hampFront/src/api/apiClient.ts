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
  if (token) config.headers.Authorization = token
  return config
})

// ── Logout callback ─────────────────────────────────────────────────────────

let logoutCallback: (() => void) | null = null

export const setLogoutCallback = (callback: () => void) => {
  logoutCallback = callback
}

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
  (error) => {
    if (isServerDownError(error)) {
      goServerDown()
      return Promise.reject(error)
    }

    if (axios.isAxiosError(error) && error.response?.status === 401) {
      logoutCallback?.()
    }

    // 백엔드에서 내려준 에러 메시지 추출 로직 추가
    if (axios.isAxiosError(error) && error.response?.data) {
      const backendMessage = error.response.data.message
      if (backendMessage) {
        return Promise.reject(new Error(backendMessage))
      }
    }

    return Promise.reject(error)
  },
)
