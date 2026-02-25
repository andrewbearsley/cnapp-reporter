import { Download } from 'lucide-react'

interface CsvDownloadProps {
  data: Record<string, unknown>[]
  filename: string
  columns?: { key: string; label: string }[]
}

function escapeCsvField(value: unknown): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function downloadCsv(data: Record<string, unknown>[], filename: string, columns?: { key: string; label: string }[]) {
  if (data.length === 0) return

  const cols = columns ?? Object.keys(data[0]).map((k) => ({ key: k, label: k }))
  const header = cols.map((c) => escapeCsvField(c.label)).join(',')
  const rows = data.map((row) =>
    cols.map((c) => escapeCsvField(row[c.key])).join(',')
  )
  const csv = [header, ...rows].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function CsvDownloadButton({ data, filename, columns }: CsvDownloadProps) {
  return (
    <button
      onClick={() => downloadCsv(data, filename, columns)}
      disabled={data.length === 0}
      title="Download as CSV"
      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300"
    >
      <Download className="h-3.5 w-3.5" />
      CSV
    </button>
  )
}
