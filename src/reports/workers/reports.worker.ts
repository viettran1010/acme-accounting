import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import { WorkerData } from './types';

const financialAccountsSet = new Set([
  // Income Statement
  'Sales Revenue',
  'Cost of Goods Sold',
  'Salaries Expense',
  'Rent Expense',
  'Utilities Expense',
  'Interest Expense',
  'Tax Expense',
  // Balance Sheet
  'Cash',
  'Accounts Receivable',
  'Inventory',
  'Fixed Assets',
  'Prepaid Expenses',
  'Accounts Payable',
  'Loan Payable',
  'Sales Tax Payable',
  'Accrued Liabilities',
  'Unearned Revenue',
  'Dividends Payable',
  'Common Stock',
  'Retained Earnings',
]);

function processFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  const accountBalances: Record<string, number> = {};
  const cashByYear: Record<string, number> = {};
  const financialAccounts: Record<string, number> = {};

  for (const line of lines) {
    const [date, account, , debit, credit] = line.split(',');
    const debitVal = parseFloat(debit || '0');
    const creditVal = parseFloat(credit || '0');
    const delta = debitVal - creditVal;

    // All accounts
    accountBalances[account] = (accountBalances[account] || 0) + delta;

    // Cash by year
    if (account === 'Cash') {
      const year = new Date(date).getFullYear().toString();
      cashByYear[year] = (cashByYear[year] || 0) + delta;
    }

    // Only include accounts used in FS
    if (financialAccountsSet.has(account)) {
      financialAccounts[account] = (financialAccounts[account] || 0) + delta;
    }
  }

  return { accountBalances, cashByYear, financialAccounts };
}

const result = processFile((workerData as WorkerData).filePath);
parentPort?.postMessage(result);
