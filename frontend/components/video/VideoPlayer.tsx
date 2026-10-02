'use client'

import { useEffect, useRef } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import { resolvePlaybackMimeType } from '@/lib/utils/video'
import { usePlayerStore } from '@/stores/player'

type Player = ReturnType<typeof videojs>

interface VideoPlayerProps {
  src: string
  mimeType: string | null
  poster?: string | null
}

/**
 * Video.js のラッパー。
 * 再生位置は Zustand ストア経由でタイムスタンプコメント側とやり取りする。
 */
export function VideoPlayer({ src, mimeType, poster }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)

  const setCurrentTime = usePlayerStore((state) => state.setCurrentTime)
  const setDuration = usePlayerStore((state) => state.setDuration)
  const seekRequest = usePlayerStore((state) => state.seekRequest)
  const resetPlayer = usePlayerStore((state) => state.reset)

  // プレイヤーの生成と破棄（マウント中は1インスタンスだけ持つ）
  useEffect(() => {
    if (playerRef.current || !containerRef.current) return

    const videoElement = document.createElement('video-js')
    videoElement.classList.add('vjs-big-play-centered', 'vjs-fluid')
    containerRef.current.appendChild(videoElement)

    const player = videojs(videoElement, {
      controls: true,
      preload: 'auto',
      playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2],
      controlBar: { pictureInPictureToggle: false },
    })

    player.on('timeupdate', () => setCurrentTime(player.currentTime() ?? 0))
    player.on('loadedmetadata', () => setDuration(player.duration() ?? 0))

    playerRef.current = player

    return () => {
      player.dispose()
      playerRef.current = null
      resetPlayer()
    }
  }, [setCurrentTime, setDuration, resetPlayer])

  // ソースの差し替え（署名付き URL は期限切れで再取得されることがある）
  useEffect(() => {
    const player = playerRef.current
    if (!player || src.length === 0) return

    player.src({ src, type: resolvePlaybackMimeType(mimeType) })
    if (poster) player.poster(poster)
  }, [src, mimeType, poster])

  // タイムスタンプコメントからのシーク要求
  useEffect(() => {
    const player = playerRef.current
    if (!player || !seekRequest) return

    async function seekAndPlay(target: Player, atSec: number): Promise<void> {
      target.currentTime(atSec)
      try {
        await target.play()
      } catch {
        // 自動再生がブロックされた場合はシークのみ反映する
      }
    }

    void seekAndPlay(player, seekRequest.atSec)
  }, [seekRequest])

  return (
    <div className="overflow-hidden rounded-lg bg-black" data-vjs-player>
      <div ref={containerRef} />
    </div>
  )
}
