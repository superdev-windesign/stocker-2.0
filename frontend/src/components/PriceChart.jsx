import { useEffect, useRef } from 'react'
import { createChart, ColorType } from 'lightweight-charts'

/**
 * Live line chart for a single stock's price history, driven by lightweight-charts.
 * Re-seeds the series whenever the selected stock changes, then appends new points.
 */
export default function PriceChart({ stock, data }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const lastTimeRef = useRef(0)

  // Create the chart once.
  useEffect(() => {
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9aa4b2',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: true },
      height: 360,
      autoSize: true,
    })
    const series = chart.addAreaSeries({
      lineColor: '#6366f1',
      topColor: 'rgba(99,102,241,0.30)',
      bottomColor: 'rgba(99,102,241,0.02)',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
    })

    chartRef.current = chart
    seriesRef.current = series

    const ro = new ResizeObserver(() => chart.applyOptions({}))
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [])

  // Re-seed the full series when the selected stock changes.
  useEffect(() => {
    if (!seriesRef.current) return
    const points = data || []
    seriesRef.current.setData(points)
    lastTimeRef.current = points.length ? points[points.length - 1].time : 0
    chartRef.current?.timeScale().fitContent()
  }, [stock.scripId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Append only newly arrived points (avoids redrawing the whole series each tick).
  useEffect(() => {
    if (!seriesRef.current || !data || !data.length) return
    const latest = data[data.length - 1]
    if (latest.time > lastTimeRef.current) {
      seriesRef.current.update(latest)
      lastTimeRef.current = latest.time
    }
  }, [data])

  return (
    <div className="rounded-xl border border-white/10 bg-[#12161c] p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">
          {stock.symbol} <span className="text-sm font-normal text-gray-500">· {stock.name}</span>
        </h2>
        <span className="text-xs text-gray-500">Live price (LTP)</span>
      </div>
      <div ref={containerRef} className="h-[360px] w-full" />
      {(!data || !data.length) && (
        <p className="mt-3 text-center text-xs text-gray-500">
          Waiting for live ticks… (charts populate during NSE market hours)
        </p>
      )}
    </div>
  )
}
