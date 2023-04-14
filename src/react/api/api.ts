import axios from 'axios'

class API {
  endpoint = '/api'

  sendMessage = async (message: string): Promise<string> => {
    const response = await axios.post(`${this.endpoint}/message`, { message })
    return response.data
  }
}

export default new API()
