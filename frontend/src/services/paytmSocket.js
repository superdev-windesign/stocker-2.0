import { parseBinary } from './parseBinary'

const WS_URL = 'wss://developer-ws.paytmmoney.com/broadcast/user/v1/data?x_jwt_token='
const MAX_RECONNECT = 5

/**
 * Opens a Paytm live-market-data websocket, subscribes to `preferences`, and streams
 * decoded ticks back through callbacks. Mirrors the reconnect behaviour of the official SDK.
 *
 * @param {object}   opts
 * @param {string}   opts.token        public access token
 * @param {Array}    opts.preferences  subscription preference objects
 * @param {(ticks:Array)=>void}              opts.onTick
 * @param {(status:string, detail?:string)=>void} opts.onStatus  'connecting'|'connected'|'error'|'closed'
 * @returns {{ disconnect: () => void }}
 */
export function createPaytmSocket({ token, preferences, onTick, onStatus }) {
  let socket = null
  let reconnectCount = 0
  let reconnectDelay = 2000
  let closedByUser = false
  let reconnectTimer = null

  const open = () => {
    onStatus?.('connecting')
    socket = new WebSocket(WS_URL + token)
    socket.binaryType = 'arraybuffer'

    socket.onopen = () => {
      reconnectCount = 0
      reconnectDelay = 2000
      onStatus?.('connected')
      socket.send(JSON.stringify(preferences))
    }

    socket.onmessage = (event) => {
      // String frames are server-side error/info messages (e.g. invalid token).
      if (typeof event.data === 'string') {
        onStatus?.('error', event.data)
        return
      }
      try {
        const ticks = parseBinary(event.data)
        if (ticks.length) onTick?.(ticks)
      } catch (err) {
        onStatus?.('error', `Failed to decode packet: ${err.message}`)
      }
    }

    socket.onerror = () => {
      onStatus?.('error', 'WebSocket connection error')
    }

    socket.onclose = (event) => {
      onStatus?.('closed', event.reason || `code ${event.code}`)
      // Reconnect on abnormal closures only (1000 = normal).
      if (!closedByUser && event.code !== 1000 && reconnectCount < MAX_RECONNECT) {
        reconnectCount += 1
        reconnectTimer = setTimeout(open, reconnectDelay)
        reconnectDelay *= 2
      }
    }
  }

  open()

  return {
    disconnect() {
      closedByUser = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (!socket) return
      // Don't fire status callbacks during an intentional teardown.
      socket.onclose = null
      socket.onerror = null
      if (socket.readyState === WebSocket.CONNECTING) {
        // Closing a socket that's still connecting throws a console warning, so
        // wait until it opens (or errors) and then close it cleanly.
        socket.onopen = () => socket.close(1000, 'client disconnect')
      } else if (socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'client disconnect')
      }
    },
  }
}
