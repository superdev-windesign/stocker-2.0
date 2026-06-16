// Browser port of the Paytm `jsPMClient` binary decoder.
// The broadcast server sends little-endian ByteBuffer packets. Each packet starts
// with a 1-byte type that tells us its shape. We only need LTP here, but QUOTE/FULL
// and the index variants are decoded too so the app degrades gracefully if the
// subscription mode ever changes.
//
// Packet type bytes:
//   61 LTP (equity)     62 QUOTE (equity)     63 FULL (equity)
//   64 LTP (index)      65 QUOTE (index)      66 FULL (index)

const f2 = (dv, p) => Number(dv.getFloat32(p, true).toFixed(2))

/**
 * @param {ArrayBuffer} buffer raw websocket message
 * @returns {Array<object>} decoded ticks
 */
export function parseBinary(buffer) {
  const dv = new DataView(buffer)
  const len = dv.byteLength
  const response = []
  let position = 0

  while (position < len) {
    const type = dv.getInt8(position)
    position += 1

    switch (type) {
      case 61: {
        // LTP — equity (22 bytes)
        response.push({
          last_price: f2(dv, position),
          last_trade_time: dv.getInt32(position + 4, true),
          security_id: dv.getInt32(position + 8, true),
          tradable: dv.getInt8(position + 12),
          mode: dv.getInt8(position + 13),
          change_absolute: f2(dv, position + 14),
          change_percent: f2(dv, position + 18),
        })
        position += 22
        break
      }
      case 64: {
        // LTP — index (22 bytes)
        response.push({
          last_price: f2(dv, position),
          last_trade_time: dv.getInt32(position + 4, true),
          security_id: dv.getInt32(position + 8, true),
          tradable: dv.getInt8(position + 12),
          mode: dv.getInt8(position + 13),
          change_absolute: f2(dv, position + 14),
          change_percent: f2(dv, position + 18),
        })
        position += 22
        break
      }
      case 62: {
        // QUOTE — equity (66 bytes)
        response.push({
          last_price: f2(dv, position),
          last_trade_time: dv.getInt32(position + 4, true),
          security_id: dv.getInt32(position + 8, true),
          tradable: dv.getInt8(position + 12),
          mode: dv.getInt8(position + 13),
          last_traded_quantity: dv.getInt32(position + 14, true),
          average_traded_price: f2(dv, position + 18),
          volume_traded: dv.getUint32(position + 22, true),
          total_buy_quantity: dv.getInt32(position + 26, true),
          total_sell_quantity: dv.getInt32(position + 30, true),
          open: f2(dv, position + 34),
          close: f2(dv, position + 38),
          high: f2(dv, position + 42),
          low: f2(dv, position + 46),
          change_percent: f2(dv, position + 50),
          change_absolute: f2(dv, position + 54),
          fifty_two_week_high: f2(dv, position + 58),
          fifty_two_week_low: f2(dv, position + 62),
        })
        position += 66
        break
      }
      case 65: {
        // QUOTE — index (42 bytes)
        response.push({
          last_price: f2(dv, position),
          security_id: dv.getInt32(position + 4, true),
          tradable: dv.getInt8(position + 8),
          mode: dv.getInt8(position + 9),
          open: f2(dv, position + 10),
          close: f2(dv, position + 14),
          high: f2(dv, position + 18),
          low: f2(dv, position + 22),
          change_percent: f2(dv, position + 26),
          change_absolute: f2(dv, position + 30),
          fifty_two_week_high: f2(dv, position + 34),
          fifty_two_week_low: f2(dv, position + 38),
        })
        position += 42
        break
      }
      case 63: {
        // FULL — equity: 5-level market depth (100 bytes) + tick (74 bytes)
        position += 100 // skip depth book — not displayed in this MVP
        response.push({
          last_price: f2(dv, position),
          last_trade_time: dv.getInt32(position + 4, true),
          security_id: dv.getInt32(position + 8, true),
          tradable: dv.getInt8(position + 12),
          mode: dv.getInt8(position + 13),
          last_traded_quantity: dv.getInt32(position + 14, true),
          average_traded_price: f2(dv, position + 18),
          volume_traded: dv.getUint32(position + 22, true),
          total_buy_quantity: dv.getInt32(position + 26, true),
          total_sell_quantity: dv.getInt32(position + 30, true),
          open: f2(dv, position + 34),
          close: f2(dv, position + 38),
          high: f2(dv, position + 42),
          low: f2(dv, position + 46),
          change_percent: f2(dv, position + 50),
          change_absolute: f2(dv, position + 54),
          fifty_two_week_high: f2(dv, position + 58),
          fifty_two_week_low: f2(dv, position + 62),
          OI: dv.getUint32(position + 66, true),
          OI_change: dv.getInt32(position + 70, true),
        })
        position += 74
        break
      }
      case 66: {
        // FULL — index (38 bytes)
        response.push({
          last_price: f2(dv, position),
          security_id: dv.getInt32(position + 4, true),
          tradable: dv.getInt8(position + 8),
          mode: dv.getInt8(position + 9),
          open: f2(dv, position + 10),
          close: f2(dv, position + 14),
          high: f2(dv, position + 18),
          low: f2(dv, position + 22),
          change_percent: f2(dv, position + 26),
          change_absolute: f2(dv, position + 30),
          last_update_time: dv.getInt32(position + 34, true),
        })
        position += 38
        break
      }
      default:
        // Unknown type byte — we cannot know its length, so stop to avoid misreads.
        return response
    }
  }

  return response
}
