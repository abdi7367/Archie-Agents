import React, { useState, useEffect, useMemo } from 'react'
import './AgentPipeline.css'

const AGENTS = [
  { id: 1, name: 'Requirements Analyzer', key: 'requirements', icon: '📝' },
  { id: 2, name: 'Architecture Designer', key: 'design', icon: '🏗️' },
  { id: 3, name: 'Tech Decisions', key: 'tech_decisions', icon: '⚡', parallel: true },
]

// Map current_agent values → which agents are done / running
const deriveStates = (runData) => {
  if (!runData) return AGENTS.map((a) => ({ ...a, status: 'pending', progress: 0, message: '' }))

  const status = runData.status || 'pending'
  // API may expose awaiting_clarification while LangGraph `next` is clarifying
  const current =
    status === 'awaiting_clarification'
      ? 'clarifying'
      : runData.current_agent || ''

  return AGENTS.map((agent, i) => {
    // "parallel_design_tech" covers both design & tech_decisions
    const isParallelNode = current === 'parallel_design_tech'

    // Determine done-ness based on pipeline position
    const doneAgents = {
      requirements:          ['requirements'],
      clarifying:            ['requirements'],
      design:                ['requirements'],
      parallel_design_tech:  ['requirements'],
      complete:              ['requirements', 'design', 'tech_decisions'],
      error:                 [],
    }[current] || []

    const runningAgents = {
      requirements:          ['requirements'],
      clarifying:            [],
      design:                ['design'],
      parallel_design_tech:  ['design', 'tech_decisions'],
      complete:              [],
    }[current] || []

    const hasArch = Array.isArray(runData.architectures) && runData.architectures.length > 0
    const hasTech = Array.isArray(runData.tech_decisions) && runData.tech_decisions.length > 0
    if (status === 'complete' || (hasArch && hasTech)) {
      return { ...agent, status: 'done', progress: 100, message: '' }
    }
    if (status === 'error' && current === agent.key) {
      return { ...agent, status: 'error', progress: 0, message: runData.error || '' }
    }
    if (doneAgents.includes(agent.key) && current !== agent.key) {
      return { ...agent, status: 'done', progress: 100, message: '' }
    }
    if (runningAgents.includes(agent.key) || current === agent.key) {
      return { ...agent, status: 'running', progress: 60, message: isParallelNode && i > 0 ? 'Running in parallel…' : '' }
    }
    return { ...agent, status: 'pending', progress: 0, message: '' }
  })
}

const AgentPipeline = ({ runData, agentEvents = [] }) => {
  const agentStates = useMemo(() => deriveStates(runData), [runData])

  const overallProgress = useMemo(() => {
    const total = agentStates.reduce((s, a) => s + a.progress, 0)
    return Math.round(total / agentStates.length)
  }, [agentStates])

  const statusIcon = (s) => ({ done: '✓', running: '◐', error: '✗', pending: '○' }[s] || '○')

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
        {agentStates.map((agent, i) => (
          <div key={agent.id} className={`agent-row ${agent.status}`}>
            <div className="agent-icon">{agent.icon}</div>

            <div className="agent-info">
              <div className="agent-name-row">
                <span className="agent-name">
                  {agent.name}
                  {agent.parallel && agent.status === 'running' && (
                    <span className="parallel-badge">∥ parallel</span>
                  )}
                </span>
                <span className={`status-badge ${agent.status}`}>
                  {statusIcon(agent.status)} {agent.status}
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

            <div className="agent-step">{i + 1}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AgentPipeline