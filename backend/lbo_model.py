import numpy as np
import numpy_financial as npf


def project_revenue(initial_revenue, growth_rate, years):
    revenues = []
    for year in range(1, years + 1):
        revenues.append(initial_revenue * (1 + growth_rate) ** year)
    return revenues


def calculate_ebitda(revenues, margin):
    return [rev * margin for rev in revenues]


def calculate_debt_schedule(initial_debt, interest_rate, years):
    # Simple straight-line amortization: repay equal principal each year
    annual_principal = initial_debt / years
    debt_balances = []
    interest_payments = []
    remaining = initial_debt
    for _ in range(years):
        interest = remaining * interest_rate
        interest_payments.append(interest)
        remaining -= annual_principal
        debt_balances.append(max(remaining, 0))
    return debt_balances, interest_payments


def calculate_exit_value(final_ebitda, exit_multiple):
    return final_ebitda * exit_multiple


def calculate_irr(cash_flows):
    try:
        result = npf.irr(cash_flows)
        return float(result) if not np.isnan(result) else None
    except Exception:
        return None


def run_lbo(data):
    revenue = float(data["revenue"])
    growth_rate = float(data["growth_rate"])
    ebitda_margin = float(data["ebitda_margin"])
    debt_percent = float(data["debt_percent"])
    interest_rate = float(data["interest_rate"])
    exit_multiple = float(data["exit_multiple"])
    years = int(data["years"])

    # 1. Purchase price = entry EBITDA * entry multiple (use exit_multiple as entry)
    entry_ebitda = revenue * ebitda_margin
    purchase_price = entry_ebitda * exit_multiple

    # 2. Split into debt + equity
    initial_debt = purchase_price * debt_percent
    initial_equity = purchase_price * (1 - debt_percent)

    # 3. Project revenue + EBITDA
    revenues = project_revenue(revenue, growth_rate, years)
    ebitda_list = calculate_ebitda(revenues, ebitda_margin)

    # 4. Build debt schedule
    debt_balances, interest_payments = calculate_debt_schedule(initial_debt, interest_rate, years)

    # 5. Exit value
    exit_value = calculate_exit_value(ebitda_list[-1], exit_multiple)

    # 6. Equity at exit = enterprise value - remaining debt
    remaining_debt = debt_balances[-1]
    equity_value = exit_value - remaining_debt

    # 7. Cash flows: [-initial_equity] at year 0, [equity_value] at exit
    # Intermediate years: EBITDA minus interest (simplified free cash flow)
    cash_flows = [-initial_equity]
    for i in range(years - 1):
        free_cash_flow = ebitda_list[i] - interest_payments[i]
        cash_flows.append(max(free_cash_flow, 0))
    cash_flows.append(equity_value)

    # 8. IRR
    irr = calculate_irr(cash_flows)

    return {
        "irr": round(irr * 100, 2) if irr is not None else None,
        "exit_value": round(exit_value, 2),
        "equity_value": round(equity_value, 2),
        "initial_equity": round(initial_equity, 2),
        "initial_debt": round(initial_debt, 2),
        "purchase_price": round(purchase_price, 2),
        "revenues": [round(r, 2) for r in revenues],
        "ebitda": [round(e, 2) for e in ebitda_list],
        "debt_balances": [round(d, 2) for d in debt_balances],
        "interest_payments": [round(i, 2) for i in interest_payments],
        "cash_flows": [round(c, 2) for c in cash_flows],
        "years": list(range(1, years + 1)),
    }
