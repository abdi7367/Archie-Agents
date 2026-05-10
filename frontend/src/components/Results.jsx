import React, { useState, useEffect } from 'react'
import AgentPipeline from './AgentPipeline'
import ConstraintsPanel from './ConstraintsPanel'
import ArchDiagram from './ArchDiagram'
import AdrCard from './AdrCard'
import { getRun, runArchie } from '../api/api'
import './Results.css'

const TABS = [
  { id: 'architectures', label: 'Architectures', icon: '🏗️' },
  { id: 'tech', label: 'Technology', icon: '💻' },
  { id: 'costs', label: 'Costs', icon: '💰' },
  { id: 'adrs', label: 'ADRs', icon: '📋' }
]

const Results = () => {
  const [activeTab, setActiveTab] = useState('architectures')
  const [userInput, setUserInput] = useState('')
  const [timestamp, setTimestamp] = useState('')
  const [runData, setRunData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isInitialRun, setIsInitialRun] = useState(false)

  useEffect(() => {
    const savedInput = sessionStorage.getItem('userInput')
    const savedTimestamp = sessionStorage.getItem('timestamp')
    const threadId = sessionStorage.getItem('thread_id')

    if (savedInput) setUserInput(savedInput)
    if (savedTimestamp) setTimestamp(savedTimestamp)

    if (threadId) {
      fetchRunData(threadId)
    } else if (savedInput) {
      runArchieAnalysis(savedInput)
    } else {
      setLoading(false)
      setError('No run data found. Please submit a request first.')
    }
  }, [])

  const fetchRunData = async (threadId) => {
    try {
      setLoading(true)
      setError('')
      const data = await getRun(threadId)
      setRunData(data)
    } catch (err) {
      setError('Failed to load results. Please try again.')
      console.error('Error fetching run data:', err)
    } finally {
      setLoading(false)
    }
  }

  const runArchieAnalysis = async (input) => {
    try {
      setLoading(true)
      setError('')
      setIsInitialRun(true)
      const result = await runArchie(input)
      sessionStorage.setItem('thread_id', result.thread_id)
      setRunData(result)
    } catch (err) {
      setError('Failed to start analysis. Please try again.')
      console.error('Error running Archie analysis:', err)
    } finally {
      setLoading(false)
      setIsInitialRun(false)
    }
  }

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="loading-container">
          {isInitialRun ? (
            <AgentPipeline runData={null} />
          ) : (
            <>
              <div className="loading-spinner"></div>
              <div className="loading-text">
                Loading {TABS.find(tab => tab.id === activeTab)?.label}...
              </div>
              <div className="loading-subtext">AI agents are processing your request</div>
            </>
          )}
        </div>
      )
    }

    if (error) {
      return (
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <div className="error-text">{error}</div>
          <button
            className="retry-button"
            onClick={() => {
              setError('')
              const threadId = sessionStorage.getItem('thread_id')
              if (threadId) fetchRunData(threadId)
              else if (userInput) runArchieAnalysis(userInput)
            }}
          >
            Retry
          </button>
        </div>
      )
    }

    if (!runData) {
      return (
        <div className="error-container">
          <div className="error-text">No data available</div>
        </div>
      )
    }

    switch (activeTab) {
      case 'architectures': return renderArchitecturesTab()
      case 'tech':          return renderTechTab()
      case 'costs':         return renderCostsTab()
      case 'adrs':          return renderAdrsTab()
      default:
        return (
          <div className="placeholder-container">
            <div className="placeholder-text">
              {TABS.find(tab => tab.id === activeTab)?.label} content coming soon
            </div>
          </div>
        )
    }
  }

  const renderArchitecturesTab = () => {
    const architectures = runData.architectures || []

    if (architectures.length === 0) {
      return (
        <div className="placeholder-container">
          <div className="placeholder-text">No architecture data available</div>
        </div>
      )
    }

    return (
      <div className="architectures-container">
        {architectures.map((arch, index) => (
          <div key={index} className="architecture-card">
            <div className="architecture-header">
              <h3 className="architecture-name">{arch.tier}</h3>
              <span className="architecture-tier">{arch.estimated_monthly_cost}</span>
            </div>

            <p className="architecture-summary">{arch.summary}</p>

            <div className="architecture-details">
              <div className="detail-section">
                <h4>Components</h4>
                <div className="components-list">
                  {(arch.components || []).map((comp, i) => (
                    <span key={i} className="component-tag">{comp}</span>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h4>Data Flow</h4>
                {(arch.data_flow || []).map((step, i) => (
                  <p key={i}>{i + 1}. {step}</p>
                ))}
              </div>

              {arch.scaling_approach && (
                <div className="detail-section">
                  <h4>Scaling Approach</h4>
                  <p>{arch.scaling_approach}</p>
                </div>
              )}

              {(arch.tradeoffs?.pros?.length > 0 || arch.tradeoffs?.cons?.length > 0) && (
                <div className="detail-section">
                  <h4>Trade-offs</h4>
                  {(arch.tradeoffs.pros || []).map((pro, i) => (
                    <p key={`pro-${i}`}>✓ {pro}</p>
                  ))}
                  {(arch.tradeoffs.cons || []).map((con, i) => (
                    <p key={`con-${i}`}>✗ {con}</p>
                  ))}
                </div>
              )}

              {arch.observability?.length > 0 && (
                <div className="detail-section">
                  <h4>Observability</h4>
                  {arch.observability.map((item, i) => (
                    <p key={i}>• {item}</p>
                  ))}
                </div>
              )}

              {arch.security?.length > 0 && (
                <div className="detail-section">
                  <h4>Security</h4>
                  {arch.security.map((item, i) => (
                    <p key={i}>• {item}</p>
                  ))}
                </div>
              )}

              {arch.mermaid_diagram && (
                <div className="detail-section">
                  <h4>Architecture Diagram</h4>
                  <ArchDiagram
                    diagramSrc={arch.mermaid_diagram}
                    title={`${arch.tier} Diagram`}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderTechTab = () => {
    const techDecisions = runData.tech_decisions || []

    if (techDecisions.length === 0) {
      return (
        <div className="placeholder-container">
          <div className="placeholder-text">No technology decisions available</div>
        </div>
      )
    }

    return (
      <div className="tech-decisions-container">
        {techDecisions.map((tier, index) => (
          <div key={index} className="tech-decision-card">
            <div className="decision-header">
              <h3 className="decision-title">{tier.tier}</h3>
            </div>

            <p className="architecture-summary">{tier.overall_recommendation}</p>

            {tier.risk_flags?.length > 0 && (
              <div className="detail-section">
                <h4>Risk Flags</h4>
                {tier.risk_flags.map((flag, i) => (
                  <p key={i}>⚠ {flag}</p>
                ))}
              </div>
            )}

            <div className="decision-content">
              <h4>Technology Decisions</h4>
              <div className="options-list">
                {(tier.decisions || []).map((decision, i) => (
                  <div key={i} className="option-item">
                    <div className="decision-header">
                      <span className="option-name">{decision.category}</span>
                      <span className="winner-badge">Score: {decision.score}/10</span>
                    </div>
                    <p><strong>Chosen:</strong> {decision.chosen}</p>
                    <p>{decision.justification}</p>
                    {decision.alternatives?.length > 0 && (
                      <p><strong>Alternatives:</strong> {decision.alternatives.join(', ')}</p>
                    )}
                    {decision.when_to_switch && (
                      <p><strong>Switch when:</strong> {decision.when_to_switch}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderCostsTab = () => {
    return (
      <div className="placeholder-container">
        <div className="placeholder-text">Cost analysis coming soon</div>
      </div>
    )
  }

  const renderAdrsTab = () => {
    const adrs = runData.adrs || []

    if (adrs.length === 0) {
      return (
        <div className="placeholder-container">
          <div className="placeholder-text">ADRs coming soon</div>
        </div>
      )
    }

    return (
      <div className="adrs-container">
        {adrs.map((adr, index) => (
          <AdrCard
            key={index}
            title={adr.title || `Architecture Decision ${index + 1}`}
            number={adr.number || index + 1}
            status={adr.status || 'accepted'}
            content={adr.content || adr.description || adr.decision}
            onDownload={(number, title) => console.log(`Downloaded ADR-${number}: ${title}`)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="results-container">
      <div className="results-header">
        <h1 className="results-title">Analysis Results</h1>
        <div className="results-meta">
          <div className="meta-item">
            <span className="meta-label">Query:</span> {userInput.substring(0, 50)}{userInput.length > 50 ? '...' : ''}
          </div>
          <div className="meta-item">
            <span className="meta-label">Time:</span> {timestamp ? new Date(timestamp).toLocaleString() : '--'}
          </div>
        </div>
      </div>

      <div className="results-content">
        <div className="results-sidebar">
          {runData?.constraints && (
            <ConstraintsPanel constraints={runData.constraints} />
          )}
          <AgentPipeline runData={runData} />
        </div>

        <div className="results-main">
          <div className="tabs-container">
            <div className="tabs-list">
              {TABS.map(tab => (
                <li key={tab.id} className="tab-item">
                  <button
                    className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span className="tab-icon">{tab.icon}</span>
                    {tab.label}
                  </button>
                </li>
              ))}
            </div>
          </div>

          <div className="tab-content">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Results