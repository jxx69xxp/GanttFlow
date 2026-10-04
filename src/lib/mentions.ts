const esc = (v: string) => v.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)

/** `@label` being typed right before the caret, or null. */
export const mentionQuery = (textBeforeCaret: string) => /(?:^|\s)@([^\s@]*)$/.exec(textBeforeCaret)?.[1] ?? null

/**
 * Plain comment text → HTML, turning each picked `@label` into a Frappe mention span.
 * Frappe's Comment.on_update reads span.mention[data-id] and notifies that user.
 */
export function commentHtml(text: string, mentions: Record<string, string>) {
  const byLabel = new Map(Object.entries(mentions).map(([label, email]) => [esc(label), { label, email }]))
  // one pass, longest label first, so "@Jun Paul" wins over "@Jun" and spans are never re-matched
  const alts = [...byLabel.keys()].sort((a, b) => b.length - a.length).map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  let html = esc(text)
  if (alts.length) {
    html = html.replace(new RegExp(`@(${alts.join('|')})`, 'g'), (_, l: string) => {
      const { label, email } = byLabel.get(l)!
      return `<span class="mention" data-id="${esc(email)}" data-value="${esc(label)}" data-denotation-char="@">@${esc(label)}</span>`
    })
  }
  return html.replace(/\n/g, '<br>')
}
