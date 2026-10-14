const TAB_FLAG_KEY = 'session_alive'
const CHANNEL_NAME = 'browser-session'
const PING_TIMEOUT_MS = 1000
const MAX_ATTEMPTS = 3

type Msg =
  | { type: 'PING'; from: string }
  | { type: 'PONG'; to: string }

const TAB_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(CHANNEL_NAME)
    : null

let initPromise: Promise<void> | null = null

// 초기화 완료 여부와 관계없이 살아 있는 탭은 PING에 응답한다.
channel?.addEventListener('message', (event: MessageEvent<Msg>) => {
  const msg = event.data

  if (msg?.type === 'PING' && msg.from !== TAB_ID) {
    channel.postMessage({
      type: 'PONG',
      to: msg.from,
    } satisfies Msg)
  }
})

const hasLivePeerOnce = (): Promise<boolean> => {
  if (!channel) {
    // 탭 간 통신을 확인할 수 없으면 살아 있는 탭이 없다고 단정하지 않는다.
    return Promise.resolve(true)
  }

  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>

    const cleanup = (result: boolean) => {
      clearTimeout(timer)
      channel.removeEventListener('message', onMessage)
      resolve(result)
    }

    const onMessage = (event: MessageEvent<Msg>) => {
      const msg = event.data

      if (msg?.type === 'PONG' && msg.to === TAB_ID) {
        cleanup(true)
      }
    }

    channel.addEventListener('message', onMessage)

    timer = setTimeout(() => {
      cleanup(false)
    }, PING_TIMEOUT_MS)

    channel.postMessage({
      type: 'PING',
      from: TAB_ID,
    } satisfies Msg)
  })
}

const hasLivePeer = async (): Promise<boolean> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (await hasLivePeerOnce()) {
      return true
    }
  }

  return false
}

export const ensureBrowserSession = (): Promise<void> => {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const wasAlive =
          sessionStorage.getItem(TAB_FLAG_KEY) === 'true'

        // 현재 탭에 세션 표시가 없을 때만 다른 탭을 확인한다.
        if (!wasAlive) {
          const alive = await hasLivePeer()

          // 모든 확인에서 응답이 없을 때만 로그인 정보를 정리한다.
          if (!alive) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
          }

          sessionStorage.setItem(TAB_FLAG_KEY, 'true')
        }
      } catch (error) {
        // 브라우저 저장소 접근 오류 시 토큰을 함부로 삭제하지 않는다.
        console.error('브라우저 세션 확인 실패:', error)
      }
    })()
  }

  return initPromise
}