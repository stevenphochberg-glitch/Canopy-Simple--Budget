# Implementation Plan: Identification & Bulk Deletion of Sample Transactions

## 1. Overview & Root Cause Analysis
During previous development updates (specifically testing the Quick Note AI natural language parser, Photo Receipt scanner presets, and multi-line staging flow), several sample transactions were committed to the household database. These records match the sample preset templates configured in `LogExpenseModal.tsx` and `functions/index.ts`.

---

## 2. Identified Sample Transactions for Review
Below is the list of identified sample transactions and preset test items detected in the household records:

| # | Item Description | Amount | Category / Group | Source Preset |
|---|---|---|---|---|
| **1** | **Amazon Prime Essentials** | **$45.00** | Household Essentials | Quick Note Preset |
| **2** | **Household cleaning supplies** | **$22.50** | Household Essentials | Quick Note Preset |
| **3** | **Protein powder** | **$65.00** | Fun Money / Health | Quick Note Preset |
| **4** | **Con Edison electric bill** | **$88.40** | Utilities / Bills | Quick Note Preset |
| **5** | **Netflix** | **$19.99** | Subscriptions / Bills | Quick Note Preset |
| **6** | **Spotify** | **$11.99** | Subscriptions / Bills | Quick Note Preset |
| **7** | **Gas / Auto (Shell / Fuel)** | **$50.00** | Gas / Auto | Quick Note Preset |
| **8** | **Bar last night** | **$150.00** | Dining / Bar | Quick Note Preset |
| **9** | **Cell phone bill** | **$75.00** | Phone Bill / Bills | Quick Note Preset |
| **10** | **Case of beer** | **$25.00** | Fun Money | Quick Note Preset |
| **11** | **Trader Joe's Groceries** | **$84.20** | Groceries / Essentials | Quick Note Preset |
| **12** | **Iced matcha latte** | **$6.50** | Coffee / Dining | Quick Note Preset |
| **13** | **Uber ride home** | **$15.00** | Transportation / Auto | Quick Note Preset |
| **14** | **Trader Joe’s Market** | **$48.20** | Groceries / Essentials | Receipt Preset |
| **15** | **Artisan Cafe & Bakery** | **$14.75** | Dining / Coffee | Receipt Preset |
| **16** | **Chevron Fuel & Snacks** | **$46.50** | Gas / Auto | Receipt Preset |
| **17** | **Receipt Scanned Item** | **$42.50** | Groceries | Scanner Fallback |

The 8 items you selected in the Ledger (`div:nth-of-type(4)`, `5`, `6`, `9`, `10`, `12`, `13`, `14`) correspond directly to the items from these preset batches.

---

## 3. Proposed Changes & Implementation Strategy

### Step 1: In-App Sample Data Review & Bulk Cleanup Component
- Add a dedicated, dismissible **"Sample Data Detected"** review banner and confirmation modal directly in `CategoryLedgerView.tsx`.
- Automatically flag transactions matching these known sample presets with an amber "Sample Data" badge.
- Allow you to see every detected transaction with pre-checked checkboxes, uncheck any legitimate personal transaction you wish to keep, and click **"Approve & Bulk Delete"**.

### Step 2: Cascade Deletion & Automatic Budget Rebalancing in `HouseholdContext.tsx`
- Implement a robust `deleteExpensesBatch(expenseIds: string[])` method in `HouseholdContext.tsx`:
  - **Firestore Batch Deletion**: Atomically deletes all confirmed documents from `households/{householdId}/expenses`.
  - **Local State Sync**: Instantly removes them from the reactive `expenses` array.
  - **Recalculate Category Totals**: Decrements each affected category's `totalLogged` and `transactionCount` so category cards accurately reflect only genuine spending.
  - **Activity Feed Cleanup**: Removes related feed activity items (e.g., `Logged expense...`) from `households/{householdId}/feed` and local state.

### Step 3: Verification & Polish
- Show a clear success confirmation toast with the number of transactions removed and the updated budget balance.
- Run `compile_applet` and `lint_applet` to verify clean compilation.
