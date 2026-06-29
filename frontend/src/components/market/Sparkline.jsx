// Tiny inline SVG sparkline with gradient fill (Google Finance index-card style).
// Feed it an array of numbers (closes). Auto colors green/red vs first point.
export default function Sparkline({ data = [], width = 240, height = 64, baseline = null }) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="flex items-center justify-center text-[10px] text-slate-400">—</div>
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)

  const y = (v) => height - ((v - min) / range) * (height - 4) - 2
  const pts = data.map((v, i) => [i * stepX, y(v)])

  const linePath = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`

  const start = baseline != null ? baseline : data[0]
  const up = data[data.length - 1] >= start
  const stroke = up ? '#16a34a' : '#dc2626'
  const fillId = `spark-${up ? 'up' : 'dn'}`

  // Optional dotted baseline (prev close)
  const baseY = baseline != null ? y(baseline) : null

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${fillId})`} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {baseY != null && (
        <line x1="0" y1={baseY} x2={width} y2={baseY} stroke="currentColor" strokeWidth="1"
          strokeDasharray="2 3" className="text-slate-300 dark:text-white/20" />
      )}
    </svg>
  )
}
