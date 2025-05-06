// src/components/Graph/GraphConnections.jsx
import React from 'react';

const GraphConnections = ({ connections = [] }) => {
  if (!connections || connections.length === 0) {
    return null;
  }

  return (
    <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none" style={{ overflow: 'visible', position: 'absolute' }}>
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="8"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L8,4 L0,8" fill="#4B5563" />
        </marker>
        
        <marker
          id="reason-arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="8"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L8,4 L0,8" fill="#D97706" />
        </marker>
        
        <marker
          id="highlight-arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="8"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L8,4 L0,8" fill="#EC4899" />
        </marker>
        
        <marker
          id="identical-arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="8"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L8,4 L0,8" fill="#3B82F6" />
        </marker>
      </defs>
      
      {connections.map(({ from, to, sourceId, targetId, isReason, isIdentical, points }, idx) => {
        // Determine if this is a connection to a reason (upward) or regular (downward)
        const isUpwardConnection = to.y < from.y;
        
        // Create appropriate path based on connection type
        let pathD;
        
        // For identical connections, use a more pronounced curve or the complex path if provided
        if (isIdentical && points && points.length > 2) {
          // Use complex path with multiple control points if provided
          if (points.length === 5) {
            // Path with 3 control points (Bezier curve with 5 points total)
            pathD = `M ${points[0].x},${points[0].y} ` +
                   `C ${points[1].x},${points[1].y} ${points[2].x},${points[2].y} ${points[3].x},${points[3].y} ` + 
                   `Q ${points[3].x},${points[3].y} ${points[4].x},${points[4].y}`;
          } else {
            // Simple quadratic curve with one control point
            pathD = `M ${points[0].x},${points[0].y} Q ${points[1].x},${points[1].y} ${points[2].x},${points[2].y}`;
          }
        } else if (isIdentical) {
          // NEW BEHAVIOR: For identical connections without predefined points, always arc underneath
          const dx = to.x - from.x;
          const controlX = (from.x + to.x) / 2;
          
          // Calculate a control point below both nodes
          const bottomY = Math.max(from.y, to.y);
          const controlY = bottomY + Math.abs(dx) * 0.2 + 40; // Arc below nodes
          
          pathD = `M ${from.x},${from.y} Q ${controlX},${controlY} ${to.x},${to.y}`;
        } else if (isReason || isUpwardConnection) {
          // ORIGINAL BEHAVIOR: For reason connections or upward connections, use a curved path
          const curveStrength = 0.2;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          
          // Create perpendicular control point
          const controlX = (from.x + to.x) / 2;
          let controlY;
          
          if (isUpwardConnection) {
            controlY = to.y - Math.abs(from.y - to.y) * curveStrength;
          } else {
            controlY = from.y - Math.abs(from.y - to.y) * curveStrength;
          }
          
          pathD = `M ${from.x},${from.y} Q ${controlX},${controlY} ${to.x},${to.y}`;
        } else {
          // ORIGINAL BEHAVIOR: For standard downward connections (vertical hierarchy), use a simple line
          pathD = `M ${from.x},${from.y} L ${to.x},${to.y}`;
        }
        
        // Determine connection style
        let strokeColor = "#4B5563"; // Default gray
        let arrowhead = "url(#arrowhead)";
        let strokeDasharray = "none";
        
        if (isReason) {
          strokeColor = "#D97706"; // Amber for reasons
          arrowhead = "url(#reason-arrowhead)";
          strokeDasharray = "5,5";
        } else if (isIdentical) {
          strokeColor = "#3B82F6"; // Blue for identical nodes
          arrowhead = "url(#identical-arrowhead)"; 
          // NEW BEHAVIOR: Always use dotted lines for identical connections
          strokeDasharray = "4,4";
        }
        
        return (
          <g key={`${sourceId}-${targetId}-${idx}`}>
            {/* Shadow path */}
            <path
              d={pathD}
              fill="none"
              stroke="#111827"
              strokeWidth="3"
              strokeOpacity="0.5"
              strokeDasharray={isIdentical ? strokeDasharray : "none"}
            />
            
            {/* Main path */}
            <path
              d={pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeOpacity="0.8"
              markerEnd={arrowhead}
              className="transition-all duration-300"
              strokeDasharray={strokeDasharray}
            />
          </g>
        );
      })}
    </svg>
  );
};

export default React.memo(GraphConnections);