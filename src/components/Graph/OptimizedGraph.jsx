// src/components/Graph/OptimizedGraph.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import EnhancedNode from './EnhancedNode';
import GraphConnections from './GraphConnections';
import ContentPanel from '../UI/ContentPanel';
import AncestryPanel from '../UI/AncestryPanel';
import { useCoordinateSystem } from '../../hooks/useCoordinateSystem';
import { Vector2D, NodeBounds } from '../../lib/CoordinateSystem';
import { getUserModifiedGraph } from '../../firebase';
import { 
  computeGraphLayout, 
  detectAndResolveCollisions, 
  normalizeLayout,
  addSpacingBetweenNodes 
} from '../../lib/graphLayout';

const OptimizedGraph = ({ data: initialData }) => {
  const [activePath, setActivePath] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [connections, setConnections] = useState([]);
  const [nodePositions, setNodePositions] = useState({});
  const [layoutComputed, setLayoutComputed] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [isLiveRefresh, setIsLiveRefresh] = useState(false);
  const [data, setData] = useState(initialData);
  
  const containerRef = useRef(null);
  const [containerOffset, setContainerOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.7);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Store node DOM elements by ID
  const nodeRefs = useRef({});
  const circleRefs = useRef({});
  const lastViewportRef = useRef({ offset: { x: 0, y: 0 }, scale: 0.7 });
  const selectedGraphRef = useRef(null);

  // Initialize coordinate system
  const {
    updateNodeBounds,
    updateTransform,
    resetConnections
  } = useCoordinateSystem(data);

  const MIN_SCALE = 0.1;
  const MAX_SCALE = 3;

  // Find the root node
  const rootNode = Object.entries(data || {}).find(([_, node]) => node.parent_id === null);
  // eslint-disable-next-line no-unused-vars
  const rootId = rootNode ? rootNode[0] : null;
  
  // Create a stable reference for findPath
  const findPath = useCallback((targetId, path = []) => {
    if (!targetId) return path;
    const node = data[targetId];
    if (!node) return path;
    return findPath(node.parent_id, [targetId, ...path]);
  }, [data]);


// Helper function to create a curved path for identity connections - DEFINED FIRST
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

// Utility function for creating connections - DEFINED SECOND
const createConnections = () => {
  if (!data || !layoutComputed || !nodePositions) {
    console.log("Cannot create connections - missing data:", {
      hasData: !!data,
      layoutComputed,
      hasNodePositions: !!nodePositions
    });
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
      console.log(`Missing node position for connection ${parentId} -> ${childId}`);
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
        console.log(`Missing node position for identical connection ${nodeId} -> ${identicalToId}`);
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
  
  console.log(`Created ${newConnections.length} connections`);
  return newConnections;
};

  // Function to update connections - using useRef for stable reference
  const updateConnectionsRef = useRef(() => {
    console.log("Updating connections with:", {
      hasData: !!data,
      layoutComputed,
      numPositions: nodePositions ? Object.keys(nodePositions).length : 0
    });
    
    const newConnections = createConnections();
    setConnections(newConnections);
  });
  
  // Make sure updateConnectionsRef.current uses the latest state/props
  useEffect(() => {
    updateConnectionsRef.current = () => {
      console.log("Updating connections with latest state:", {
        hasData: !!data,
        layoutComputed,
        numPositions: nodePositions ? Object.keys(nodePositions).length : 0 
      });
      
      const newConnections = createConnections();
      if (newConnections.length > 0) {
        console.log(`Setting ${newConnections.length} connections`);
        setConnections(newConnections);
      } else {
        console.warn("No connections created!");
      }
    };
  }, [data, layoutComputed, nodePositions, createConnections]);

  // Handle node click
  const handleNodeClick = useCallback((nodeId) => {
    if (!data[nodeId]) return;
    
    const newPath = findPath(nodeId);
    setActivePath(newPath);
    setSelectedNode(data[nodeId]);
    
    // Use the ref version for stable reference
    setTimeout(() => {
      updateConnectionsRef.current();
    }, 10);
  }, [data, findPath]);

  // Save reference to node circle element
  const saveCircleRef = useCallback((id, element) => {
    if (element) {
      circleRefs.current[id] = element;
    }
  }, []);

  // Live refresh polling
  useEffect(() => {
    let intervalId;
    
    if (isLiveRefresh && selectedGraphRef.current) {
      console.log('Starting live refresh polling...');
      intervalId = setInterval(async () => {
        try {
          console.log('Live refresh: Fetching new data...');
          // Fetch new data
          const newData = await getUserModifiedGraph(selectedGraphRef.current);
          console.log('Live refresh: Received new data:', {
            nodeCount: Object.keys(newData).length,
            currentDataCount: Object.keys(data).length
          });
          
          // Only update if data has changed
          if (JSON.stringify(newData) !== JSON.stringify(data)) {
            console.log('Live refresh: Data has changed, updating...');
            // Store current viewport state
            const currentViewport = lastViewportRef.current;
            console.log('Live refresh: Current viewport state:', currentViewport);
            
            // Update data while preserving viewport
            setData(newData);
            setContainerOffset(currentViewport.offset);
            setScale(currentViewport.scale);
            setLayoutComputed(false); // Force layout recomputation
            console.log('Live refresh: State updates queued');
          } else {
            console.log('Live refresh: No data changes detected');
          }
        } catch (error) {
          console.error('Error in live refresh:', error);
        }
      }, 5000); // Poll every 5 seconds
    }
    
    return () => {
      if (intervalId) {
        console.log('Cleaning up live refresh interval');
        clearInterval(intervalId);
      }
    };
  }, [isLiveRefresh, data]);

  // Compute layout when data changes
  useEffect(() => {
    if (!data || Object.keys(data).length === 0) {
      console.log('Layout computation skipped: No data available');
      return;
    }
    
    console.log('Computing optimal graph layout...', {
      dataNodeCount: Object.keys(data).length,
      currentLayoutComputed: layoutComputed,
      isLiveRefresh
    });
    
    try {
      // Compute layout using the parent-centered approach that stacks reasons directly above parents
      const initialLayout = computeGraphLayout(data);
      console.log('Initial layout computed:', {
        nodeCount: Object.keys(initialLayout).length
      });
      
      // Detect and resolve any remaining collisions
      const resolvedLayout = detectAndResolveCollisions(initialLayout, data, 650, 450);
      console.log('Collisions resolved');
      
      // Apply additional spacing to prevent overlaps
      const spacedLayout = addSpacingBetweenNodes(resolvedLayout, 1.2);
      console.log('Spacing applied');
      
      // Normalize layout to fit within view
      const { positions: normalizedLayout } = normalizeLayout(spacedLayout);
      console.log('Layout normalized:', {
        nodeCount: Object.keys(normalizedLayout).length
      });
      
      // If we're in live refresh mode, try to maintain node positions as much as possible
      if (isLiveRefresh && Object.keys(nodePositions).length > 0) {
        console.log('Live refresh: Adjusting layout to maintain positions');
        // For each node in the new layout, try to find a similar position in the old layout
        const adjustedLayout = { ...normalizedLayout };
        Object.entries(normalizedLayout).forEach(([nodeId, newPos]) => {
          if (nodePositions[nodeId]) {
            // If the node existed before, try to keep it close to its old position
            const oldPos = nodePositions[nodeId];
            adjustedLayout[nodeId] = {
              x: oldPos.x + (newPos.x - oldPos.x) * 0.3, // Blend old and new positions
              y: oldPos.y + (newPos.y - oldPos.y) * 0.3
            };
          }
        });
        console.log('Live refresh: Layout adjusted', {
          adjustedNodeCount: Object.keys(adjustedLayout).length
        });
        setNodePositions(adjustedLayout);
      } else {
        console.log('Setting new node positions:', {
          nodeCount: Object.keys(normalizedLayout).length
        });
        setNodePositions(normalizedLayout);
      }
      
      setLayoutComputed(true);
      console.log('Layout computation complete');
      
      // Find and select question node (but don't display it)
      const questionNode = Object.entries(data).find(([_, node]) => node.node_type === 'question');
      if (questionNode && !selectedNode) {
        console.log('Selecting question node:', questionNode[0]);
        handleNodeClick(questionNode[0]);
      }
    } catch (err) {
      console.error('Error computing layout:', err);
    }
  }, [data, selectedNode, handleNodeClick, isLiveRefresh, nodePositions]);

  // Update node references for position tracking
  const handleNodeRef = useCallback((id, element) => {
    if (!element || !(element instanceof HTMLElement) || !layoutComputed) return;
    
    // Store reference to node element
    nodeRefs.current[id] = element;
  
    const updateNodePosition = () => {
      try {
        const rect = element.getBoundingClientRect();
        
        // Find the image part for connecting lines (or fall back to center of node)
        const imageElement = element.querySelector('.node-circle');
        let position;
        
        if (imageElement) {
          const imageRect = imageElement.getBoundingClientRect();
          position = new Vector2D(
            imageRect.left + imageRect.width / 2,
            imageRect.top + imageRect.height / 2
          );
        } else {
          position = new Vector2D(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
          );
        }
        
        const nodeBounds = new NodeBounds(
          position,
          rect.width,
          rect.height
        );
        
        updateNodeBounds(id, nodeBounds);
      } catch (error) {
        console.error('Error updating node position:', error);
      }
    };
  
    // Use ResizeObserver to track size/position changes
    const observer = new ResizeObserver(updateNodePosition);
    observer.observe(element);
  
    // Initial position update
    requestAnimationFrame(updateNodePosition);
  
    return () => observer.disconnect();
  }, [updateNodeBounds, layoutComputed]);

  // Update transform when scale or offset changes
  useEffect(() => {
    updateTransform(scale, containerOffset);
    
    // Schedule connection update after transform update
    if (layoutComputed) {
      const timer = setTimeout(() => {
        updateConnectionsRef.current();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [scale, containerOffset, updateTransform, layoutComputed]);

  // Update connections when nodePositions change
  useEffect(() => {
    if (layoutComputed && nodePositions) {
      updateConnectionsRef.current();
    }
  }, [nodePositions, layoutComputed]);

  // Initial view setup
  useEffect(() => {
    if (!containerRef.current || !layoutComputed) return;
    
    // Center the graph in the view
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    setContainerOffset({
      x: containerWidth / 2,
      y: containerHeight / 4 // Position toward the top to see more of the vertical structure
    });
    
    setScale(0.25); // Zoom out more to see the increased vertical spacing
    
    resetConnections();
    
    // Add a slight delay to ensure nodes are positioned before updating connections
    const timer = setTimeout(() => {
      updateConnectionsRef.current();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [layoutComputed, resetConnections]);

  // Handle zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(scale + delta, MIN_SCALE), MAX_SCALE);
    
    const container = containerRef.current;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;
    
    const scaleChange = newScale / scale;
    
    // Zoom centered on cursor position
    const newX = x - (x - containerOffset.x) * scaleChange;
    const newY = y - (y - containerOffset.y) * scaleChange;
    
    setScale(newScale);
    setContainerOffset({ x: newX, y: newY });
  };

  // Handle panning
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - containerOffset.x,
      y: e.clientY - containerOffset.y
    });
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setContainerOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Update connections after zooming or panning completes
  useEffect(() => {
    if (isDragging) return;
    
    const timer = setTimeout(() => {
      updateConnectionsRef.current();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isDragging]);

  // Set up mouse event listeners
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove]);

  // Store current viewport state before updates
  useEffect(() => {
    if (!isDragging) {
      lastViewportRef.current = {
        offset: { ...containerOffset },
        scale
      };
    }
  }, [containerOffset, scale, isDragging]);

  // Update selectedGraphRef when initialData changes
  useEffect(() => {
    if (initialData) {
      // Find the graph ID by looking for a node with parent_id === null
      const rootNode = Object.entries(initialData).find(([_, node]) => node.parent_id === null);
      if (rootNode) {
        selectedGraphRef.current = rootNode[0];
      }
    }
  }, [initialData]);

  // Add debug logging for node rendering
  const renderNodes = () => {
    if (!layoutComputed || !nodePositions) {
      console.log('Skipping node render:', {
        layoutComputed,
        hasNodePositions: !!nodePositions
      });
      return null;
    }

    console.log('Rendering nodes:', {
      nodePositionCount: Object.keys(nodePositions).length,
      dataNodeCount: Object.keys(data).length
    });

    return Object.entries(nodePositions).map(([nodeId, position]) => {
      // Skip the question node
      if (data[nodeId]?.node_type === 'question') {
        return null;
      }
      
      console.log('Rendering node:', {
        nodeId,
        position,
        hasData: !!data[nodeId]
      });
      
      return (
        <div
          key={nodeId}
          style={{
            position: 'absolute',
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: 'translate(-50%, -50%)', // Center the node
          }}
        >
          <EnhancedNode
            id={nodeId}
            data={data}
            onNodeClick={handleNodeClick}
            activePath={activePath}
            onNodeRef={handleNodeRef}
            onCircleRef={(element) => saveCircleRef(nodeId, element)}
          />
        </div>
      );
    });
  };

  return (
    <div className="h-screen w-full flex bg-white">
      <div className="relative flex-1 overflow-hidden">
        {/* Main graph area */}
        <div 
          className="absolute inset-0"
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          {/* Connection lines and nodes */}
          <div
            className="w-full h-full"
            style={{ 
              transform: `translate(${containerOffset.x}px, ${containerOffset.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              position: 'relative'
            }}
          >
            {/* Connection lines - rendered before nodes to be underneath */}
            {connections.length > 0 && <GraphConnections connections={connections} />}
            
            {/* Render nodes based on computed positions */}
            {renderNodes()}
          </div>
          
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
                onClick={() => setScale(prev => Math.min(prev + 0.1, MAX_SCALE))}
              >
                +
              </button>
              <button 
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-sm"
                onClick={() => setScale(prev => Math.max(prev - 0.1, MIN_SCALE))}
              >
                -
              </button>
              <button 
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-sm"
                onClick={() => {
                  if (containerRef.current) {
                    const containerWidth = containerRef.current.clientWidth;
                    const containerHeight = containerRef.current.clientHeight;
                    setContainerOffset({
                      x: containerWidth / 2,
                      y: containerHeight / 2
                    });
                    setScale(0.7);
                    
                    // Update connections after reset
                    setTimeout(() => {
                      updateConnectionsRef.current();
                    }, 100);
                  }
                }}
              >
                Reset
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="liveRefresh"
                checked={isLiveRefresh}
                onChange={(e) => setIsLiveRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="liveRefresh" className="text-sm text-gray-700">
                Live refresh
              </label>
            </div>
          </div>
        </div>
      </div>
      
      {/* Side panel with toggle functionality */}
      {selectedNode && isPanelVisible && (
        <div className="w-1/3 flex flex-col h-screen border-l border-gray-200 bg-white transition-all duration-300">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-serif text-gray-800">{selectedNode.summary}</h2>
            <div className="flex gap-2 mt-2">
              <div className="text-xs px-2 py-1 bg-gray-200 rounded-full text-gray-700">
                {selectedNode.node_type}
              </div>
              {selectedNode.nonsense && (
                <div className="text-xs px-2 py-1 bg-red-100 rounded-full text-red-700">
                  Nonsense
                </div>
              )}
              {selectedNode.identical_to && (
                <div className="text-xs px-2 py-1 bg-blue-100 rounded-full text-blue-700">
                  Identical to another node
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-6">
            <div className="prose max-w-none">
              <ContentPanel node={selectedNode} />
            </div>
          </div>
          
          <div className="h-1/3 border-t border-gray-200 overflow-auto">
            <div className="p-4 bg-gray-50">
              <h3 className="text-lg font-serif text-gray-800">Ancestry Path</h3>
            </div>
            <div className="p-4">
              <AncestryPanel node={selectedNode} graphData={data} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptimizedGraph;