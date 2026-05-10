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

/**
 * Fetch the current state of a run by thread_id.
 */
export const getRun = (threadId) =>
  get(`/run/${threadId}`)

/**
 * Poll GET /run/{threadId} every `intervalMs` milliseconds until the run
 * reaches "complete" or "error", then resolve with the final state.
 *
 * @param {string}   threadId
 * @param {function} onUpdate   - called on every poll with the latest data
 * @param {number}   intervalMs - polling interval (default 2500ms)
 * @param {number}   timeoutMs  - give up after this many ms (default 120s)
 */
export const pollRun = (threadId, onUpdate, intervalMs = 3000, timeoutMs = 300_000) => {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    let timerId = null

    const tick = async () => {
      // Timeout guard
      if (Date.now() - start > timeoutMs) {
        clearTimeout(timerId)
        reject(new Error('Pipeline timed out after 5 minutes. Please try again.'))
        return
      }

      try {
        const data = await getRun(threadId)
        if (onUpdate) onUpdate(data)

        if (data.status === 'complete' || data.status === 'error') {
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


    // Start polling
    timerId = setTimeout(tick, intervalMs)
  })
}
export const submitClarification = (threadId, answers) =>
  post('/clarify', { thread_id: threadId, answers })