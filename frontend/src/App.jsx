import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './components/Home'
import Results from './components/Results'
import ErrorBoundary from './components/ErrorBoundary'

const App = () => {
  return (
    <Router>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/results"
            element={
              // Per-route boundary: a Results crash won't kill the Home page
              <ErrorBoundary>
                <Results />
              </ErrorBoundary>
            }
          />
        </Routes>
      </ErrorBoundary>
    </Router>
  )
}

export default App