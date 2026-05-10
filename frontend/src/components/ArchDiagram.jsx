import React, { useEffect, useRef } from 'react'
import mermaid from 'mermaid'
import './ArchDiagram.css'

const ArchDiagram = ({ diagramSrc, title }) => {
  const diagramRef = useRef(null)

  useEffect(() => {
    // Initialize Mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#6366f1',
        primaryTextColor: '#e0e0e0',
        primaryBorderColor: '#a855f7',
        lineColor: '#a0a0a0',
        secondaryColor: '#8b5cf6',
        tertiaryColor: '#3b82f6',
        background: '#0f0f23',
        mainBkg: '#1a1a2e',
        secondBkg: '#262646',
        tertiaryBkg: '#16213e'
      },
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      }
    })
  }, [])

  useEffect(() => {
    if (diagramRef.current && diagramSrc) {
      const renderDiagram = async () => {
        try {
          // Clear previous content
          diagramRef.current.innerHTML = ''
          
          // Generate unique ID for this diagram
          const diagramId = `mermaid-diagram-${Math.random().toString(36).substr(2, 9)}`
          
          // Render the diagram
          const { svg } = await mermaid.render(diagramId, diagramSrc)
          diagramRef.current.innerHTML = svg
          
          // Add responsive behavior
          const svgElement = diagramRef.current.querySelector('svg')
          if (svgElement) {
            svgElement.setAttribute('width', '100%')
            svgElement.setAttribute('height', 'auto')
            svgElement.style.maxWidth = '100%'
            svgElement.style.height = 'auto'
          }
        } catch (error) {
          console.error('Error rendering Mermaid diagram:', error)
          diagramRef.current.innerHTML = `
            <div class="diagram-error">
              <p>Failed to render diagram</p>
              <details>
                <summary>Diagram Source</summary>
                <pre>${diagramSrc}</pre>
              </details>
            </div>
          `
        }
      }

      renderDiagram()
    }
  }, [diagramSrc])

  return (
    <div className="arch-diagram">
      {title && <h3 className="diagram-title">{title}</h3>}
      <div className="diagram-container" ref={diagramRef}>
        {diagramSrc ? (
          <div className="diagram-loading">Loading diagram...</div>
        ) : (
          <div className="diagram-placeholder">No diagram available</div>
        )}
      </div>
    </div>
  )
}

export default ArchDiagram
