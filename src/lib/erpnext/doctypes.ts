// Doctypes a notification can point at; comments/resolve only touch these.
export const BACKLOG_DOCTYPES = ['Sprint Backlogs', 'Sprint Archive', 'Product Backlog', 'Task'] as const

export const allowedDoctype = (v?: string | null) =>
  (BACKLOG_DOCTYPES as readonly string[]).includes(v ?? '') ? v! : null

/** Doctype for a stored task: SPB- names are Sprint Backlogs, the rest ERP Tasks. */
export const doctypeFor = (externalId: string) => (externalId.startsWith('SPB-') ? 'Sprint Backlogs' : 'Task')
