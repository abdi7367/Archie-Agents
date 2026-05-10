import React, { useState, useEffect, useRef } from 'react'
import './ClarificationFlow.css'

/**
 * ClarificationFlow
 *
 * Props:
 *   questions  — array of ClarificationQuestion from the API
 *                Each has: id | field, question, options, hint, allow_freetext
 *   assumptions — array of strings (inferred values shown as context)
 *   onSubmit(answers) — { [field]: value } dict
 *   onSkip()  — proceed without answering
 */
const ClarificationFlow = ({ questions = [], assumptions = [], onSubmit, onSkip }) => {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [freetext, setFreetext] = useState('')
  const [showFreetext, setShowFreetext] = useState(false)
  const [exiting, setExiting] = useState(false)
  const inputRef = useRef(null)

  const q = questions[index]
  const isLast = index === questions.length - 1
  const qKey = q?.field || q?.id  // backend may use either

  useEffect(() => {
    if (showFreetext && inputRef.current) inputRef.current.focus()
  }, [showFreetext])

  if (!q) return null

  const advance = (key, value) => {
    const next = { ...answers, [key]: value }
    setAnswers(next)
    setShowFreetext(false)
    setFreetext('')

    if (isLast) {
      onSubmit(next)
      return
    }

    setExiting(true)
    setTimeout(() => {
      setIndex((i) => i + 1)
      setExiting(false)
    }, 220)
  }

  const handleOption = (value) => {
    advance(qKey, value)
  }

  const handleFreetextSubmit = () => {
    const val = freetext.trim()
    if (!val) return
    advance(qKey, val)
  }

  const handleSkipThis = () => {
    const fallback = q.options?.[0]?.value || 'auto'
    advance(qKey, fallback)
  }

  return (
    <div className="clarification-flow">
      {/* Inferred assumptions banner — shown only on first question */}
      {assumptions.length > 0 && index === 0 && (
        <div className="assumptions-banner">
          <div className="assumptions-header">
            <span className="assumptions-icon">✦</span>
            <span>I inferred these from your description</span>
          </div>
          <div className="assumptions-list">
            {assumptions.map((a, i) => (
              <div key={i} className="assumption-chip">{a}</div>
            ))}
          </div>
        </div>
      )}

      {/* Progress dots */}
      <div className="progress-dots">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`progress-dot ${
              i < index ? 'done' : i === index ? 'active' : 'pending'
            }`}
          />
        ))}
      </div>

      {/* Question card */}
      <div className={`question-card ${exiting ? 'slide-out' : 'slide-in'}`}>
        <div className="question-number">
          {index + 1} / {questions.length}
        </div>

        <h2 className="question-text">{q.question}</h2>

        {q.hint && <p className="question-hint">{q.hint}</p>}

        {!showFreetext ? (
          <>
            <div className="options-grid">
              {(q.options || []).map((opt) => {
                const selected = answers[qKey] === opt.value
                return (
                  <button
                    key={opt.value}
                    className={`option-chip ${selected ? 'selected' : ''}`}
                    onClick={() => handleOption(opt.value)}
                  >
                    {opt.emoji && <span className="option-emoji">{opt.emoji}</span>}
                    <span className="option-label">{opt.label}</span>
                    {selected && <span className="option-check">✓</span>}
                  </button>
                )
              })}

              {q.allow_freetext !== false && (
                <button
                  className="option-chip freetext-trigger"
                  onClick={() => setShowFreetext(true)}
                >
                  <span className="option-emoji">✏️</span>
                  <span className="option-label">Custom answer</span>
                </button>
              )}
            </div>

            <button className="skip-question" onClick={handleSkipThis}>
              Skip — use best guess
            </button>
          </>
        ) : (
          <div className="freetext-container">
            <input
              ref={inputRef}
              className="freetext-input"
              type="text"
              placeholder="Type your answer…"
              value={freetext}
              onChange={(e) => setFreetext(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFreetextSubmit()}
            />
            <div className="freetext-actions">
              <button
                className="freetext-back"
                onClick={() => { setShowFreetext(false); setFreetext('') }}
              >
                ← Back to options
              </button>
              <button
                className="freetext-submit"
                onClick={handleFreetextSubmit}
                disabled={!freetext.trim()}
              >
                Continue →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Skip all */}
      <button className="skip-all" onClick={() => onSubmit(answers)}>
        Generate with current info
      </button>
    </div>
  )
}

export default ClarificationFlow