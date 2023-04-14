import { indexer } from '@/db/indexer'
import { respondToMessages } from '@/server/messenger'
import { log } from '@/utils/logger'
import bodyParser from 'body-parser'
import express from 'express'
import ViteExpress from 'vite-express'

const PORT = 3000

const app = express()

app.use(bodyParser.json())

app.get('/message', (_, res) => res.send('Hello from express!'))

app.get('/api/files', async (_, res) => {
  const files = await indexer.getFiles()
  res.json({ files })
})

app.post('/api/message', async (req, res) => {
  const input = req.body
  res.setHeader('Content-Type', 'application/json')

  respondToMessages(input, res)
})

export default function serve(port: number = PORT): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const server = ViteExpress.listen(app, port, () => {
      log(`Server is listening on port ${port}...`)
      resolve(`http://localhost:${port}`)
    })

    server.on('error', (e: Error & { code: string; errno: number }) => {
      if (e.code === 'EADDRINUSE') {
        console.log(`Port ${port} is in use, trying another one...`)
        resolve(serve(port + 1))
      } else {
        reject(e)
      }
    })
  })
}
