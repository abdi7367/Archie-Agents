import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { runArchie } from '../api/api'
import ParticleBackground from './ParticleBackground'
import TypingIndicator from './TypingIndicator'
import { useSoundEffects } from '../hooks/useSoundEffects'
import './Home.css'

const Home = () => {
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const navigate = useNavigate()
  const { playClickSound, playHoverSound, playTypingSound } = useSoundEffects()

  const examplePrompts = [
    "I need to build a B2B SaaS platform for 100k users with a team of 5 developers, $3k/month budget, and need to handle GDPR compliance",
    "Build a consumer mobile app with 1M users, team of 10, growing traffic pattern, and need to handle PII data",
    "Create an internal tool for a small team of 3, steady traffic, no compliance requirements, minimal budget",
    "Design a data pipeline processing 100GB/day with scheduled traffic patterns, team of 8 data engineers",
    "Build an IoT platform for 50k devices with spiky traffic, team of 6, need real-time processing"
  ]

  useEffect(() => {
    const savedInput = sessionStorage.getItem('userInput')
    if (savedInput) {
      setInput(savedInput)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (input.trim()) {
      setIsSubmitting(true)
      setError('')
      
      try {
        sessionStorage.setItem('userInput', input)
        sessionStorage.setItem('timestamp', new Date().toISOString())
        
        const result = await runArchie(input)
        
        // Store thread_id for Results component to fetch data
        sessionStorage.setItem('thread_id', result.thread_id)
        sessionStorage.setItem('status', result.status)
        
        navigate('/results')
      } catch (err) {
        setError('Failed to process your request. Please try again.')
        console.error('Error:', err)
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const handleExampleClick = (prompt) => {
    setInput(prompt)
    setIsTyping(true)
    playClickSound()
    setTimeout(() => setIsTyping(false), 2000)
  }

  return (
    <div className="home-container">
      <ParticleBackground />
      <div className="floating-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>
      <div className="terminal-card">
        <h1 className="terminal-title">
          Archie Architecture Advisor
        </h1>
        
        <p className="terminal-description">
          Describe your product requirements and get AI-powered architecture recommendations
        </p>

        {/* Examples Section - Top */}
        <div className="examples-section">
          <h3 className="examples-title">
            Example Prompts:
          </h3>
          <div className="examples-grid">
            {examplePrompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(prompt)}
                onMouseEnter={playHoverSound}
                className="example-button"
              >
                <span className="example-arrow">→</span>
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Section - Bottom */}
        <form onSubmit={handleSubmit} className="terminal-form">
          <div className="input-container">
            <span className="prompt-symbol">$</span>
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setIsTyping(false)
                if (e.target.value.length > input.length) {
                  playTypingSound()
                }
              }}
              onFocus={() => setIsTyping(true)}
              onBlur={() => setTimeout(() => setIsTyping(false), 1000)}
              placeholder="Describe your product requirements..."
              className="terminal-input textarea-input"
              rows="4"
            />
          </div>
          
          {isTyping && !isSubmitting && (
            <div className="typing-container">
              <TypingIndicator />
            </div>
          )}

          <button
            type="submit"
            disabled={!input.trim() || isSubmitting}
            onMouseEnter={playHoverSound}
            className={`execute-button ${isSubmitting ? 'loading' : ''}`}
          >
            {isSubmitting && (
              <span className="spinner">
                ⚡
              </span>
            )}
            {isSubmitting ? 'Analyzing...' : 'Analyze Architecture'}
          </button>
        </form>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="info-section">
          <div className="info-header">
            <span className="info-icon">ℹ</span>
            <span className="info-title">Info:</span>
          </div>
          Your input will be saved to session storage and available on the results page.
        </div>
      </div>
    </div>
  )
}

export default Home