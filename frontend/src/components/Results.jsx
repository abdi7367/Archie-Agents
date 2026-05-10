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
      // No thread ID but we have input, run Archie
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
      
      // Check if analysis is complete, if not, poll for updates
      if (data.status === 'running' || data.status === 'processing') {
        const pollInterval = setInterval(async () => {
          try {
            const updatedData = await getRun(threadId)
            setRunData(updatedData)
            
            if (updatedData.status === 'complete' || updatedData.status === 'error') {
              clearInterval(pollInterval)
              setLoading(false)
            }
          } catch (err) {
            console.error('Error polling for updates:', err)
            clearInterval(pollInterval)
          }
        }, 3000)
        
        // Clear polling after 5 minutes max
        setTimeout(() => clearInterval(pollInterval), 300000)
      } else {
        setLoading(false)
      }
    } catch (err) {
      setError('Failed to load results. Please try again.')
      console.error('Error fetching run data:', err)
      setLoading(false)
    }
  }

  const runArchieAnalysis = async (input) => {
    try {
      setLoading(true)
      setError('')
      setIsInitialRun(true)
      
      const result = await runArchie(input)
      
      // Store thread_id for future polling
      sessionStorage.setItem('thread_id', result.thread_id)
      
      // Start polling for results
      fetchRunData(result.thread_id)
    } catch (err) {
      setError('Failed to start analysis. Please try again.')
      console.error('Error running Archie analysis:', err)
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
              <div className="loading-text">Loading {TABS.find(tab => tab.id === activeTab)?.label}...</div>
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
              if (threadId) {
                fetchRunData(threadId)
              } else if (userInput) {
                runArchieAnalysis(userInput)
              }
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

    // Render tab-specific content
    switch (activeTab) {
      case 'architectures':
        return renderArchitecturesTab()
      case 'tech':
        return renderTechTab()
      case 'costs':
        return renderCostsTab()
      case 'adrs':
        return renderAdrsTab()
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
              <h3 className="architecture-name">{arch.name || `Architecture ${index + 1}`}</h3>
              <span className="architecture-tier">{arch.tier || 'Standard'}</span>
            </div>
            
            <p className="architecture-summary">{arch.summary || arch.description}</p>
            
            <div className="architecture-details">
              <div className="detail-section">
                <h4>Trade-offs</h4>
                <p>{arch.tradeoffs || 'No trade-offs specified'}</p>
              </div>
              
              <div className="detail-section">
                <h4>Components</h4>
                <div className="components-list">
                  {(arch.components || []).map((comp, i) => (
                    <span key={i} className="component-tag">{comp}</span>
                  ))}
                </div>
              </div>
              
              {arch.scaling_approach && (
                <div className="detail-section">
                  <h4>Scaling Approach</h4>
                  <p>{arch.scaling_approach}</p>
                </div>
              )}
              
              {arch.estimated_monthly_cost && (
                <div className="detail-section">
                  <h4>Estimated Monthly Cost</h4>
                  <p className="cost-amount">{arch.estimated_monthly_cost}</p>
                </div>
              )}
              
              {arch.mermaid_diagram_src && (
                <div className="detail-section">
                  <h4>Architecture Diagram</h4>
                  <ArchDiagram 
                    diagramSrc={arch.mermaid_diagram_src} 
                    title={`${arch.name || `Architecture ${index + 1}`} Diagram`}
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
        {techDecisions.map((decision, index) => (
          <div key={index} className="tech-decision-card">
            <div className="decision-header">
              <h3 className="decision-title">{decision.fork_name || decision.category || `Decision ${index + 1}`}</h3>
              {decision.winner && (
                <span className="winner-badge">🏆 Winner</span>
              )}
            </div>
            
            <div className="decision-content">
              <div className="decision-options">
                <h4>Options Considered:</h4>
                <div className="options-list">
                  {(decision.options || []).map((option, i) => (
                    <div key={i} className={`option-item ${option.is_winner ? 'winner' : ''}`}>
                      <span className="option-name">{option.name}</span>
                      {option.is_winner && <span className="winner-indicator">✓</span>}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="decision-justification">
                <h4>Justification</h4>
                <p>{decision.justification || decision.reasoning}</p>
              </div>
              
              {decision.considerations && (
                <div className="decision-considerations">
                  <h4>Considerations</h4>
                  <p>{decision.considerations}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderCostsTab = () => {
    const costData = runData.cost_analysis || runData.costs || {}
    
    if (!costData.current_load && !costData.monthly_costs) {
      return (
        <div className="placeholder-container">
          <div className="placeholder-text">No cost data available</div>
        </div>
      )
    }

    return (
      <div className="costs-container">
        <div className="cost-table">
          <h3>Cost Analysis</h3>
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Current Load</th>
                <th>10x Load</th>
                <th>Cost Cliff</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(costData.components || costData.breakdown || []).map((component, index) => (
                <tr key={index}>
                  <td className="component-name">{component.name || component.service}</td>
                  <td className="cost-current">{component.current_load || component.current_cost}</td>
                  <td className="cost-10x">{component.load_10x || component.cost_10x}</td>
                  <td className="cost-cliff">{component.cost_cliff || component.cliff_threshold}</td>
                  <td className="cost-notes">{component.notes || component.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {(costData.total_monthly_cost || costData.summary) && (
            <div className="cost-summary">
              <h4>Summary</h4>
              <div className="summary-item">
                <span>Estimated Monthly Cost:</span>
                <span className="total-cost">
                  {costData.total_monthly_cost || costData.summary?.total}
                </span>
              </div>
              {costData.summary?.notes && (
                <div className="summary-notes">
                  <p>{costData.summary.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderAdrsTab = () => {
    const adrs = runData.adrs || runData.adr_generation || []
    
    if (adrs.length === 0) {
      return (
        <div className="placeholder-container">
          <div className="placeholder-text">No ADRs available</div>
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
            onDownload={(number, title) => {
              console.log(`Downloaded ADR-${number}: ${title}`)
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="results-container">
      {/* Header */}
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

      {/* Main Content */}
      <div className="results-content">
        {/* Sidebar */}
        <div className="results-sidebar">
          {runData?.constraints && (
            <ConstraintsPanel constraints={runData.constraints} />
          )}
          <AgentPipeline runData={runData} />
        </div>

        {/* Main Area */}
        <div className="results-main">
          {/* Tabs */}
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

          {/* Tab Content */}
          <div className="tab-content">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Results
