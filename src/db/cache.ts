import { log } from '@/logger'
import { RedisClientType } from '@redis/client'
import { createClient } from 'redis'

class Cache {
  client?: RedisClientType
  shouldSkipCache = false

  initRedis = async () => {
    this.client = createClient()
    this.client.on('error', (err) => log('Redis Client Error', err))
    await this.client.connect()
  }

  set = async (key: string, value: string) => {
    if (!this.client) await this.initRedis()
    await this.client!.set(key, value)
  }

  get = async (key: string) => {
    if (!this.client) await this.initRedis()
    if (this.shouldSkipCache) return null
    return await this.client!.get(key)
  }

  close = async () => {
    this.client?.quit()
  }

  skipCache = () => {
    this.shouldSkipCache = true
  }
}

export const cache = new Cache()
