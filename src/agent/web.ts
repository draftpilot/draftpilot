// npm search

import google from 'googlethis'
import { convert } from 'html-to-text'

import { Tool } from '@/agent/tool'

const googleTool: Tool = {
  name: 'google',
  description:
    'Search google, return JSON results. { name: "google", input: "what are cats made of" }',
  run: async (input: string) => {
    const options = {
      page: 0,
      parse_ads: false,
    }

    const response = await google.search(input, options)
    return response.results.map((r) => r.title + '\n' + r.url + '\n' + r.description).join('\n\n')
  },
}

const googleResultTool: Tool = {
  name: 'googleResult',
  description:
    'Search google, fetch the first result as text. { name: "googleResult", input: "github REST pull api" }',
  run: async (input: string) => {
    const options = {
      page: 0,
      parse_ads: false,
    }

    const response = await google.search(input, options)
    const firstMatch = response.results[0].url

    const siteResponse = await fetch(firstMatch)
    const htmlContent = await siteResponse.text()
    const textContent = getText(htmlContent)
    return textContent || 'No text content found'
  },
}

const urlTool: Tool = {
  name: 'fetchUrl',
  description:
    'Visit a website and scrape the text. { name: "fetchUrl", input: "https://slack.com" }',
  run: async (input: string) => {
    const response = await fetch(input)
    if (!response.ok) {
      return `Error fetching the website: ${response.statusText}`
    }

    const htmlContent = await response.text()
    const textContent = getText(htmlContent)
    return textContent || 'No text content found'
  },
}

export const webTools = [googleTool, googleResultTool, urlTool]

const getText = (html: string) => {
  return convert(html)
}
