# Financial Module (KBM Logic)

This document describes how the financial engine works after the MongoDB Atlas migration and the addition of income/expense **Transactions** into the core Earned Value Management (EVM) formulas.

---

## 1) Data Models (MongoDB Atlas)

### Project schema (finance-related fields)
- `fixedCosts[]` – recurring/one-time planned costs with `amount`, `currency`, and `frequency` (`one-time`, `daily`, `weekly`, `monthly`, `yearly`); stored inside the project for baseline costs.
- `members[].userId.monthlySalary` – monthly salary; converted to **daily rate** using the project `workSchedule` (working days/week, hours/day). Daily rates feed AC.
- `workSchedule` – drives salary-to-rate conversion and PV time slicing.
- `evmSnapshots[]` – cached PV/AC/EV points for historical dates to speed up S-curve rendering.
- `cumulativeActualCost` – running AC cache for quick lookups.
- `deadline` – target completion date; used to determine PV projection end.
- Derived `financials` response (from `/projects/:id/stats`) – not persisted as a field, but returned to clients with PV/AC/EV, variances, and remaining budget.

### Transaction schema
- Fields: `projectId`, `amount`, `type` (`'+'` = Income, `'-'` = Expense), `source`, `date` (immutable), `authorId`, `description`.
- Effects:
  - `type: '+'` (Income) increases available/remaining budget.
  - `type: '-'` (Expense) is included in **AC**.
- Indexed for Atlas performance: `{ projectId, type, date }` and `{ projectId, date }`.

### Expense schema
- Fields: `projectId`, `name`, `amount`, `frequency` (`daily`, `weekly`, `monthly`, `yearly`), `createdBy`, `updatedBy`, timestamps.
- Recurring costs: applied per frequency for AC.
- One-time costs: captured either as a single Expense entry (no recurrence beyond its creation date) or as a `fixedCosts` item with `frequency: 'one-time'`.

---

## 2) Core EVM Logic & Formulas

- **PV (Planned Value)** – Baseline is allocated across the project duration from start to deadline (or effective deadline) using task budgets (estimate hours × avg hourly rate from salaries). PV extends into the future for projection.
- **EV (Earned Value)** – `Total Budget * % of Completed Tasks` (implemented by summing the budget of tasks whose status is Done by the target date).
- **AC (Actual Cost)** – `Sum(Daily Salaries from Start to Now) + Sum(Fixed Costs) + Sum(Negative Transactions)`
  - Salaries: daily rates derived from `members[].userId.monthlySalary` and `workSchedule`.
  - Fixed/recurring costs: `fixedCosts` and `expenses` applied by frequency.
  - Negative transactions: all `type: '-'` entries up to the target date.
  - **"This Month"**: AC is recalculated for the filtered period, summing these three sources within the range.
- **Variances**
  - SV (Schedule Variance) = `EV - PV`
  - CV (Cost Variance) = `EV - AC`

---

## 3) Financial Health Metrics

- **Burn Rate** – Average daily spend over the last 30 days: rolling AC components (salaries + recurring costs + `type: '-'` transactions) limited to that window.
- **Runway** – `Remaining Budget / Daily Burn Rate` (Infinity if burn is zero).
- **Remaining Budget** – `(Initial/Baseline Budget + Total Income from Transactions) - Actual Cost`

---

## 4) S-Curve Visualization (Adaptive Logic)

- **Adaptive granularity**
  - Projects < 2 months: daily points.
  - Tiered logic for longer projects: weekly (<6 months), bi-weekly (<2 years), monthly (<5 years), quarterly (5+ years). Projects > 2 years therefore use monthly-or-higher aggregation.
- **Future projection**
  - PV continues through the deadline/effective end date.
  - AC (and EV) stop at today; future points show PV only.

---

## Notes & Storage

- All collections (`projects`, `transactions`, `expenses`, `tasks`, `users`) are stored in **MongoDB Atlas**.
- Indexes on transactions/expenses are tuned for AC and budget calculations; PV/EV/AC snapshots are cached in `evmSnapshots` for fast historical lookups.

