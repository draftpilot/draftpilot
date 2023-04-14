import axios from 'axios'

class API {
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

export default new API()
