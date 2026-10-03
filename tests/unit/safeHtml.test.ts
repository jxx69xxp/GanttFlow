import { describe, expect, it } from 'vitest'
import { erpFileUrl, safeUrl } from '../../src/lib/safeHtml'

// safeHtml itself needs DOMParser (browser); these cover the URL rules it applies.
describe('safeHtml url rules', () => {
  it('proxies Frappe files, keeping ?fid', () => {
    expect(erpFileUrl('/files/a.png')).toBe('/api/erp-file?path=%2Ffiles%2Fa.png')
    expect(erpFileUrl('/private/files/b.png?fid=abc')).toBe('/api/erp-file?path=%2Fprivate%2Ffiles%2Fb.png%3Ffid%3Dabc')
    expect(erpFileUrl('https://erp.x.com/private/files/c.png')).toBe('/api/erp-file?path=%2Fprivate%2Ffiles%2Fc.png')
    expect(erpFileUrl('https://cdn.x.com/d.png')).toBe('https://cdn.x.com/d.png')
  })

  it('blocks script URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBe(false)
    expect(safeUrl(' java\tscript:alert(1)')).toBe(false)
    expect(safeUrl('vbscript:x')).toBe(false)
    expect(safeUrl('data:text/html,x')).toBe(false)
    expect(safeUrl('data:image/png;base64,AAA')).toBe(true)
    expect(safeUrl('/private/files/a.png')).toBe(true)
    expect(safeUrl('https://erp.x.com/app/user-profile/a@b.c')).toBe(true)
  })
})
