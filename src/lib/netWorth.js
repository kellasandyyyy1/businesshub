/**
 * Net worth: what is owned against what is owed.
 *
 * The categories are fixed rather than free text. A list a household types
 * itself drifts, "Savings", "savings account", "BPI savings", and the
 * subtotals stop meaning anything the moment two rows disagree about which
 * group they are in.
 */

export const ASSET_CATEGORIES = ['Cash & Savings', 'Investments', 'Property', 'Other']
export const LIABILITY_CATEGORIES = ['Loans', 'Credit Cards', 'Other Debt']

export const NET_WORTH_TYPES = ['asset', 'liability']

export const categoriesFor = (type) =>
  type === 'liability' ? LIABILITY_CATEGORIES : ASSET_CATEGORIES

/** The bucket an uncategorised row falls into, per side. */
export const fallbackCategory = (type) => (type === 'liability' ? 'Other Debt' : 'Other')

const amountOf = (item) => Number(item?.amount) || 0

/**
 * One side of the sheet, split into its category groups.
 *
 * Only groups holding something come back. An empty "PROPERTY" heading above
 * nothing is a row of furniture the reader has to skip past, and the fixed
 * category list means most sheets would carry two or three of them.
 */
export function groupByCategory(items = [], type) {
  const known = categoriesFor(type)
  const fallback = fallbackCategory(type)

  const buckets = new Map(known.map((name) => [name, []]))
  for (const item of items) {
    const key = known.includes(item.category) ? item.category : fallback
    buckets.get(key).push(item)
  }

  return known
    .map((category) => {
      const rows = buckets.get(category)
      return {
        category,
        items: rows.sort((a, b) => amountOf(b) - amountOf(a)),
        subtotal: rows.reduce((total, row) => total + amountOf(row), 0),
      }
    })
    .filter((group) => group.items.length > 0)
}

/**
 * The headline figures.
 *
 * A negative net worth is a real answer and is returned as one, owing more
 * than you own is a fact worth reading plainly, not an error to hide.
 */
export function netWorthSummary(items = []) {
  let assets = 0
  let liabilities = 0
  let updatedAt = null

  for (const item of items) {
    if (item.type === 'liability') liabilities += amountOf(item)
    else assets += amountOf(item)

    if (item.updatedAt && (!updatedAt || item.updatedAt > updatedAt)) updatedAt = item.updatedAt
  }

  return { assets, liabilities, net: assets - liabilities, updatedAt }
}

export const splitByType = (items = []) => ({
  assets: items.filter((i) => i.type !== 'liability'),
  liabilities: items.filter((i) => i.type === 'liability'),
})
