import React, { useState, useEffect, useRef } from 'react'
import './ClarificationFlow.css'

/**
 * ClarificationFlow
 *
 * Props:
 *   questions       — array of ClarificationQuestion objects from the API
 *   assumptions     — array of strings (inferred assumptions)
 *   onSubmit(answers) — called when user submits all answers
 *   onSkip()        — called when user wants to skip and generate anyway
 */
const ClarificationFlow = ({ questions, assumptions, onSubmit, onSkip }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})        // { question_id: value }
  const [freetext, setFreetext] = useState({})      // { question_id: string }
  const [showFreetext, setShowFreetext] = useState({})
  const [animating, setAnimating] = useState(false)
  const inputRef = useRef(null)

  const currentQuestion = questions[currentIndex]
  const isLast = currentIndex === questions.length - 1
  const progress = ((currentIndex) / questions.length) * 100

  useEffect(() => {
    // Focus freetext input when it appears
    if (showFreetext[currentQuestion?.id] && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showFreetext, currentQuestion?.id])

  const selectOption = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
    // Auto-advance after a short delay
    setTimeout(() => advance(questionId, value), 300)
  }

  const advance = (questionId, value) => {
    const finalAnswers = { ...answers, [questionId]: value }
    setAnswers(finalAnswers)

    if (isLast) {
      onSubmit(finalAnswers)
      return
    }

    setAnimating(true)
    setTimeout(() => {
      setCurrentIndex(i => i + 1)
      setAnimating(false)
    }, 250)
  }

  const handleFreetextSubmit = () => {
    const val = freetext[currentQuestion.id]?.trim()
    if (!val) return
    advance(currentQuestion.id, val)
  }

  const handleSkipQuestion = () => {
    // Use first option as default when skipping
    const defaultVal = currentQuestion.options[0]?.value || 'unknown'
    advance(currentQuestion.id, defaultVal)
  }

  if (!currentQuestion) return null

  const selectedValue = answers[currentQuestion.id]
  const isShowingFreetext = showFreetext[currentQuestion.id]

  return (
    <div className="clarification-flow">
      {/* Assumptions banner */}
      {assumptions?.length > 0 && currentIndex === 0 && (
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
              i < currentIndex ? 'done' :
              i === currentIndex ? 'active' : 'pending'
            }`}
          />
        ))}
      </div>

      {/* Question card */}
      <div className={`question-card ${animating ? 'slide-out' : 'slide-in'}`}>
        <div className="question-number">
          Question {currentIndex + 1} of {questions.length}
        </div>

        <h2 className="question-text">{currentQuestion.question}</h2>

        {currentQuestion.hint && (
          <p className="question-hint">{currentQuestion.hint}</p>
        )}

        {/* Option chips */}
        {!isShowingFreetext && (
          <div className="options-grid">
            {currentQuestion.options.map((opt) => (
              <button
                key={opt.value}
                className={`option-chip ${selectedValue === opt.value ? 'selected' : ''}`}
                onClick={() => selectOption(currentQuestion.id, opt.value)}
              >
                {opt.emoji && <span className="option-emoji">{opt.emoji}</span>}
                <span className="option-label">{opt.label}</span>
                {selectedValue === opt.value && (
                  <span className="option-check">✓</span>
                )}
              </button>
            ))}

            {currentQuestion.allow_freetext && (
              <button
                className="option-chip freetext-trigger"
                onClick={() => setShowFreetext(prev => ({
                  ...prev,
                  [currentQuestion.id]: true,
                }))}
              >
                <span className="option-emoji">✏️</span>
                <span className="option-label">Custom answer</span>
              </button>
            )}
          </div>
        )}

        {/* Freetext input */}
        {isShowingFreetext && (
          <div className="freetext-container">
            <input
              ref={inputRef}
              className="freetext-input"
              type="text"
              placeholder={`Enter your answer...`}
              value={freetext[currentQuestion.id] || ''}
              onChange={e => setFreetext(prev => ({
                ...prev,
                [currentQuestion.id]: e.target.value,
              }))}
              onKeyDown={e => e.key === 'Enter' && handleFreetextSubmit()}
            />
            <div className="freetext-actions">
              <button
                className="freetext-back"
                onClick={() => setShowFreetext(prev => ({
                  ...prev,
                  [currentQuestion.id]: false,
                }))}
              >
                ← Back to options
              </button>
              <button
                className="freetext-submit"
                onClick={handleFreetextSubmit}
                disabled={!freetext[currentQuestion.id]?.trim()}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Skip this question */}
        <button className="skip-question" onClick={handleSkipQuestion}>
          Skip — use best guess
        </button>
      </div>

      {/* Bottom skip-all */}
      <button className="skip-all" onClick={() => onSubmit(answers)}>
        Generate with current info
      </button>
    </div>
  )
}

export default ClarificationFlow