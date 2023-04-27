import { PropsWithChildren, useEffect, useState } from 'react'

import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useStore } from '@nanostores/react'
import { fileStore } from '@/react/stores/fileStore'

type NodeData = {
  name: string
  isOpen?: boolean
  children?: NodeData[]
  type: 'file' | 'folder'
  path: string
}

type FileTreeProps = {
  selected: string
  setSelected: (file: string) => void
}

export default (props: FileTreeProps) => {
  const [tree, setTree] = useState<NodeData>({ name: '', type: 'folder', path: '' })
  const files = useStore(fileStore.files)

  useEffect(() => {
    if (!files.length) return
    const tree = filesToNodes(files)
    setTree(tree)
  }, [files])

  return (
    <nav className="px-2 space-y-1 flex flex-col flex-1">
      <FileTree {...{ node: tree, indent: 0, ...props }} />
      <RootFolderDropZone></RootFolderDropZone>
    </nav>
  )
}

type NodeProps = {
  indent: number
  node: NodeData
} & FileTreeProps

function FileTree({ node, indent, ...rest }: NodeProps) {
  if (!node.children) return null
  const sorted = node.children.sort((a, b) =>
    a.type != b.type ? (a.type == 'folder' ? -1 : 1) : a.name.localeCompare(b.name)
  )
  return (
    <div className={indent > 0 ? 'ml-4 border-l pl-1' : ''}>
      {sorted.map((node) => {
        if (node.type == 'file') {
          return <FileNode key={node.path} {...{ indent, node, ...rest }} />
        } else if (node.type == 'folder') {
          return <FolderNode key={node.path} {...{ indent, node, ...rest }} />
        } else {
          return null
        }
      })}
    </div>
  )
}

function FileNode({ indent, node, ...rest }: NodeProps) {
  const isSelected = rest.selected === node.path
  return (
    <div
      onClick={() => rest.setSelected(node.path)}
      className={
        (isSelected ? 'bg-blue-200 ' : ' hover:bg-blue-300 ') +
        'text-gray-700 group flex items-center px-2 py-2 text-sm font-medium rounded-md ' +
        'transition-all overflow-hidden whitespace-nowrap text-ellipsis'
      }
    >
      {node.name}
    </div>
  )
}

function FolderNode(props: NodeProps) {
  const { node, indent, ...rest } = props
  const expanded = useStore(fileStore.expanded)[node.path]

  const setExpanded = (setting: boolean) => {
    fileStore.expanded.setKey(node.path, setting)
  }

  const Icon = expanded ? ChevronDownIcon : ChevronRightIcon

  const onContextMenu = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect()
  }

  return (
    <>
      <div
        onContextMenu={(e) => onContextMenu(e.target as HTMLElement)}
        className="text-gray-700 hover:bg-gray-300 group flex
        items-center px-2 py-2 text-sm font-medium rounded-md transition-all cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <Icon className="text-gray-500  mr-2 flex-shrink-0 h-4 w-4" aria-hidden="true" />
        {node.name}
      </div>
      {expanded && <FileTree {...{ node, indent: indent + 1, ...rest }} />}
    </>
  )
}

function RootFolderDropZone({ children }: PropsWithChildren<{}>) {
  return <div className="min-h-10 flex-1">{children}</div>
}

const filesToNodes = (files: string[]) => {
  const cwd = fileStore.cwd.get()
  const baseFolder = cwd.split('/').slice(-1)[0]
  const tree: NodeData = {
    name: baseFolder,
    type: 'folder',
    children: [],
    path: '',
  }
  files.forEach((f) => {
    const path = f.split('/')
    let node = tree
    for (let i = 0; i < path.length - 1; i++) {
      const name = path[i]
      let child = node.children?.find((c) => c.name === name)
      if (!child) {
        child = {
          name,
          type: 'folder',
          children: [],
          path: path.slice(0, i + 1).join('/'),
        }
        node.children?.push(child)
      }
      node = child
    }
    node.children?.push({
      name: path[path.length - 1],
      type: 'file',
      path: f,
    })
  })
  return tree
}
