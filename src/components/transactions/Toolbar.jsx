import { IconPlus, IconSearch } from '@tabler/icons-react'

import ExportButton from '../export/ExportButton'
import { DATE_RANGES } from '../../hooks/useTransactions'

/* What people call the three kinds of row, rather than the stored type names. */
const TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Money in' },
  { value: 'expense', label: 'Money out' },
  { value: 'transfer', label: 'Transfers' },
]

/** A ghost pill select — native control, styled down to a mono micro-label. */
function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="bfh-filter">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function Toolbar({
  search,
  onSearch,
  type,
  onType,
  category,
  onCategory,
  method = 'all',
  onMethod,
  methods = [],
  dateRange,
  onDateRange,
  categories,
  onAdd,
  exportRange,
  onClear,
  filtersActive,
}) {
  return (
    <div className="bfh-toolbar-wrap">
      <div className="bfh-segment" role="radiogroup" aria-label="Show">
        {TYPE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            className="bfh-segment__option"
            aria-checked={type === o.value}
            onClick={() => onType(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="bfh-toolbar">
        <div className="bfh-search">
          <IconSearch size={14} stroke={1.5} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search transactions…"
            aria-label="Search transactions"
          />
        </div>

        <div className="bfh-toolbar__filters">
          <FilterSelect
            label="Category"
            value={category}
            onChange={onCategory}
            options={[
              { value: 'all', label: 'All categories' },
              // Only the categories that can hold the kind of row being shown.
              ...categories
                .filter((c) => type === 'all' || type === 'transfer' || c.type === type)
                .map((c) => ({ value: c.name, label: c.name })),
            ]}
          />

          {onMethod && methods.length > 0 && (
            <FilterSelect
              label="Payment method"
              value={method}
              onChange={onMethod}
              options={[
                { value: 'all', label: 'All payment methods' },
                ...methods.map((m) => ({ value: m.id, label: m.name })),
                { value: 'none', label: 'No payment method' },
              ]}
            />
          )}

          <FilterSelect
            label="Date range"
            value={dateRange}
            onChange={onDateRange}
            options={DATE_RANGES.map((r) => ({ value: r.id, label: r.label }))}
          />

          {filtersActive && (
            <button type="button" className="bfh-clearfilters" onClick={onClear}>
              Clear filters
            </button>
          )}

          <ExportButton
            typeId="transaction-log"
            from={exportRange?.from}
            to={exportRange?.to}
          />

          <button type="button" className="bfh-btn-primary bfh-btn-primary--inline" onClick={onAdd}>
            <IconPlus size={14} stroke={1.75} aria-hidden="true" />
            <span>Add transaction</span>
          </button>
        </div>
      </div>
    </div>
  )
}
