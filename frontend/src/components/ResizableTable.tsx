import { useCallback, useEffect, useRef, useState } from 'react'

interface ResizableTableProps {
  columns: { key: string; label: string; minWidth?: number; defaultWidth?: number; align?: 'left' | 'center' }[]
  children: React.ReactNode
}

export default function ResizableTable({ columns, children }: ResizableTableProps) {
  const [widths, setWidths] = useState<number[]>(() =>
    columns.map((c) => c.defaultWidth ?? 150)
  )
  const dragging = useRef<{ index: number; startX: number; startWidth: number } | null>(null)

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return
    const { index, startX, startWidth } = dragging.current
    const minW = columns[index].minWidth ?? 60
    const newWidth = Math.max(minW, startWidth + (e.clientX - startX))
    setWidths((prev) => {
      const next = [...prev]
      next[index] = newWidth
      return next
    })
  }, [columns])

  const onMouseUp = useCallback(() => {
    dragging.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  function onMouseDown(index: number, e: React.MouseEvent) {
    e.preventDefault()
    dragging.current = { index, startX: e.clientX, startWidth: widths[index] }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
      <colgroup>
        {widths.map((w, i) => (
          <col key={i} style={{ width: `${w}px` }} />
        ))}
      </colgroup>
      <thead>
        <tr className="text-gray-500 dark:text-gray-400 text-left border-b border-gray-200 dark:border-gray-700">
          {columns.map((col, i) => (
            <th
              key={col.key}
              className={`px-6 py-3 font-medium relative ${col.align === 'center' ? 'text-center' : ''}`}
            >
              {col.label}
              {i < columns.length - 1 && (
                <span
                  onMouseDown={(e) => onMouseDown(i, e)}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/40 active:bg-blue-500/50"
                />
              )}
            </th>
          ))}
        </tr>
      </thead>
      {children}
    </table>
  )
}
