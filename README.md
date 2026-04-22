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

```bash
./start.sh
```

That's it. The script will:

1. Create a Python virtual environment (first run only)
2. Install dependencies (first run only)
3. Start the backend API on `http://localhost:8000`
4. Start the frontend server on `http://localhost:8080`
5. Open the app in your browser automatically

Press **Ctrl+C** to stop both servers.

> **Note:** Requires Python 3.8+ and port 8000 and 8080 to be available.

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
