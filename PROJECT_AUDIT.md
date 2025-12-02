# Project Codebase Audit Report

**Date:** Generated on audit execution  
**Scope:** Full-stack MERN application (MongoDB, Express.js, React, Node.js)  
**Focus Areas:** Database integrity, business logic consistency, API/UI alignment, security gaps

---

## 1. Critical Logic Discrepancies (High Priority)

### 1.1 **Fixed Costs NOT Included in AC Calculation**
**Location:** `server/services/evmEngine.js` → `calculateAC()` function  
**Issue:** The `calculateAC()` function calculates Actual Cost from:
- Member salaries (daily rate × days since start)
- Project expenses (from `Expense` model)

However, it **completely ignores** `project.fixedCosts` array, which is defined in the Project schema and can be set via the API.

**Impact:** 
- If users add fixed costs (e.g., monthly office rent, software licenses), these costs are NOT reflected in the Actual Cost calculation.
- This causes a **systematic underreporting** of actual spending.
- The Financial Dashboard and Investor Report will show incorrect AC values.

**Evidence:**
- `Project.js` schema defines `fixedCosts: [fixedCostSchema]` (line 144)
- `evmEngine.js` `calculateAC()` (lines 199-269) does not reference `project.fixedCosts`
- `budgetEngine.js` `calculatePlannedValue()` (lines 8-63) DOES include fixed costs in planned value calculation
- **Inconsistency:** Fixed costs are included in PV but not in AC, causing a mismatch.

**Recommendation:** Add fixed costs calculation to `calculateAC()`:
```javascript
// Add after line 262 (after expenses loop)
// Add fixed costs (project.fixedCosts)
if (project.fixedCosts && Array.isArray(project.fixedCosts)) {
  for (const fixedCost of project.fixedCosts) {
    const fixedCostStartDate = new Date(project.createdAt || projectStartDate);
    if (date >= fixedCostStartDate) {
      const daysSinceStart = Math.max(0, Math.ceil((date - fixedCostStartDate) / (1000 * 60 * 60 * 24)));
      
      let fixedCostAmount = 0;
      switch (fixedCost.frequency) {
        case 'daily':
          fixedCostAmount = fixedCost.amount * daysSinceStart;
          break;
        case 'weekly':
          fixedCostAmount = fixedCost.amount * Math.ceil(daysSinceStart / 7);
          break;
        case 'monthly':
          fixedCostAmount = fixedCost.amount * Math.ceil(daysSinceStart / 30.44);
          break;
        case 'yearly':
          fixedCostAmount = fixedCost.amount * Math.ceil(daysSinceStart / 365);
          break;
        case 'one-time':
          fixedCostAmount = fixedCost.amount; // One-time cost applied once
          break;
        default:
          fixedCostAmount = fixedCost.amount * Math.ceil(daysSinceStart / 30.44);
      }
      totalAC += fixedCostAmount;
    }
  }
}
```

---

### 1.2 **Transaction Model NOT Used in AC Calculation**
**Location:** `server/services/evmEngine.js` → `calculateAC()` function  
**Issue:** The `Transaction` model (which tracks manual budget additions/subtractions via "Manage Funds") is **not included** in the Actual Cost calculation.

**Impact:**
- When users add funds (`type: '+'`) or withdraw funds (`type: '-'`) via the "Manage Funds" feature, these transactions are stored in the database but **not reflected in AC**.
- This creates a discrepancy: the budget changes are visible in the Transactions list, but the AC calculation ignores them.
- The `budgetEngine.js` `calculateActualCost()` function (lines 68-95) DOES include transactions, but this function is **not used** by the main Financial Dashboard.

**Evidence:**
- `Transaction` model exists (`server/models/Transaction.js`)
- `evmEngine.js` `calculateAC()` does not query `Transaction.find()`
- `budgetEngine.js` `calculateActualCost()` includes transactions (line 86-88), but this function is **never called** by `financialController.js` or `reportController.js`
- Financial Dashboard uses `calculateAC()` from `evmEngine.js`, which ignores transactions

**Recommendation:** Add transaction calculation to `calculateAC()`:
```javascript
// Add after fixed costs calculation
// Add transactions (manual budget adjustments)
const transactions = await Transaction.find({ 
  projectId,
  date: { $lte: date } // Only transactions up to target date
}).lean();

let transactionSum = 0;
for (const transaction of transactions) {
  // '+' means money added (reduces AC), '-' means money withdrawn (increases AC)
  // Wait, this is confusing. Let's think:
  // If type is '+', user added funds to budget (this is income, not cost)
  // If type is '-', user withdrew funds (this is expense, increases AC)
  // Actually, transactions might represent actual cash flow, not just budget adjustments.
  // Need to clarify business logic: Should transactions affect AC?
  // For now, if transactions represent actual costs, add them:
  if (transaction.type === '-') {
    transactionSum += transaction.amount; // Withdrawal = cost
  }
  // If type is '+', it's income, not a cost, so don't add to AC
}
totalAC += transactionSum;
```

**Note:** This requires clarification of business logic: Do `Transaction` entries represent actual costs (should be in AC) or budget adjustments (should not be in AC)?

---

### 1.3 **Missing Permission Check on Investor Report Route**
**Location:** `server/routes/api.js` line 148  
**Issue:** The Investor Report endpoint is missing the `requirePermission('can_generate_reports')` middleware check.

**Current Code:**
```javascript
router.get('/projects/:projectId/reports/investor', verifyToken, checkDatabaseConnection, checkProjectMember, getInvestorReport);
```

**Expected:**
```javascript
router.get('/projects/:projectId/reports/investor', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_generate_reports'), getInvestorReport);
```

**Impact:**
- Any project member (even Guests) can access the Investor Report endpoint if they know the URL.
- The frontend checks `hasPermission('can_generate_reports')` before showing the button, but the API endpoint itself is unprotected.
- This is a **security vulnerability** (unauthorized access to financial reports).

**Evidence:**
- `server/routes/api.js` line 148: route definition missing permission check
- `server/controllers/financialController.js` line 94: frontend button checks `hasPermission('can_generate_reports')`
- `server/models/Project.js` line 47: `can_generate_reports` is **NOT** in `ALL_PERMISSIONS` array (see issue 4.1)

---

### 1.4 **Permission `can_generate_reports` Not Defined in ALL_PERMISSIONS**
**Location:** `server/models/Project.js` line 25-47  
**Issue:** The permission string `'can_generate_reports'` is used in the codebase but is **not included** in the `ALL_PERMISSIONS` array.

**Impact:**
- Permission validation will fail if the system checks against `ALL_PERMISSIONS`.
- The permission cannot be granted/revoked via the role management UI (if it validates against this array).
- This is a **data integrity issue** (permission exists in code but not in schema definition).

**Evidence:**
- `server/models/Project.js` `ALL_PERMISSIONS` array (lines 25-47) does not include `'can_generate_reports'`
- `server/controllers/financialController.js` line 94: uses `hasPermission('can_generate_reports')`
- `server/controllers/reportController.js`: endpoint is designed for this permission
- `server/routes/api.js` line 148: route should use this permission (but currently doesn't)

**Recommendation:** Add to `ALL_PERMISSIONS` array:
```javascript
const ALL_PERMISSIONS = [
  // ... existing permissions
  'can_manage_work_schedule',
  'can_delete_project',
  'can_generate_reports', // ADD THIS LINE
  // Notification permissions
  'notify_on_financial_risk',
  // ...
];
```

---

### 1.5 **Hardcoded Hourly Rate in budgetEngine.js**
**Location:** `server/services/budgetEngine.js` lines 42, 79  
**Issue:** The `budgetEngine.js` file uses a hardcoded hourly rate of `50` instead of calculating from member salaries.

**Code:**
```javascript
const hourlyRate = 50; // Default or from member hourlyRate
```

**Impact:**
- `budgetEngine.js` is **not used** by the main Financial Dashboard (which uses `evmEngine.js`), so this is a "zombie code" issue.
- However, if this file is ever used or referenced, it will produce incorrect calculations.
- The comment says "Should come from member hourlyRate" but it's never implemented.

**Evidence:**
- `budgetEngine.js` line 42: hardcoded `50` in `calculatePlannedValue()`
- `budgetEngine.js` line 79: hardcoded `50` in `calculateActualCost()`
- `evmEngine.js` correctly calculates hourly rates from `monthlySalary` and `workSchedule`
- `budgetEngine.js` functions are **never imported or called** by `financialController.js` or `reportController.js`

**Recommendation:** 
- **Option 1:** Delete `budgetEngine.js` if it's not used (verify no other code references it).
- **Option 2:** If it must be kept, fix it to use actual member rates (similar to `evmEngine.js`).

---

### 1.6 **Inconsistent Date Normalization**
**Location:** Multiple files  
**Issue:** Date handling uses `setHours(0, 0, 0, 0)` in some places but not others, and timezone handling is inconsistent.

**Evidence:**
- `financialController.js` line 53: `currentDate.setHours(0, 0, 0, 0)` (normalized)
- `financialController.js` line 92: `today.setHours(0, 0, 0, 0)` (normalized)
- `reportController.js` line 73: `today.setHours(0, 0, 0, 0)` (normalized)
- `evmEngine.js` line 217: `project.createdAt || new Date()` (not normalized)
- `evmEngine.js` line 286: `targetDate.setHours(0, 0, 0, 0)` (normalized in daily job)

**Impact:**
- Potential "off-by-one-day" errors when comparing dates.
- Timezone issues if dates are created in different timezones.
- Minor risk, but can cause calculation discrepancies.

**Recommendation:** Standardize date normalization:
- Always use `setHours(0, 0, 0, 0)` when comparing dates or calculating day differences.
- Consider using a utility function: `function normalizeDate(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }`

---

## 2. Data Structure Issues

### 2.1 **Unused Field: `workingHoursPerMonth` in Project Model**
**Location:** `server/models/Project.js` lines 278-282  
**Issue:** The `workingHoursPerMonth` field is defined in the schema but **never used** in calculations.

**Evidence:**
- `Project.js` schema defines `workingHoursPerMonth: { type: Number, default: 160, min: 1 }`
- `evmEngine.js` calculates `workingHoursPerMonth` dynamically (line 47): `const workingHoursPerMonth = workingDaysPerMonth * hoursPerDay;`
- No code reads `project.workingHoursPerMonth` from the database

**Impact:**
- Database field is stored but never used (wasted storage, potential confusion).
- If the field is updated via API, it has no effect on calculations.

**Recommendation:**
- **Option 1:** Remove the field from the schema (if not needed).
- **Option 2:** Use the stored value instead of calculating it dynamically (if users should be able to override the calculated value).

---

### 2.2 **Legacy Field: `roleName` in Member Schema**
**Location:** `server/models/Project.js` lines 64-67, 106-120  
**Issue:** The `roleName` field is marked as "legacy" and maintained for backward compatibility, but it's still actively used in some controllers.

**Evidence:**
- `Project.js` memberSchema defines `roleName` (line 64-67) with comment "Legacy field for backward compatibility"
- Pre-save hook (lines 106-120) syncs `roles` array ↔ `roleName` field
- `reportController.js` line 238: uses `member.roleName` as fallback
- `projectController.js` line 584: sets `roleName` when updating roles

**Impact:**
- Code complexity (dual field maintenance).
- Risk of desynchronization if pre-save hook fails.
- Not a critical bug, but a technical debt issue.

**Recommendation:** 
- Migrate all code to use `roles` array exclusively.
- Remove `roleName` field after migration period.
- Or document it clearly as a required legacy field.

---

### 2.3 **Unused Field: `currency` in FixedCost Schema**
**Location:** `server/models/Project.js` lines 18-21  
**Issue:** The `fixedCostSchema` defines a `currency` field (default: 'USD'), but it's never validated, used, or displayed.

**Evidence:**
- `Project.js` fixedCostSchema defines `currency: { type: String, default: 'USD' }`
- No validation middleware checks currency values
- No calculation logic uses currency (all calculations assume single currency)
- No frontend component displays or edits currency

**Impact:**
- Field is stored but has no functional purpose.
- If multi-currency support is planned, it's incomplete.

**Recommendation:**
- **Option 1:** Remove the field if multi-currency is not planned.
- **Option 2:** Implement currency conversion if multi-currency is required.

---

### 2.4 **Unused Field: `plannedValue` in Task Model**
**Location:** `server/models/Task.js` lines 96-100  
**Issue:** The `Task` schema defines `plannedValue` field, but it's **never calculated or updated** by any controller or service.

**Evidence:**
- `Task.js` schema defines `plannedValue: { type: Number, default: 0, min: 0 }`
- `taskController.js` reads `plannedValue` from request body (line 115) but doesn't calculate it
- `evmEngine.js` calculates PV at the **project level**, not per-task
- No code sets `task.plannedValue` based on task data

**Impact:**
- Field exists but is always `0` (default value).
- Potential confusion: developers might expect this field to be populated.

**Recommendation:**
- **Option 1:** Remove the field if task-level PV is not needed.
- **Option 2:** Calculate and update `task.plannedValue` when task is created/updated (based on `estimateHours` and assignee rates).

---

### 2.5 **Missing `.populate()` for Member User Data**
**Location:** `server/controllers/reportController.js` line 209  
**Issue:** The `reportController.js` uses `project.populate('members.userId', ...)` but the project might not be populated before this call.

**Evidence:**
- `reportController.js` line 63: `const project = await Project.findById(projectId);` (no populate)
- Line 209: `await project.populate('members.userId', 'displayName email monthlySalary');`
- This should work, but if `project.members` is empty or not loaded, populate might fail silently.

**Impact:**
- Low risk, but could cause `member.userId` to be an ObjectId instead of a User object if populate fails.

**Recommendation:** Verify populate works correctly, or use a more explicit approach:
```javascript
const project = await Project.findById(projectId)
  .populate('members.userId', 'displayName email monthlySalary');
```

---

## 3. Frontend/API Mismatches

### 3.1 **Investor Report Route Missing Permission Middleware**
**Location:** `server/routes/api.js` line 148  
**Issue:** Already covered in section 1.3 (Critical Logic Discrepancies).

---

### 3.2 **Frontend Error Handling Gaps**
**Location:** Multiple frontend components  
**Issue:** Some API calls have error handling, but error messages are not always user-friendly.

**Evidence:**
- `investor-report-modal.tsx` line 140-143: catches error and shows toast, but error message is generic
- `financial/page.tsx` line 42-44: catches error but only logs to console (no user notification)
- Some components might not handle `null` or `undefined` responses gracefully

**Impact:**
- Users see generic error messages or no feedback when API calls fail.
- Poor user experience.

**Recommendation:** 
- Add consistent error handling across all API calls.
- Show user-friendly error messages via toast notifications.
- Handle edge cases (null responses, network errors, etc.).

---

### 3.3 **Type Safety: Frontend Expects Specific Data Structure**
**Location:** `client/src/pages/workspace/financial/page.tsx` lines 67-73  
**Issue:** Frontend code accesses nested properties without null checks in some places.

**Code:**
```typescript
const currentPV = stats?.current?.PV || 0
const currentAC = stats?.current?.AC || 0
const currentEV = stats?.current?.EV || 0
```

**Impact:**
- If API response structure changes, frontend will break.
- Currently uses optional chaining (`?.`), which is good, but some places might not.

**Recommendation:** 
- Verify all API response accesses use optional chaining or null checks.
- Consider using TypeScript interfaces to enforce API contract.

---

## 4. Security & Permissions Gaps

### 4.1 **Missing Permission in ALL_PERMISSIONS Array**
**Location:** `server/models/Project.js` line 25-47  
**Issue:** Already covered in section 1.4 (Critical Logic Discrepancies).

---

### 4.2 **Investor Report Route Missing Permission Check**
**Location:** `server/routes/api.js` line 148  
**Issue:** Already covered in section 1.3 (Critical Logic Discrepancies).

---

### 4.3 **Salary Data Exposure Risk**
**Location:** `server/controllers/reportController.js` lines 207-253  
**Issue:** The code checks `isOwner` before returning salary data, which is correct. However, the check is done **after** populating user data, which means salary data is loaded into memory even for non-owners.

**Current Code:**
```javascript
if (isOwner) {
  await project.populate('members.userId', 'displayName email monthlySalary');
  // ... build team data
}
```

**Impact:**
- Low risk (data is not sent to client), but inefficient.
- If there's a bug in the `isOwner` check, salary data could leak.

**Recommendation:** 
- The current implementation is actually correct (data is only sent if `isOwner` is true).
- Consider adding an explicit check before populate to avoid unnecessary database queries:
```javascript
if (isOwner) {
  await project.populate('members.userId', 'displayName email monthlySalary');
  // ... build team data
} else {
  // Don't populate salary data at all
}
```

---

## 5. Recommendations for Refactoring

### 5.1 **Create a Single Source of Truth for Financial Calculations**
**Issue:** Financial calculations are scattered across multiple files:
- `evmEngine.js` (used by Financial Dashboard and Investor Report)
- `budgetEngine.js` (not used, but contains similar logic)
- `taskCostCalculator.js` (used for task-level costs)

**Recommendation:**
- Consolidate all financial calculation logic into `evmEngine.js`.
- Delete or refactor `budgetEngine.js` to avoid confusion.
- Ensure all endpoints use the same calculation functions.

---

### 5.2 **Add Fixed Costs to AC Calculation**
**Priority: HIGH**  
**Issue:** Fixed costs are not included in Actual Cost calculation (see section 1.1).

**Recommendation:**
- Implement the fix described in section 1.1.
- Test with projects that have fixed costs to verify AC values update correctly.

---

### 5.3 **Clarify Transaction Model Business Logic**
**Priority: MEDIUM**  
**Issue:** It's unclear whether `Transaction` entries should be included in AC calculation (see section 1.2).

**Recommendation:**
- **Decision needed:** Do `Transaction` entries represent actual costs (should be in AC) or budget adjustments (should not be in AC)?
- If transactions represent costs, add them to `calculateAC()`.
- If transactions represent budget adjustments, document this clearly and ensure they're reflected in "Remaining Budget" calculations.

---

### 5.4 **Add Permission Check to Investor Report Route**
**Priority: HIGH**  
**Issue:** Missing `requirePermission('can_generate_reports')` middleware (see section 1.3).

**Recommendation:**
- Add the permission check to the route definition.
- Add `'can_generate_reports'` to `ALL_PERMISSIONS` array.
- Test that non-authorized users cannot access the endpoint.

---

### 5.5 **Remove or Use Unused Schema Fields**
**Priority: LOW**  
**Issue:** Several schema fields are defined but never used (see section 2).

**Recommendation:**
- Remove `workingHoursPerMonth` from Project schema (or use it).
- Remove `currency` from FixedCost schema (or implement multi-currency).
- Remove `plannedValue` from Task schema (or calculate it).
- Document `roleName` as a required legacy field, or migrate away from it.

---

### 5.6 **Standardize Date Handling**
**Priority: MEDIUM**  
**Issue:** Date normalization is inconsistent (see section 1.6).

**Recommendation:**
- Create a utility function: `normalizeDate(date)`.
- Use it consistently across all date calculations.
- Document timezone handling (currently assumes server timezone).

---

### 5.7 **Improve Error Handling in Frontend**
**Priority: MEDIUM**  
**Issue:** Some API calls lack user-friendly error messages (see section 3.2).

**Recommendation:**
- Add consistent error handling to all API calls.
- Show toast notifications for all errors.
- Handle network errors, timeout errors, and validation errors separately.

---

### 5.8 **Add Integration Tests for Financial Calculations**
**Priority: HIGH**  
**Issue:** Financial calculations are complex and have multiple dependencies.

**Recommendation:**
- Create integration tests that verify:
  - AC calculation includes salaries, expenses, and fixed costs
  - PV calculation matches expected values
  - Investor Report numbers match Financial Dashboard numbers
  - Date handling is consistent
- Run these tests in CI/CD pipeline.

---

## Summary

**Total Issues Found:** 15  
**Critical (High Priority):** 5  
**Medium Priority:** 6  
**Low Priority:** 4

**Most Critical Issues:**
1. Fixed costs not included in AC calculation (systematic underreporting)
2. Missing permission check on Investor Report route (security vulnerability)
3. Missing `can_generate_reports` in ALL_PERMISSIONS array (data integrity)
4. Transaction model not used in AC (potential data mismatch)
5. Hardcoded hourly rate in unused budgetEngine.js (code quality)

**Next Steps:**
1. Fix critical issues (sections 1.1, 1.3, 1.4, 1.2)
2. Refactor unused code (section 5.1)
3. Add integration tests (section 5.8)
4. Address medium-priority issues (sections 1.6, 3.2, 5.6, 5.7)
5. Clean up unused fields (section 5.5)

---

**End of Audit Report**

