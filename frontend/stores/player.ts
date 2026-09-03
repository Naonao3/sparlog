import { create } from 'zustand'

interface SeekRequest {
  atSec: number
  /** 同じ秒数を連続で要求しても発火させるための識別子 */
  nonce: number
}

interface PlayerState {
  currentTime: number
  duration: number
  seekRequest: SeekRequest | null
  setCurrentTime: (seconds: number) => void
  setDuration: (seconds: number) => void
  requestSeek: (seconds: number) => void
  reset: () => void
}

/**
 * 動画プレイヤーと、タイムスタンプコメント側の UI を仲介するストア。
 * プレイヤーの実体（Video.js）には触れず、秒数のやり取りだけを担当する。
 */
export const usePlayerStore = create<PlayerState>((set) => ({
  currentTime: 0,
  duration: 0,
  seekRequest: null,
  setCurrentTime: (seconds) => set({ currentTime: seconds }),
  setDuration: (seconds) => set({ duration: seconds }),
  requestSeek: (seconds) => set({ seekRequest: { atSec: seconds, nonce: Date.now() } }),
  reset: () => set({ currentTime: 0, duration: 0, seekRequest: null }),
}))
