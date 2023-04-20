import { API } from '@/react/api/api'
import { atom } from 'nanostores'

class UIStore {
  windowVisible = atom<boolean>(true)
}

const uiStore = new UIStore()
export default uiStore
