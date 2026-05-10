import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { runArchie, pollRun } from '../api/api'
import TypingIndicator from './TypingIndicator'
import AgentPipeline from './AgentPipeline'
import './Home.css'

const examples = [
  {
    prompt: "I need to build a B2B SaaS platform for 100k users with a team of 5 developers, $3k/month budget, and need to handle GDPR compliance",
    tags: ["B2B SaaS", "100k Users", "GDPR"],
    tier: "Production",
    estimate: "$2,800/mo",
    components: 8
  },
  {
    prompt: "Build a consumer mobile app with 1M users, team of 10, growing traffic pattern, and need to handle PII data",
    tags: ["Mobile", "1M Users", "High Growth"],
    tier: "Scale",
    estimate: "$8,500/mo",
    components: 12
  },
  {
    prompt: "Create an internal tool for a small team of 3, steady traffic, no compliance requirements, minimal budget",
    tags: ["Internal Tool", "Small Team", "Low Cost"],
    tier: "MVP",
    estimate: "$450/mo",
    components: 4
  },
  {
    prompt: "Design a data pipeline processing 100GB/day with scheduled traffic patterns, team of 8 data engineers",
    tags: ["Data Pipeline", "100GB/day", "Analytics"],
    tier: "Production",
    estimate: "$5,200/mo",
    components: 10
  },
  {
    prompt: "Build an IoT platform for 50k devices with spiky traffic, team of 6, need real-time processing",
    tags: ["IoT", "50k Devices", "Real-time"],
    tier: "Scale",
    estimate: "$6,800/mo",
    components: 11
  }
]

const Home = () => {
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  // Live pipeline progress shown while waiting
  const [liveRunData, setLiveRunData] = useState(null)

  const navigate = useNavigate()
  const pollCancelRef = useRef(null)   // lets us cancel polling if user navigates away

  useEffect(() => {
    const savedInput = sessionStorage.getItem('userInput')
    if (savedInput) setInput(savedInput)

    // Cleanup: cancel any in-flight poll on unmount
    return () => {
      if (pollCancelRef.current) pollCancelRef.current()
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return

    setIsSubmitting(true)
    setError('')
    setLiveRunData(null)

    const timestamp = new Date().toISOString()
    sessionStorage.setItem('userInput', trimmed)
    sessionStorage.setItem('timestamp', timestamp)

    try {
      // 1. Start run — returns immediately with thread_id
      const { thread_id } = await runArchie(trimmed)
      sessionStorage.setItem('thread_id', thread_id)

      // 2. Poll with live updates so the pipeline widget animates
      let cancelled = false
      pollCancelRef.current = () => { cancelled = true }

      const finalData = await pollRun(
        thread_id,
        (update) => {
          if (!cancelled) setLiveRunData(update)
        }
      )

      if (cancelled) return

      // 3. Navigate, passing the full result so Results doesn't re-fetch
      navigate('/results', {
        state: {
          threadId: thread_id,
          userInput: trimmed,
          timestamp,
          runData: finalData,
        }
      })
    } catch (err) {
      setError(err.message || 'Failed to process your request. Please try again.')
      console.error('Error:', err)
    } finally {
      setIsSubmitting(false)
      setLiveRunData(null)
    }
  }

  const handleExampleClick = (example) => {
    setInput(example.prompt)
    setIsTyping(true)
    setTimeout(() => setIsTyping(false), 2000)
  }

  return (
    <div className="home-container">
      <div className="terminal-card">
        <h1 className="terminal-title">Archie Multi Agent</h1>

        <p className="terminal-description">
          Describe your product requirements and get AI-powered architecture recommendations
        </p>

        {/* Show live pipeline progress while analysing */}
        {isSubmitting && liveRunData && (
          <div className="live-pipeline">
            <AgentPipeline runData={liveRunData} />
          </div>
        )}

        {/* Example cards — hidden while submitting to reduce noise */}
        {!isSubmitting && (
          <div className="examples-section">
            <div className="examples-header">
              <h3 className="examples-title">See what you'll get</h3>
              <p className="examples-subtitle">
                Click any example to load it into the prompt
              </p>
            </div>
            <div className="examples-grid">
              {examples.map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(example)}
                  className="example-card"
                >
                  <div className="example-preview">
                    <div className="preview-header">
                      <span className={`tier-badge tier-${example.tier.toLowerCase()}`}>
                        {example.tier}
                      </span>
                      <span className="cost-pill">{example.estimate}</span>
                    </div>
                    <div className="preview-stats">
                      <div className="stat">
                        <span className="stat-value">{example.components}</span>
                        <span className="stat-label">Components</span>
                      </div>
                      <div className="stat-divider"></div>
                      <div className="stat">
                        <span className="stat-value">{example.tags[0]}</span>
                        <span className="stat-label">Type</span>
                      </div>
                    </div>
                  </div>
                  <div className="example-prompt">
                    <span className="example-arrow">→</span>
                    <span className="prompt-text">{example.prompt}</span>
                  </div>
                  <div className="example-tags">
                    {example.tags.map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input form */}
        <form onSubmit={handleSubmit} className="terminal-form">
          <div className="input-container">
            <span className="prompt-symbol">$</span>
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setIsTyping(false)
              }}
              onFocus={() => setIsTyping(true)}
              onBlur={() => setTimeout(() => setIsTyping(false), 1000)}
              placeholder="Describe your product requirements..."
              className="terminal-input textarea-input"
              rows="4"
              disabled={isSubmitting}
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
            className={`execute-button ${isSubmitting ? 'loading' : ''}`}
          >
            {isSubmitting && <span className="spinner">⚡</span>}
            {isSubmitting ? 'Analyzing…' : 'Analyze Architecture'}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}

        <div className="info-section">
          <div className="info-header">
            <span className="info-icon">ℹ</span>
            <span className="info-title">Info:</span>
          </div>
          Results are kept in this browser session. Paste a thread ID to resume a previous run.
        </div>
      </div>
    </div>
  )
}

export default Home