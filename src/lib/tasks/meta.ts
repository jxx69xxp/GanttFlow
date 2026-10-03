export interface BacklogMeta {
  priority?: string | null
  workType?: string | null
  sprintPoints?: string | null
  module?: string | null
  assigneeName?: string | null
  currentAssignee?: string | null
  devAssignee?: string | null
  qaAssignee?: string | null
  dateAssigned?: string | null
  dependencies?: string | null
  parentBacklogId?: string | null
  parentBacklogName?: string | null
  erpStatus?: string | null
  devopsStatus?: string | null
}

const PREFIX = '<!--gfmeta:'
const SUFFIX = '-->'

export function packTaskMeta(description: string | null | undefined, meta: BacklogMeta): string {
  const cleaned = Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value != null && value !== '')
  ) as BacklogMeta
  const body = description ?? ''
  if (Object.keys(cleaned).length === 0) return body
  return `${PREFIX}${JSON.stringify(cleaned)}${SUFFIX}\n${body}`
}

export function unpackTaskMeta(raw: string | null | undefined): { description: string | null; meta: BacklogMeta } {
  if (!raw) return { description: null, meta: {} }
  if (!raw.startsWith(PREFIX)) return { description: raw, meta: {} }
  const end = raw.indexOf(SUFFIX)
  if (end < 0) return { description: raw, meta: {} }
  try {
    const meta = JSON.parse(raw.slice(PREFIX.length, end)) as BacklogMeta
    const description = raw.slice(end + SUFFIX.length).replace(/^\n/, '') || null
    return { description, meta }
  } catch {
    return { description: raw, meta: {} }
  }
}
