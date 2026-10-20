import axios from 'axios'
import type { NavigateFunction } from 'react-router-dom'
import type { ApiResponseTokenResponse } from '@/api/auth/Auth'

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean
  }
}

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 60000,
  withCredentials: true,
  paramsSerializer: (params) => {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => {
          searchParams.append(key, String(v))
        })
      } else if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    })
    return searchParams.toString().replace(/%2C/g, ',')
  },
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

let logoutCallback:
  | ((code?: string, message?: string, requestToken?: string) => void)
  | null = null

export const setLogoutCallback = (
  callback:
    | ((code?: string, message?: string, requestToken?: string) => void)
    | null,
) => {
  logoutCallback = callback
}

// ── Refresh Token State ─────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null

// ── 에러 페이지 이동 ────────────────────────────────────────────────────────
//
//  에러 종류별 페이지
//   - 'server-down' : /server-down  (5xx, 네트워크 단절, 타임아웃)
//   - 'api-error'   : /api-error    (API 404 중 비즈니스 응답이 아닌 것 = 엔드포인트 없음)
//   - (라우팅 404)  : '*' → NotFound (프론트 라우트에 없는 주소, 여기서 다루지 않음)

type ErrorPageKind = 'server-down' | 'api-error'

const ERROR_PATHS: Record<ErrorPageKind, string> = {
  'server-down': '/server-down',
  'api-error': '/api-error',
}

interface ErrorPageInfo {
  status?: number
  method?: string
  url?: string
}

let navigateFn: NavigateFunction | null = null
let getCurrentPathFn: (() => string) | null = null
let isErrorRedirecting = false

export const setApiNavigator = (
  navigate: NavigateFunction,
  getCurrentPath: () => string,
) => {
  navigateFn = navigate
  getCurrentPathFn = getCurrentPath
}

const getCurrentPath = () =>
  getCurrentPathFn?.() ??
  window.location.pathname + window.location.search + window.location.hash

const isOnErrorPage = (path: string) =>
  Object.values(ERROR_PATHS).some((p) => path.startsWith(p))

const goErrorPage = (kind: ErrorPageKind, info: ErrorPageInfo = {}) => {
  if (isErrorRedirecting) return

  const nowPath = getCurrentPath()
  if (isOnErrorPage(nowPath)) return

  isErrorRedirecting = true
  setTimeout(() => {
    isErrorRedirecting = false
  }, 500)

  // "다시 시도" 시 돌아올 경로
  sessionStorage.setItem('preServerDownPath', nowPath)

  // 아직 navigate 가 등록되지 않은 경우(앱 초기 로딩 등)에는 하드 이동
  if (!navigateFn) {
    window.location.replace(ERROR_PATHS[kind])
    return
  }

  navigateFn(ERROR_PATHS[kind], {
    replace: true,
    state: { from: nowPath, ...info },
  })
}

// ── 에러 분류 ───────────────────────────────────────────────────────────────

/** 백엔드가 내려준 비즈니스 에러(JSON 의 code/message)인지 */
const hasBusinessBody = (data: unknown): boolean => {
  if (typeof data !== 'object' || data === null) return false
  const { code, message } = data as { code?: unknown; message?: unknown }
  return !!(code || message)
}

/**
 * 공통 에러 페이지로 보낼 에러인지 분류한다.
 * null 이면 호출한 화면에서 직접 처리하도록 reject 한다.
 */
const classifyError = (error: unknown): ErrorPageKind | null => {
  if (!axios.isAxiosError(error)) return null

  const status = error.response?.status
  const code = error.code
  const data = error.response?.data

  // 사용자가 취소한 요청은 무시
  if (code === 'ERR_CANCELED') return null

  // 1. 네트워크 단절 / 타임아웃 (응답 자체가 없음)
  if (!error.response) {
    if (code && ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'].includes(code)) {
      return 'server-down'
    }
    return null
  }

  // 2. 게이트웨이/서버 다운 계열
  if (status && [502, 503, 504].includes(status)) return 'server-down'

  // 3. 500: 백엔드 비즈니스 예외(JSON code/message)면 화면에서 처리, 아니면 서버 장애
  if (status === 500) return hasBusinessBody(data) ? null : 'server-down'

  // 4. 404: 비즈니스 응답(데이터 없음 등)이면 화면에서 처리, 아니면 API 엔드포인트 없음
  if (status === 404) return hasBusinessBody(data) ? null : 'api-error'

  return null
}

// ── Request Header 토큰 추출 헬퍼 함수 ───────────────────────────────────────
const extractRequestToken = (config: any): string | undefined => {
  if (!config?.headers) return undefined
  let authHeader: string | undefined

  if (typeof config.headers.get === 'function') {
    authHeader = config.headers.get('Authorization')
  } else {
    authHeader = config.headers['Authorization'] || config.headers['authorization']
  }

  return authHeader?.replace(/^Bearer\s+/i, '')
}

// ── Response interceptor ────────────────────────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    // 1. 서버 다운 / API 404 → 전용 에러 페이지
    const errorKind = classifyError(error)
    if (errorKind) {
      goErrorPage(errorKind, {
        status: error.response?.status,
        method: error.config?.method,
        url: error.config?.url,
      })
      // 에러 페이지로 전환되므로, 호출한 페이지의 catch 알림을 억제합니다.
      return new Promise(() => {})
    }

    // 2. 403 Forbidden 에러 핸들링
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      const errorMessage =
        error.response?.data?.message || '접근 권한이 없습니다.'

      alert(errorMessage)

      if (navigateFn) {
        navigateFn('/', { replace: true })
      } else {
        window.location.href = '/'
      }

      return new Promise(() => {})
    }

    // 3. 401 Unauthorized 에러 핸들링
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const originalRequest = error.config
      const errorCode = error.response?.data?.code
      const errorMessage = error.response?.data?.message

      const requestToken = extractRequestToken(originalRequest)

      if (!originalRequest) {
        logoutCallback?.(undefined, undefined, requestToken)
        // 강제 로그아웃 시 페이지단 catch 알림 차단
        return new Promise(() => {})
      }

      const url = originalRequest.url ?? ''

      // Auth 관련 엔드포인트에서 401 발생 시 바로 실패 반환 (로그인 실패 등)
      if (
        url.includes('/auth/login') ||
        url.includes('/auth/logout') ||
        url.includes('/auth/refresh') ||
        url.includes('/auth/change-password')
      ) {
        return Promise.reject(error)
      }

      // 다른 장치에서 중복 로그인된 경우 (즉시 강제 로그아웃)
      if (errorCode === 'SESSION_REPLACED') {
        logoutCallback?.(errorCode, errorMessage, requestToken)
        // 호출한 페이지의 catch 블록이 실행되지 않도록 Pending Promise 반환
        return new Promise(() => {})
      }

      // 초기 비밀번호 변경 필요 시 강제 리다이렉트
      if (errorCode === 'PASSWORD_CHANGE_REQUIRED') {
        const nowPath = getCurrentPath()

        // 무한 리다이렉트 방지
        if (!nowPath.includes('/change-password')) {
          navigateFn?.('/change-password', { replace: true })
        }

        // 화면 전환이 일어나므로 개별 컴포넌트의 catch(에러 토스트 등) 차단
        return new Promise(() => {})
      }

      // 이미 재시도한 요청이 또 401인 경우 (재발급 받은 토큰도 만료/유효하지 않은 경우)
      if (originalRequest._retry) {
        logoutCallback?.(errorCode, errorMessage, requestToken)
        return new Promise(() => {})
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

              logoutCallback?.(errCode, errMsg, requestToken)
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
        // 토큰 재발급에 최종 실패하여 로그아웃 처리된 경우에도 페이지단 catch 알림을 차단
        return new Promise(() => {})
      }
    }

    return Promise.reject(error)
  },
)
