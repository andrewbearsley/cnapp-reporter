import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Bell, MessageSquare, XCircle } from 'lucide-react'

const actions = [
  { key: 'notify', label: 'Notify', icon: Bell },
  { key: 'comment', label: 'Comment', icon: MessageSquare },
  { key: 'close', label: 'Close', icon: XCircle },
]

export default function ActionMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 w-36">
          {actions.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Icon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
