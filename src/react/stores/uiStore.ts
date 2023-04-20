import { API } from '@/react/api/api'
import { atom } from 'nanostores'

class UIStore {
  windowVisible = atom<boolean>(true)
  editingProjectContext = atom<boolean>(false)

  toggleProjectContext = () => {
    this.editingProjectContext.set(!this.editingProjectContext.get())
  }
}

const uiStore = new UIStore()
export default uiStore