import { log } from '@/logger'
import { RedisClientType } from '@redis/client'
import { createClient } from 'redis'

class Cache {
  client?: RedisClientType

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
    return await this.client!.get(key)
  }
}

export const cache = new Cache()
