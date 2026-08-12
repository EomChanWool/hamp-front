import axios from 'axios'
import type { NavigateFunction } from 'react-router-dom'
import type { ApiResponseTokenResponse } from '@/types/auth/Auth'

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean
  }
}

// ── 브라우저 완전 종료 감지 및 토큰 정리 ──────────────────────────────────────
// 새로고침 시에는 sessionStorage가 유지되지만, 브라우저/탭을 닫으면 사라집니다.
// 이를 이용해 브라우저가 새로 켜진 것인지(종료 후 재시작) 판별합니다.
if (!sessionStorage.getItem('session_alive')) {
  // 브라우저를 완전히 닫았다가 켰을 때만 로컬스토리지의 토큰을 강제 삭제
  localStorage.removeItem('token')
}
// 현재 세션이 살아있음을 표시
sessionStorage.setItem('session_alive', 'true')

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

let isAlerting = false // 중복 얼럿 방지용

const goServerDown = () => {
  // 만약 네비게이터가 없거나 아직 페이지가 준비되지 않았다면 임시 얼럿 및 새로고침 실행
  if (!navigateFn) {
    if (isAlerting) return
    isAlerting = true
    alert('서버 연결에 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    window.location.reload()
    return
  }

  if (isServerDownRedirecting) return

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
  const url = error.config?.url ?? ''
  const responseData = error.response?.data

  // 1. 서버가 죽었거나 네트워크 오류인 경우 (500번대, 네트워크 에러)
  if (status && [500, 502, 503, 504].includes(status)) return true
  if (code && ['ECONNABORTED', 'ERR_NETWORK'].includes(code)) return true
  
  // 2. 404 에러 처리 (라우팅 실패 등)
  if (status === 404 && url.startsWith('/')) {
    // 백엔드가 비즈니스 에러를 보낼 때 보통 에러 코드(code)나 메시지를 담습니다.
    // 만약 데이터 자체가 없거나, 우리 백엔드의 비즈니스 에러 규격이 아니라면
    // 이건 서버/프록시가 띄운 404이므로 서버 다운으로 간주합니다.
    const isBusinessError = !!(responseData?.code || responseData?.message)
    
    if (!isBusinessError) {
      return true
    }
  }

  return false
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
    // 1. 서버 다운 또는 네트워크 단절 에러 처리
    if (isServerDownError(error)) {
      goServerDown()
      // 서버 다운 페이지로 전환되므로, 호출한 페이지의 catch 알림을 억제합니다.
      return new Promise(() => {})
    }

    // 2. 401 Unauthorized 에러 핸들링
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