import { fatal } from '@/utils/utils'

type Config = {
  options: any | undefined
  configFolder: string
  gpt4: 'always' | 'code-only' | 'never'
  glob?: string
  temperature?: number
  logRequests?: boolean
}

const config: Config = {
  options: undefined,
  configFolder: '.draftpilot',
  gpt4: 'always',
  temperature: 0,
  logRequests: true,
}

export default config

export function overrideGPT4(command: string) {
  if (command === 'always') config.gpt4 = 'always'
  else if (command === 'code-only') config.gpt4 = 'code-only'
  else if (command === 'never') config.gpt4 = 'never'
  else fatal('Invalid gpt4 policy')
}
