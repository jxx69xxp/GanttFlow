'use client'
import { useRef, useState } from 'react'
import { Code2, ImagePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { safeHtml } from '@/lib/safeHtml'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/**
 * contentEditable editor: type, paste text/HTML, paste or drop images, or edit raw HTML.
 * Images are inlined as data: URLs — Frappe's Text Editor extracts them into File docs on save.
 * ponytail: no toolbar (bold/lists come from paste or ⌘B/⌘I); add one if people ask.
 */
export function RichTextInput({ id, onChange }: { id?: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState(false)
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')

  const emit = (value: string) => { setHtml(value); onChange(value) }

  async function insertImages(files: File[], at?: { x: number; y: number }) {
    setError('')
    const images = files.filter(f => f.type.startsWith('image/'))
    const tooBig = images.filter(f => f.size > MAX_IMAGE_BYTES)
    if (tooBig.length) setError(`Images over 5 MB skipped: ${tooBig.map(f => f.name).join(', ')}`)
    const el = ref.current
    if (!el) return
    el.focus()
    // drop: put the caret where the image was dropped
    if (at && document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(at.x, at.y)
      if (range) { const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(range) }
    }
    for (const file of images.filter(f => f.size <= MAX_IMAGE_BYTES)) {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      document.execCommand('insertImage', false, url)  // keeps native undo
    }
    emit(el.innerHTML)
  }

  function toggleSource() {
    if (source && ref.current) {
      // leaving HTML mode: sanitize before it touches the live DOM (no onerror etc.)
      ref.current.innerHTML = safeHtml(html, { proxyFiles: false })
      emit(ref.current.innerHTML)
    }
    setSource(s => !s)
  }

  return (
    <div className="rounded-lg border border-line bg-input focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/40">
      <div className="flex items-center gap-1 border-b border-line px-2 py-1">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={source}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-ink disabled:opacity-40">
          <ImagePlus className="h-3.5 w-3.5" /> Image
        </button>
        <button type="button" onClick={toggleSource} aria-pressed={source}
          className={cn('flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-hover',
            source ? 'bg-hover font-semibold text-ink' : 'text-muted hover:text-ink')}>
          <Code2 className="h-3.5 w-3.5" /> HTML
        </button>
        <span className="ml-auto text-[10px] text-soft">Paste or drop images</span>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={e => { insertImages([...(e.target.files ?? [])]); e.target.value = '' }} />
      </div>

      {/* editor stays mounted so its content survives the HTML toggle */}
      <div
        id={id}
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label="Description"
        contentEditable
        suppressContentEditableWarning
        onInput={e => emit(e.currentTarget.innerHTML)}
        onPaste={e => {
          const files = [...e.clipboardData.files]
          if (files.some(f => f.type.startsWith('image/'))) { e.preventDefault(); insertImages(files) }
        }}
        onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
        onDrop={e => {
          const files = [...e.dataTransfer.files]
          if (files.length) { e.preventDefault(); insertImages(files, { x: e.clientX, y: e.clientY }) }
        }}
        data-placeholder="Write, paste text/HTML, or drop images…"
        className={cn(
          'min-h-[120px] max-h-[40vh] overflow-y-auto px-3 py-2 text-sm text-ink outline-none',
          '[&_img]:my-1 [&_img]:max-w-full [&_img]:rounded',
          'empty:before:pointer-events-none empty:before:text-soft empty:before:content-[attr(data-placeholder)]',
          source && 'hidden',
        )}
      />
      {source && (
        <textarea
          value={html}
          onChange={e => emit(e.target.value)}
          spellCheck={false}
          aria-label="Description HTML"
          className="block min-h-[120px] w-full resize-y bg-transparent px-3 py-2 font-mono text-xs text-ink outline-none"
        />
      )}
      {error && <p className="border-t border-line px-3 py-1 text-[11px] text-red-500">{error}</p>}
    </div>
  )
}
