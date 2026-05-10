const BASE = '/api'

// ── Core fetch helpers ───────────────────────────────────────────────────────

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`POST ${path} failed (${res.status}): ${detail}`)
  }
  return res.json()
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`GET ${path} failed (${res.status}): ${detail}`)
  }
  return res.json()
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Start a pipeline run.
 * Returns immediately with { thread_id, status: "pending" }.
 * Use pollRun() to wait for completion.
 */
export const runArchie = (userInput) =>
  post('/run', { user_input: userInput })

/** Max wait for design + tech LLM chain (requirements alone can return quickly via clarification). */
export const PIPELINE_POLL_TIMEOUT_MS = 25 * 60 * 1000 // 25 minutes

function timeoutMessage(timeoutMs) {
  const mins = Math.floor(timeoutMs / 60_000)
  const secs = Math.round((timeoutMs % 60_000) / 1000)
  const human =
    mins > 0
      ? `${mins} minute${mins === 1 ? '' : 's'}${secs ? ` ${secs}s` : ''}`
      : `${secs} seconds`
  return (
    `Pipeline timed out after ${human}. Analysis can be slow — check the Results page ` +
    `with the same browser session or try again later.`
  )
}

/**
 * Fetch the current state of a run by thread_id.
 */
export const getRun = (threadId) =>
  get(`/run/${threadId}`)

/**
 * Poll GET /run/{threadId} every `intervalMs` milliseconds until the run
 * reaches "complete", "error", or "awaiting_clarification", then resolve with the final state.
 *
 * @param {string}   threadId
 * @param {function} onUpdate   - called on every poll with the latest data
 * @param {number}   intervalMs - polling interval (default 2500ms)
 * @param {number}   timeoutMs  - give up after this many ms (default PIPELINE_POLL_TIMEOUT_MS)
 */
export const pollRun = (
  threadId,
  onUpdate,
  intervalMs = 3000,
  timeoutMs = PIPELINE_POLL_TIMEOUT_MS,
) => {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    let timerId = null

    const tick = async () => {
      // Timeout guard
      if (Date.now() - start > timeoutMs) {
        clearTimeout(timerId)
        reject(new Error(timeoutMessage(timeoutMs)))
        return
      }

      try {
        const data = await getRun(threadId)
        if (onUpdate) onUpdate(data)

        if (
          data.status === 'complete' ||
          data.status === 'error' ||
          data.status === 'awaiting_clarification'
        ) {
          clearTimeout(timerId)
          resolve(data)
        } else {
          // Still running — schedule next tick
          timerId = setTimeout(tick, intervalMs)
        }
      } catch (err) {
        clearTimeout(timerId)
        reject(err)
      }
    }

    // First fetch immediately (backend may already be at awaiting_clarification / complete)
    void tick()
  })
}
export const submitClarification = (threadId, answers) =>
  post('/clarify', { thread_id: threadId, answers })