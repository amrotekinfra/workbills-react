import { useCallback, useRef } from 'react'

// Global toast element — one instance in the DOM
export function Toast() {
  return <div id="wb-toast" className="toast" aria-live="polite" />
}

export function useToast() {
  const timerRef = useRef(null)
  const show = useCallback((msg, ms = 2600) => {
    const el = document.getElementById('wb-toast')
    if (!el) return
    el.textContent = msg
    el.classList.add('show')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => el.classList.remove('show'), ms)
  }, [])
  return show
}
