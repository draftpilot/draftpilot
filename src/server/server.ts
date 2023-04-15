import { indexer } from '@/db/indexer'
import { Messenger } from '@/server/messenger'
import { log } from '@/utils/logger'
import bodyParser from 'body-parser'
import express from 'express'
import ViteExpress from 'vite-express'
import fs from 'fs'

const PORT = 3000

export default function serve(
  port: number = PORT,
  mode?: 'development' | 'production'
): Promise<string> {
  const app = express()
  const messenger = new Messenger()

  if (mode) {
    ViteExpress.config({ mode })
  }

  app.use(bodyParser.json())
  app.use(bodyParser.text())

  app.get('/message', (_, res) => res.send('Hello from express!'))

  app.get('/api/files', async (_, res) => {
    const files = await indexer.getFiles()
    res.json({ files })
  })

  app.get('/api/file', async (req, res) => {
    const { path } = req.query
    const file = fs.readFileSync(path as string, 'utf8')
    res.json({ file })
  })

  app.put('/api/file', async (req, res) => {
    const { path } = req.query
    const body = req.body
    const file = fs.writeFileSync(path as string, body)
    res.end()
  })

  app.post('/api/message', async (req, res) => {
    const input = req.body
    res.setHeader('Content-Type', 'application/json')

    messenger.respondToMessages(input, res)
  })

  const listen = (port: number) => {
    return new Promise<string>((resolve, reject) => {
      const server = ViteExpress.listen(app, port, () => {
        log(`Server is listening on port ${port}...`)
        resolve(`http://localhost:${port}`)
      })

      server.on('error', (e: Error & { code: string; errno: number }) => {
        if (e.code === 'EADDRINUSE') {
          console.log(`Port ${port} is in use, trying another one...`)
          resolve(listen(port + 1))
        } else {
          reject(e)
        }
      })
    })
  }

  return listen(port)
}
