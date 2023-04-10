declare module 'cache' {
  export default class Cache {
    constructor(ttl: number, file?: string)

    put(key: string, value: any): void

    get(key: string): any
  }
}
