import React from 'react'
import './ConstraintsPanel.css'

const ConstraintsPanel = ({ constraints }) => {
  if (!constraints || Object.keys(constraints).length === 0) {
    return (
      <div className="constraints-panel">
        <h3 className="panel-title">Constraints</h3>
        <div className="no-constraints">
          <p>No constraints data available</p>
        </div>
      </div>
    )
  }

  const formatConstraintValue = (key, value) => {
    if (typeof value === 'boolean') {
      return value ? '✅ Yes' : '❌ No'
    }
    if (typeof value === 'number') {
      if (key.toLowerCase().includes('budget') || key.toLowerCase().includes('cost')) {
        return `$${value.toLocaleString()}`
      }
      if (key.toLowerCase().includes('users') || key.toLowerCase().includes('load')) {
        return value.toLocaleString()
      }
      return value.toString()
    }
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    return value
  }

  const getConstraintIcon = (key) => {
    const lowerKey = key.toLowerCase()
    if (lowerKey.includes('user') || lowerKey.includes('traffic')) return '👥'
    if (lowerKey.includes('budget') || lowerKey.includes('cost')) return '💰'
    if (lowerKey.includes('team') || lowerKey.includes('developer')) return '👨‍💻'
    if (lowerKey.includes('compliance') || lowerKey.includes('security')) return '🔒'
    if (lowerKey.includes('performance') || lowerKey.includes('scalability')) return '⚡'
    if (lowerKey.includes('deadline') || lowerKey.includes('timeline')) return '📅'
    return '📋'
  }

  return (
    <div className="constraints-panel">
      <h3 className="panel-title">Project Constraints</h3>
      <div className="constraints-list">
        {Object.entries(constraints).map(([key, value]) => (
          <div key={key} className="constraint-item">
            <div className="constraint-header">
              <span className="constraint-icon">{getConstraintIcon(key)}</span>
              <span className="constraint-key">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>
            <div className="constraint-value">
              {formatConstraintValue(key, value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ConstraintsPanel
