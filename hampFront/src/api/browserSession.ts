// ── 상수 ────────────────────────────────────────────────────────────────────

/** 이 탭이 이미 판별을 마쳤음을 표시하는 sessionStorage 키 (탭 단위, 새로고침에는 유지됨) */
const TAB_FLAG_KEY = 'session_alive'

/** BroadcastChannel 이름 */
const CHANNEL_NAME = 'browser-session'

/** PING 한 번당 응답 대기 시간 */
const PING_TIMEOUT_MS = 1000

/** PING 재시도 횟수 (응답이 없을 때 최대 PING_TIMEOUT_MS * MAX_ATTEMPTS 만큼 대기) */
const MAX_ATTEMPTS = 3

/** [Web Locks] 살아 있는 탭이 공통으로 쥐고 있는 락 이름 */
const LOCK_NAME = 'browser-session-alive'

// ── 타입 / 탭 식별자 ────────────────────────────────────────────────────────

type Msg =
  | { type: 'PING'; from: string }
  | { type: 'PONG'; to: string }

/** 이 탭(페이지)을 구분하기 위한 고유 ID. PING/PONG 주고받을 때 자기 자신을 걸러내는 용도 */
const TAB_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`

// ── Web Locks 지원 여부 ─────────────────────────────────────────────────────

/** navigator.locks는 HTTPS/localhost에서만 존재한다. 없으면 PING 폴백을 사용한다. */
const hasLockApi =
  typeof navigator !== 'undefined' && !!navigator.locks

// ── BroadcastChannel 설정 ────────────────────────────────────────────

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(CHANNEL_NAME)
    : null

/** 모듈 단위로 판별을 한 번만 실행하기 위한 Promise 캐시 */
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

/** PING을 한 번 보내고, 다른 탭의 PONG이 오면 true, 시간 초과면 false */
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

      // 나에게 온 PONG일 때만 인정
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

/** 여러 번 재시도해서 한 번이라도 응답이 있으면 true */
const hasLivePeer = async (): Promise<boolean> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (await hasLivePeerOnce()) {
      return true
    }
  }

  return false
}

// ── [Web Locks] 판별 / 락 유지 ──────────────────────────────────────────────

/** 다른 탭이 락을 쥐고 있는지 조회한다. (타임아웃 없이 즉시 결과가 나온다) */
const hasLiveTabByLock = async (): Promise<boolean> => {
  const { held = [] } = await navigator.locks.query()
  return held.some((lock) => lock.name === LOCK_NAME)
}

/**
 * 이 탭이 살아 있는 동안 공유 락을 유지한다.
 * - callback이 영원히 resolve되지 않으므로 탭이 닫힐 때까지 락이 유지되고,
 *   탭이 닫히거나 크래시되면 브라우저가 자동으로 해제한다.
 * - shared 모드라서 여러 탭이 동시에 쥘 수 있다.
 */
const holdAliveLock = () => {
  navigator.locks
    .request(LOCK_NAME, { mode: 'shared' }, () => new Promise<void>(() => {}))
    .catch((error) => {
      console.error('세션 락 획득 실패:', error)
    })
}

// ── 프리렌더링 보호 ─────────────────────────────────────────────────────────

/**
 * 주소창 입력 중 브라우저가 미리 렌더링(prerender)하는 페이지에서는
 * 세션 판별/localStorage 삭제를 하면 안 된다.
 * 실제로 사용자가 해당 페이지로 이동해 활성화될 때까지 기다린다.
 */
const waitForActivation = (): Promise<void> => {
  // document.prerendering은 TS 기본 타입에 없을 수 있어 any로 접근
  if (!(document as any).prerendering) return Promise.resolve()

  return new Promise((resolve) => {
    document.addEventListener('prerenderingchange', () => resolve(), {
      once: true,
    })
  })
}

export const ensureBrowserSession = (): Promise<void> => {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        // 1. 프리렌더링 단계에서는 아무것도 하지 않고 대기
        await waitForActivation()

        const wasAlive = sessionStorage.getItem(TAB_FLAG_KEY) === 'true'

        // 2. 현재 탭에 세션 표시가 없을 때만 다른 탭을 확인
        //    (같은 탭의 새로고침/주소 변경은 sessionStorage가 유지되므로 여기를 건너뜀)
        if (!wasAlive) {
          const alive = hasLockApi
            ? await hasLiveTabByLock() // HTTPS: 즉시 판별
            : await hasLivePeer() // HTTP 등: PING 폴백 (최대 약 3초)

          // 모든 확인에서 살아 있는 탭이 없을 때만 로그인 정보를 정리한다.
          if (!alive) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
          }

          sessionStorage.setItem(TAB_FLAG_KEY, 'true')
        }
      } catch (error) {
        // 브라우저 저장소 접근 오류 시 토큰을 함부로 삭제하지 않는다.
        console.error('브라우저 세션 확인 실패:', error)
      } finally {
        // 3. 판별이 끝난 뒤에 내 락을 잡는다.
        //    (판별 전에 잡으면 내가 나를 "살아 있는 탭"으로 오인할 수 있다)
        if (hasLockApi) holdAliveLock()
      }
    })()
  }

  return initPromise
}
