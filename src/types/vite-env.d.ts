/// <reference types="vite/client" />

declare module 'axios/lib/adapters/http' {
  export default function httpAdapter(config: any): Promise<any>
}
