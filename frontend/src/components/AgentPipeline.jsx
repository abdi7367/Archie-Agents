import React, { useState, useEffect } from 'react'
import './AgentPipeline.css'

const AGENTS = [
  { id: 1, name: 'Requirements Analyzer', key: 'requirements' },
  { id: 2, name: 'Architecture Designer', key: 'design' },
  { id: 3, name: 'Technology Selector', key: 'tech_decisions' },
  { id: 4, name: 'Cost Estimator', key: 'cost_analysis' },
  { id: 5, name: 'ADR Generator', key: 'adr_generation' }
]

const AgentPipeline = ({ runData }) => {
  const [agents, setAgents] = useState(
    AGENTS.map(agent => ({
      ...agent,
      status: 'pending',
      progress: 0,
      startTime: null,
      endTime: null
    }))
  )

  useEffect(() => {
    if (!runData) {
      // Start simulated pipeline when no data
      const runPipeline = async () => {
        for (let i = 0; i < agents.length; i++) {
          const agentId = agents[i].id
          
          setAgents(prev => prev.map(agent => 
            agent.id === agentId 
              ? { ...agent, status: 'running', progress: 0, startTime: new Date() }
              : agent
          ))

          const progressInterval = setInterval(() => {
            setAgents(prev => prev.map(agent => {
              if (agent.id === agentId && agent.status === 'running') {
                const newProgress = Math.min(agent.progress + 10, 100)
                return { ...agent, progress: newProgress }
              }
              return agent
            }))
          }, 200)

          await new Promise(resolve => setTimeout(resolve, 2000))
          
          clearInterval(progressInterval)
          
          setAgents(prev => prev.map(agent => 
            agent.id === agentId 
              ? { ...agent, status: 'done', progress: 100, endTime: new Date() }
              : agent
          ))

          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      const timeout = setTimeout(runPipeline, 1000)
      return () => clearTimeout(timeout)
    } else {
      // Update based on actual runData
      const currentAgent = runData.current_agent || ''
      const isComplete = runData.status === 'complete' || runData.status === 'error'

      setAgents(prev => prev.map(agent => {
        const agentIndex = AGENTS.findIndex(a => a.key === currentAgent)
        const currentIndex = AGENTS.findIndex(a => a.key === currentAgent)
        
        if (isComplete && agentIndex < currentIndex) {
          return { ...agent, status: 'done', progress: 100, endTime: new Date() }
        } else if (agent.key === currentAgent && !isComplete) {
          return { ...agent, status: 'running', progress: 50, startTime: new Date() }
        } else if (agentIndex > currentIndex) {
          return { ...agent, status: 'pending', progress: 0 }
        } else {
          return { ...agent, status: 'done', progress: 100, endTime: new Date() }
        }
      }))
    }
  }, [runData])

  const formatTime = (date) => {
    if (!date) return '--:--:--'
    return date.toLocaleTimeString()
  }

  const getDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '--'
    const duration = Math.round((endTime - startTime) / 1000)
    return `${duration}s`
  }

  return (
    <div className="pipeline-container">
      <h2 className="pipeline-title">Agent Pipeline</h2>
      <div className="agents-grid">
        {agents.map(agent => (
          <div key={agent.id} className={`agent-card ${agent.status}`}>
            <div className="agent-name">{agent.name}</div>
            <div className={`agent-status status-${agent.status}`}>
              {agent.status.toUpperCase()}
            </div>
            <div className="agent-progress">
              <div 
                className="progress-bar" 
                style={{ width: `${agent.progress}%` }}
              />
            </div>
            <div className="agent-time">
              Start: {formatTime(agent.startTime)}
            </div>
            <div className="agent-time">
              End: {formatTime(agent.endTime)}
            </div>
            <div className="agent-time">
              Duration: {getDuration(agent.startTime, agent.endTime)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AgentPipeline
