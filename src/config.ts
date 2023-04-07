type Config = {
  customServer: boolean
  server: string
  options: any | undefined
}

const config: Config = {
  customServer: false,
  server: 'https://teamstory.ai',
  options: undefined,
}

export default config

export function overrideServer(server: string) {
  if (server.startsWith('localhost')) server = 'http://' + server
  else if (!server.startsWith('http')) server = 'https://' + server

  config.customServer = true
  config.server = server
}
