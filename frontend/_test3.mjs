import * as yahoo from './lib/marketdata/yahoo.js'
const usSec = await yahoo.sectorIndices('US')
console.log('US sectors:', usSec.length)
usSec.slice(0,3).forEach(s => console.log(`  ${s.label} (${s.yahooSymbol}): ${s.price} ${s.changePct}%`))
const us = await yahoo.usQuotes()
console.log('\nUS quotes:', us.length)
us.slice(0,4).forEach(q => console.log(`  ${q.nsSymbol}: $${q.price} (${q.changePct}%) name=${q.name?.slice(0,20)}`))
