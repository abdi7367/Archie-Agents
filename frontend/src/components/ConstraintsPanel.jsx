import React, { useState } from 'react'
import './ConstraintsPanel.css'

const INFERRED_DEFAULTS = {
  cloud_provider: 'AWS',
  region: 'us-east-1',
  preferred_language: 'TypeScript',
  database_type: 'PostgreSQL',
  cache_strategy: 'Redis',
  container_orchestration: 'Docker Compose',
  ci_cd: 'GitHub Actions',
  monitoring: 'Datadog',
  logging: 'ELK Stack'
}

const ConstraintsPanel = ({ constraints, inferred = {}, onConstraintChange }) => {
  const [editingKey, setEditingKey] = useState(null)
  const [editValue, setEditValue] = useState('')

  // Merge provided constraints with inferred defaults
  const allConstraints = { ...INFERRED_DEFAULTS, ...constraints, ...inferred }
  const inferredKeys = Object.keys({ ...INFERRED_DEFAULTS, ...inferred })
  
  if (!allConstraints || Object.keys(allConstraints).length === 0) {
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
      return value ? 'Yes' : 'No'
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
    if (lowerKey.includes('cloud')) return '☁️'
    if (lowerKey.includes('database') || lowerKey.includes('cache')) return '🗄️'
    if (lowerKey.includes('container') || lowerKey.includes('docker')) return '�'
    if (lowerKey.includes('monitoring') || lowerKey.includes('logging')) return '📊'
    return '�📋'
  }

  const isInferred = (key) => inferredKeys.includes(key) && !constraints?.[key]

  const handleEditClick = (key, value) => {
    setEditingKey(key)
    setEditValue(value)
  }

  const handleSave = () => {
    if (onConstraintChange && editingKey) {
      onConstraintChange(editingKey, editValue)
    }
    setEditingKey(null)
    setEditValue('')
  }

  const handleCancel = () => {
    setEditingKey(null)
    setEditValue('')
  }

  return (
    <div className="constraints-panel">
      <h3 className="panel-title">Project Constraints</h3>
      <p className="panel-subtitle">
        Inferred values shown. Click any value to edit.
      </p>
      <div className="constraints-list">
        {Object.entries(allConstraints).map(([key, value]) => (
          <div key={key} className={`constraint-item ${isInferred(key) ? 'inferred' : ''}`}>
            <div className="constraint-header">
              <span className="constraint-icon">{getConstraintIcon(key)}</span>
              <span className="constraint-key">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>
            
            {editingKey === key ? (
              <div className="constraint-edit">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="constraint-input"
                  autoFocus
                />
                <div className="edit-actions">
                  <button onClick={handleSave} className="edit-btn save">✓</button>
                  <button onClick={handleCancel} className="edit-btn cancel">✗</button>
                </div>
              </div>
            ) : (
              <div 
                className="constraint-value editable"
                onClick={() => handleEditClick(key, value)}
                title="Click to edit"
              >
                {formatConstraintValue(key, value)}
                {isInferred(key) && (
                  <span className="inferred-badge">Inferred</span>
                )}
                <span className="edit-hint">✎</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default ConstraintsPanel
