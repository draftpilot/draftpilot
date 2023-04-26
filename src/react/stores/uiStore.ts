import { API } from '@/react/api/api'
import { atom } from 'nanostores'

class UIStore {
  windowVisible = atom<boolean>(true)
  editingProjectContext = atom<boolean>(false)
  projectContext = atom<string | undefined>()
  onboarding = atom<boolean>(false)

  sidebarVisible = atom<boolean>(true)

  init = () => {
    API.getContext().then((response) => {
      this.projectContext.set(response)
      if (!response) {
        this.onboarding.set(true)
        this.editingProjectContext.set(true)
      }
    })
  }

  toggleProjectContext = () => {
    this.editingProjectContext.set(!this.editingProjectContext.get())
  }

  saveProjectContext = (context: string) => {
    this.projectContext.set(context)
    this.editingProjectContext.set(false)
    API.putContext(context)
    if (this.onboarding.get()) {
      this.onboarding.set(false)
    }
  }

  toggleSidebar = () => {
    this.sidebarVisible.set(!this.sidebarVisible.get())
  }
}

const uiStore = new UIStore()
export default uiStore
