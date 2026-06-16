import { useEffect, useRef } from 'react'
import { createChart, ColorType } from 'lightweight-charts'
import { useTheme } from '../../context/ThemeContext'

/**
 * Historical price chart (area on close) with an average-buy price line and
 * 🟢 buy / 🔴 sell markers overlaid. Powered by lightweight-charts.
 *
 * @param {Array} candles  normalized [{time, close, ...}]
 * @param {number} [avgPrice]
 * @param {Array} [markers]  [{time, side:'BUY'|'SELL', qty, price}]
 */
export default function PriceChartWithMarkers({ candles, avgPrice, markers = [] }) {
  const elRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const { theme } = useTheme()

  useEffect(() => {
    const chart = createChart(elRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: theme === 'dark' ? '#9aa4b2' : '#475569',
      },
      grid: {
        vertLines: { color: 'rgba(127,127,127,0.08)' },
        horzLines: { color: 'rgba(127,127,127,0.08)' },
      },
      rightPriceScale: { borderColor: 'rgba(127,127,127,0.15)' },
      timeScale: { borderColor: 'rgba(127,127,127,0.15)', timeVisible: true },
      height: 360,
      autoSize: true,
    })
    const series = chart.addAreaSeries({
      lineColor: '#6366f1',
      topColor: 'rgba(99,102,241,0.25)',
      bottomColor: 'rgba(99,102,241,0.02)',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
    })
    chartRef.current = chart
    seriesRef.current = series
    const ro = new ResizeObserver(() => chart.applyOptions({}))
    ro.observe(elRef.current)
    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [theme])

  // Update data + overlays.
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    const data = (candles || []).map((c) => ({ time: c.time, value: c.close }))
    series.setData(data)

    // Average buy price line.
    if (avgPrice && data.length) {
      series.createPriceLine({
        price: avgPrice,
        color: '#f59e0b',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Avg Buy',
      })
    }

    // Buy/sell markers snapped to the nearest candle time.
    if (markers.length && data.length) {
      const times = data.map((d) => d.time)
      const snapped = markers.map((m) => {
        const t = times.reduce((best, x) => (Math.abs(x - m.time) < Math.abs(best - m.time) ? x : best), times[0])
        const buy = m.side === 'BUY'
        return {
          time: t,
          position: buy ? 'belowBar' : 'aboveBar',
          color: buy ? '#16c784' : '#ea3943',
          shape: buy ? 'arrowUp' : 'arrowDown',
          text: `${buy ? 'B' : 'S'} ${m.qty ?? ''}`,
        }
      })
      series.setMarkers(snapped.sort((a, b) => a.time - b.time))
    }

    chartRef.current?.timeScale().fitContent()
  }, [candles, avgPrice, markers])

  if (!candles || !candles.length) {
    return (
      <div className="flex h-[360px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        No price history returned for this timeframe.
      </div>
    )
  }
  return <div ref={elRef} className="h-[360px] w-full" />
}
