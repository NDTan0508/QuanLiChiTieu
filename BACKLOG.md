# BACKLOG - Quan Li Chi Tieu Web App

Last updated: 2026-07-22

## Rule For Future Work

- Before continuing any major work, read this file and `plan.md`.
- After completing each concrete task, update this file before moving to the next task.
- Do not assume old context is available. This file is the handoff source of truth.
- Keep user decisions intact unless the user explicitly changes them.

## Product Goal

Build a personal finance web app to replace a Google Sheet used for monthly income, expenses, savings allocation, investment funds, MBB bank deposits, emergency deposits, SOL accumulation, and net-worth reporting.

The app is for one user. It should feel good on phone first, also work on laptop. The UI should be dark, minimal, finance-focused, modern/tech, with black/orange as the main style but not a one-color palette.

## User Decisions Already Confirmed

### Platform And Storage

- App should run on phone and laptop.
- Mobile experience is the priority.
- Data can be stored online with Supabase.
- App may need a simple PIN login.
- No full multi-user login is required.
- Backup/export Excel is useful later.
- Current implementation is allowed to start with local browser storage for quick testing, then connect Supabase later.

### Money And Dates

- User enters full money values manually, for example `9.000.000`.
- Display money as `9.000.000đ`.
- Display dates as `01/08/2026`.

### Dashboard

- Dashboard opens the current month by default.
- There must be previous/next month controls.
- Dashboard shows:
  - Total income
  - Total expenses
  - Monthly savings
  - Pie chart for income by category
  - Pie chart for expenses by category
  - Detail list under each pie chart
  - Savings allocation preview
  - Checklist of fixed monthly transfers
  - Widget for MBB deposits close to maturity
- Monthly savings formula:
  - If envelope expense is calculated as `spent = start amount - end amount`, then:
  - `monthly savings = income - expense`
  - Do not add leftover again, because leftover is already reflected by the expense formula.

### Income

- Income categories can be fixed or variable.
- Fixed income example: PT Valley.
- PT Valley is entered manually and happens once per month.
- App should not auto-create fixed income rows with 0 VND.
- Variable income example: Fishing.
- Variable income can be entered multiple times per month.
- Each variable income transaction should store date and note.
- No "received/not received" status is needed.

### Expenses

- Expense categories can be:
  - `envelope`: has start-of-month amount and end-of-month amount.
  - `fixed`: has amount and "transferred" checkbox.
- Current envelope categories are mainly:
  - Chi tiêu
  - Phát sinh
- User can create/edit envelope and fixed expense categories.
- Fixed expenses include examples:
  - Mẹ
  - Du lịch
  - Học phí
- Fixed expenses count into monthly expenses only after the checkbox is ticked.
- Checklist is made from fixed expense items.
- Checklist is not just a reminder; ticking it affects expense calculation.
- One-off expense entries are needed, with date and note.
- One-off expense entries should add into the selected expense category, especially "Phát sinh".

### Savings Allocation

- Allocation funds:
  - BTC
  - CK
  - Quỹ tiết kiệm
  - Quỹ dự phòng
- Percentages can be changed.
- Percentages must total 100%.
- Allocation preview should only suggest values until confirmed.
- There should be a "Xác nhận chia quỹ" button.
- User only confirms allocation at the end of the month.
- After confirmation:
  - BTC and CK amounts are added to their VND fund histories.
  - Quỹ tiết kiệm and Quỹ dự phòng should open/use deposit data: amount, deposit date, term months, interest rate.
- User says they will not edit income/expense after final monthly allocation. If this changes later, design an adjustment flow.

### BTC And CK

- BTC and CK are only VND funds.
- No BTC price or stock-market valuation is needed.
- Withdrawals only write history.
- Withdrawals should include date and reason/note.

### MBB Savings And Emergency Funds

- Quỹ tiết kiệm MBB and Quỹ dự phòng both use individual deposit-book records.
- Each bank deposit requires:
  - Amount/principal
  - Deposit date
  - Term in months
  - Annual interest rate
- Interest formula:
  - `interest = principal * annualRatePercent * termMonths / 12`
- Only term by months is needed.
- Near maturity highlight:
  - 30 days: yellow
  - 7 days: red
- At maturity, user has three options:
  - Withdraw all
  - Roll principal only
  - Roll principal + interest
- On rollover, always create a new deposit record and link it to the old deposit.
- Old deposit should never be overwritten except status/link metadata.
- Early settlement:
  - Interest = 0
  - Received amount = principal
  - Status should indicate early settlement.
- Net worth should count only current principal of active MBB deposits.
- Do not count future expected interest in net worth.
- Interest is only counted into principal/net worth after maturity is completed and rolled into a new deposit or otherwise actually realized.

### SOL

- SOL is accumulated randomly, like a coin portfolio.
- Each SOL entry needs:
  - Date
  - SOL amount
  - Buy price in USDT
  - Note
- App calculates:
  - Cost = SOL amount * buy price
  - Total SOL
  - Total cost
  - Average cost
  - Current value
  - PnL USDT and percent
- Current SOL price should come from CoinGecko.
- If API/network fails, show the last saved market price.
- SOL is tracked in USDT.
- App should also fetch current USD/VND rate to convert SOL value for net worth.
- No SOL trading fee needed.

### Reports

- First report priority: total net worth.
- Need asset growth chart in the first version.
- Net worth includes:
  - BTC VND fund
  - CK VND fund
  - SOL converted to VND
  - Current principal of active MBB saving deposits
  - Current principal of active emergency deposits
- Net worth excludes cash.
- Do not import old Excel data. User will enter values manually.

### Navigation

User wants:

- Thu nhập, Chi tiêu, Chia quỹ combined into one page.
- Each fund as its own page:
  - BTC
  - CK
  - Tiết kiệm
  - Dự phòng
  - SOL

Current proposed nav:

- Dashboard
- Thu/Chi
- BTC
- CK
- Tiết kiệm
- Dự phòng
- SOL
- Báo cáo
- Cài đặt

## Current Code Status

The project started from an almost empty folder containing only:

- `plan.md`

Files already created:

- `.gitignore`
- `package.json`
- `index.html`
- `tsconfig.json`
- `tsconfig.node.json`
- `vite.config.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/styles.css`
- `BACKLOG.md`

`src/styles.css` now exists. Build has not been run yet after adding CSS.

## Current Implementation Summary

### Stack

- Vite
- React
- TypeScript
- Recharts
- lucide-react
- LocalStorage state for MVP

Supabase is not implemented yet.

### App State In `src/App.tsx`

Implemented TypeScript data models:

- `IncomeCategory`
- `IncomeTransaction`
- `ExpenseCategory`
- `MonthlyExpense`
- `ExpenseEntry`
- `Allocation`
- `FundTransaction`
- `BankDeposit`
- `SolTransaction`
- `Market`
- `SettingsState`
- `AppState`

LocalStorage key:

- `quan-li-chi-tieu-state-v1`

### Implemented Pages/Components

In `src/App.tsx`:

- PIN gate
- App navigation
- Dashboard page
- Combined Thu/Chi/Chia quỹ page
- BTC fund page
- CK fund page
- MBB saving deposit page
- Emergency deposit page
- SOL page
- Reports page
- Settings page

### Implemented Logic

- Current month handling.
- Previous/next month controls.
- VND formatting.
- Date formatting.
- Money parsing from strings like `9.000.000`.
- Monthly income summary by category.
- Monthly expense summary by category.
- Envelope expense calculation:
  - `spent = max(startAmount - endAmount, 0)`
- Fixed expense calculation:
  - Counts only when checked.
- One-off expense entries add to selected category.
- Savings calculation:
  - `saving = income - expense`
- Allocation percentages and preview.
- Allocation confirmation:
  - Adds BTC and CK fund transactions.
  - Creates saving and emergency MBB deposit records.
- BTC/CK withdrawals with notes.
- MBB deposit:
  - Create deposit.
  - Calculate maturity date.
  - Calculate simple interest.
  - Early settlement.
  - Matured settlement.
  - Rollover principal.
  - Rollover principal + interest.
  - Link parent/child deposits.
- SOL:
  - Add SOL entries.
  - Calculate cost, current value, PnL.
  - Fetch CoinGecko SOL price.
  - Fetch USD/VND rate from open.er-api.com.
  - Keep last saved price on API failure.
- Reports:
  - Calculate current net worth from BTC, CK, SOL VND, active MBB principal.

## Known Gaps / Needs Fixing

### Build/CSS

- Create `src/styles.css`.
- Ensure all classes used in `src/App.tsx` have usable mobile-first styling.
- Verify app builds with TypeScript.

### TypeScript Risks To Check

- Recharts and JSX types need dependency install.
- `useEffect` market fetch depends on initial `state.market` but dependency array is empty. This is acceptable for last-saved fallback on mount, but can be improved.

### Product Logic Gaps

- Allocation confirmation can currently be clicked multiple times for same month, creating duplicate fund transactions/deposits. Need prevent duplicate confirmation or support update/replace flow.
- If allocation has already been confirmed, UI should show confirmed status and maybe disable repeat unless user chooses "chia lại".
- For MBB maturity:
  - Current `settled` status does not add realized interest to any fund/cash. User excludes cash from net worth, but if "rút toàn bộ" to somewhere else is later needed, add destination handling.
  - Rollover principal-only currently creates new principal deposit but does not route interest anywhere. Product spec says app should ask where interest goes. Need implement.
  - Rollover principal + interest is okay because new principal includes interest.
- For net worth:
  - Active MBB principal only is counted.
  - Rolled principal + interest becomes active principal in the new child deposit, so realized interest is counted then.
- Reports asset growth chart is currently simplistic: it shows current total assets for all months, not a true historical net-worth series. Need improve later.
- Supabase schema and integration not yet implemented.
- Export Excel not implemented.
- Category editing/deleting is not implemented, only creation.
- Transaction editing/deleting is not implemented.
- PIN is stored in localStorage in plain text. This is okay for MVP only; later hash or use Supabase auth/edge logic if needed.

## Next Tasks

1. Test key flows manually:
   - Create PIN
   - Add income
   - Edit envelope expense start/end
   - Tick fixed expense
   - Add one-off expense
   - Change allocation percentages
   - Confirm allocation
   - Check BTC/CK pages
   - Check saving/emergency deposit pages
   - Add SOL transaction
   - Check report net worth
7. Update this backlog after each completed task.

## Suggested Supabase Schema Later

Tables:

- `income_categories`
- `income_transactions`
- `expense_categories`
- `monthly_expenses`
- `expense_entries`
- `allocations`
- `fund_transactions`
- `bank_deposits`
- `sol_transactions`
- `market_prices`
- `settings`

Because the app is single-user, every table can be simple at first. If a PIN-only online app is used, store a single private workspace id or use Supabase Auth later.

## Latest Completed Task Log

- 2026-07-22: Read user answers from `plan.md` and clarified remaining decisions.
- 2026-07-22: User confirmed PIN, savings formula, final allocation behavior, navigation, expense entries, and net-worth logic.
- 2026-07-22: Created initial Vite/React/TypeScript project files.
- 2026-07-22: Created first large `src/App.tsx` implementation with core data models, pages, and calculations.
- 2026-07-22: Created this `BACKLOG.md` handoff file before continuing styling/build work.
- 2026-07-22: Created `src/styles.css` with mobile-first dark orange finance UI, responsive bottom nav on mobile, cards, forms, deposit states, charts, and PIN screen styling.
- 2026-07-22: Ran `npm install`; dependencies installed successfully with 0 vulnerabilities.
- 2026-07-22: First `npm run build` failed on TypeScript config and MBB rollover status typing. Fixed `moduleResolution` to `Bundler` and typed rollover status as `DepositStatus`.
- 2026-07-22: `npm run build` passed successfully. Vite warned that the main JS chunk is larger than 500 kB, mostly expected from chart dependencies in the MVP.
- 2026-07-22: Started Vite dev server on `http://localhost:5173/`; local request returned HTTP 200. Logs are written to `vite-dev.log` and `vite-dev.err.log`.
- 2026-07-22: Added `.gitignore`, moved TypeScript build-info files into `node_modules/.tmp`, and removed generated root artifacts `vite.config.js`, `vite.config.d.ts`, `tsconfig.tsbuildinfo`, and `tsconfig.node.tsbuildinfo`.
- 2026-07-22: Rebuild showed TypeScript project references cannot point to a no-emit config. Removed the `tsconfig.node.json` reference from root `tsconfig.json`; app source remains covered by TypeScript build.
- 2026-07-22: Re-ran `npm run build`; build passed again with only the known Vite chunk-size warning.
- 2026-07-22: Started implementing updated allocation plan. Extended `Allocation` with confirmed amount snapshots and added an `AllocationAmounts` model for rounded fund distribution.
- 2026-07-22: Added certificate-lot allocation helper. Saving and emergency allocations round down to `100.000đ`; their remainder is added to BTC, and monthly summaries now use that final distribution.
- 2026-07-22: Changed allocation confirmation so it stores confirmed snapshots and creates only BTC/CK fund transactions. It no longer creates saving/emergency deposit records immediately, and the confirmation popup now explains that those deposits wait on their own pages.
- 2026-07-22: Added pending deposit banners to Saving/Emergency pages. Confirmed allocations now show as "chưa tạo sổ" until at least one matching deposit exists for that fund and month. Deposit form can be prefilled from the banner and now supports a manually editable maturity date. Added modal and pending-banner styling.
- 2026-07-22: Ran `npm run build`; build passed with only the existing Vite chunk-size warning.
- 2026-07-22: Renamed allocation date label from deposit date to confirmation date, rebuilt successfully, and kept the existing Vite chunk-size warning as non-blocking.
- 2026-07-22: Reset test data by moving LocalStorage to `quan-li-chi-tieu-state-v2-june-2026-reset`. App now starts at month `2026-06`; default categories remain, while transactions/funds/deposits/SOL start empty for fresh testing.
- 2026-07-22: Ran `npm run build` after the reset/start-month change; build passed with only the known chunk-size warning.
- 2026-07-22: Updated SOL metric cards so `Vốn` and `Lãi/lỗ` show USDT as the main value and VND conversion underneath using the current USD/VND market rate.
- 2026-07-22: Ran `npm run build` after SOL metric display change; build passed with only the known chunk-size warning.
