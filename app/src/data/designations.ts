// Designation catalogue, mirrored from the backend enum + admin token map so the
// registration picker groups roles by category with the exact §6 marker hues.

export type CategoryKey = 'Engineering' | 'Quality' | 'Delivery' | 'Operations' | 'Business'

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  Engineering: 'ENGINEERING',
  Quality: 'QUALITY & DESIGN',
  Delivery: 'DELIVERY',
  Operations: 'OPERATIONS',
  Business: 'BUSINESS',
}

export const CATEGORY_COLOR: Record<CategoryKey, string> = {
  Engineering: '#4C8DFF',
  Quality: '#A855F7',
  Delivery: '#F59E0B',
  Operations: '#06B6D4',
  Business: '#FB7185',
}

export const CATEGORY_ORDER: CategoryKey[] = [
  'Engineering',
  'Quality',
  'Delivery',
  'Operations',
  'Business',
]

export const DESIGNATION_COLOR: Record<string, string> = {
  'Software Engineer': '#7DB0FF',
  'Senior Software Engineer': '#4C8DFF',
  'Tech Lead': '#2E6BF0',
  'Backend Developer': '#1D4ED8',
  'Frontend Developer': '#4338CA',
  'Mobile App Developer': '#6D5DF0',
  'QA Engineer': '#C084FC',
  'Senior QA Engineer': '#A855F7',
  'UI/UX Designer': '#7E22CE',
  'Project Manager': '#FCD34D',
  'Delivery Manager': '#F59E0B',
  'Product Manager': '#D97706',
  'Business Analyst': '#B45309',
  'DevOps Engineer': '#22D3EE',
  'HR / Operations': '#06B6D4',
  Admin: '#0E7490',
  'Sales / Account Manager': '#FB7185',
  Leadership: '#E11D48',
}

export const DESIGNATIONS: { name: string; category: CategoryKey }[] = [
  { name: 'Software Engineer', category: 'Engineering' },
  { name: 'Senior Software Engineer', category: 'Engineering' },
  { name: 'Tech Lead', category: 'Engineering' },
  { name: 'Backend Developer', category: 'Engineering' },
  { name: 'Frontend Developer', category: 'Engineering' },
  { name: 'Mobile App Developer', category: 'Engineering' },
  { name: 'QA Engineer', category: 'Quality' },
  { name: 'Senior QA Engineer', category: 'Quality' },
  { name: 'UI/UX Designer', category: 'Quality' },
  { name: 'Project Manager', category: 'Delivery' },
  { name: 'Delivery Manager', category: 'Delivery' },
  { name: 'Product Manager', category: 'Delivery' },
  { name: 'Business Analyst', category: 'Delivery' },
  { name: 'DevOps Engineer', category: 'Operations' },
  { name: 'HR / Operations', category: 'Operations' },
  { name: 'Sales / Account Manager', category: 'Business' },
  { name: 'Leadership', category: 'Business' },
]

export function designationColor(name: string | undefined): string {
  if (!name) return '#4C8DFF'
  return DESIGNATION_COLOR[name] ?? '#4C8DFF'
}

export function categoryFor(name: string | undefined): CategoryKey | undefined {
  return DESIGNATIONS.find((d) => d.name === name)?.category
}
