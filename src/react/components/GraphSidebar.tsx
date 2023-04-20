import React from 'react'
import { Graph, GraphConfiguration } from 'react-d3-graph'

interface GraphSidebarProps {
  graphData: GraphData
}
interface Node {
  id: string
  label: string
  type: string
  // add any other properties specific to your use case
}

interface Link {
  source: string
  target: string
  // add any other properties specific to your use case
}

interface GraphData {
  nodes: Node[]
  links: Link[]
}

const GraphSidebar: React.FC<GraphSidebarProps> = ({ graphData }) => {
  const config: Partial<GraphConfiguration<Node, Link>> = {
    nodeHighlightBehavior: true,
    node: {
      color: 'lightgreen',
      size: 400,
      highlightStrokeColor: 'blue',
    },
    link: {
      highlightColor: 'lightblue',
    },
  }

  const onClickNode = function (nodeId: any) {
    window.alert(`Clicked node ${nodeId}`)
  }

  const onClickLink = function (source: any, target: any) {
    window.alert(`Clicked link between ${source} and ${target}`)
  }

  return (
    <div>
      <Graph
        id="graph-id"
        data={graphData}
        config={config}
        onClickNode={onClickNode}
        onClickLink={onClickLink}
      />
    </div>
  )
}

export default GraphSidebar
