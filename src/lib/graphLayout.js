// src/lib/graphLayout.js

/**
 * A specialized layout algorithm for dialectical graphs with the structure:
 * Question → Thesis nodes (level 0)
 * Antithesis nodes (level -1)
 * Synthesis nodes (level -2)
 * And so on...
 * 
 * Reasons are stacked vertically above their parent thesis nodes.
 */

// Layout constants - optimized for better vertical separation
const CONSTANTS = {
  // Horizontal spacing between nodes at the same level
  HORIZONTAL_GAP: 650,
  
  // Vertical spacing between levels - significantly increased for better separation
  VERTICAL_GAP: 700,
  
  // Reason positioning (above thesis nodes)
  REASON_VERTICAL_OFFSET: -450, // Initial offset from parent for first reason
  REASON_VERTICAL_STACK_GAP: 450, // Gap between stacked reasons
  
  // Initial positioning
  INITIAL_X: 800,
  INITIAL_Y: 400
};

/**
 * Computes the optimal layout for a dialectical graph using a parent-centered approach
 * @param {Object} data - The graph data
 * @returns {Object} The computed node positions
 */
export const computeGraphLayout = (data) => {
  if (!data || Object.keys(data).length === 0) return {};
  
  // Find the root question node
  const rootNode = Object.entries(data).find(([_, node]) => node.parent_id === null);
  if (!rootNode) return {};
  
  const [rootId] = rootNode;
  
  // Build a tree representation of the graph
  const graphTree = buildGraphTree(data, rootId);
  
  // Calculate subtree sizes (needed for centering)
  calculateTreeSizes(graphTree, data);
  
  // Position nodes
  const positions = {};
  positionNodesRecursive(graphTree, positions, data, CONSTANTS.INITIAL_X, CONSTANTS.INITIAL_Y);
  
  // Note: optimizeIdenticalNodesLayout call removed
  
  return positions;
};

/**
 * Builds a tree representation of the graph for hierarchical layout
 */
const buildGraphTree = (data, rootId) => {
  const tree = {
    id: rootId,
    children: [],
    reasons: [],
    width: 0 // Will be calculated later
  };
  
  // Function to recursively build the tree
  const buildSubtree = (nodeId, parent) => {
    // Get children (excluding reasons)
    const nonReasonChildren = Object.entries(data)
      .filter(([_, node]) => 
        node.parent_id === nodeId && 
        node.node_type !== 'reason')
      .map(([id]) => id);
    
    // Get reason children
    const reasonChildren = Object.entries(data)
      .filter(([_, node]) => 
        node.parent_id === nodeId && 
        node.node_type === 'reason')
      .map(([id]) => id);
    
    // Add reasons directly to parent node
    parent.reasons = reasonChildren;
    
    // Process non-reason children
    for (const childId of nonReasonChildren) {
      const childNode = {
        id: childId,
        children: [],
        reasons: [],
        width: 0
      };
      
      parent.children.push(childNode);
      buildSubtree(childId, childNode);
    }
  };
  
  // Build the tree starting from the root
  buildSubtree(rootId, tree);
  return tree;
};

/**
 * Calculates the width of each subtree for centering parents
 */
const calculateTreeSizes = (node, data) => {
  if (!node) return 0;
  
  // Base width for a node with no children
  if (node.children.length === 0) {
    node.width = 1;
    return 1;
  }
  
  // Calculate width based on children
  let totalWidth = 0;
  for (const child of node.children) {
    totalWidth += calculateTreeSizes(child, data);
  }
  
  // Ensure minimum width
  node.width = Math.max(1, totalWidth);
  return node.width;
};

/**
 * Positions nodes recursively with parent centered above children
 */
const positionNodesRecursive = (node, positions, data, x, y, level = 0) => {
  if (!node) return;
  
  // Position this node (including root)
  positions[node.id] = { x, y };
  
  // Position reasons directly above this node
  if (node.reasons.length > 0) {
    positionReasonsAbove(node.reasons, node.id, positions);
  }
  
  // Process children
  const children = node.children;
  if (children.length > 0) {
    // Calculate total width of all children
    const totalChildrenWidth = children.reduce((sum, child) => sum + child.width, 0);
    const startX = x - (totalChildrenWidth * CONSTANTS.HORIZONTAL_GAP / 2) + (CONSTANTS.HORIZONTAL_GAP / 2);
    
    // Position each child
    let currentX = startX;
    for (let i = 0; i < children.length; i++) {
      const childNode = children[i];
      const childWidth = childNode.width;
      const childCenterX = currentX + (childWidth * CONSTANTS.HORIZONTAL_GAP / 2);
      
      positionNodesRecursive(childNode, positions, data, childCenterX, y + CONSTANTS.VERTICAL_GAP, level + 1);
      
      currentX += childWidth * CONSTANTS.HORIZONTAL_GAP;
    }
  }
};


// Note: optimizeIdenticalNodesLayout function completely removed

/**
 * Positions reason nodes in a vertical stack directly centered above their parent
 */
const positionReasonsAbove = (reasonIds, parentId, positions) => {
  if (!reasonIds || reasonIds.length === 0 || !positions[parentId]) return;
  
  const parentX = positions[parentId].x;
  const parentY = positions[parentId].y;
  
  // Use the node height for proper spacing calculations
  const NODE_HEIGHT = 450;
  
  // Stack reasons in a single vertical column centered above the parent
  reasonIds.forEach((reasonId, index) => {
    // Each reason gets the same X coordinate as the parent (centered)
    // Calculate Y position based on NODE_HEIGHT to ensure proper spacing
    const reasonY = parentY + CONSTANTS.REASON_VERTICAL_OFFSET - (index * (NODE_HEIGHT + 50));
    
    positions[reasonId] = {
      x: parentX, // Perfectly centered above parent
      y: reasonY
    };
  });
};

/**
 * Helper to detect collisions between nodes and adjust positions
 */
export const detectAndResolveCollisions = (positions, data, nodeWidth = 600, nodeHeight = 450) => {
  const adjustedPositions = { ...positions };
  let collisionsFound = true;
  let iterations = 0;
  const MAX_ITERATIONS = 10; // Increased iterations
  
  // Simple collision detection with large safety margins
  const checkCollision = (pos1, pos2) => {
    // Add extra safety margins
    const safetyMargin = 50;
    return Math.abs(pos1.x - pos2.x) < (nodeWidth + safetyMargin) &&
           Math.abs(pos1.y - pos2.y) < (nodeHeight + safetyMargin);
  };
  
  // Resolve collisions with stronger repulsion
  while (collisionsFound && iterations < MAX_ITERATIONS) {
    collisionsFound = false;
    iterations++;
    
    // Check each pair of nodes for collisions
    const nodeIds = Object.keys(adjustedPositions);
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const id1 = nodeIds[i];
        const id2 = nodeIds[j];
        const pos1 = adjustedPositions[id1];
        const pos2 = adjustedPositions[id2];
        
        if (checkCollision(pos1, pos2)) {
          collisionsFound = true;
          
          // Determine if nodes are at the same level (vertical)
          const sameLevel = Math.abs(pos1.y - pos2.y) < 100;
          
          if (sameLevel) {
            // If at same level, prioritize horizontal separation
            const moveX = (nodeWidth + 100 - Math.abs(pos1.x - pos2.x)) * 0.8;
            const direction = pos1.x < pos2.x ? -1 : 1;
            
            adjustedPositions[id1] = { 
              ...pos1, 
              x: pos1.x + (direction * moveX / 2) 
            };
            
            adjustedPositions[id2] = { 
              ...pos2, 
              x: pos2.x + (direction * -moveX / 2) 
            };
          } else {
            // If at different levels, prioritize vertical separation for stacked relationships
            // First check if one is a reason of the other
            const node1 = data[id1];
            const node2 = data[id2];
            
            const isReasonRelationship = 
              (node1?.node_type === 'reason' && node1?.parent_id === id2) ||
              (node2?.node_type === 'reason' && node2?.parent_id === id1);
            
            if (isReasonRelationship) {
              // For reason-parent relationships, only increase vertical separation
              const moveY = (nodeHeight + 100 - Math.abs(pos1.y - pos2.y)) * 1.0;
              const direction = pos1.y < pos2.y ? -1 : 1;
              
              adjustedPositions[id1] = { 
                ...pos1, 
                y: pos1.y + (direction * moveY / 2) 
              };
              
              adjustedPositions[id2] = { 
                ...pos2, 
                y: pos2.y + (direction * -moveY / 2) 
              };
            } else {
              // For other relationships, use both horizontal and vertical adjustment
              const moveX = (nodeWidth - Math.abs(pos1.x - pos2.x)) * 0.3;
              const moveY = (nodeHeight - Math.abs(pos1.y - pos2.y)) * 0.7;
              
              const directionX = pos1.x < pos2.x ? -1 : 1;
              const directionY = pos1.y < pos2.y ? -1 : 1;
              
              adjustedPositions[id1] = { 
                x: pos1.x + (directionX * moveX / 2),
                y: pos1.y + (directionY * moveY / 2)
              };
              
              adjustedPositions[id2] = { 
                x: pos2.x + (directionX * -moveX / 2),
                y: pos2.y + (directionY * -moveY / 2)
              };
            }
          }
        }
      }
    }
  }
  
  return adjustedPositions;
};

/**
 * Add spacing between all nodes to ensure they're not too close
 */
export const addSpacingBetweenNodes = (positions, spacingFactor = 1.2) => {
  // Find the center of the layout
  const centerX = Object.values(positions).reduce((sum, pos) => sum + pos.x, 0) / 
                 Math.max(1, Object.values(positions).length);
  
  const spacedPositions = {};
  
  // Group positions by their y-coordinate to identify layers
  const positionsByY = {};
  Object.entries(positions).forEach(([id, pos]) => {
    const yKey = Math.round(pos.y / 10) * 10; // Round to nearest 10 to group similar y values
    if (!positionsByY[yKey]) {
      positionsByY[yKey] = [];
    }
    positionsByY[yKey].push({ id, pos });
  });
  
  // For each layer, apply horizontal spacing from center
  Object.values(positionsByY).forEach(layerPositions => {
    if (layerPositions.length <= 1) {
      // Single node in layer, no need for horizontal spacing
      layerPositions.forEach(({ id, pos }) => {
        spacedPositions[id] = { ...pos };
      });
      return;
    }
    
    // Find center of this layer
    const layerCenterX = layerPositions.reduce((sum, { pos }) => sum + pos.x, 0) / layerPositions.length;
    
    // Apply spacing for this layer
    layerPositions.forEach(({ id, pos }) => {
      // Calculate vector from layer center (only adjust x to maintain vertical relationships)
      const dx = pos.x - layerCenterX;
      
      spacedPositions[id] = {
        x: layerCenterX + dx * spacingFactor,
        y: pos.y
      };
    });
  });
  
  return spacedPositions;
};

/**
 * Normalizes the layout to fit within a certain area
 */
export const normalizeLayout = (positions) => {
  if (Object.keys(positions).length === 0) return { positions: {}, width: 0, height: 0 };
  
  // Find bounding box
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  Object.values(positions).forEach(pos => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  });
  
  // Use the center point to ensure the layout is centered properly
  const paddingX = 400; // Extra horizontal padding
  const paddingY = 500; // Extra vertical padding
  
  // Calculate the center X coordinate
  const centerX = (minX + maxX) / 2;
  
  const normalized = {};
  Object.entries(positions).forEach(([id, pos]) => {
    // Adjust position relative to centerX for better horizontal centering if needed
    const horizontalAdjustment = (pos.x > centerX) ? 50 : -50;
    
    normalized[id] = {
      // Apply small adjustment based on position relative to center
      x: pos.x - minX + paddingX + horizontalAdjustment,
      y: pos.y - minY + paddingY
    };
  });
  
  return {
    positions: normalized,
    width: maxX - minX + (paddingX * 2),
    height: maxY - minY + (paddingY * 2)
  };
};