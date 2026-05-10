import React from 'react'
import './TypingIndicator.css'

const TypingIndicator = () => {
  return (
    <div className="typing-indicator">
      <div className="typing-dots">
        <div className="dot dot-1"></div>
        <div className="dot dot-2"></div>
        <div className="dot dot-3"></div>
      </div>
      <span className="typing-text">AI is thinking...</span>
    </div>
  )
}

export default TypingIndicator
