// Designation → category and the exact §6 token colours (hue per category,
// shade per role). Keys match the API's stored designation strings.

export type CategoryKey =
  | 'Engineering'
  | 'Quality'
  | 'Delivery'
  | 'Operations'
  | 'Business'

// Representative hue per category (matches the Live Map legend/filter dots).
export const CATEGORY_COLOR: Record<CategoryKey, string> = {
  Engineering: '#4C8DFF',
  Quality: '#A855F7',
  Delivery: '#F59E0B',
  Operations: '#06B6D4',
  Business: '#FB7185',
}

// Category display label (legend copy) + mono legend tag.
export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  Engineering: 'Engineering',
  Quality: 'Quality & Design',
  Delivery: 'Delivery',
  Operations: 'Operations',
  Business: 'Business',
}

export const CATEGORY_TAG: Record<CategoryKey, string> = {
  Engineering: 'BLUE',
  Quality: 'VIOLET',
  Delivery: 'AMBER',
  Operations: 'CYAN',
  Business: 'ROSE',
}

export const CATEGORY_ORDER: CategoryKey[] = [
  'Engineering',
  'Quality',
  'Delivery',
  'Operations',
  'Business',
]

// Per-role shades from §6.
export const DESIGNATION_COLOR: Record<string, string> = {
  // Engineering (blue)
  'Software Engineer': '#7DB0FF',
  'Senior Software Engineer': '#4C8DFF',
  'Tech Lead': '#2E6BF0',
  'Backend Developer': '#1D4ED8',
  'Frontend Developer': '#4338CA',
  'Mobile App Developer': '#6D5DF0',
  // Quality (violet)
  'QA Engineer': '#C084FC',
  'Senior QA Engineer': '#A855F7',
  'UI/UX Designer': '#7E22CE',
  // Delivery (amber)
  'Project Manager': '#FCD34D',
  'Delivery Manager': '#F59E0B',
  'Product Manager': '#D97706',
  'Business Analyst': '#B45309',
  // Operations (cyan)
  'DevOps Engineer': '#22D3EE',
  'HR / Operations': '#06B6D4',
  Admin: '#0E7490',
  // Business (rose)
  'Sales / Account Manager': '#FB7185',
  Leadership: '#E11D48',
}

export function designationColor(designation: string, category: string): string {
  return (
    DESIGNATION_COLOR[designation] ??
    CATEGORY_COLOR[(category as CategoryKey) ?? 'Engineering'] ??
    '#4C8DFF'
  )
}
