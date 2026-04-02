import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal, Toast, EmptyState, Loader, CategoryBadge, AmountDisplay, CategorySelect, SearchableCategorySelect } from '../components/UI';

describe('Modal', () => {
  it('renders title and children', () => {
    render(<Modal title="Test Modal" onClose={() => {}}><p>Content</p></Modal>);
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn();
    render(<Modal title="Close Me" onClose={onClose}><p>Body</p></Modal>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('Toast', () => {
  it('renders message', () => {
    render(<Toast message="Saved!" type="success" onClose={() => {}} />);
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });

  it('calls onClose when dismissed', () => {
    const onClose = vi.fn();
    render(<Toast message="Info" type="info" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('EmptyState', () => {
  it('renders icon, title, and subtitle', () => {
    render(<EmptyState icon="📦" title="Nothing here" subtitle="Add something" />);
    expect(screen.getByText('📦')).toBeInTheDocument();
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Add something')).toBeInTheDocument();
  });
});

describe('Loader', () => {
  it('renders loading text', () => {
    render(<Loader text="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

describe('CategoryBadge', () => {
  it('renders name with icon', () => {
    render(<CategoryBadge name="Groceries" color="#22c55e" icon="🛒" />);
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('🛒')).toBeInTheDocument();
  });
});

describe('AmountDisplay', () => {
  it('renders debit with minus sign', () => {
    render(<AmountDisplay amount={42.5} type="debit" />);
    expect(screen.getByText('-€42.50')).toBeInTheDocument();
  });

  it('renders credit with plus sign', () => {
    render(<AmountDisplay amount={100} type="credit" />);
    expect(screen.getByText('+€100.00')).toBeInTheDocument();
  });
});

describe('CategorySelect', () => {
  const categories = [
    { id: 1, name: 'Groceries', icon: '🛒', parent_id: null },
    { id: 2, name: 'Transport', icon: '🚌', parent_id: null },
    { id: 3, name: 'Bus', icon: '🚍', parent_id: 2 },
  ];

  it('renders all categories with parent/child grouping', () => {
    render(<CategorySelect categories={categories} value="" onChange={() => {}} />);
    const options = screen.getAllByRole('option');
    // empty + 2 parents + 1 child = 4
    expect(options.length).toBe(4);
  });

  it('includes empty label option', () => {
    render(<CategorySelect categories={categories} value="" onChange={() => {}} emptyLabel="Pick one" />);
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('renders extra options when provided', () => {
    render(
      <CategorySelect
        categories={categories}
        value=""
        onChange={() => {}}
        extraOptions={[{ value: 'none', label: '⚠ Uncategorized' }]}
      />
    );
    expect(screen.getByText('⚠ Uncategorized')).toBeInTheDocument();
  });

  it('calls onChange when selection changes', () => {
    const onChange = vi.fn();
    render(<CategorySelect categories={categories} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledOnce();
  });
});


describe('SearchableCategorySelect', () => {
  const categories = [
    { id: 1, name: 'Groceries', icon: '🛒', parent_id: null },
    { id: 2, name: 'Transport', icon: '🚌', parent_id: null },
    { id: 3, name: 'Bus', icon: '🚍', parent_id: 2 },
    { id: 4, name: 'Dining', icon: '🍽️', parent_id: null },
  ];

  it('renders with empty label when no value selected', () => {
    render(<SearchableCategorySelect categories={categories} value="" onChange={() => {}} emptyLabel="All categories" />);
    expect(screen.getByText('All categories')).toBeInTheDocument();
  });

  it('shows selected category name when value is set', () => {
    render(<SearchableCategorySelect categories={categories} value="1" onChange={() => {}} />);
    expect(screen.getByText('🛒 Groceries')).toBeInTheDocument();
  });

  it('opens dropdown on click and shows search input', () => {
    render(<SearchableCategorySelect categories={categories} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Search categories...')).toBeInTheDocument();
  });

  it('filters categories by search text', () => {
    render(<SearchableCategorySelect categories={categories} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    const searchInput = screen.getByPlaceholderText('Search categories...');
    fireEvent.change(searchInput, { target: { value: 'groc' } });
    // Should show Groceries, not Transport or Dining
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.queryByText('Transport')).not.toBeInTheDocument();
    expect(screen.queryByText('Dining')).not.toBeInTheDocument();
  });

  it('shows child categories when parent matches search', () => {
    render(<SearchableCategorySelect categories={categories} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    const searchInput = screen.getByPlaceholderText('Search categories...');
    fireEvent.change(searchInput, { target: { value: 'transport' } });
    // Parent matches, so child Bus should also appear
    expect(screen.getByText('Transport')).toBeInTheDocument();
    expect(screen.getByText('Bus')).toBeInTheDocument();
  });

  it('calls onChange when an option is clicked', () => {
    const onChange = vi.fn();
    render(<SearchableCategorySelect categories={categories} value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Groceries'));
    expect(onChange).toHaveBeenCalledWith({ target: { value: '1' } });
  });

  it('renders extra options', () => {
    render(
      <SearchableCategorySelect
        categories={categories}
        value=""
        onChange={() => {}}
        extraOptions={[{ value: 'none', label: '⚠ Uncategorized' }]}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('⚠ Uncategorized')).toBeInTheDocument();
  });

  it('shows no results message when search has no matches', () => {
    render(<SearchableCategorySelect categories={categories} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    const searchInput = screen.getByPlaceholderText('Search categories...');
    fireEvent.change(searchInput, { target: { value: 'zzzzz' } });
    expect(screen.getByText('No categories found')).toBeInTheDocument();
  });

  it('closes dropdown on Escape key', () => {
    render(<SearchableCategorySelect categories={categories} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Search categories...')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByPlaceholderText('Search categories...'), { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Search categories...')).not.toBeInTheDocument();
  });
});
