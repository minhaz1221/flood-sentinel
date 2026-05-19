let faviconInterval: ReturnType<typeof setInterval> | null = null
let faviconState = false

export function startFaviconAlert(): void {
  if (faviconInterval) return

  const normalIcon = '/favicon.svg'
  const alertIcon = '/favicon-alert.svg'

  faviconInterval = setInterval(() => {
    faviconState = !faviconState
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null
    if (link) link.href = faviconState ? alertIcon : normalIcon
  }, 800)
}

export function stopFaviconAlert(): void {
  if (faviconInterval) {
    clearInterval(faviconInterval)
    faviconInterval = null
  }
  faviconState = false
  const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null
  if (link) link.href = '/favicon.svg'
}

let titleInterval: ReturnType<typeof setInterval> | null = null

export function startTitleAlert(upazila: string): void {
  if (titleInterval) return
  let titleState = false
  titleInterval = setInterval(() => {
    titleState = !titleState
    document.title = titleState
      ? `\u{1F6A8} CRITICAL — ${upazila} | Flood Sentinel`
      : `⚠ FLOOD WARNING | Flood Sentinel`
  }, 1200)
}

export function stopTitleAlert(): void {
  if (titleInterval) {
    clearInterval(titleInterval)
    titleInterval = null
  }
  document.title = 'Flood Sentinel'
}
