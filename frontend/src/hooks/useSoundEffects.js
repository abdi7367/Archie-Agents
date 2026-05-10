import { useEffect, useRef } from 'react'

export const useSoundEffects = () => {
  const audioContext = useRef(null)

  useEffect(() => {
    // Initialize Web Audio API
    audioContext.current = new (window.AudioContext || window.webkitAudioContext)()
    
    return () => {
      if (audioContext.current) {
        audioContext.current.close()
      }
    }
  }, [])

  const playClickSound = () => {
    if (!audioContext.current) return
    
    const oscillator = audioContext.current.createOscillator()
    const gainNode = audioContext.current.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.current.destination)
    
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0.1, audioContext.current.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.current.currentTime + 0.1)
    
    oscillator.start(audioContext.current.currentTime)
    oscillator.stop(audioContext.current.currentTime + 0.1)
  }

  const playHoverSound = () => {
    if (!audioContext.current) return
    
    const oscillator = audioContext.current.createOscillator()
    const gainNode = audioContext.current.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.current.destination)
    
    oscillator.frequency.value = 600
    oscillator.type = 'triangle'
    
    gainNode.gain.setValueAtTime(0.05, audioContext.current.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.current.currentTime + 0.05)
    
    oscillator.start(audioContext.current.currentTime)
    oscillator.stop(audioContext.current.currentTime + 0.05)
  }

  const playTypingSound = () => {
    if (!audioContext.current) return
    
    const oscillator = audioContext.current.createOscillator()
    const gainNode = audioContext.current.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.current.destination)
    
    oscillator.frequency.value = 1200
    oscillator.type = 'square'
    
    gainNode.gain.setValueAtTime(0.02, audioContext.current.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.current.currentTime + 0.02)
    
    oscillator.start(audioContext.current.currentTime)
    oscillator.stop(audioContext.current.currentTime + 0.02)
  }

  return { playClickSound, playHoverSound, playTypingSound }
}
