// src/components/Graph/EnhancedNode.jsx
import React, { useEffect, useRef } from 'react';

const getNodeTypeColor = (nodeType) => {
  switch (nodeType?.toLowerCase()) {
    case 'question': return { border: 'border-blue-600', bg: 'bg-blue-50', text: 'text-blue-800' };
    case 'thesis': return { border: 'border-green-600', bg: 'bg-green-50', text: 'text-green-800' };
    case 'antithesis': return { border: 'border-red-600', bg: 'bg-red-50', text: 'text-red-800' };
    case 'synthesis': return { border: 'border-purple-600', bg: 'bg-purple-50', text: 'text-purple-800' };
    case 'reason': return { border: 'border-yellow-600', bg: 'bg-yellow-50', text: 'text-yellow-800' };
    default: return { border: 'border-gray-500', bg: 'bg-gray-50', text: 'text-gray-800' };
  }
};

const EnhancedNode = ({ 
  id,
  data, 
  onNodeClick, 
  activePath = [],
  onNodeRef = null,
  onCircleRef = null,
}) => {
  const nodeRef = useRef(null);
  const circleRef = useRef(null);
  const node = data[id];
  
  // Handle node references for positioning
  useEffect(() => {
    if (nodeRef.current && onNodeRef) {
      onNodeRef(id, nodeRef.current);
    }
    if (circleRef.current && onCircleRef) {
      onCircleRef(circleRef.current);
    }
  }, [id, onNodeRef, onCircleRef]);

  if (!node) {
    console.warn(`No node data for id: ${id}`);
    return null;
  }

  const isInPath = activePath.includes(id);
  const isNonsense = node.nonsense;
  const identicalTo = node.identical_to;
  const isTerminal = isNonsense || identicalTo;
  const isReason = node.node_type === 'reason';
  
  // Use a placeholder image - inline SVG data URL for universal compatibility
  const placeholderImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='24' fill='%239ca3af'%3EPlaceholder%3C/text%3E%3C/svg%3E";
  
  // Truncate content for preview
  const truncateContent = (content) => {
    if (!content) return '';
    return content.length > 150 ? content.substring(0, 150) + '...' : content;
  };
  
  // Parse content with curly braces into numbered bullets
  const parseContent = (content) => {
    if (!content) return null;
    
    // Use regex to match text inside curly braces
    const regex = /\{([^{}]*)\}/g;
    let match;
    let bullets = [];
    let count = 1;
    
    while ((match = regex.exec(content)) !== null) {
      bullets.push({
        number: count++,
        text: match[1].trim()
      });
    }
    
    if (bullets.length === 0) {
      // If no curly braces, return plain text
      return <p className="text-sm text-gray-600 font-serif">{truncateContent(content)}</p>;
    }
    
    return (
      <div className="text-sm text-gray-600 font-serif space-y-1.5">
        {bullets.map((bullet, index) => (
          <div key={index} className="flex">
            <span className="font-bold min-w-[20px] mr-1">{bullet.number}.</span>
            <span>{bullet.text}</span>
          </div>
        ))}
        {bullets.length > 0 && <span className="text-sm text-blue-600 inline-block">[more]</span>}
      </div>
    );
  };

  // Get node type colors
  const nodeColors = getNodeTypeColor(node.node_type);

  // Adjust the width based on node type
  const nodeWidth = isReason ? 'w-80' : 'w-96';
  
  // Highlight borders based on node type or identity
  let borderStyles = isInPath ? 'ring-2 ring-blue-600' : '';
  if (identicalTo) {
    borderStyles += ' border-blue-500 border-2 border-dashed';
  }
  
  // Terminal status indicator text
  const getTerminalStatus = () => {
    if (isNonsense) return 'Terminal: Nonsense';
    if (identicalTo) {
      // Get the identical node's summary if available
      const identicalNode = data[identicalTo];
      if (identicalNode && identicalNode.summary) {
        // Limit the summary length to avoid overflow
        const truncatedSummary = identicalNode.summary.length > 25 
          ? identicalNode.summary.substring(0, 22) + '...' 
          : identicalNode.summary;
        return `Identical to: ${truncatedSummary}`;
      }
      return `Identical to Node ${identicalTo.substring(0, 8)}...`;
    }
    return null;
  };

  return (
    <div 
      ref={nodeRef} 
      data-node-id={id}
      className={`
        ${isInPath ? 'z-10' : 'z-0'}
      `}
    >
      {/* Card styled after the visual example */}
      <div 
        className={`
          ${nodeWidth} rounded-lg overflow-hidden shadow-lg cursor-pointer
          transition-all duration-300 transform
          ${borderStyles}
          ${isInPath ? 'scale-105 shadow-xl' : 'hover:shadow-xl hover:scale-105'}
          ${isNonsense ? 'opacity-70' : 'opacity-100'}
          ${identicalTo ? 'bg-blue-50' : 'bg-white'}
          ${nodeColors.border}
          border-2
        `}
        onClick={() => onNodeClick(id)}
      >
        <div className="flex bg-white">
          {/* Image Column */}
          <div 
            ref={circleRef} 
            className="w-1/3 bg-gray-100 node-circle"
          >
            <img 
              src={placeholderImage} 
              alt={node.summary || 'Node'} 
              className="h-full w-full object-cover"
            />
          </div>
          
          {/* Content Column */}
          <div className="w-2/3 p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2 font-serif">
              {node.summary || 'Untitled Node'}
            </h3>
            {parseContent(node.content)}
            
            {/* Terminal status indicator */}
            {isTerminal && (
              <div className={`
                mt-2 text-xs px-2 py-1 inline-block rounded-full 
                ${isNonsense ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}
              `}>
                {getTerminalStatus()}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Visual indicator for node type */}
      <div className={`
        absolute -top-3 -right-3 px-2 py-1 
        rounded-full border shadow-sm font-bold text-xs
        ${nodeColors.bg} ${nodeColors.border} 
        ${nodeColors.text}
      `}>
        {node.node_type || 'node'}
      </div>
      
      {/* Identity badge if this node is identical to another */}
      {identicalTo && (
        <div className="absolute -bottom-2 -right-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full border border-blue-400 shadow-sm font-bold text-xs flex items-center">
          <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16l-4-4m0 0l4-4m-4 4h18" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Identity
        </div>
      )}
    </div>
  );
};

export default EnhancedNode;