// Một AudioContext duy nhất dùng lại cho mọi tiếng chuông (trình duyệt giới hạn số context & không tự đóng)
let sharedAudioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (sharedAudioContext && sharedAudioContext.state !== 'closed') return sharedAudioContext

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null

  sharedAudioContext = new AudioContextClass()
  return sharedAudioContext
}

/**
 * Phát tiếng "ting" ngắn khi có tin nhắn mới (FR-32). Lỗi autoplay bị bỏ qua êm.
 */
export function playNotificationSound(): void {
  try {
    const audioCtx = getAudioContext()
    if (!audioCtx) return
    // Context có thể bị "suspended" cho đến khi người dùng tương tác
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume()?.catch?.(() => {})
    }
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime)
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.35)
  } catch {
    // ignore audio play restriction if not yet interacted
  }
}

/** Chỉ dùng cho unit test: xóa context đã cache */
export function resetNotificationSoundForTest(): void {
  sharedAudioContext = null
}
