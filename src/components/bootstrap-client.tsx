'use client'

/**
 * Loads the Bootstrap 5.3 UMD bundle on the client only (after mount).
 * It powers the data-attribute APIs used by the dashboard
 * (offcanvas sidebar on mobile, dropdowns). Loading inside useEffect
 * keeps SSR/prerender safe — the UMD bundle touches `document` at
 * module-evaluation time.
 */
import { useEffect } from 'react'

export function BootstrapClient() {
  useEffect(() => {
    import('bootstrap/dist/js/bootstrap.bundle.min.js')
  }, [])

  return null
}
