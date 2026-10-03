// Allowlist sanitizer for Frappe HTML (descriptions, comments).
// Uses the browser's DOMParser — regex can't parse HTML (Frappe mentions put raw '>' inside attributes).
// DOMParser documents are inert: no scripts run, no images load.
const ALLOWED: Record<string, string[]> = {
  p: [], br: [], div: [], span: [], strong: [], b: [], em: [], i: [], u: [], s: [],
  ul: [], ol: [], li: [],
  a: ['href', 'title'],
  img: ['src', 'alt', 'width', 'height'],
  h1: [], h2: [], h3: [], h4: [],
  blockquote: [], pre: [], code: [], hr: [],
  table: [], thead: [], tbody: [], tr: [], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'],
}
// dropped with their contents; any other unknown tag is unwrapped (text kept)
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'head', 'title'])
const URL_ATTRS = new Set(['src', 'href'])

/** Frappe /files and /private/files only resolve on the ERP host (private needs auth) → route through our proxy. Keeps ?fid=. */
export function erpFileUrl(url: string) {
  const m = url.match(/^(?:https?:\/\/[^/]+)?(\/(?:private\/)?files\/[^#]+)/i)
  return m ? `/api/erp-file?path=${encodeURIComponent(m[1])}` : url
}

export function safeUrl(url: string) {
  const v = url.trim()
  if (/^(https?:|mailto:|data:image\/)/i.test(v)) return true
  // relative URL only: no scheme before the first / ? #
  return !v.split(/[/?#]/)[0].includes(':')
}

function clean(node: Node, doc: Document, proxyFiles: boolean): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? '')
  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  if (DROP.has(tag)) return null

  const kids = [...el.childNodes].map(n => clean(n, doc, proxyFiles)).filter((n): n is Node => !!n)
  if (!(tag in ALLOWED)) {
    const frag = doc.createDocumentFragment()
    frag.append(...kids)
    return frag
  }
  const copy = doc.createElement(tag)
  for (const name of ALLOWED[tag]) {
    const v = el.getAttribute(name)
    if (v == null) continue
    if (URL_ATTRS.has(name)) {
      if (!safeUrl(v)) continue
      copy.setAttribute(name, proxyFiles ? erpFileUrl(v.trim()) : v.trim())
    } else {
      copy.setAttribute(name, v)
    }
  }
  if (tag === 'a') { copy.setAttribute('target', '_blank'); copy.setAttribute('rel', 'noopener noreferrer') }
  copy.append(...kids)
  return copy
}

/** proxyFiles: rewrite Frappe file links to our proxy — on for display, off for HTML sent back to ERP. */
export function safeHtml(raw: string | null | undefined, { proxyFiles = true } = {}): string {
  if (!raw || typeof DOMParser === 'undefined') return ''  // client-only (drawer never SSR-renders open)
  const doc = new DOMParser().parseFromString(raw, 'text/html')
  const out = doc.createElement('div')
  out.append(...[...doc.body.childNodes].map(n => clean(n, doc, proxyFiles)).filter((n): n is Node => !!n))
  return out.innerHTML.replace(/﻿/g, '').trim()  // Quill mention zero-width markers
}
