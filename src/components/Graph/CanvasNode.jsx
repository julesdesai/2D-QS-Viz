// src/components/Graph/CanvasNode.jsx
import React, { useEffect, useState, memo } from 'react';
import { Group, Rect, Text, Image } from 'react-konva';

// Simple color function for node types
const getNodeTypeColor = (nodeType) => {
  switch (nodeType?.toLowerCase()) {
    case 'thesis': return '#16a34a';
    case 'antithesis': return '#dc2626';
    case 'synthesis': return '#9333ea';
    case 'reason': return '#d97706';
    default: return '#6b7280';
  }
};

// Memoized minimal node
const CanvasNode = memo(({
  id,
  x,
  y,
  data,
  onNodeClick,
  activePath = [],
  isSelected = false
}) => {
  const node = data[id];
  const [image, setImage] = useState(null);
  
  // Cache to track if image load has been attempted
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Load image only once when component mounts
  useEffect(() => {
    // Skip if already attempted loading
    if (imageLoaded) return;
    
    setImageLoaded(true);
    
    const loadImage = async () => {
      try {
        if (node?.has_image) {
          const images = await getNodeImages(node.id);
          if (images.length > 0) {
            const img = new window.Image();
            img.src = images[0].url;
            img.onload = () => setImage(img);
            return;
          }
        }
        else {
          // Fallback to default thumbnail
          const img = new window.Image();
          img.src = process.env.PUBLIC_URL + "/assets/images/node-thumbnail.png";
          img.onload = () => setImage(img);
        }
      } catch (error) {
        console.error('Error loading node image:', error);
        // Fallback to default thumbnail on error
        const img = new window.Image();
        img.src = process.env.PUBLIC_URL + "/assets/images/node-thumbnail.png";
        img.onload = () => setImage(img);
      }
    };
    
    loadImage();
  }, [imageLoaded, node]);

  if (!node) return null;

  const isNonsense = node.nonsense;
  const identicalTo = node.identical_to;
  const isInPath = activePath.includes(id);
  
  // Get terminal status text
  const getTerminalStatus = () => {
    if (isNonsense) return 'Nonsense';
    if (identicalTo) return 'Identity';
    return null;
  };
  
  // Smaller, optimized dimensions
  const nodeWidth = 300; 
  const nodeHeight = 140;
  const imageWidth = 110;
  
  // Border color - single stroke instead of shadows for better performance
  const borderColor = getNodeTypeColor(node.node_type);
  
  return (
    <Group
      x={x}
      y={y}
      offsetX={nodeWidth/2}
      offsetY={nodeHeight/2}
      onClick={() => onNodeClick(id)}
    >
      {/* Main container - single rect with border instead of shadow */}
      <Rect
        width={nodeWidth}
        height={nodeHeight}
        fill="white"
        stroke={borderColor}
        strokeWidth={isInPath || isSelected ? 3 : 1.5}
        cornerRadius={4}
      />
      
      {/* Image - conditionally rendered only if loaded */}
      {image && (
        <Image
          x={5}
          y={5}
          width={imageWidth}
          height={nodeHeight - 10}
          image={image}
        />
      )}
      
      {/* Summary - serif font, positioned right of image or at start if no image */}
      <Text
        x={image ? imageWidth + 10 : 10}
        y={10}
        width={image ? nodeWidth - imageWidth - 15 : nodeWidth - 15}
        text={node.summary || 'Untitled Node'}
        fontSize={14}
        fontFamily="serif"
        fill="#1f2937"
        ellipsis={true}
      />
      
      {/* Node type - always shown */}
      <Text
        x={image ? imageWidth + 10 : 10}
        y={nodeHeight - 55}
        text={node.node_type || 'node'}
        fontSize={12}
        fontFamily="serif"
        fill={borderColor}
        fontStyle="italic"
      />
      
      {/* Terminal status - only shown if node is terminal */}
      {(isNonsense || identicalTo) && (
        <Text
          x={image ? imageWidth + 10 : 10}
          y={nodeHeight - 30}
          text={getTerminalStatus()}
          fontSize={12}
          fontFamily="serif"
          fill={isNonsense ? '#b91c1c' : '#1e40af'}
        />
      )}
    </Group>
  );
});

export default CanvasNode;