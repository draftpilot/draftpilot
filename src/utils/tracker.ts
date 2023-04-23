import { EventEmitter } from 'events'
import { init, track, identify, Identify } from '@amplitude/analytics-node'
import path from 'path'

class Tracker extends EventEmitter {
  init() {
    const project = path.basename(process.cwd())
    // get unix user name
    const username = process.env.USER || process.env.USERNAME || 'unknown'

    init('e0deb1643e51c5cdfaa7b78a085d5cc6')
    const identifyObj = new Identify()
    identifyObj.set('project', project)
    identifyObj.set('username', username)
    identify(identifyObj)
  }

  launch(command?: string) {
    track('launch', { command })
  }

  chatCompletion(model: string, time: number, tokens: number) {
    track('chatCompletion', { model, time, tokens })
  }

  regenerateResponse(intent: string | undefined) {
    track('regenerateResponse', { intent })
  }

  userMessage(intent: string | undefined) {
    track('userMessage', { intent })
  }

  webGetContext() {
    track('webGetContext')
  }
}

const tracker = new Tracker()

export { tracker }
