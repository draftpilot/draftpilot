import config from '@/config'
import Cache from 'cache'

const EXPIRY = 60 * 60 * 24 * 7 // 1 week

class RequestCache {
  client?: Cache
  shouldSkipCache = false

  init = async () => {
    this.client = new Cache(EXPIRY, config.configFolder + '/cache.json')
  }

  set = async (key: string, value: any) => {
    if (!this.client) await this.init()
    this.client!.put(key, value)
  }

  get = async (key: string) => {
    if (!this.client) await this.init()
    if (this.shouldSkipCache) return null
    return this.client!.get(key)
  }

  close = async () => {}

  skipCache = () => {
    this.shouldSkipCache = true
  }
}

export const cache = new RequestCache()
