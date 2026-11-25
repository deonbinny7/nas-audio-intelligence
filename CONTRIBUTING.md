# Contributing to NAS

Thank you for your interest in contributing to **NAS**!

## Development Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/deonbinny7/nas-audio-intelligence.git
   cd nas-audio-intelligence
   ```
2. Set up the Python backend (Python 3.12+ and FFmpeg required):
   ```powershell
   cd backend
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   copy .env.example .env
   uvicorn app.main:app --port 8000 --reload
   ```
3. Set up the React + TypeScript frontend (Node.js 20+):
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

## Branch & Commit Conventions

- **Branch naming:**
  - `feat/<short-description>` for new features
  - `fix/<short-description>` for bug fixes
  - `docs/<short-description>` for documentation updates
  - `refactor/<short-description>` for code refactoring
- **Commit messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).

## Code Quality Expectations

- **Frontend:** Ensure `npm run build` (`tsc -b && vite build`) passes without TypeScript or bundler errors.
- **Backend:** Keep FastAPI routes typed with Pydantic schemas, avoid blocking the async event loop (use `run_in_threadpool` for CPU-bound DSP/ML inference), and never commit secrets or `.env` files.
- **Explainability:** If adding or modifying an AI/DSP pipeline stage, update the static explainability registry in `frontend/src/data/explanations.ts` so descriptions remain accurate.

## Pull Request Process

1. Ensure no secrets, `.env` files, or downloaded model weights (`backend/pretrained_models/`) are staged.
2. Describe the problem, your solution, and how you tested it against the running backend and frontend.
3. Open a pull request against `main`.
