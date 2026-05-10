import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import AgentPipeline from './AgentPipeline'
import ConstraintsPanel from './ConstraintsPanel'
import ArchDiagram from './ArchDiagram'
import AdrCard from './AdrCard'
import { getRun, runArchie } from '../api/api'
import './Results.css'

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'architectures', label: 'Architectures', icon: '🏗️' },
  { id: 'decisions', label: 'Decisions', icon: '⚡' },
  { id: 'costs', label: 'Cost Model', icon: '💰' },
  { id: 'adrs', label: 'ADRs', icon: '📋' }
]

const Results = () => {
  const location = useLocation()

  const [activeTab, setActiveTab] = useState('overview')

  // ── FIX 1: All state at the top level — no useState inside render functions ──
  const [selectedTier, setSelectedTier] = useState('MVP')

  // ── FIX 2: Prefer router state over sessionStorage ──
  const routerState = location.state || {}
  const [userInput] = useState(
    routerState.userInput || sessionStorage.getItem('userInput') || ''
  )
  const [timestamp] = useState(
    routerState.timestamp || sessionStorage.getItem('timestamp') || ''
  )

  const [runData, setRunData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isInitialRun, setIsInitialRun] = useState(false)

  // ── FIX 3: Sync selectedTier when runData arrives ──
  useEffect(() => {
    if (runData?.architectures?.length) {
      setSelectedTier(runData.architectures[0].tier)
    }
  }, [runData])

  useEffect(() => {
    const threadId = routerState.threadId || sessionStorage.getItem('thread_id')

    if (threadId) {
      fetchRunData(threadId)
    } else if (userInput) {
      runArchieAnalysis(userInput)
    } else {
      setLoading(false)
      setError('No run data found. Please submit a request first.')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Render helpers ───────────────────────────────────────────────────────

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
                Loading {TABS.find(t => t.id === activeTab)?.label}...
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
      case 'overview':      return renderOverviewTab()
      case 'architectures': return renderArchitecturesTab()
      case 'decisions':     return renderDecisionsTab()
      case 'costs':         return renderCostsTab()
      case 'adrs':          return renderAdrsTab()
      default:
        return (
          <div className="placeholder-container">
            <div className="placeholder-text">
              {TABS.find(t => t.id === activeTab)?.label} content coming soon
            </div>
          </div>
        )
    }
  }

  const renderOverviewTab = () => {
    const architectures = runData.architectures || []
    const recommendation = runData.recommendation

    if (architectures.length === 0) {
      return (
        <div className="placeholder-container">
          <div className="placeholder-text">No architecture data available</div>
        </div>
      )
    }

    return (
      <div className="overview-container">
        {recommendation && (
          <div className="recommendation-card">
            <div className="recommendation-header">
              <span className="recommendation-badge">Recommended</span>
              <h3 className="recommendation-tier">{recommendation.tier} Tier</h3>
            </div>
            <p className="recommendation-reasoning">{recommendation.reasoning}</p>
          </div>
        )}

        <div className="comparison-section">
          <h3 className="section-title">Architecture Comparison</h3>
          <div className="comparison-table">
            <div className="comparison-header">
              <div className="comparison-cell">Feature</div>
              {architectures.map((arch, i) => (
                <div key={i} className={`comparison-cell tier-${arch.tier?.toLowerCase()}`}>
                  {arch.tier}
                </div>
              ))}
            </div>

            <div className="comparison-row">
              <div className="comparison-cell label">Monthly Cost</div>
              {architectures.map((arch, i) => (
                <div key={i} className="comparison-cell">
                  <span className="cost-value">{arch.estimated_monthly_cost}</span>
                </div>
              ))}
            </div>

            <div className="comparison-row">
              <div className="comparison-cell label">Components</div>
              {architectures.map((arch, i) => (
                <div key={i} className="comparison-cell">
                  {arch.components?.length || 0}
                </div>
              ))}
            </div>

            <div className="comparison-row">
              <div className="comparison-cell label">Complexity</div>
              {architectures.map((arch, i) => (
                <div key={i} className="comparison-cell">
                  <span className={`complexity-badge ${arch.complexity?.toLowerCase()}`}>
                    {arch.complexity || 'Medium'}
                  </span>
                </div>
              ))}
            </div>

            <div className="comparison-row">
              <div className="comparison-cell label">Best For</div>
              {architectures.map((arch, i) => (
                <div key={i} className="comparison-cell">
                  <span className="best-for">{arch.best_for || 'General'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="summary-cards">
          {architectures.map((arch, i) => (
            <div key={i} className={`summary-card tier-${arch.tier?.toLowerCase()}`}>
              <h4 className="summary-tier">{arch.tier}</h4>
              <p className="summary-text">{arch.summary}</p>
              <div className="summary-components">
                {(arch.components || []).slice(0, 4).map((comp, j) => (
                  <span key={j} className="component-chip">{comp}</span>
                ))}
                {(arch.components || []).length > 4 && (
                  <span className="component-chip more">
                    +{arch.components.length - 4} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── FIX 1 APPLIED: selectedTier lives at component level, not inside this fn ──
  const renderArchitecturesTab = () => {
    const architectures = runData.architectures || []
    const selectedArch = architectures.find(a => a.tier === selectedTier) || architectures[0]

    if (architectures.length === 0) {
      return (
        <div className="placeholder-container">
          <div className="placeholder-text">No architecture data available</div>
        </div>
      )
    }

    return (
      <div className="architectures-container">
        <div className="tier-selector">
          {architectures.map((arch, i) => (
            <button
              key={i}
              className={`tier-button ${selectedTier === arch.tier ? 'active' : ''} tier-${arch.tier?.toLowerCase()}`}
              onClick={() => setSelectedTier(arch.tier)}
            >
              {arch.tier}
            </button>
          ))}
        </div>

        {selectedArch && (
          <div className={`architecture-detail-card tier-${selectedArch.tier?.toLowerCase()}`}>
            <div className="detail-header">
              <h3 className="detail-tier">{selectedArch.tier}</h3>
              <span className="detail-cost">{selectedArch.estimated_monthly_cost}</span>
            </div>

            <p className="detail-summary">{selectedArch.summary}</p>

            <div className="detail-grid">
              <div className="detail-block">
                <h4>Components</h4>
                <div className="components-grid">
                  {(selectedArch.components || []).map((comp, i) => (
                    <span key={i} className="component-pill">{comp}</span>
                  ))}
                </div>
              </div>

              <div className="detail-block">
                <h4>Data Flow</h4>
                <div className="flow-steps">
                  {(selectedArch.data_flow || []).map((step, i) => (
                    <div key={i} className="flow-step">
                      <span className="step-number">{i + 1}</span>
                      <span className="step-text">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedArch.scaling_approach && (
                <div className="detail-block">
                  <h4>Scaling Approach</h4>
                  <p className="scaling-text">{selectedArch.scaling_approach}</p>
                </div>
              )}

              {(selectedArch.tradeoffs?.pros?.length > 0 || selectedArch.tradeoffs?.cons?.length > 0) && (
                <div className="detail-block tradeoffs">
                  <h4>Trade-offs</h4>
                  <div className="tradeoffs-grid">
                    <div className="pros">
                      <span className="tradeoff-label">Pros</span>
                      {(selectedArch.tradeoffs.pros || []).map((pro, i) => (
                        <p key={i} className="pro-item">✓ {pro}</p>
                      ))}
                    </div>
                    <div className="cons">
                      <span className="tradeoff-label">Cons</span>
                      {(selectedArch.tradeoffs.cons || []).map((con, i) => (
                        <p key={i} className="con-item">✗ {con}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedArch.mermaid_diagram && (
                <div className="detail-block full-width">
                  <h4>Architecture Diagram</h4>
                  <ArchDiagram
                    diagramSrc={selectedArch.mermaid_diagram}
                    title={`${selectedArch.tier} Architecture`}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderDecisionsTab = () => {
    const techDecisions = runData.tech_decisions || []

    if (techDecisions.length === 0) {
      return (
        <div className="placeholder-container">
          <div className="placeholder-text">No technology decisions available</div>
        </div>
      )
    }

    return (
      <div className="decisions-container">
        {techDecisions.map((tier, i) => (
          <div key={i} className={`decision-tier-card tier-${tier.tier?.toLowerCase()}`}>
            <div className="decision-tier-header">
              <h3 className="decision-tier-title">{tier.tier}</h3>
              {tier.overall_recommendation && (
                <p className="tier-recommendation">{tier.overall_recommendation}</p>
              )}
            </div>

            {tier.risk_flags?.length > 0 && (
              <div className="risk-section">
                <h4 className="section-label">Risk Flags</h4>
                <div className="risk-flags">
                  {tier.risk_flags.map((flag, j) => (
                    <span key={j} className="risk-flag">⚠ {flag}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="decisions-grid">
              {(tier.decisions || []).map((decision, j) => (
                <div key={j} className="decision-card">
                  <div className="decision-category">
                    <span className="category-name">{decision.category}</span>
                    <span className="score-badge">{decision.score}/10</span>
                  </div>
                  <div className="decision-choice">
                    <span className="choice-label">Chosen:</span>
                    <span className="choice-value">{decision.chosen}</span>
                  </div>
                  <p className="decision-justification">{decision.justification}</p>
                  {decision.alternatives?.length > 0 && (
                    <div className="alternatives">
                      <span className="alt-label">Alternatives:</span>
                      <span className="alt-list">{decision.alternatives.join(', ')}</span>
                    </div>
                  )}
                  {decision.when_to_switch && (
                    <div className="switch-condition">
                      <span className="switch-label">Switch when:</span>
                      <span className="switch-text">{decision.when_to_switch}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderCostsTab = () => {
    const architectures = runData.architectures || []
    const costAnalysis = runData.cost_analysis || {}

    if (architectures.length === 0) {
      return (
        <div className="placeholder-container">
          <div className="placeholder-text">No cost data available</div>
        </div>
      )
    }

    return (
      <div className="costs-container">
        <div className="cost-summary-grid">
          {architectures.map((arch, i) => (
            <div key={i} className={`cost-card tier-${arch.tier?.toLowerCase()}`}>
              <h3 className="cost-tier">{arch.tier}</h3>
              <div className="cost-amount">{arch.estimated_monthly_cost}</div>
              <div className="cost-period">per month</div>
              <div className="cost-breakdown">
                <div className="cost-line">
                  <span>Components:</span>
                  <span>{arch.components?.length || 0}</span>
                </div>
                <div className="cost-line">
                  <span>Complexity:</span>
                  <span>{arch.complexity || 'Medium'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {costAnalysis.breakdown && (
          <div className="cost-detail-section">
            <h3 className="section-title">Cost Breakdown</h3>
            <div className="cost-table-container">
              <table className="cost-table">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Service</th>
                    <th>Instance</th>
                    <th>Monthly Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {costAnalysis.breakdown.map((item, i) => (
                    <tr key={i}>
                      <td>{item.component}</td>
                      <td>{item.service}</td>
                      <td>{item.instance_type || 'N/A'}</td>
                      <td className="cost-value">{item.monthly_cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {costAnalysis.scaling_projection && (
          <div className="cost-detail-section">
            <h3 className="section-title">Scaling Projections</h3>
            <div className="scaling-grid">
              <div className="scaling-card">
                <span className="scaling-label">Current</span>
                <span className="scaling-value">{costAnalysis.scaling_projection.current}</span>
              </div>
              <div className="scaling-card">
                <span className="scaling-label">10x Traffic</span>
                <span className="scaling-value">{costAnalysis.scaling_projection['10x']}</span>
              </div>
              <div className="scaling-card">
                <span className="scaling-label">Cliff Point</span>
                <span className="scaling-value">{costAnalysis.scaling_projection.cliff}</span>
              </div>
            </div>
          </div>
        )}

        {costAnalysis.notes && (
          <div className="cost-notes">
            <h4 className="notes-title">Cost Optimization Notes</h4>
            <ul>
              {costAnalysis.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        )}
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
        {adrs.map((adr, i) => (
          <AdrCard
            key={i}
            title={adr.title || `Architecture Decision ${i + 1}`}
            number={adr.number || i + 1}
            status={adr.status || 'accepted'}
            content={adr.content || adr.description || adr.decision}
            onDownload={(number, title) => console.log(`Downloaded ADR-${number}: ${title}`)}
          />
        ))}
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="results-container">
      <div className="results-header">
        <h1 className="results-title">Analysis Results</h1>
        <div className="results-meta">
          <div className="meta-item">
            <span className="meta-label">Query:</span>{' '}
            {userInput.substring(0, 50)}{userInput.length > 50 ? '…' : ''}
          </div>
          <div className="meta-item">
            <span className="meta-label">Time:</span>{' '}
            {timestamp ? new Date(timestamp).toLocaleString() : '--'}
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