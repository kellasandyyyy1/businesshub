/**
 * The category lists each profile starts with.
 *
 * One place for both the first-run seed and the migration that reshapes an
 * existing database, so the two can never describe different sets.
 *
 * Icon names are bare Tabler names resolved by `config/categoryIcons.js` — no
 * `ti-` prefix, which is a webfont this app does not load.
 */

export const BUSINESS_CATEGORIES = [
  // Income
  { name: 'Client Revenue', type: 'income', icon: 'users' },
  { name: 'Retainers', type: 'income', icon: 'repeat' },
  { name: 'Product Sales', type: 'income', icon: 'shopping-bag' },
  { name: 'Consulting', type: 'income', icon: 'briefcase' },
  { name: 'Grants', type: 'income', icon: 'award' },
  { name: 'Other Income', type: 'income', icon: 'plus' },
  // Expense
  { name: 'Bank Fees', type: 'expense', icon: 'building-bank' },
  { name: 'Equipment', type: 'expense', icon: 'device-laptop' },
  { name: 'Internet & Comms', type: 'expense', icon: 'wifi' },
  { name: 'Marketing', type: 'expense', icon: 'speakerphone' },
  { name: 'Meals & Entertainment', type: 'expense', icon: 'tools-kitchen-2' },
  { name: 'Office & Rent', type: 'expense', icon: 'building' },
  // The one expense that is also personal income; the transfer flow keys off it.
  { name: 'Owner Draw / Salary', type: 'expense', icon: 'arrows-exchange' },
  { name: 'Professional Services', type: 'expense', icon: 'certificate' },
  { name: 'Salaries & Contractors', type: 'expense', icon: 'users' },
  { name: 'Software & Subscriptions', type: 'expense', icon: 'apps' },
  { name: 'Taxes & Government', type: 'expense', icon: 'receipt-tax' },
  { name: 'Travel & Transport', type: 'expense', icon: 'car' },
  { name: 'Utilities', type: 'expense', icon: 'bolt' },
  { name: 'Other', type: 'expense', icon: 'dots' },
]

export const PERSONAL_CATEGORIES = [
  // Income
  { name: 'Salary', type: 'income', icon: 'building-bank' },
  { name: 'Freelance', type: 'income', icon: 'briefcase' },
  { name: 'Business Draw', type: 'income', icon: 'arrows-exchange' },
  { name: 'Investments', type: 'income', icon: 'trending-up' },
  { name: 'Rental Income', type: 'income', icon: 'home' },
  { name: 'Other Income', type: 'income', icon: 'plus' },
  // Expense
  { name: 'Housing & Rent', type: 'expense', icon: 'home' },
  { name: 'Food & Groceries', type: 'expense', icon: 'tools-kitchen-2' },
  { name: 'Transportation', type: 'expense', icon: 'car' },
  { name: 'Healthcare', type: 'expense', icon: 'heart-rate-monitor' },
  { name: 'Entertainment', type: 'expense', icon: 'device-tv' },
  { name: 'Clothing', type: 'expense', icon: 'hanger' },
  { name: 'Education', type: 'expense', icon: 'school' },
  { name: 'Subscriptions', type: 'expense', icon: 'repeat' },
  { name: 'Debt Payment', type: 'expense', icon: 'credit-card' },
  { name: 'Savings Transfer', type: 'expense', icon: 'pig-money' },
  { name: 'Gifts & Donations', type: 'expense', icon: 'gift' },
  { name: 'Other', type: 'expense', icon: 'dots' },
]

/** Both lists, each row already carrying the profile it belongs to. */
export const ALL_CATEGORIES = [
  ...BUSINESS_CATEGORIES.map((c) => ({ ...c, profile: 'business', isDefault: true })),
  ...PERSONAL_CATEGORIES.map((c) => ({ ...c, profile: 'personal', isDefault: true })),
]

/**
 * Defaults that changed name.
 *
 * A transaction stores its category as a name, not a reference, so renaming a
 * category without rewriting the rows that use it strands them: the history
 * keeps a name nothing in the list matches any more. The migration renames the
 * category and its rows together, keyed off this map.
 */
export const RENAMED_CATEGORIES = [
  { profile: 'business', type: 'income', from: 'Client Payments', to: 'Client Revenue' },
  { profile: 'personal', type: 'expense', from: 'Housing', to: 'Housing & Rent' },
  { profile: 'personal', type: 'expense', from: 'Food', to: 'Food & Groceries' },
  { profile: 'personal', type: 'expense', from: 'Transport', to: 'Transportation' },
  { profile: 'personal', type: 'expense', from: 'Savings', to: 'Savings Transfer' },
]

/** The category a goal contribution is filed under. */
export const SAVINGS_CATEGORY = 'Savings Transfer'
