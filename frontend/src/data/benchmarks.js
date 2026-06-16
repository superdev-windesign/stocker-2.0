// Bundled benchmark index history (Nifty 50 & Sensex) for the portfolio-vs-market
// comparison and alpha calculation. Paytm doesn't expose index history, so we ship
// real-ish quarterly anchor closes and interpolate a monthly series at runtime.

const ANCHORS = [
  { d: '2020-01', nifty: 12100, sensex: 41000 },
  { d: '2020-04', nifty: 9860, sensex: 33700 },
  { d: '2020-07', nifty: 11070, sensex: 37600 },
  { d: '2020-10', nifty: 11640, sensex: 39600 },
  { d: '2021-01', nifty: 13980, sensex: 47750 },
  { d: '2021-04', nifty: 14630, sensex: 48780 },
  { d: '2021-07', nifty: 15760, sensex: 52580 },
  { d: '2021-10', nifty: 17670, sensex: 59300 },
  { d: '2022-01', nifty: 17340, sensex: 58010 },
  { d: '2022-04', nifty: 17100, sensex: 57060 },
  { d: '2022-07', nifty: 16220, sensex: 54480 },
  { d: '2022-10', nifty: 17900, sensex: 60750 },
  { d: '2023-01', nifty: 17660, sensex: 59550 },
  { d: '2023-04', nifty: 18065, sensex: 61110 },
  { d: '2023-07', nifty: 19750, sensex: 66530 },
  { d: '2023-10', nifty: 19080, sensex: 63870 },
  { d: '2024-01', nifty: 21730, sensex: 71750 },
  { d: '2024-04', nifty: 22600, sensex: 74480 },
  { d: '2024-07', nifty: 24950, sensex: 81330 },
  { d: '2024-10', nifty: 24200, sensex: 79390 },
  { d: '2025-01', nifty: 23510, sensex: 77600 },
  { d: '2025-04', nifty: 24330, sensex: 80120 },
]

const toMonthIndex = (d) => {
  const [y, m] = d.split('-').map(Number)
  return y * 12 + (m - 1)
}

// Build a monthly interpolated series across the full anchor range.
export function benchmarkSeries() {
  const start = toMonthIndex(ANCHORS[0].d)
  const end = toMonthIndex(ANCHORS[ANCHORS.length - 1].d)
  const out = []
  let ai = 0
  for (let mi = start; mi <= end; mi++) {
    while (ai < ANCHORS.length - 1 && toMonthIndex(ANCHORS[ai + 1].d) <= mi) ai++
    const a = ANCHORS[ai]
    const b = ANCHORS[Math.min(ai + 1, ANCHORS.length - 1)]
    const ami = toMonthIndex(a.d)
    const bmi = toMonthIndex(b.d)
    const t = bmi === ami ? 0 : (mi - ami) / (bmi - ami)
    const year = Math.floor(mi / 12)
    const month = (mi % 12) + 1
    out.push({
      date: `${year}-${String(month).padStart(2, '0')}`,
      nifty: Math.round(a.nifty + (b.nifty - a.nifty) * t),
      sensex: Math.round(a.sensex + (b.sensex - a.sensex) * t),
    })
  }
  return out
}

// Index a series to base 100 from its first point (for normalized comparison).
export function indexed(values) {
  if (!values?.length) return []
  const base = values[0]
  return values.map((v) => (base ? (v / base) * 100 : 100))
}
