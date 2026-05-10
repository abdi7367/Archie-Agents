import React, { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import './ArchDiagram.css'

// Basic validation for Mermaid diagram syntax
const validateMermaid = (src) => {
  if (!src || typeof src !== 'string') {
    return { valid: false, error: 'Empty or invalid diagram source' }
  }
  
  const trimmed = src.trim()
  
  // Check for valid diagram type
  const validTypes = ['flowchart', 'graph TD', 'graph LR', 'graph BT', 'graph RL', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie', 'gitGraph']
  const hasValidType = validTypes.some(type => trimmed.toLowerCase().startsWith(type.toLowerCase()))
  
  if (!hasValidType) {
    // Try to auto-fix by adding flowchart LR if no type found
    return { valid: false, error: 'Missing diagram type declaration', canAutoFix: true }
  }
  
  // Check for basic syntax issues
  const lines = trimmed.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    // Skip empty lines and comments
    if (!line || line.startsWith('%%')) continue
    
    // Check for unclosed brackets/parentheses
    const openBrackets = (line.match(/\[/g) || []).length
    const closeBrackets = (line.match(/\]/g) || []).length
    const openParens = (line.match(/\(/g) || []).length
    const closeParens = (line.match(/\)/g) || []).length
    const openCurlies = (line.match(/\{/g) || []).length
    const closeCurlies = (line.match(/\}/g) || []).length
    
    if (openBrackets !== closeBrackets) {
      return { valid: false, error: `Unmatched brackets on line ${i + 1}` }
    }
    if (openParens !== closeParens) {
      return { valid: false, error: `Unmatched parentheses on line ${i + 1}` }
    }
    if (openCurlies !== closeCurlies) {
      return { valid: false, error: `Unmatched braces on line ${i + 1}` }
    }
  }
  
  return { valid: true }
}

// Auto-fix common Mermaid issues
const autoFixMermaid = (src) => {
  if (!src) return src
  
  let fixed = src.trim()
  
  // Add flowchart LR if no diagram type found
  const validTypes = ['flowchart', 'graph TD', 'graph LR', 'graph BT', 'graph RL', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram']
  const hasValidType = validTypes.some(type => fixed.toLowerCase().startsWith(type.toLowerCase()))
  
  if (!hasValidType) {
    fixed = `flowchart LR\n${fixed}`
  }
  
  // Convert graph TD to flowchart LR for better visuals
  if (fixed.toLowerCase().startsWith('graph td')) {
    fixed = fixed.replace(/graph TD/i, 'flowchart LR')
  }
  
  return fixed
}

const ArchDiagram = ({ diagramSrc, title }) => {
  const diagramRef = useRef(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Initialize Mermaid with better defaults
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
        nodeTextColor: '#e0e0e0'
      },
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
        padding: 16,
        nodeSpacing: 50,
        rankSpacing: 50
      },
      securityLevel: 'loose'
    })
  }, [])

  useEffect(() => {
    if (diagramRef.current && diagramSrc) {
      const renderDiagram = async () => {
        setIsLoading(true)
        setError(null)
        
        try {
          // Validate and auto-fix
          const validation = validateMermaid(diagramSrc)
          let processedSrc = diagramSrc
          
          if (!validation.valid) {
            if (validation.canAutoFix) {
              processedSrc = autoFixMermaid(diagramSrc)
              console.log('Auto-fixed diagram syntax')
            } else {
              throw new Error(validation.error)
            }
          } else {
            processedSrc = autoFixMermaid(diagramSrc)
          }
          
          // Clear previous content
          diagramRef.current.innerHTML = ''
          
          // Generate unique ID for this diagram
          const diagramId = `mermaid-diagram-${Date.now()}`
          
          // Render the diagram
          const { svg } = await mermaid.render(diagramId, processedSrc)
          diagramRef.current.innerHTML = svg
          
          // Add responsive behavior
          const svgElement = diagramRef.current.querySelector('svg')
          if (svgElement) {
            svgElement.setAttribute('width', '100%')
            svgElement.setAttribute('height', 'auto')
            svgElement.style.maxWidth = '100%'
            svgElement.style.height = 'auto'
          }
        } catch (err) {
          console.error('Error rendering Mermaid diagram:', err)
          setError(err.message || 'Failed to render diagram')
        } finally {
          setIsLoading(false)
        }
      }

      renderDiagram()
    }
  }, [diagramSrc])

  if (error) {
    return (
      <div className="arch-diagram">
        {title && <h3 className="diagram-title">{title}</h3>}
        <div className="diagram-error-container">
          <div className="diagram-error-icon">⚠</div>
          <div className="diagram-error-message">
            Unable to render architecture diagram
          </div>
          <div className="diagram-error-detail">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="arch-diagram">
      {title && <h3 className="diagram-title">{title}</h3>}
      <div className="diagram-container" ref={diagramRef}>
        {!diagramSrc ? (
          <div className="diagram-placeholder">No diagram available</div>
        ) : isLoading ? (
          <div className="diagram-loading">
            <div className="diagram-spinner"></div>
            <span>Generating diagram...</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ArchDiagram
