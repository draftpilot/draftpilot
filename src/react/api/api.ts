import axios, { AxiosError } from 'axios'

class APIService {
  endpoint = '/api'

  loadFiles = async (): Promise<{ files: string[] }> => {
    const response = await axios.get(`${this.endpoint}/files`)
    return response.data
  }

  sendMessage = async (message: string): Promise<string> => {
    const response = await axios.post(`${this.endpoint}/message`, { message })
    return response.data
  }
}

export const API = new APIService()

export const isAxiosError = (item: Error): item is AxiosError => (item as AxiosError).isAxiosError
