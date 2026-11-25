import { useEffect, type RefObject } from 'react'
import gsap from 'gsap'

/**
 * Animates `.gsap-reveal` descendants inside `containerRef` with a subtle
 * staggered upward fade on mount. Respects `prefers-reduced-motion`.
 */
export function useStaggerReveal(containerRef: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>('.gsap-reveal', el)
      if (!targets.length) return
      gsap.fromTo(
        targets,
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.055,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        },
      )
    }, el)

    return () => ctx.revert()
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}
