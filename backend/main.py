from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from lbo_model import run_lbo
import yfinance as yf
import numpy as np
import time

app = FastAPI(title="LBO Modeling Tool")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def fetch_info_with_retry(ticker_sym, retries=3, delay=2):
    for attempt in range(retries):
        try:
            t = yf.Ticker(ticker_sym)
            info = t.info
            if info and info.get("quoteType"):
                return t, info
        except Exception:
            pass
        if attempt < retries - 1:
            time.sleep(delay)
    return None, None


def build_company_payload(ticker, t, info):
    name = info.get("longName") or info.get("shortName") or ticker.upper()
    sector = info.get("sector", "")
    industry = info.get("industry", "")

    total_revenue = info.get("totalRevenue") or 0
    revenue_m = round(total_revenue / 1e6, 1)

    ebitda_margins = info.get("ebitdaMargins") or 0.20
    ebitda_margin_pct = round(ebitda_margins * 100, 1)

    growth_rate_pct = 5.0
    try:
        financials = t.financials
        if financials is not None and not financials.empty:
            rev_row = None
            for label in ["Total Revenue", "Revenue"]:
                if label in financials.index:
                    rev_row = financials.loc[label]
                    break
            if rev_row is not None and len(rev_row) >= 2:
                latest = rev_row.iloc[0]
                prior = rev_row.iloc[1]
                if prior and prior != 0:
                    growth_rate_pct = round(((latest - prior) / abs(prior)) * 100, 1)
    except Exception:
        pass

    total_debt = info.get("totalDebt") or 0
    enterprise_value = info.get("enterpriseValue") or 1
    debt_percent_pct = round(min((total_debt / enterprise_value) * 100, 80), 1)
    if debt_percent_pct < 10:
        debt_percent_pct = 60.0

    ebitda_val = total_revenue * ebitda_margins
    exit_multiple = 10.0
    if ebitda_val and ebitda_val > 0:
        computed = enterprise_value / ebitda_val
        if 3 < computed < 50:
            exit_multiple = round(computed, 1)

    return {
        "name": name,
        "sector": sector,
        "industry": industry,
        "ticker": ticker.upper(),
        "revenue": revenue_m,
        "growth_rate": growth_rate_pct,
        "ebitda_margin": ebitda_margin_pct,
        "debt_percent": debt_percent_pct,
        "interest_rate": 8.0,
        "exit_multiple": exit_multiple,
        "years": 5,
        "total_debt": round(total_debt / 1e6, 1),
        "enterprise_value": round(enterprise_value / 1e6, 1),
        "ebitda_val": round(ebitda_val / 1e6, 1),
    }


@app.get("/validate/{ticker}")
def validate_company(ticker: str):
    try:
        t, info = fetch_info_with_retry(ticker.upper())
        if not info:
            raise HTTPException(status_code=429, detail="Yahoo Finance rate limit hit — wait 30 seconds and try again.")

        company = build_company_payload(ticker, t, info)

        checks = []
        score = 0

        # 1. Positive EBITDA margin
        margin = info.get("ebitdaMargins") or 0
        if margin > 0.15:
            checks.append({"label": "Strong EBITDA margin", "pass": True,  "detail": f"{round(margin*100,1)}% — solid cash generation"})
            score += 25
        elif margin > 0:
            checks.append({"label": "Positive EBITDA margin", "pass": True,  "detail": f"{round(margin*100,1)}% — thin but positive"})
            score += 10
        else:
            checks.append({"label": "EBITDA margin", "pass": False, "detail": f"{round(margin*100,1)}% — company is losing money, debt cannot be repaid"})

        # 2. Revenue size
        revenue = info.get("totalRevenue") or 0
        revenue_m = revenue / 1e6
        if revenue_m >= 500:
            checks.append({"label": "Revenue scale", "pass": True,  "detail": f"${round(revenue_m,0):,.0f}M — large enough for institutional LBO"})
            score += 20
        elif revenue_m >= 100:
            checks.append({"label": "Revenue scale", "pass": True,  "detail": f"${round(revenue_m,0):,.0f}M — mid-market LBO range"})
            score += 12
        elif revenue_m > 0:
            checks.append({"label": "Revenue scale", "pass": False, "detail": f"${round(revenue_m,0):,.0f}M — too small, lenders won't finance"})
        else:
            checks.append({"label": "Revenue scale", "pass": False, "detail": "No revenue reported — pre-revenue company"})

        # 3. Existing debt load (Debt/EBITDA)
        total_debt = info.get("totalDebt") or 0
        ebitda_val = revenue * margin
        if ebitda_val > 0:
            debt_ebitda = total_debt / ebitda_val
            if debt_ebitda < 4:
                checks.append({"label": "Existing debt load", "pass": True,  "detail": f"{round(debt_ebitda,1)}x Debt/EBITDA — room to add LBO leverage"})
                score += 20
            elif debt_ebitda < 7:
                checks.append({"label": "Existing debt load", "pass": True,  "detail": f"{round(debt_ebitda,1)}x Debt/EBITDA — manageable but tight"})
                score += 10
            else:
                checks.append({"label": "Existing debt load", "pass": False, "detail": f"{round(debt_ebitda,1)}x Debt/EBITDA — already over-leveraged"})
        else:
            checks.append({"label": "Existing debt load", "pass": False, "detail": "Cannot calculate — no positive EBITDA"})

        # 4. Stable / non-speculative sector
        sector = info.get("sector", "")
        bad_sectors = ["Technology"]  # only flag pure speculative tech
        quote_type = info.get("quoteType", "")
        market_cap = info.get("marketCap") or 0
        # Flag if tiny market cap (under $300M) — likely startup
        if market_cap < 3e8:
            checks.append({"label": "Company maturity", "pass": False, "detail": f"Market cap ${round(market_cap/1e6,0):.0f}M — too small/early stage for LBO"})
        else:
            checks.append({"label": "Company maturity", "pass": True,  "detail": f"Market cap ${round(market_cap/1e9,1):.1f}B — established company"})
            score += 20

        # 5. Free cash flow positive
        fcf = info.get("freeCashflow") or 0
        if fcf > 0:
            checks.append({"label": "Free cash flow", "pass": True,  "detail": f"${round(fcf/1e6,0):,.0f}M — positive FCF pays down debt"})
            score += 15
        else:
            checks.append({"label": "Free cash flow", "pass": False, "detail": f"${round(fcf/1e6,0):,.0f}M — negative FCF, cannot service debt"})

        # Verdict
        passed = sum(1 for c in checks if c["pass"])
        total  = len(checks)

        if score >= 75:
            verdict = "Strong LBO Candidate"
            valid = True
            color = "green"
            summary = "This company has the fundamentals a PE firm looks for — positive cash flows, meaningful scale, and manageable existing debt."
        elif score >= 45:
            verdict = "Possible LBO Candidate"
            valid = True
            color = "yellow"
            summary = "This company could work as an LBO target but has some weaknesses. Model outputs should be interpreted with caution."
        else:
            verdict = "Poor LBO Candidate"
            valid = False
            color = "red"
            summary = "This company lacks the fundamentals needed for a realistic LBO. The model will likely produce unreliable or extreme outputs."

        return {
            "ticker": ticker.upper(),
            "name": company["name"],
            "sector": company["sector"],
            "industry": company["industry"],
            "valid": valid,
            "score": score,
            "verdict": verdict,
            "color": color,
            "summary": summary,
            "checks": checks,
            "passed": passed,
            "total": total,
            "company": company,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/company/{ticker}")
def get_company(ticker: str):
    try:
        t, info = fetch_info_with_retry(ticker.upper())
        if not info:
            raise HTTPException(status_code=429, detail="Yahoo Finance rate limit hit — wait 30 seconds and try again.")
        return build_company_payload(ticker, t, info)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search")
def search_companies(q: str):
    try:
        results = yf.Search(q, max_results=6).quotes
        companies = []
        for item in results:
            if item.get("quoteType") in ("EQUITY", "ETF"):
                companies.append({
                    "ticker": item.get("symbol", ""),
                    "name": item.get("longname") or item.get("shortname") or "",
                    "exchange": item.get("exchange", ""),
                })
        return {"results": companies}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/lbo")
def calculate_lbo(data: dict):
    required = ["revenue", "growth_rate", "ebitda_margin", "debt_percent",
                "interest_rate", "exit_multiple", "years"]
    missing = [k for k in required if k not in data]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing fields: {missing}")
    try:
        return run_lbo(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/monte-carlo")
def monte_carlo(data: dict):
    required = ["revenue", "growth_rate", "ebitda_margin", "debt_percent",
                "interest_rate", "exit_multiple", "years"]
    missing = [k for k in required if k not in data]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing fields: {missing}")

    try:
        n = int(data.get("simulations", 1000))
        n = min(max(n, 100), 5000)

        base_growth   = float(data["growth_rate"])
        base_margin   = float(data["ebitda_margin"])
        base_multiple = float(data["exit_multiple"])

        growth_std   = float(data.get("growth_std",   base_growth * 0.4))
        margin_std   = float(data.get("margin_std",   base_margin * 0.2))
        multiple_std = float(data.get("multiple_std", base_multiple * 0.2))

        irr_results  = []
        moic_results = []
        rng = np.random.default_rng()

        growth_samples   = rng.normal(base_growth,   growth_std,   n)
        margin_samples   = rng.normal(base_margin,   margin_std,   n)
        multiple_samples = rng.normal(base_multiple, multiple_std, n)

        for i in range(n):
            sim_data = dict(data)
            sim_data["growth_rate"]   = float(np.clip(growth_samples[i],   0.001, 1.0))
            sim_data["ebitda_margin"] = float(np.clip(margin_samples[i],   0.01,  0.99))
            sim_data["exit_multiple"] = float(np.clip(multiple_samples[i], 1.0,   50.0))
            try:
                result = run_lbo(sim_data)
                irr = result.get("irr")
                eq_in  = result.get("initial_equity", 0)
                eq_out = result.get("equity_value", 0)
                if irr is not None and -50 < irr < 200:
                    irr_results.append(round(irr, 2))
                    moic = round(eq_out / eq_in, 2) if eq_in > 0 else None
                    if moic is not None:
                        moic_results.append(moic)
            except Exception:
                pass

        if not irr_results:
            raise HTTPException(status_code=500, detail="No valid simulations produced.")

        irr_arr  = np.array(irr_results)
        moic_arr = np.array(moic_results)
        counts, edges = np.histogram(irr_arr, bins=30)

        return {
            "simulations": len(irr_results),
            "irr": {
                "mean":   round(float(np.mean(irr_arr)), 2),
                "median": round(float(np.median(irr_arr)), 2),
                "p10":    round(float(np.percentile(irr_arr, 10)), 2),
                "p25":    round(float(np.percentile(irr_arr, 25)), 2),
                "p75":    round(float(np.percentile(irr_arr, 75)), 2),
                "p90":    round(float(np.percentile(irr_arr, 90)), 2),
                "min":    round(float(np.min(irr_arr)), 2),
                "max":    round(float(np.max(irr_arr)), 2),
            },
            "moic": {
                "mean":   round(float(np.mean(moic_arr)), 2)   if len(moic_arr) else None,
                "median": round(float(np.median(moic_arr)), 2) if len(moic_arr) else None,
                "p10":    round(float(np.percentile(moic_arr, 10)), 2) if len(moic_arr) else None,
                "p90":    round(float(np.percentile(moic_arr, 90)), 2) if len(moic_arr) else None,
            },
            "histogram": {
                "counts": counts.tolist(),
                "edges":  [round(float(e), 2) for e in edges],
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}
