import React, { useState, useEffect, useMemo } from 'react'
import './AgentPipeline.css'

const AGENTS = [
  { id: 1, name: 'Requirements Analyzer', key: 'requirements', icon: '📝' },
  { id: 2, name: 'Architecture Designer', key: 'design', icon: '🏗️' },
  { id: 3, name: 'Technology Selector', key: 'tech_decisions', icon: '⚡' },
  { id: 4, name: 'Cost Estimator', key: 'cost_analysis', icon: '💰' },
  { id: 5, name: 'ADR Generator', key: 'adr_generation', icon: '📋' }
]

const AgentPipeline = ({ runData, agentEvents = [] }) => {
  const [agentStates, setAgentStates] = useState(
    AGENTS.map(agent => ({
      ...agent,
      status: 'pending',
      progress: 0,
      startTime: null,
      endTime: null,
      message: ''
    }))
  )

  // Process real agent events from backend
  useEffect(() => {
    if (agentEvents.length > 0) {
      setAgentStates(prev => {
        const newStates = [...prev]
        
        agentEvents.forEach(event => {
          const agentIndex = AGENTS.findIndex(a => a.key === event.agent_key)
          if (agentIndex !== -1) {
            newStates[agentIndex] = {
              ...newStates[agentIndex],
              status: event.status,
              progress: event.progress || (event.status === 'done' ? 100 : event.status === 'running' ? 50 : 0),
              startTime: event.start_time ? new Date(event.start_time) : newStates[agentIndex].startTime,
              endTime: event.end_time ? new Date(event.end_time) : newStates[agentIndex].endTime,
              message: event.message || newStates[agentIndex].message
            }
          }
        })
        
        return newStates
      })
    }
  }, [agentEvents])

  // Derive state from runData if no events
  useEffect(() => {
    if (!runData || agentEvents.length > 0) return
    
    const currentAgent = runData.current_agent || ''
    const isComplete = runData.status === 'complete'
    const hasError = runData.status === 'error'
    
    setAgentStates(prev => prev.map((agent, index) => {
      const currentIndex = AGENTS.findIndex(a => a.key === currentAgent)
      const agentIndex = index
      
      if (isComplete || (hasError && agentIndex < currentIndex)) {
        return { ...agent, status: 'done', progress: 100 }
      } else if (agent.key === currentAgent && !isComplete && !hasError) {
        return { ...agent, status: 'running', progress: 75 }
      } else if (agentIndex < currentIndex) {
        return { ...agent, status: 'done', progress: 100 }
      } else if (hasError && agentIndex === currentIndex) {
        return { ...agent, status: 'error', progress: 0 }
      }
      return agent
    }))
  }, [runData, agentEvents.length])

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    const totalProgress = agentStates.reduce((sum, agent) => sum + agent.progress, 0)
    return Math.round(totalProgress / agentStates.length)
  }, [agentStates])

  const getStatusIcon = (status) => {
    switch (status) {
      case 'done': return '✓'
      case 'running': return '◐'
      case 'error': return '✗'
      default: return '○'
    }
  }

  return (
    <div className="pipeline-container">
      <div className="pipeline-header">
        <h2 className="pipeline-title">AI Agent Pipeline</h2>
        <div className="overall-progress">
          <span className="progress-text">{overallProgress}%</span>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>
      </div>
      
      <div className="agents-list">
        {agentStates.map((agent, index) => (
          <div 
            key={agent.id} 
            className={`agent-row ${agent.status}`}
          >
            <div className="agent-icon">{agent.icon}</div>
            
            <div className="agent-info">
              <div className="agent-name-row">
                <span className="agent-name">{agent.name}</span>
                <span className={`status-badge ${agent.status}`}>
                  {getStatusIcon(agent.status)} {agent.status}
                </span>
              </div>
              
              {agent.message && (
                <div className="agent-message">{agent.message}</div>
              )}
              
              <div className="agent-progress-bar">
                <div 
                  className="agent-progress-fill" 
                  style={{ width: `${agent.progress}%` }}
                />
              </div>
            </div>
            
            <div className="agent-step">{index + 1}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AgentPipeline
