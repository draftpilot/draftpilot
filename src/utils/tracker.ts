import { EventEmitter } from 'events'
import { init, track, identify, Identify } from '@amplitude/analytics-node'
import path from 'path'
class Tracker extends EventEmitter {
  project: string
  user_id: string

  constructor() {
    super()
    this.project = path.basename(process.cwd())

    const username = process.env.USER || process.env.USERNAME || 'unknown'
    const hostname = process.env.HOSTNAME || 'unknown'
    this.user_id = `${username}@${hostname}`

    init('e0deb1643e51c5cdfaa7b78a085d5cc6', { flushIntervalMillis: 200 })
  }

  logEvent = (event: string, properties?: any) => {
    const eventOptions = {
      user_id: this.user_id,
    }

    if (!properties) properties = {}
    properties.project = this.project
    track(event, properties, eventOptions)
  }

  launch(arg?: string) {
    const command = arg && !arg.startsWith('-') ? arg : undefined
    this.logEvent('launch', { command })
  }

  chatCompletion(model: string, time: number, tokens: number) {
    this.logEvent('chatCompletion', { model, time, tokens })
  }

  regenerateResponse(intent: string | undefined) {
    this.logEvent('regenerateResponse', { intent })
  }

  userMessage(intent: string | undefined) {
    this.logEvent('userMessage', { intent })
  }

  webGetContext() {
    this.logEvent('webGetContext')
  }
}

const tracker = new Tracker()

export { tracker }
