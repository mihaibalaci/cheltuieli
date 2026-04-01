import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Dashboard from '../pages/Dashboard';

vi.mock('../utils/api.js', () => ({
  api: {
    getPeriods: vi.fn().mockResolvedValue([]),
    getMonthlyTrend: vi.fn().mockResolvedValue([]),
    getSummary: vi.fn().mockResolvedValue({
      byCategory: [{ id: 1, name: 'Groceries', color: '#22c55e', icon: '🛒', count: 5, spent: 200, income: 0 }],
      totals: { total_spent: 200, total_income: 3000, total_transactions: 10 },
      uncategorized: 3,
    }),
    getTopMerchants: vi.fn().mockResolvedValue([
      { counterparty: 'Albert Heijn', total: 150, count: 4 },
    ]),
    getAccountBalances: vi.fn().mockResolvedValue({
      accounts: [
        { id: 1, name: 'Current Account', color: '#3b82f6', iban: '865474001', total_in: 3000, total_out: 200, balance: 2800, transactions: 10 },
        { id: 2, name: 'Savings', color: '#22c55e', iban: '869898825', total_in: 500, total_out: 0, balance: 500, transactions: 2 },
      ],
      total: 3300,
    }),
  },
}));

import { api } from '../utils/api.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Dashboard', () => {
  it('renders stat cards with summary data', async () => {
    render(<Dashboard onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/total spent/i)).toBeInTheDocument();
      expect(screen.getByText(/total income/i)).toBeInTheDocument();
      expect(screen.getByText(/net balance/i)).toBeInTheDocument();
    });
  });

  it('renders uncategorized card when count > 0', async () => {
    render(<Dashboard onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/uncategorized/i)).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('renders account balances section', async () => {
    render(<Dashboard onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Account Balances')).toBeInTheDocument();
      expect(screen.getByText('Current Account')).toBeInTheDocument();
      expect(screen.getByText('Savings')).toBeInTheDocument();
    });
  });

  it('calls onNavigate with debit filter when Total Spent is clicked', async () => {
    const onNavigate = vi.fn();
    render(<Dashboard onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText(/total spent/i)).toBeInTheDocument();
    });
    // Click the Total Spent card
    fireEvent.click(screen.getByText(/total spent/i).closest('.card'));
    expect(onNavigate).toHaveBeenCalledWith('transactions', expect.objectContaining({ type: 'debit' }));
  });

  it('calls onNavigate with credit filter when Total Income is clicked', async () => {
    const onNavigate = vi.fn();
    render(<Dashboard onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText(/total income/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/total income/i).closest('.card'));
    expect(onNavigate).toHaveBeenCalledWith('transactions', expect.objectContaining({ type: 'credit' }));
  });

  it('shows empty state when no summary data', async () => {
    api.getSummary.mockResolvedValueOnce(null);
    render(<Dashboard onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
    });
  });
});
