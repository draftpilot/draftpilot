export interface Tool {
  name: string
  description: string

  run: (input: string) => Promise<string>
}
