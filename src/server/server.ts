//e.g server.js
import { log } from '@/utils/logger'
import express from 'express'
import ViteExpress from 'vite-express'

const PORT = 3000

const app = express()

app.get('/message', (_, res) => res.send('Hello from express!'))

export default function serve(port: number = PORT): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const server = ViteExpress.listen(app, port, () => {
      log(`Server is listening on port ${port}...`)
      resolve(`http://localhost:${port}`)
    })

    server.on('error', (e: any) => {
      log(e)

      if (e.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is in use, trying another one...`)
        resolve(serve(port + 1))
      } else {
        reject(e)
      }
    })
  })
}
