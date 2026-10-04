import { describe, expect, it } from 'vitest'
import { commentHtml, mentionQuery } from '@/lib/mentions'

describe('mentions', () => {
  it('finds the @query at the caret', () => {
    expect(mentionQuery('hi @ju')).toBe('ju')
    expect(mentionQuery('@')).toBe('')
    expect(mentionQuery('mail a@b')).toBeNull()
    expect(mentionQuery('hi @jun done')).toBeNull()
  })

  it('turns picked labels into Frappe mention spans and escapes the rest', () => {
    const html = commentHtml('<b> @Jun Paul and @Jun\nok', { 'Jun': 'jun@x.com', 'Jun Paul': 'jp@x.com' })
    expect(html).toContain('&#60;b&#62;')
    expect(html).toContain('data-id="jp@x.com" data-value="Jun Paul"')
    expect(html).toContain('data-id="jun@x.com" data-value="Jun"')
    expect(html.match(/class="mention"/g)).toHaveLength(2)
    expect(html).toContain('<br>ok')
  })
})
