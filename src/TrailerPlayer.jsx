import { useEffect, useEffectEvent, useImperativeHandle, useRef } from 'react'

let apiPromise
function disableCaptions(player) {
  try {
    player.unloadModule?.('captions')
    player.unloadModule?.('cc')
    player.setOption?.('captions', 'track', {})
  } catch {
    // Some trailer embeds do not expose the captions module.
  }
}

function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const previousReady = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.()
        resolve(window.YT)
      }
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      document.head.appendChild(script)
    })
  }
  return apiPromise
}

// Own the iframe inside a host so API cleanup is safe with React Strict Mode.
export default function TrailerPlayer({
  ref,
  videoId,
  title,
  className,
  onMutedChange,
  onPlayingChange,
  controls = false,
}) {
  const host = useRef(null)
  const player = useRef(null)
  const pendingPlayRequest = useRef(null)
  const reportMuted = useEffectEvent((muted) => onMutedChange?.(muted))
  const reportPlaying = useEffectEvent((playing) => onPlayingChange?.(playing))

  useImperativeHandle(
    ref,
    () => ({
      toggleSound() {
        const current = player.current
        if (!current?.getPlayerState) {
          pendingPlayRequest.current = 'sound'
          return
        }
        const wasMuted = current.isMuted()
        if (wasMuted) {
          current.unMute()
          current.setVolume(100)
          current.playVideo()
        } else {
          current.mute()
        }
        onMutedChange?.(!wasMuted)
      },
      togglePlayback() {
        const current = player.current
        if (!current?.getPlayerState) {
          pendingPlayRequest.current = 'muted'
          return
        }
        if (current.getPlayerState() === 1) current.pauseVideo()
        else {
          current.mute()
          current.playVideo()
          reportMuted(true)
        }
      },
    }),
    [onMutedChange]
  )

  useEffect(() => {
    let disposed = false
    let instance
    let revealTimer
    const isMobile = window.matchMedia('(max-width: 700px)').matches
    reportPlaying(false)
    const container = host.current
    const frame = document.createElement('iframe')
    frame.className = className || ''
    if (!isMobile) frame.classList.add('youtube-trailer-pending')
    frame.title = title
    frame.loading = 'eager'
    frame.allow = 'autoplay; encrypted-media; picture-in-picture'
    frame.allowFullscreen = true
    frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=${isMobile ? 0 : 1}&mute=1&controls=${controls ? 1 : 0}&rel=0&cc_load_policy=0&iv_load_policy=3&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
    container.appendChild(frame)
    loadYouTube().then((YT) => {
      if (disposed) return
      instance = new YT.Player(frame, {
        events: {
          onReady({ target }) {
            if (disposed) return
            player.current = target
            disableCaptions(target)
            if (pendingPlayRequest.current) {
              const requestedPlayback = pendingPlayRequest.current
              pendingPlayRequest.current = null
              if (requestedPlayback === 'sound') {
                target.unMute()
                target.setVolume(100)
              } else target.mute()
              target.playVideo()
              reportMuted(requestedPlayback !== 'sound')
            } else {
              target.mute()
              if (!isMobile) target.playVideo()
              reportMuted(true)
            }
          },
          onAutoplayBlocked({ target }) {
            if (disposed) return
            target.mute()
            target.playVideo()
            reportMuted(true)
          },
          onStateChange({ target, data }) {
            if (!disposed && data === 1) {
              reportPlaying(true)
              disableCaptions(target)
              reportMuted(target.isMuted())
              if (!revealTimer && !frame.classList.contains('youtube-trailer-ready')) {
                revealTimer = window.setTimeout(() => {
                  frame.classList.remove('youtube-trailer-pending')
                  frame.classList.add('youtube-trailer-ready')
                }, 150)
              }
            } else if (!disposed && (data === 0 || data === 2)) {
              reportPlaying(false)
            }
          },
        },
      })
    })
    return () => {
      disposed = true
      window.clearTimeout(revealTimer)
      player.current = null
      pendingPlayRequest.current = false
      instance?.destroy()
      container.replaceChildren()
    }
  }, [videoId, title, className, controls])

  return <span ref={host} style={{ display: 'contents' }} />
}
