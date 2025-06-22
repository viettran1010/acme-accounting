import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import * as fsp from 'fs/promises';

@Injectable()
export class ReportsService {
  private states = {
    accounts: 'idle',
    yearly: 'idle',
    fs: 'idle',
  };

  state(scope: 'accounts' | 'yearly' | 'fs') {
    return this.states[scope];
  }

  async accountsAndYearlyAndFS() {
    this.states.accounts = 'starting';
    this.states.yearly = 'starting';
    this.states.fs = 'starting';
    const start = performance.now();
    const tmpDir = 'tmp';

    const accountBalances: Record<string, number> = {};
    const cashByYear: Record<string, number> = {};
    const fsBalances: Record<string, number> = {};

    const files = await fsp.readdir(tmpDir);
    const csvFiles = files.filter((f) => f.endsWith('.csv') && f !== 'fs.csv');

    const results = await Promise.all(
      csvFiles.map(
        (file) =>
          new Promise<{
            accountBalances: Record<string, number>;
            cashByYear: Record<string, number>;
            financialAccounts: Record<string, number>;
          }>((resolve, reject) => {
            const worker = new Worker(
              path.resolve(__dirname, './workers/reports.worker.js'),
              {
                workerData: { filePath: path.join(tmpDir, file) },
              },
            );
            worker.on('message', resolve);
            worker.on('error', reject);
            worker.on('exit', (code) => {
              if (code !== 0)
                reject(new Error(`Worker exited with code ${code}`));
            });
          }),
      ),
    );

    for (const {
      accountBalances: a,
      cashByYear: y,
      financialAccounts: f,
    } of results) {
      for (const [k, v] of Object.entries(a))
        accountBalances[k] = (accountBalances[k] || 0) + v;
      for (const [k, v] of Object.entries(y))
        cashByYear[k] = (cashByYear[k] || 0) + v;
      for (const [k, v] of Object.entries(f))
        fsBalances[k] = (fsBalances[k] || 0) + v;
    }

    const accountsOutput = ['Account,Balance'];
    for (const [account, balance] of Object.entries(accountBalances)) {
      accountsOutput.push(`${account},${balance.toFixed(2)}`);
    }
    fs.writeFileSync('out/accounts.csv', accountsOutput.join('\n'));
    this.states.accounts =
      'finished in ' + ((performance.now() - start) / 1000).toFixed(2) + 's';

    const yearlyOutput = ['Financial Year,Cash Balance'];
    for (const year of Object.keys(cashByYear).sort()) {
      yearlyOutput.push(`${year},${cashByYear[year].toFixed(2)}`);
    }
    fs.writeFileSync('out/yearly.csv', yearlyOutput.join('\n'));
    this.states.yearly = `finished in ${(
      (performance.now() - start) /
      1000
    ).toFixed(2)}s`;

    const categories = {
      'Income Statement': {
        Revenues: ['Sales Revenue'],
        Expenses: [
          'Cost of Goods Sold',
          'Salaries Expense',
          'Rent Expense',
          'Utilities Expense',
          'Interest Expense',
          'Tax Expense',
        ],
      },
      'Balance Sheet': {
        Assets: [
          'Cash',
          'Accounts Receivable',
          'Inventory',
          'Fixed Assets',
          'Prepaid Expenses',
        ],
        Liabilities: [
          'Accounts Payable',
          'Loan Payable',
          'Sales Tax Payable',
          'Accrued Liabilities',
          'Unearned Revenue',
          'Dividends Payable',
        ],
        Equity: ['Common Stock', 'Retained Earnings'],
      },
    };

    const fsOutput: string[] = [];
    fsOutput.push('Basic Financial Statement\n');
    fsOutput.push('Income Statement');

    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const acc of categories['Income Statement'].Revenues) {
      const val = fsBalances[acc] || 0;
      fsOutput.push(`${acc},${val.toFixed(2)}`);
      totalRevenue += val;
    }
    for (const acc of categories['Income Statement'].Expenses) {
      const val = fsBalances[acc] || 0;
      fsOutput.push(`${acc},${val.toFixed(2)}`);
      totalExpenses += val;
    }

    const netIncome = totalRevenue - totalExpenses;
    fsOutput.push(`Net Income,${netIncome.toFixed(2)}\n`);

    fsOutput.push('Balance Sheet');
    let totalAssets = 0,
      totalLiabilities = 0,
      totalEquity = 0;

    fsOutput.push('Assets');
    for (const acc of categories['Balance Sheet'].Assets) {
      const val = fsBalances[acc] || 0;
      fsOutput.push(`${acc},${val.toFixed(2)}`);
      totalAssets += val;
    }
    fsOutput.push(`Total Assets,${totalAssets.toFixed(2)}\n`);

    fsOutput.push('Liabilities');
    for (const acc of categories['Balance Sheet'].Liabilities) {
      const val = fsBalances[acc] || 0;
      fsOutput.push(`${acc},${val.toFixed(2)}`);
      totalLiabilities += val;
    }
    fsOutput.push(`Total Liabilities,${totalLiabilities.toFixed(2)}\n`);

    fsOutput.push('Equity');
    for (const acc of categories['Balance Sheet'].Equity) {
      const val = fsBalances[acc] || 0;
      fsOutput.push(`${acc},${val.toFixed(2)}`);
      totalEquity += val;
    }
    fsOutput.push(`Retained Earnings (Net Income),${netIncome.toFixed(2)}`);
    totalEquity += netIncome;
    fsOutput.push(`Total Equity,${totalEquity.toFixed(2)}\n`);
    fsOutput.push(
      `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(totalLiabilities + totalEquity).toFixed(2)}`,
    );

    fs.writeFileSync('out/fs.csv', fsOutput.join('\n'));
    this.states.fs = `finished in ${(
      (performance.now() - start) /
      1000
    ).toFixed(2)}s`;

    const duration = ((performance.now() - start) / 1000).toFixed(2);
    console.log(`All reports generated in ${duration}s`);
  }
}
