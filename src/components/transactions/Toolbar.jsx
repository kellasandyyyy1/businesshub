import { IconPlus, IconSearch } from '@tabler/icons-react'

import ExportButton from '../export/ExportButton'
import { DATE_RANGES } from '../../hooks/useTransactions'
import { TRANSACTION_TYPES } from '../../db/db'

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
  dateRange,
  onDateRange,
  categories,
  onAdd,
  exportRange,
}) {
  return (
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
          label="Type"
          value={type}
          onChange={onType}
          options={[
            { value: 'all', label: 'All types' },
            ...TRANSACTION_TYPES.map((t) => ({ value: t, label: t })),
          ]}
        />

        <FilterSelect
          label="Category"
          value={category}
          onChange={onCategory}
          options={[
            { value: 'all', label: 'All categories' },
            ...categories.map((c) => ({ value: c.name, label: c.name })),
          ]}
        />

        <FilterSelect
          label="Date range"
          value={dateRange}
          onChange={onDateRange}
          options={DATE_RANGES.map((r) => ({ value: r.id, label: r.label }))}
        />

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
  )
}
