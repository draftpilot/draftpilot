import React from 'react';
import { Graph } from 'react-d3-graph';

interface GraphSidebarProps {
  graphData: any;
}

const GraphSidebar: React.FC<GraphSidebarProps> = ({ graphData }) => {
  const config = {
    nodeHighlightBehavior: true,
    node: {
      color: 'lightgreen',
      size: 120,
      highlightStrokeColor: 'blue',
    },
    link: {
      highlightColor: 'lightblue',
    },
  };

  const onClickNode = function(nodeId: any) {
    window.alert(`Clicked node ${nodeId}`);
  };

  const onClickLink = function(source: any, target: any) {
    window.alert(`Clicked link between ${source} and ${target}`);
  };

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
  );
};

export default GraphSidebar;