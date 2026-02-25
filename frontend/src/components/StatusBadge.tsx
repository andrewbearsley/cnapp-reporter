interface StatusBadgeProps {
  status: string
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const isHealthy = status === 'healthy' || status === 'success'
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isHealthy
          ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
          : status === 'pending'
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
            : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-green-500 dark:bg-green-400' : status === 'pending' ? 'bg-yellow-500 dark:bg-yellow-400' : 'bg-red-500 dark:bg-red-400'}`} />
      {status === 'healthy' || status === 'success' ? 'Healthy' : status === 'pending' ? 'Pending' : 'Error'}
    </span>
  )
}
