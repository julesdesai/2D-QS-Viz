// src/components/Graph/CanvasGraph.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Stage, Layer, Group, Circle } from 'react-konva';
import CanvasNode from './CanvasNode';
import CanvasConnections from './CanvasConnections';
import ContentPanel from '../UI/ContentPanel';
import AncestryPanel from '../UI/AncestryPanel';
import { 
  computeGraphLayout, 
  detectAndResolveCollisions, 
  normalizeLayout,
  addSpacingBetweenNodes 
} from '../../lib/graphLayout';

const CanvasGraph = ({ data }) => {
  // Add debug logging to track graph rendering state
  useEffect(() => {
    if (data) {
      console.log('CanvasGraph received data:', data);
      console.log('Number of nodes in data:', Object.keys(data).length);
    }
  }, [data]);

  const [activePath, setActivePath] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [connections, setConnections] = useState([]);
  const [nodePositions, setNodePositions] = useState({});
  const [layoutComputed, setLayoutComputed] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  
  const [scale, setScale] = useState(0.7);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [viewportBounds, setViewportBounds] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  
  // Debug logging for layout computation
  useEffect(() => {
    if (layoutComputed) {
      console.log('Layout computed!');
      console.log('Number of positioned nodes:', Object.keys(nodePositions).length);
      
      // Get a sample of node positions to verify they look reasonable
      const nodeKeys = Object.keys(nodePositions);
      if (nodeKeys.length > 0) {
        console.log('Sample node positions:');
        for (let i = 0; i < Math.min(3, nodeKeys.length); i++) {
          const nodeId = nodeKeys[i];
          console.log(`  Node ${nodeId}:`, nodePositions[nodeId]);
        }
      } else {
        console.error('No nodes positioned after layout computation!');
      }
    }
  }, [layoutComputed, nodePositions]);

  // Find the root node
  const rootNode = Object.entries(data || {}).find(([_, node]) => node.parent_id === null);
  const rootId = rootNode ? rootNode[0] : null;
  
  // Create a stable reference for findPath
  const findPath = useCallback((targetId, path = []) => {
    if (!targetId) return path;
    const node = data[targetId];
    if (!node) return path;
    return findPath(node.parent_id, [targetId, ...path]);
  }, [data]);

  // Calculate which nodes are visible in the current viewport
  const getVisibleNodes = useCallback(() => {
    if (!nodePositions || !stageRef.current || !layoutComputed) {
      return [];
    }
    
    const stage = stageRef.current;
    if (!stage) return [];
    
    // Calculate viewport bounds with padding for smoother panning
    const padding = 2000 / scale; // Add more padding when zoomed out
    const vpBounds = {
      x: -stagePos.x / scale - padding,
      y: -stagePos.y / scale - padding,
      width: (stage.width() / scale) + (padding * 2),
      height: (stage.height() / scale) + (padding * 2),
    };
    
    // Only update viewportBounds if it changed significantly to prevent render loops
    const boundsChanged = 
      Math.abs(vpBounds.x - viewportBounds.x) > 100 || 
      Math.abs(vpBounds.y - viewportBounds.y) > 100 || 
      Math.abs(vpBounds.width - viewportBounds.width) > 100 || 
      Math.abs(vpBounds.height - viewportBounds.height) > 100;
      
    if (boundsChanged) {
      setViewportBounds(vpBounds);
    }
    
    // Actually filter nodes by viewport for better performance
    return Object.entries(nodePositions)
      .filter(([nodeId, pos]) => {
        // Skip filtering for very zoomed out views (show all nodes)
        if (scale < 0.05) return true;
        
        // Node dimensions (estimate)
        const nodeWidth = 400;
        const nodeHeight = 200;
        
        // Check if node is in viewport with padding
        return (
          pos.x + nodeWidth/2 >= vpBounds.x &&
          pos.x - nodeWidth/2 <= vpBounds.x + vpBounds.width &&
          pos.y + nodeHeight/2 >= vpBounds.y &&
          pos.y - nodeHeight/2 <= vpBounds.y + vpBounds.height
        );
      })
      .map(([nodeId, pos]) => ({
        id: nodeId,
        ...pos
      }));
  }, [nodePositions, stagePos, scale, layoutComputed, viewportBounds]);

  // Get visible nodes based on current viewport - memoized to prevent recalculation on every render
  const visibleNodes = useMemo(() => {
    return getVisibleNodes();
  }, [getVisibleNodes]);

  // Helper function to create a curved path for identity connections - based on original
  const calculateIdenticalPath = (start, end) => {
    // Calculate midpoint
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    // Determine if this is more horizontal or vertical
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const isMoreHorizontal = Math.abs(dx) > Math.abs(dy);
    
    // For horizontal lines, create a more pronounced curve
    if (isMoreHorizontal) {
      // Create a strong arc for horizontal connections
      const arcHeight = Math.abs(dx) * 0.3;
      
      // Alternating up/down arcs based on node positions to avoid overlapping arcs
      // This creates a somewhat randomized pattern but predictable for the same nodes
      const nodeIdSum = parseInt(String(start.x) + String(start.y));
      const arcDirection = (nodeIdSum % 2 === 0) ? 1 : -1;
      
      // Create arc control point
      const controlPoint = {
        x: midX,
        y: midY + (arcHeight * arcDirection)
      };
      
      // For very long horizontal lines, use multiple control points
      if (Math.abs(dx) > 2000) {
        return [
          start,
          {
            x: start.x + dx * 0.25,
            y: start.y + dy * 0.25 + (arcHeight * arcDirection * 0.7)
          },
          controlPoint,
          {
            x: start.x + dx * 0.75,
            y: start.y + dy * 0.75 + (arcHeight * arcDirection * 0.7)
          },
          end
        ];
      }
      
      return [start, controlPoint, end];
    }
    
    // For vertical or diagonal connections, use a simpler curve
    // Create a moderate curve perpendicular to the connection line
    const perpX = -dy / distance * distance * 0.3;
    const perpY = dx / distance * distance * 0.3;
    
    const controlPoint = {
      x: midX + perpX,
      y: midY + perpY
    };
    
    return [start, controlPoint, end];
  };

  // Utility function for creating connections - adapted from original
  const createConnections = useCallback(() => {
    if (!data || !layoutComputed || !nodePositions) {
      return [];
    }
    
    const newConnections = [];
    
    // Create connections for all parent-child relationships
    Object.entries(data).forEach(([childId, node]) => {
      const parentId = node.parent_id;
      
      // Skip root node (as it has no parent)
      if (!parentId) return;
      
      // Skip if either node position is not available
      if (!nodePositions[parentId] || !nodePositions[childId]) {
        return;
      }
      
      // Create connection based on the computed layout positions
      const sourcePos = {
        x: nodePositions[parentId].x,
        y: nodePositions[parentId].y
      };
      
      const targetPos = {
        x: nodePositions[childId].x,
        y: nodePositions[childId].y
      };
      
      // Create the connection
      newConnections.push({
        from: sourcePos,
        to: targetPos,
        sourceId: parentId,
        targetId: childId,
        isReason: node.node_type === 'reason',
        isIdentical: false
      });
    });
    
    // Create connections for identical nodes
    Object.entries(data).forEach(([nodeId, node]) => {
      // Check if this node is identical to another node
      if (node.identical_to) {
        const identicalToId = node.identical_to;
        
        // Skip if either node position is not available
        if (!nodePositions[identicalToId] || !nodePositions[nodeId]) {
          return;
        }
        
        // Create connection based on the computed layout positions
        const sourcePos = {
          x: nodePositions[nodeId].x,
          y: nodePositions[nodeId].y
        };
        
        const targetPos = {
          x: nodePositions[identicalToId].x,
          y: nodePositions[identicalToId].y
        };
        
        // Calculate the path with pronounced curves
        const points = calculateIdenticalPath(sourcePos, targetPos);
        
        // Create the identical connection
        newConnections.push({
          from: sourcePos,
          to: targetPos,
          sourceId: nodeId,
          targetId: identicalToId,
          isReason: false,
          isIdentical: true,
          points: points
        });
      }
    });
    
    return newConnections;
  }, [data, layoutComputed, nodePositions]);

  // Update connections
  const updateConnections = useCallback(() => {
    const newConnections = createConnections();
    setConnections(newConnections);
  }, [createConnections]);

  // Handle node click
  const handleNodeClick = useCallback((nodeId) => {
    if (!data[nodeId]) return;
    
    const newPath = findPath(nodeId);
    setActivePath(newPath);
    setSelectedNode(data[nodeId]);
    
    // Update connections after changing selection
    setTimeout(() => {
      updateConnections();
    }, 10);
  }, [data, findPath, updateConnections]);

  // Compute optimal layout for the graph
  useEffect(() => {
    if (!data || Object.keys(data).length === 0 || layoutComputed) return;
    
    console.log('Computing optimal graph layout...');
    try {
      // Compute layout using the parent-centered approach that stacks reasons directly above parents
      const initialLayout = computeGraphLayout(data);
      
      // Detect and resolve any remaining collisions
      //const resolvedLayout = detectAndResolveCollisions(initialLayout, data, 650, 450);
      
      // Apply additional spacing to prevent overlaps
     // const spacedLayout = addSpacingBetweenNodes(resolvedLayout, 1.2);
      
      // Normalize layout to fit within view
      const { positions: normalizedLayout } = normalizeLayout(initialLayout);
      
      setNodePositions(normalizedLayout);
      setLayoutComputed(true);
      
      // Find and select question node (but don't display it)
      const questionNode = Object.entries(data).find(([_, node]) => node.node_type === 'question');
      if (questionNode && !selectedNode) {
        handleNodeClick(questionNode[0]);
      }
    } catch (err) {
      console.error('Error computing layout:', err);
    }
  }, [data, selectedNode, handleNodeClick, layoutComputed]);

  // Initial view setup
  useEffect(() => {
    if (!containerRef.current || !layoutComputed || !stageRef.current) {
      console.log('Cannot setup initial view - missing dependencies', {
        hasContainerRef: !!containerRef.current,
        layoutComputed,
        hasStageRef: !!stageRef.current
      });
      return;
    }
    
    console.log('Setting up initial view');
    
    // Center the graph in the view
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    console.log('Container dimensions:', { width: containerWidth, height: containerHeight });
    
    // Calculate center of all nodes
    const nodePositionArray = Object.values(nodePositions);
    if (nodePositionArray.length > 0) {
      const sumX = nodePositionArray.reduce((sum, pos) => sum + pos.x, 0);
      const sumY = nodePositionArray.reduce((sum, pos) => sum + pos.y, 0);
      const centerX = sumX / nodePositionArray.length;
      const centerY = sumY / nodePositionArray.length;
      
      console.log('Calculated center of all nodes:', { x: centerX, y: centerY });
      
      // Set extremely zoomed out view to see all nodes
      const initialScale = 0.02; // Very zoomed out
      
      // Position the stage to center on the nodes
      setStagePos({
        x: containerWidth / 2 - centerX * initialScale,
        y: containerHeight / 2 - centerY * initialScale
      });
      
      // Start with a very zoomed out view
      setScale(initialScale);
      
      console.log('Initial stage position:', { 
        x: containerWidth / 2 - centerX * initialScale, 
        y: containerHeight / 2 - centerY * initialScale 
      });
      console.log('Initial scale:', initialScale);
    } else {
      // Fallback if no nodes are positioned
      setStagePos({
        x: containerWidth / 2,
        y: containerHeight / 2
      });
      setScale(0.1);
    }
    
    // Add a slight delay to ensure nodes are positioned before updating connections
    const timer = setTimeout(() => {
      console.log('Updating connections after initial setup');
      updateConnections();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [layoutComputed, updateConnections, nodePositions]);

  // Update connections when nodePositions change
  useEffect(() => {
    if (layoutComputed && nodePositions) {
      updateConnections();
    }
  }, [nodePositions, layoutComputed, updateConnections]);

  // Handle zoom with wheel
  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    
    const MIN_SCALE = 0.01;
    const MAX_SCALE = 3;
    
    const oldScale = scale;
    const pointer = stageRef.current.getPointerPosition();
    
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    
    // Calculate new scale with zoom speed adjustment
    const newScale = Math.min(
      Math.max(
        oldScale + (e.evt.deltaY * -0.001 * oldScale),
        MIN_SCALE
      ),
      MAX_SCALE
    );
    
    // Calculate new position
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    
    // Update state in one batch to prevent multiple rerenders
    setScale(newScale);
    setStagePos(newPos);
  }, [scale, stagePos]);

  // Update connections after zooming or panning completes
  useEffect(() => {
    if (isDragging) return;
    
    const timer = setTimeout(() => {
      updateConnections();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isDragging, updateConnections]);

  // Get window dimensions for the stage
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Update window size on resize
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="h-screen w-full flex bg-white">
      <div 
        className="relative flex-1 overflow-hidden bg-gray-100" /* Added bg color for visibility */
        ref={containerRef}
      >
        {/* Main graph area */}
        <Stage
          ref={stageRef}
          width={isPanelVisible ? windowSize.width * 0.67 : windowSize.width}
          height={windowSize.height}
          draggable
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
          onDragMove={(e) => {
            setStagePos(e.target.position());
          }}
          onWheel={handleWheel}
          position={stagePos}
          scale={{ x: scale, y: scale }}
          style={{ border: '2px solid blue' }} /* Added border for debugging */
        >
          <Layer>
            {/* Simpler debug indicators */}
            <Group>
              {/* Origin marker */}
              <Circle 
                x={0} 
                y={0} 
                radius={50} 
                fill="red" 
              />
            </Group>
            
            {/* Connection lines */}
            {connections.length > 0 && (
              <CanvasConnections 
                connections={connections} 
                viewportBounds={viewportBounds}
              />
            )}
            
            {/* Render nodes with optimized visibility check */}
            {visibleNodes.map(node => {
              const nodeId = node.id;
              
              // Skip question nodes and make sure data exists
              if (!data[nodeId] || data[nodeId].node_type === 'question') return null;
              
              return (
                <CanvasNode
                  key={nodeId}
                  id={nodeId}
                  x={node.x}
                  y={node.y}
                  data={data}
                  onNodeClick={handleNodeClick}
                  activePath={activePath}
                  isSelected={selectedNode?.id === nodeId}
                />
              );
            })}
            
            {/* Connection lines - temporarily disabled for troubleshooting */}
            {/* {connections.length > 0 && (
              <CanvasConnections 
                connections={connections} 
                viewportBounds={viewportBounds}
              />
            )} */}
          </Layer>
        </Stage>
        
        {/* Toggle panel button */}
        <button
          className="fixed top-5 right-5 bg-white border border-gray-200 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-50 text-sm z-10 shadow-md"
          onClick={() => setIsPanelVisible(!isPanelVisible)}
        >
          {isPanelVisible ? '≫ Hide Panel' : '≪ Show Panel'}
        </button>
        
        {/* Controls */}
        <div className="fixed bottom-5 left-5 bg-white p-4 rounded-lg shadow-lg z-10 flex flex-col gap-2">
          <div className="text-sm font-medium text-gray-700">Navigation Controls</div>
          <div className="text-xs text-gray-600">Click and drag to pan</div>
          <div className="text-xs text-gray-600">Scroll to zoom in/out</div>
          <div className="flex gap-2 mt-2">
            <button 
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-sm"
              onClick={() => setScale(prev => Math.min(prev + 0.1, 3))}
            >
              +
            </button>
            <button 
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-sm"
              onClick={() => setScale(prev => Math.max(prev - 0.1, 0.1))}
            >
              -
            </button>
            <button 
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-sm"
              onClick={() => {
                if (containerRef.current) {
                  const containerWidth = containerRef.current.clientWidth;
                  const containerHeight = containerRef.current.clientHeight;
                  setStagePos({
                    x: containerWidth / 2,
                    y: containerHeight / 2
                  });
                  setScale(0.7);
                  
                  // Update connections after reset
                  setTimeout(() => {
                    updateConnections();
                  }, 100);
                }
              }}
            >
              Reset
            </button>
            <button 
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm ml-2"
              onClick={() => {
                if (containerRef.current && nodePositions && Object.keys(nodePositions).length > 0) {
                  const containerWidth = containerRef.current.clientWidth;
                  const containerHeight = containerRef.current.clientHeight;
                  
                  // Calculate bounds of all nodes
                  const nodePositionArray = Object.values(nodePositions);
                  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                  
                  nodePositionArray.forEach(pos => {
                    minX = Math.min(minX, pos.x);
                    minY = Math.min(minY, pos.y);
                    maxX = Math.max(maxX, pos.x);
                    maxY = Math.max(maxY, pos.y);
                  });
                  
                  // Calculate center and size of graph
                  const centerX = (minX + maxX) / 2;
                  const centerY = (minY + maxY) / 2;
                  const graphWidth = maxX - minX + 500; // Add padding
                  const graphHeight = maxY - minY + 500;
                  
                  // Calculate appropriate scale to fit graph
                  const scaleX = containerWidth / graphWidth;
                  const scaleY = containerHeight / graphHeight;
                  const newScale = Math.min(scaleX, scaleY, 1) * 0.9; // Slightly smaller to ensure fit
                  
                  // Set new position and scale
                  setStagePos({
                    x: containerWidth / 2 - centerX * newScale,
                    y: containerHeight / 2 - centerY * newScale
                  });
                  setScale(newScale);
                  
                  console.log('Zoom to fit:', {
                    bounds: { minX, minY, maxX, maxY },
                    center: { centerX, centerY },
                    graphSize: { width: graphWidth, height: graphHeight },
                    newScale
                  });
                  
                  // Update connections after zooming
                  setTimeout(() => {
                    updateConnections();
                  }, 100);
                }
              }}
            >
              Zoom to Fit
            </button>
          </div>
          <div className="text-xs text-gray-600 mt-2">
            Rendering {visibleNodes.length} of {Object.keys(nodePositions).length} nodes
          </div>
          <div className="text-xs text-gray-600">
            Data loaded: {data ? Object.keys(data).length : 0} nodes
          </div>
          <div className="text-xs text-gray-600">
            Layout computed: {layoutComputed ? 'Yes' : 'No'}
          </div>
        </div>
      </div>
      
      {/* Side panel with toggle functionality */}
      {/* Side panel with balanced heights */}
      {selectedNode && isPanelVisible && (
        <div className="w-1/3 flex flex-col h-screen border-l border-gray-200 bg-gray-50 overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            <ContentPanel node={selectedNode} />
          </div>
          <div className="flex-1 overflow-hidden px-4 pt-4 pb-6">
            <AncestryPanel node={selectedNode} graphData={data} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasGraph;