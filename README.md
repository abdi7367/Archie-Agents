# ⬡ Archie — AI Architecture Advisor

> Describe your product. Get a full architecture analysis in seconds.

Archie is a multi-agent AI system that takes a plain-English product description and returns three production-grade architecture options — MVP, Production, and Future-scale — complete with component breakdowns, data flow diagrams, technology decisions, cost estimates, and ADRs.

![Archie Demo](https://via.placeholder.com/900x400/0f0f23/6366f1?text=Archie+Multi+Agent+Demo)

---

## What it does

You describe your product requirements in natural language:

> *"B2B SaaS platform for 100k users, team of 5, $3k/month budget, GDPR compliance needed"*

Archie runs a pipeline of AI agents and returns:

- **3 architecture tiers** — MVP, Production, Future-scale
- **Mermaid architecture diagrams** for each tier
- **Technology decisions** scored and justified against your constraints
- **Cost estimates** per tier with monthly breakdown
- **ADRs** (Architecture Decision Records) you can download as Markdown
- **Interactive clarification** — asks only what matters, like a Staff engineer would

---

## Architecture

```
User Input
    │
    ▼
┌─────────────────────┐
│  Requirements Agent │  ← Extracts constraints, confidence scoring,
│                     │    Cursor-style clarifying questions
└─────────┬───────────┘
          │
    ┌─────▼──────┐
    │ Clarifying │  ← Human-in-the-loop (optional, only if confidence < 80%)
    └─────┬──────┘
          │
    ┌─────▼────────────────────────┐
    │  Design + Tech Decisions     │  ← Run in parallel
    │  (Architecture Designer)     │    3 tiers × components, diagrams,
    │  (Technology Selector)       │    scored tech choices
    └─────────────────────────────-┘
          │
          ▼
      Results UI
```

Built with **LangGraph** for the agent pipeline, **FastAPI** for the backend, and **React + Vite** for the frontend.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent Orchestration | LangGraph + MemorySaver |
| LLM | Groq (llama-3.3-70b-versatile) or local vLLM |
| Backend | FastAPI, Python 3.11 |
| Frontend | React 19, Vite 8, React Router 7 |
| Diagrams | Mermaid.js |
| Containerization | Docker + Docker Compose |
| Inference (local) | vLLM on AMD ROCm (MI300X) |

---

## Getting Started

### Prerequisites

- Docker + Docker Compose
- A [Groq API key](https://console.groq.com) (free tier works)

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/archie.git
cd archie
```

### 2. Set up environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
GROQ_API_KEY=your_groq_api_key_here
INFERENCE_MODE=groq
```

### 3. Run with Docker Compose

```bash
docker-compose up --build
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:8001](http://localhost:8001)
- API docs: [http://localhost:8001/docs](http://localhost:8001/docs)

### 4. Run locally (without Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn backend.api:app --reload --port 8001
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Running on AMD GPU (ROCm / vLLM)

For local inference on AMD hardware (tested on MI300X):

```bash
docker-compose -f docker-compose.amd.yml up --build
```

This spins up:
1. **vLLM** serving `meta-llama/Llama-3.3-70B-Instruct` via ROCm
2. **Archie backend** pointed at the local vLLM endpoint
3. **React frontend**

Model weights are cached in a Docker volume — first run downloads ~140GB, subsequent starts are fast.

Set environment variables in `docker-compose.amd.yml`:
```yaml
HSA_OVERRIDE_GFX_VERSION=11.0.0   # adjust for your GPU
```

---

## Project Structure

```
archie/
├── backend/
│   ├── agents/
│   │   ├── requirements.py   # Agent 1 — constraint extraction + clarification
│   │   ├── design.py         # Agent 2 — 3 architecture tiers
│   │   └── tech_decisions.py # Agent 3 — scored technology choices
│   ├── prompts/
│   │   ├── requirements.py   # Cursor-style question generation
│   │   ├── design.py         # Architecture generation prompts
│   │   └── tech_decisions.py # Tech scoring prompts
│   ├── api.py                # FastAPI endpoints
│   ├── graph.py              # LangGraph pipeline
│   ├── llm.py                # Groq / vLLM client factory
│   └── state.py              # Pydantic state models
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Home.jsx           # Input + clarification flow
│       │   ├── Results.jsx        # Tabbed results view
│       │   ├── ArchDiagram.jsx    # Mermaid diagram renderer
│       │   ├── AgentPipeline.jsx  # Live pipeline progress
│       │   ├── ClarificationFlow.jsx  # Interactive Q&A
│       │   ├── ConstraintsPanel.jsx   # Editable constraints sidebar
│       │   └── AdrCard.jsx        # Downloadable ADR cards
│       └── api/api.js         # Polling + REST helpers
├── docker-compose.yml         # Groq cloud setup
├── docker-compose.amd.yml     # AMD ROCm local inference
└── Dockerfile.backend
```

---

## API Reference

### `POST /run`
Start a pipeline run. Returns immediately with a `thread_id`.

```json
{
  "user_input": "B2B SaaS for 100k users, team of 5, $3k/month"
}
```

Response:
```json
{
  "thread_id": "abc-123",
  "status": "pending",
  "current_agent": "requirements"
}
```

### `GET /run/{thread_id}`
Poll for results. Status: `pending → running → complete | error`

### `POST /clarify`
Submit answers to clarifying questions.

```json
{
  "thread_id": "abc-123",
  "answers": {
    "scale": "100k",
    "traffic_pattern": "spiky"
  }
}
```

---

## How the agents work

### Agent 1 — Requirements Analyzer
Extracts structured constraints from free-form text. Assigns confidence scores (0–1) per field. If overall confidence < 80%, generates up to 3 targeted clarifying questions using urgency scoring (impact × uncertainty). Skips questions for anything it can reasonably infer.

### Agent 2 — Architecture Designer
Generates exactly 3 architecture tiers: MVP (ship fast), Production (handles stated load), Future-scale (10× growth). Every decision is justified by the actual constraints — team size, budget, compliance, scale. Outputs Mermaid diagrams for each tier.

### Agent 3 — Technology Selector
Scores technology choices (1–10) across categories: Database, Cache, Queue, API Gateway, Auth, Storage, Observability, CI/CD, Hosting. Justifies each choice against constraints, lists alternatives, and flags when to switch.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `GROQ_API_KEY` | Groq cloud API key | required |
| `INFERENCE_MODE` | `groq` or `local` | `groq` |
| `VLLM_BASE_URL` | vLLM endpoint (local mode) | `http://localhost:8000/v1` |
| `LOCAL_MODEL_NAME` | Model name for vLLM | `meta-llama/Llama-3.3-70B-Instruct` |
| `LLM_REQUEST_TIMEOUT_SECONDS` | Per-request LLM timeout | `30` |
| `FRONTEND_URL` | CORS allowed origin | `` |

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
  Built with ⬡ and too much coffee
</div>
