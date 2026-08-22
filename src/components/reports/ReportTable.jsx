import { formatCurrency } from '../../lib/format'

const formatValue = (value, format, symbol) =>
  format === 'percent' ? `${(value * 100).toFixed(1)}%` : formatCurrency(value, symbol)

/** Renders any report shape: section, row, subtotal, total, grand. */
export default function ReportTable({ report, symbol }) {
  return (
    <table className="bfh-report__table">
      <thead>
        <tr>
          <th scope="col">Line</th>
          {report.columns.map((column) => (
            <th scope="col" key={column} className="bfh-report__num">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {report.lines.map((line, index) => (
          // Report lines are generated, not stored — position is their identity.
          // eslint-disable-next-line react/no-array-index-key
          <tr key={`${line.kind}-${line.label}-${index}`} data-kind={line.kind}>
            <td className="bfh-report__label">{line.label}</td>
            {report.columns.map((column, i) => (
              <td key={column} className="bfh-report__num">
                {line.values ? formatValue(line.values[i], line.formats?.[i], symbol) : ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
