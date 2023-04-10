import { fatal } from '@/utils'

type Config = {
  customServer: boolean
  server: string
  options: any | undefined
  configFolder: string
  gpt4: 'always' | 'code-only' | 'never'
  glob?: string
}

const config: Config = {
  customServer: false,
  server: 'https://teamstory.ai',
  options: undefined,
  configFolder: '.draftpilot',
  gpt4: 'code-only',
}

export default config

export function overrideServer(server: string) {
  if (server.startsWith('localhost')) server = 'http://' + server
  else if (!server.startsWith('http')) server = 'https://' + server

  config.customServer = true
  config.server = server
}

export function overrideGPT4(command: string) {
  if (command === 'always') config.gpt4 = 'always'
  else if (command === 'code-only') config.gpt4 = 'code-only'
  else if (command === 'never') config.gpt4 = 'never'
  else fatal('Invalid gpt4 policy')
}
