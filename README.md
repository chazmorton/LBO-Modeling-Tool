# LBO Modeling Tool

An interactive web application for analyzing leveraged buyout (LBO) opportunities. Enter any public company ticker and the tool fetches live financial data from Yahoo Finance, scores the company's LBO suitability, runs a full 5-year financial model, and stress-tests the deal with a Monte Carlo simulation.

Built for students and professionals learning about private equity and financial modeling.

> **Disclaimer:** This tool is for educational purposes only and does not constitute investment advice.

---

## Features

- **Company Validation** — Score a company across five LBO suitability criteria (EBITDA margin, revenue scale, existing debt load, company maturity, free cash flow) on a 100-point scale
- **LBO Model** — Project revenue, EBITDA, debt paydown, and equity value over a 5-year holding period; calculates IRR and MOIC
- **Monte Carlo Simulation** — Run 1,000+ randomized scenarios to see the distribution of potential returns
- **Live Data** — Auto-fills company financials from Yahoo Finance via `yfinance`

---

## Project Structure

```
LBO-Modeling-Tool/
├── backend/
│   ├── main.py             # FastAPI app — REST API endpoints
│   ├── lbo_model.py        # Financial modeling logic (IRR, MOIC, projections)
│   └── requirements.txt    # Python dependencies
└── frontend/
    ├── index.html          # Step 1: Company validation
    ├── lbo.html            # Step 2: LBO model inputs & results
    ├── monte-carlo.html    # Step 3: Monte Carlo simulation
    ├── about.html          # About the tool
    ├── shared.js           # Shared utilities (navigation, search, state)
    ├── script.js           # Additional frontend logic
    └── style.css           # Global styling
```

### Three-Step Workflow

1. **Validate** (`index.html`) — Search a ticker, review the LBO suitability score
2. **Model** (`lbo.html`) — Adjust entry multiple, debt structure, growth assumptions, and exit multiple; view 5-year projections
3. **Simulate** (`monte-carlo.html`) — Run a Monte Carlo simulation to stress-test the deal across 1,000+ scenarios

### API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/validate/{ticker}` | GET | Score a company's LBO suitability |
| `/company/{ticker}` | GET | Fetch company financials from Yahoo Finance |
| `/search` | GET | Typeahead company search |
| `/lbo` | POST | Run the LBO model with given assumptions |
| `/monte-carlo` | POST | Run Monte Carlo simulation |
| `/health` | GET | Health check |

---

## Requirements

- **Python 3.8+**
- A modern browser with ES6 support (Chrome, Firefox, Safari, Edge)
- Internet connection (required for Yahoo Finance data)
- Port **8000** available for the backend API

Python dependencies (see `backend/requirements.txt`):

```
fastapi==0.115.0
uvicorn==0.30.6
numpy==1.26.4
numpy-financial==1.0.0
pandas==2.2.2
yfinance==0.2.54
```

---

## How to Run

### 1. Start the Backend

```bash
# Navigate to the backend directory
cd backend

# (Recommended) Create and activate a virtual environment
python -m venv venv
source venv/bin/activate      # macOS/Linux
# venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt

# Start the API server
python main.py
```

The API will be available at `http://localhost:8000`.

### 2. Open the Frontend

The frontend is plain HTML/CSS/JavaScript — no build step required.

**Option A — Open directly in browser:**

```bash
open frontend/index.html    # macOS
# or just double-click frontend/index.html in Finder
```

**Option B — Serve locally (recommended to avoid CORS issues):**

```bash
cd frontend
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

> The frontend expects the backend API at `http://localhost:8000`. Make sure the backend is running before using the app.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI |
| ASGI server | Uvicorn |
| Financial data | yfinance (Yahoo Finance) |
| Numerical computing | NumPy, NumPy-Financial, Pandas |
| Frontend | Vanilla HTML / CSS / JavaScript |
| Charts | Chart.js (via CDN) |
| State persistence | Browser `localStorage` |
