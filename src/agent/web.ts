// npm search

import { Tool } from '@/agent/tool'
import google from 'googlethis'

const googleTool: Tool = {
  name: 'google',
  description: 'Search google. Input: search query',
  run: async (input: string) => {
    const options = {
      page: 0,
      parse_ads: false,
    }

    const response = await google.search(input, options)
    return response.results.map((r) => r.title + '\n' + r.url + '\n' + r.description).join('\n\n')
  },
}
const urlTool: Tool = {
  name: 'fetchUrl',
  description: 'Fetch text from the url. Input: url',
  run: async (input: string) => {
    const response = await fetch(input)
    if (!response.ok) {
      return `Error fetching the website: ${response.statusText}`
    }

    const htmlContent = await response.text()
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlContent, 'text/html')
    const textContent = doc.body.textContent
    return textContent || 'No text content found'
  },
}

export const webTools = [googleTool, urlTool]
