# GenFolio

A family-tree app where you build your tree by inviting relatives (not by manually drawing nodes), track shared family health history, and ask a RAG chatbot what conditions run in your family — scoped strictly to your own blood relatives.

## What it does

- **Invitation-based tree building.** You don't draw your family tree — you invite people. Send an invite that says "join as my sibling," and the app derives everything that implies: shared parents, and therefore grandparents, aunts/uncles, and cousins, all without anyone manually entering those relationships.
- **A real relationship-inference engine.** Only two relationship types are ever stored — `PARENT_OF` and `SPOUSE_OF`. Every other relationship (sibling, grandparent, aunt/uncle, cousin, in-law, "N-th cousin M-times removed") is derived at read time by walking that graph. This keeps the data model impossible to get inconsistent, at the cost of the traversal logic having to get every case right — which is why it has the project's only real unit test suite.
- **Handles incomplete families gracefully.** If you join as someone's sibling before either of you has a parent on record, the app creates an unclaimed placeholder parent so the sibling link is still captured structurally. When the real parent joins later, they claim that placeholder instead of creating a disconnected duplicate.
- **A genealogy-chart tree view**, not a flat list — couples rendered side by side, arbitrary numbers of children per couple, generations laid out automatically, with unresolved relationships shown as an explicit "?" instead of guessed at or hidden.
- **Family health records** across five categories (blood sugar, blood pressure, cholesterol, diagnosed conditions, other), each with its own validated shape, and a per-record visibility toggle (private vs. visible to family).
- **A privacy-scoped health chatbot.** Ask "why am I bald?" or "do I have a family history of high blood pressure?" and get an answer grounded only in records your blood relatives have marked visible — retrieval is filtered in SQL before anything reaches the LLM, not just prompted around.

## Why it's more than CRUD

Two pieces of this were genuinely non-trivial:

1. **The relationship engine.** Storing only `PARENT_OF`/`SPOUSE_OF` and deriving everything else means "sibling," "grandparent," and "cousin, once removed" are all just different shapes of the same ancestor-BFS, not separately hand-coded cases. Adding a new relative to the family graph correctly ripples every derived relationship without touching stored data.
2. **The RAG retrieval boundary.** Heredity is genetic, not by marriage — so retrieval scopes to blood relatives only, and the SQL filter on `family_id` + candidate person IDs *is* the privacy boundary, not just prompt instructions. A private record never reaches the LLM context in the first place.

## Tech stack

**Frontend** — Next.js 16 (App Router, TypeScript), Tailwind CSS v4 (token-based light/dark theme), `react-hook-form` + `zod` (validation mirrors the backend's Pydantic constraints field-for-field), TanStack Query, `relatives-tree` for genealogy-chart layout math.

**Backend** — FastAPI (async), SQLAlchemy 2.0 (async) + Alembic migrations, PostgreSQL + pgvector.

**Auth** — Custom JWT (access + refresh), issued by FastAPI, proxied through Next.js route handlers into an httpOnly cookie so the token never touches client JS.

**RAG chatbot** — LangChain + Groq (`llama-3.3-70b-versatile`) for generation, local `sentence-transformers` embeddings (via `langchain-huggingface`) so health data never leaves the backend just to get embedded, pgvector for similarity search via `langchain-postgres`.

**Other** — Cloudinary (profile pictures), a sliding-window rate limiter on the chat endpoint to cap LLM spend.

## Architecture

```
GenFolio/
  frontend/    Next.js — presentation + a thin auth proxy, not a second backend
  backend/     FastAPI — the one source of truth for business logic, auth, and RAG
    app/
      api/         routers: auth, persons, invitations, health_records, chat
      services/    relationship_service (the graph engine), rag_service, auth/invitation services
      models/      SQLAlchemy models
      schemas/     Pydantic request/response schemas
      db/          Alembic migrations
    tests/         relationship_service unit tests
  docker-compose.yml   postgres+pgvector, backend, frontend
```

The frontend never talks to the database or holds business logic beyond form validation — every mutation goes through the FastAPI backend, either via a Next.js route handler (for anything that needs to read/attach the auth cookie) or a direct server-side fetch from a Server Component.

## Getting started

Requires Docker, or Python 3.13+ and Node 20+ if running services natively.

```bash
git clone <this-repo>
cd GenFolio
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# fill in GROQ_API_KEY in backend/.env to enable the chatbot; everything else
# has a working local default

docker-compose up
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend docs: [http://localhost:8000/docs](http://localhost:8000/docs)

First run needs the database schema:

```bash
docker-compose exec backend alembic upgrade head
```

### Running without Docker

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# frontend
cd frontend
npm install
npm run dev
```

## Testing

```bash
cd backend
pytest
```

Covers `relationship_service` — the correctness-critical piece, since a wrong derived edge silently corrupts the whole tree. Fixtures build a small multi-generation family (grandparents → parents → ego + sibling → spouse + kid, plus an aunt/uncle/cousin branch) and assert every derived relationship label, including the gendering rules (an in-law is labeled by their *own* sex, not the blood relative's) and the blood-vs-in-law distinction the RAG scoping depends on.

## Known limitations

Being upfront about what's not here yet:

- **No relationship-editing UI.** If someone is invited with the wrong relationship (e.g., invited directly as your parent when they should be your grandparent), there's currently no way to fix the link short of a manual database edit.
- **No automated frontend tests.** Validation logic is exercised manually; there's no component or E2E test suite yet.
- **Not deployed.** Runs locally via Docker Compose; no hosted environment yet.
- **Email delivery isn't wired up.** Invitations and password resets are link-only — outside production, the reset endpoint hands the link back directly instead of emailing it.
