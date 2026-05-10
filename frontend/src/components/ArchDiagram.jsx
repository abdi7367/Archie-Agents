import React, { useEffect, useRef, useState } from 'react'
import './ArchDiagram.css'

let mermaidInitialized = false

const initMermaid = async () => {
  if (mermaidInitialized) return
  const mermaid = (await import('mermaid')).default
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      primaryColor: '#6366f1',
      primaryTextColor: '#e0e0e0',
      primaryBorderColor: '#6366f1',
      lineColor: '#a0a0a0',
      secondaryColor: '#8b5cf6',
      tertiaryColor: '#3b82f6',
      background: '#0f0f23',
      mainBkg: '#1a1a2e',
      secondBkg: '#262646',
      tertiaryBkg: '#16213e',
      nodeBorder: '#6366f1',
      clusterBkg: 'rgba(99, 102, 241, 0.1)',
      clusterBorder: '#6366f1',
      titleColor: '#e0e0e0',
      edgeLabelBackground: '#0f0f23',
      nodeTextColor: '#e0e0e0',
    },
    flowchart: {
      useMaxWidth: true,
      htmlLabels: false, // KEY: false avoids the removeChild DOM crash
      curve: 'basis',
      padding: 16,
      nodeSpacing: 50,
      rankSpacing: 50,
    },
    securityLevel: 'loose',
  })
  mermaidInitialized = true
}

const sanitizeDiagram = (src) => {
  if (!src || typeof src !== 'string') return null
  let fixed = src.trim()

  // Strip markdown fences
  if (fixed.startsWith('```')) {
    fixed = fixed
      .split('\n')
      .filter((l) => !l.trim().startsWith('```'))
      .join('\n')
      .trim()
  }

  // Ensure a valid diagram type header
  const validPrefixes = [
    'flowchart', 'graph TD', 'graph LR', 'graph BT', 'graph RL',
    'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram',
  ]
  const hasPrefix = validPrefixes.some((p) =>
    fixed.toLowerCase().startsWith(p.toLowerCase())
  )
  if (!hasPrefix) {
    fixed = `flowchart LR\n${fixed}`
  }

  // Normalise graph TD → flowchart LR for better rendering
  fixed = fixed.replace(/^graph\s+TD/im, 'flowchart LR')

  return fixed
}

let _counter = 0
const uniqueId = () => `mermaid-arch-${Date.now()}-${++_counter}`

const ArchDiagram = ({ diagramSrc, title }) => {
  // We render into a plain div that lives OUTSIDE React's reconciliation.
  // Mermaid gets its own DOM node; React never touches the innerHTML.
  const holderRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | loading | ok | error
  const [errMsg, setErrMsg] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!diagramSrc || !holderRef.current) return

    const cleaned = sanitizeDiagram(diagramSrc)
    if (!cleaned) {
      setStatus('error')
      setErrMsg('Empty diagram source')
      return
    }

    let cancelled = false
    setStatus('loading')
    setErrMsg('')

    const render = async () => {
      try {
        await initMermaid()
        const mermaid = (await import('mermaid')).default

        if (cancelled || !mountedRef.current || !holderRef.current) return

        // Create a throw-away off-screen div for mermaid to write into
        const tempDiv = document.createElement('div')
        tempDiv.style.position = 'absolute'
        tempDiv.style.visibility = 'hidden'
        tempDiv.style.top = '-9999px'
        document.body.appendChild(tempDiv)

        const id = uniqueId()
        let svg = ''
        try {
          const result = await mermaid.render(id, cleaned, tempDiv)
          svg = result.svg
        } finally {
          // Always clean up the temp node, even if render threw
          if (document.body.contains(tempDiv)) {
            document.body.removeChild(tempDiv)
          }
          // Mermaid may also inject a style/svg with the same id into <body>
          const orphan = document.getElementById(id)
          if (orphan && document.body.contains(orphan)) {
            document.body.removeChild(orphan)
          }
        }

        if (cancelled || !mountedRef.current || !holderRef.current) return

        holderRef.current.innerHTML = svg

        const svgEl = holderRef.current.querySelector('svg')
        if (svgEl) {
          svgEl.setAttribute('width', '100%')
          svgEl.removeAttribute('height')
          svgEl.style.maxWidth = '100%'
          svgEl.style.height = 'auto'
        }

        if (mountedRef.current) setStatus('ok')
      } catch (err) {
        if (cancelled || !mountedRef.current) return
        console.error('[ArchDiagram] render error:', err)
        setStatus('error')
        setErrMsg(err?.message || 'Render failed')
        if (holderRef.current) holderRef.current.innerHTML = ''
      }
    }

    render()

    return () => {
      cancelled = true
      // Clear diagram when src changes so stale SVG doesn't flash
      if (holderRef.current) holderRef.current.innerHTML = ''
    }
  }, [diagramSrc])

  return (
    <div className="arch-diagram">
      {title && <h3 className="diagram-title">{title}</h3>}

      {status === 'loading' && (
        <div className="diagram-loading">
          <div className="diagram-spinner" />
          <span>Generating diagram…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="diagram-error-container">
          <div className="diagram-error-icon">⚠</div>
          <div className="diagram-error-message">Unable to render diagram</div>
          <div className="diagram-error-detail">{errMsg}</div>
        </div>
      )}

      {/* holderRef div is always mounted — Mermaid writes raw SVG into it */}
      <div
        className="diagram-container"
        ref={holderRef}
        style={{ display: status === 'error' || status === 'loading' ? 'none' : 'flex' }}
      />

      {status === 'idle' && !diagramSrc && (
        <div className="diagram-container">
          <div className="diagram-placeholder">No diagram available</div>
        </div>
      )}
    </div>
  )
}

export default ArchDiagram