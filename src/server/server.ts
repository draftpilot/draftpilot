import { indexer } from '@/db/indexer'
import { Messenger } from '@/server/messenger'
import { log } from '@/utils/logger'
import bodyParser from 'body-parser'
import express from 'express'
import ViteExpress from './vite-express'
import fs from 'fs'

import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename) // usually dist/
const assetRoot = path.dirname(__dirname) // usually draftpilot/

const PORT = 3080

export default function serve(
  port: number = PORT,
  mode?: 'development' | 'production'
): Promise<string> {
  ViteExpress.config({ assetRoot, mode: mode || 'production' })

  const app = express()
  const messenger = new Messenger()

  app.use(bodyParser.json())
  app.use(bodyParser.text())

  app.get('/message', (_, res) => res.send('Hello from express!'))

  app.get('/api/files', async (_, res) => {
    const files = await indexer.getFiles()
    const cwd = process.cwd()
    res.json({ files, cwd })
  })

  app.get('/api/file', async (req, res) => {
    const { path } = req.query
    const file = fs.readFileSync(path as string, 'utf8')
    res.json({ file })
  })

  app.put('/api/file', async (req, res) => {
    const { path } = req.query
    const body = req.body
    const filePath = path as string
    if (!filePath || filePath.startsWith('/')) {
      res.sendStatus(403)
      return
    }
    fs.writeFileSync(filePath, body)
  })

  app.post('/api/message', async (req, res) => {
    const input = req.body
    res.setHeader('Content-Type', 'application/json')

    messenger.respondToMessages(input, res)
  })

  app.post('/api/interrupt', async (req, res) => {
    const { id } = req.query
    messenger.respondToInterrupt(id as string)
    res.json({ success: true })
  })

  const listen = (port: number) => {
    return new Promise<string>((resolve, reject) => {
      const server = ViteExpress.listen(app, port, () => {
        const url = `http://localhost:${port}`
        log(`Draftpilot is listening on ${url}`)
        resolve(url)
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
