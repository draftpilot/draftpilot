import ChatInput from '@/react/components/ChatInput'
import GraphSidebar from '@/react/components/GraphSidebar'
import Messages from '@/react/components/Messages'
import Sidebar from '@/react/components/Sidebar'

function App() {
  const data = {
    nodes: [
      { id: 'node1', label: 'Node 1', type: 'circle' },
      { id: 'node2', label: 'Node 2', type: 'square' },
      { id: 'node3', label: 'Node 3', type: 'triangle' },
    ],
    links: [
      { source: 'node1', target: 'node2' },
      { source: 'node2', target: 'node3' },
      { source: 'node3', target: 'node1' },
    ],
  }

  return (
    <div className="flex h-full relative">
      <div className="hidden sm:block w-56 bg-gray-300">
        <Sidebar />
      </div>
      <div className="flex-1 overflow-y-auto pb-40">
        <div className="mx-auto w-[768px] max-w-full">
          <Messages />
        </div>
      </div>
      <div className="hidden sm:block w-56 bg-gray-300">
        <GraphSidebar graphData={data} />
      </div>
      <div className="fixed bottom-0 left-0 sm:left-56 right-0">
        <div className="mx-auto w-[768px] max-w-full">
          <div className="bg-gradient-to-b from-transparent to-gray-200 h-10" />
          <ChatInput />
        </div>
      </div>
    </div>
  )
}

export default App
