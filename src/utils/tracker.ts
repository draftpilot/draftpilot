import { EventEmitter } from 'events'
import { init, logEvent } from '@amplitude/analytics-node'

class Tracker extends EventEmitter {
  constructor() {
    super()
    init('e0deb1643e51c5cdfaa7b78a085d5cc6')
  }

  launch() {
    logEvent('launch')
  }

  chatCompletion(model: string, time: number, tokens: number) {
    logEvent('chatCompletion', { model, time, tokens })
  }
}

const tracker = new Tracker()

export { tracker }
