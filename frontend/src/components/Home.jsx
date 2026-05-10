import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { runArchie, pollRun, submitClarification, PIPELINE_POLL_TIMEOUT_MS } from '../api/api'
import TypingIndicator from './TypingIndicator'
import AgentPipeline from './AgentPipeline'
import ClarificationFlow from './ClarificationFlow'
import './Home.css'

const examples = [
  {
    prompt: "B2B SaaS platform for 100k users, team of 5, $3k/month, GDPR compliance needed",
    tags: ["B2B SaaS", "100k Users", "GDPR"],
    tier: "Production",
    estimate: "$2,800/mo",
    components: 8,
  },
  {
    prompt: "Consumer mobile app targeting 1M users, team of 10, growing traffic, handles PII",
    tags: ["Mobile", "1M Users", "High Growth"],
    tier: "Scale",
    estimate: "$8,500/mo",
    components: 12,
  },
  {
    prompt: "Internal tool for a 3-person team, steady traffic, no compliance, minimal budget",
    tags: ["Internal Tool", "Small Team", "Low Cost"],
    tier: "MVP",
    estimate: "$450/mo",
    components: 4,
  },
  {
    prompt: "Data pipeline processing 100GB/day with scheduled peaks, team of 8 data engineers",
    tags: ["Data Pipeline", "100GB/day", "Analytics"],
    tier: "Production",
    estimate: "$5,200/mo",
    components: 10,
  },
]

// ── Stages ────────────────────────────────────────────────────────────────────
// idle → submitting → clarifying → analyzing → done (navigate away)

const Home = () => {
  const [input, setInput] = useState('')
  const [stage, setStage] = useState('idle') // idle | submitting | clarifying | analyzing
  const [error, setError] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  // Clarification state
  const [threadId, setThreadId] = useState(null)
  const [clarifyQuestions, setClarifyQuestions] = useState([])
  const [clarifyAssumptions, setClarifyAssumptions] = useState([])

  // Live pipeline progress
  const [liveRunData, setLiveRunData] = useState(null)

  const navigate = useNavigate()
  const pollCancelRef = useRef(null)

  useEffect(() => {
    const saved = sessionStorage.getItem('userInput')
    if (saved) setInput(saved)
    return () => { if (pollCancelRef.current) pollCancelRef.current() }
  }, [])

  // ── Submit initial prompt ──────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return

    setStage('submitting')
    setError('')
    setLiveRunData(null)

    const timestamp = new Date().toISOString()
    sessionStorage.setItem('userInput', trimmed)
    sessionStorage.setItem('timestamp', timestamp)

    try {
      const { thread_id } = await runArchie(trimmed)
      sessionStorage.setItem('thread_id', thread_id)
      setThreadId(thread_id)

      // Poll until awaiting_clarification | complete | error.
      // Without clarification the backend runs the full graph in one task — often several minutes.
      let cancelled = false
      pollCancelRef.current = () => { cancelled = true }

      const firstResult = await pollRun(
        thread_id,
        (update) => { if (!cancelled) setLiveRunData(update) },
        2000,
        PIPELINE_POLL_TIMEOUT_MS,
      )

      if (cancelled) return

      // Did the requirements agent ask questions? (API uses awaiting_clarification)
      const questions = firstResult.clarification_questions || []
      if (
        questions.length > 0 &&
        firstResult.status !== 'complete' &&
        firstResult.status !== 'error'
      ) {
        // Show interactive clarification UI
        setClarifyQuestions(questions)
        setClarifyAssumptions(firstResult.assumptions || [])
        setStage('clarifying')
        return
      }

      // No questions needed — go straight to results
      await proceedToResults(thread_id, trimmed, timestamp, firstResult)
    } catch (err) {
      setError(err.message || 'Failed to process your request. Please try again.')
      setStage('idle')
    }
  }

  // ── Handle clarification answers ──────────────────────────────────────────

  const handleClarifySubmit = async (answers) => {
    setStage('analyzing')
    setError('')

    const trimmed = input.trim()
    const timestamp = sessionStorage.getItem('timestamp') || new Date().toISOString()

    try {
      await submitClarification(threadId, answers)

      let cancelled = false
      pollCancelRef.current = () => { cancelled = true }

      const finalData = await pollRun(
        threadId,
        (update) => { if (!cancelled) setLiveRunData(update) },
        2500,
        PIPELINE_POLL_TIMEOUT_MS,
      )

      if (cancelled) return
      await proceedToResults(threadId, trimmed, timestamp, finalData)
    } catch (err) {
      setError(err.message || 'Failed to process clarification. Please try again.')
      setStage('idle')
    }
  }

  const handleClarifySkip = () => {
    handleClarifySubmit({})
  }

  // ── Navigate to results ───────────────────────────────────────────────────

  const proceedToResults = async (tid, userInput, timestamp, runData) => {
    // If still running, keep polling
    if (runData.status === 'running' || runData.status === 'pending') {
      setStage('analyzing')
      let cancelled = false
      pollCancelRef.current = () => { cancelled = true }

      const finalData = await pollRun(
        tid,
        (update) => { if (!cancelled) setLiveRunData(update) },
        2500,
        PIPELINE_POLL_TIMEOUT_MS,
      )
      if (cancelled) return
      runData = finalData
    }

    navigate('/results', {
      state: { threadId: tid, userInput, timestamp, runData },
    })
  }

  const handleExampleClick = (example) => {
    setInput(example.prompt)
    setIsTyping(true)
    setTimeout(() => setIsTyping(false), 2000)
  }

  const isSubmitting = stage === 'submitting' || stage === 'analyzing'

  // ── Render ────────────────────────────────────────────────────────────────

  // Clarification screen — full-screen, minimal
  if (stage === 'clarifying') {
    return (
      <div className="home-container">
        <div className="terminal-card clarify-mode">
          <div className="clarify-header">
            <div className="clarify-brand">
              <span className="clarify-logo">⬡</span>
              <span className="clarify-title">Archie</span>
            </div>
            <p className="clarify-subtitle">
              A few quick questions to nail the architecture
            </p>
          </div>

          <ClarificationFlow
            questions={clarifyQuestions}
            assumptions={clarifyAssumptions}
            onSubmit={handleClarifySubmit}
            onSkip={handleClarifySkip}
          />

          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="home-container">
      <div className="terminal-card">
        <h1 className="terminal-title">Archie Multi Agent</h1>
        <p className="terminal-description">
          Describe your product — get a full architecture analysis in seconds
        </p>

        {/* Live pipeline progress while analyzing */}
        {isSubmitting && liveRunData && (
          <div className="live-pipeline">
            <AgentPipeline runData={liveRunData} />
          </div>
        )}

        {/* Example cards */}
        {!isSubmitting && (
          <div className="examples-section">
            <div className="examples-header">
              <h3 className="examples-title">See what you'll get</h3>
              <p className="examples-subtitle">Click any example to load it</p>
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
                      <div className="stat-divider" />
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
              onChange={(e) => { setInput(e.target.value); setIsTyping(false) }}
              onFocus={() => setIsTyping(true)}
              onBlur={() => setTimeout(() => setIsTyping(false), 1000)}
              placeholder="Describe your product requirements…"
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
          Results are kept in this browser session.
        </div>
      </div>
    </div>
  )
}

export default Home