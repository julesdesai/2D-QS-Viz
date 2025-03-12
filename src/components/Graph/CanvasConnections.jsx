// src/components/Graph/CanvasConnections.jsx
import React, { useMemo } from 'react';
import { Group, Line, Path, Circle } from 'react-konva';

const CanvasConnections = ({ connections = [], viewportBounds = null }) => {
  // Filter connections to only show those within or near viewport for performance
  const visibleConnections = useMemo(() => {
    // Return empty array if no connections
    if (!connections || connections.length === 0) {
      return [];
    }
    
    // Return all connections if no viewport bounds
    if (!viewportBounds) return connections;
    
    // Add padding to viewport for smooth edge rendering
    const padding = 1000; // Extra space around viewport to render connections
    const expandedBounds = {
      x: viewportBounds.x - padding,
      y: viewportBounds.y - padding,
      width: viewportBounds.width + padding * 2,
      height: viewportBounds.height + padding * 2
    };
    
    // Check if a point is within the expanded viewport
    const isPointVisible = (point) => {
      return (
        point.x >= expandedBounds.x &&
        point.x <= expandedBounds.x + expandedBounds.width &&
        point.y >= expandedBounds.y &&
        point.y <= expandedBounds.y + expandedBounds.height
      );
    };
    
    // Filter connections where at least one endpoint is visible
    return connections.filter(conn => 
      isPointVisible(conn.from) || isPointVisible(conn.to)
    );
  }, [connections, viewportBounds]);

  // Return null if no connections after filtering
  if (visibleConnections.length === 0) {
    return null;
  }

  // Convert bezier curve points to path data
  const bezierPathData = (points) => {
    if (!points || points.length < 2) return null;
    
    // For quadratic curve (3 points)
    if (points.length === 3) {
      return {
        start: points[0],
        control: points[1],
        end: points[2],
        type: 'quadratic'
      };
    }
    
    // For cubic curve (5 points)
    if (points.length === 5) {
      return {
        start: points[0],
        control1: points[1],
        control2: points[2],
        control3: points[3],
        end: points[4],
        type: 'cubic'
      };
    }
    
    // Simple line fallback
    return {
      start: points[0],
      end: points[points.length - 1],
      type: 'line'
    };
  };

  // Create an arrow for the end of the path
  const createArrow = (from, to, color, key) => {
    // Calculate the angle of the line
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);
    
    // Arrow dimensions
    const arrowLength = 8;
    const arrowWidth = 8;
    
    // Calculate arrow points
    const points = [
      to.x, to.y,
      to.x - arrowLength * Math.cos(angle - Math.PI/6), to.y - arrowLength * Math.sin(angle - Math.PI/6),
      to.x - arrowLength * Math.cos(angle + Math.PI/6), to.y - arrowLength * Math.sin(angle + Math.PI/6)
    ];
    
    return (
      <Line
        key={`arrow-${key}`}
        points={points}
        fill={color}
        closed={true}
      />
    );
  };

  return (
    <Group>
      {visibleConnections.map((conn, idx) => {
        // Determine connection style
        let strokeColor = "#4B5563"; // Default gray
        let strokeDashArray = [];
        
        if (conn.isReason) {
          strokeColor = "#D97706"; // Amber for reasons
          strokeDashArray = [5, 5];
        } else if (conn.isIdentical) {
          strokeColor = "#3B82F6"; // Blue for identical nodes
          strokeDashArray = [4, 4];
        }
        
        // For connections with complex paths
        if (conn.isIdentical && conn.points && conn.points.length > 2) {
          const pathData = bezierPathData(conn.points);
          
          // Determine the last segment coordinates for the arrow
          let arrowFrom, arrowTo;
          
          if (pathData.type === 'quadratic') {
            // Get a point near the end of the quadratic curve for the arrow
            const t = 0.95; // Get a point 95% along the curve
            const x = (1-t)*(1-t)*pathData.start.x + 2*(1-t)*t*pathData.control.x + t*t*pathData.end.x;
            const y = (1-t)*(1-t)*pathData.start.y + 2*(1-t)*t*pathData.control.y + t*t*pathData.end.y;
            arrowFrom = { x, y };
            arrowTo = pathData.end;
          } else if (pathData.type === 'cubic') {
            // Get a point near the end of the cubic curve for the arrow
            const t = 0.95; // Get a point 95% along the curve
            const mt = 1 - t;
            const x = mt*mt*mt*pathData.start.x + 3*mt*mt*t*pathData.control1.x + 
                      3*mt*t*t*pathData.control2.x + t*t*t*pathData.end.x;
            const y = mt*mt*mt*pathData.start.y + 3*mt*mt*t*pathData.control1.y + 
                      3*mt*t*t*pathData.control2.y + t*t*t*pathData.end.y;
            arrowFrom = { x, y };
            arrowTo = pathData.end;
          } else {
            arrowFrom = pathData.start;
            arrowTo = pathData.end;
          }
          
          // Draw quadratic curve
          if (pathData.type === 'quadratic') {
            return (
              <Group key={`conn-${idx}`}>
                {/* Shadow line */}
                <Path
                  data={`M ${pathData.start.x} ${pathData.start.y} Q ${pathData.control.x} ${pathData.control.y} ${pathData.end.x} ${pathData.end.y}`}
                  stroke="#111827"
                  strokeWidth={3}
                  opacity={0.3}
                  lineCap="round"
                  lineJoin="round"
                  dash={strokeDashArray}
                />
                
                {/* Main line */}
                <Path
                  data={`M ${pathData.start.x} ${pathData.start.y} Q ${pathData.control.x} ${pathData.control.y} ${pathData.end.x} ${pathData.end.y}`}
                  stroke={strokeColor}
                  strokeWidth={2}
                  opacity={0.8}
                  lineCap="round"
                  lineJoin="round"
                  dash={strokeDashArray}
                />
                
                {/* Arrow */}
                {createArrow(arrowFrom, arrowTo, strokeColor, idx)}
              </Group>
            );
          }
          
          // Draw cubic curve
          if (pathData.type === 'cubic') {
            return (
              <Group key={`conn-${idx}`}>
                {/* Shadow line */}
                <Path
                  data={`M ${pathData.start.x} ${pathData.start.y} C ${pathData.control1.x} ${pathData.control1.y} ${pathData.control2.x} ${pathData.control2.y} ${pathData.control3.x} ${pathData.control3.y} Q ${pathData.control3.x} ${pathData.control3.y} ${pathData.end.x} ${pathData.end.y}`}
                  stroke="#111827"
                  strokeWidth={3}
                  opacity={0.3}
                  lineCap="round"
                  lineJoin="round"
                  dash={strokeDashArray}
                />
                
                {/* Main line */}
                <Path
                  data={`M ${pathData.start.x} ${pathData.start.y} C ${pathData.control1.x} ${pathData.control1.y} ${pathData.control2.x} ${pathData.control2.y} ${pathData.control3.x} ${pathData.control3.y} Q ${pathData.control3.x} ${pathData.control3.y} ${pathData.end.x} ${pathData.end.y}`}
                  stroke={strokeColor}
                  strokeWidth={2}
                  opacity={0.8}
                  lineCap="round"
                  lineJoin="round"
                  dash={strokeDashArray}
                />
                
                {/* Arrow */}
                {createArrow(arrowFrom, arrowTo, strokeColor, idx)}
              </Group>
            );
          }
        }
        
        // For regular connections
        // Determine if this is a connection to a reason (upward) or regular (downward)
        const isUpwardConnection = conn.to.y < conn.from.y;
        
        // For reason connections or upward connections, use a curved path
        if (conn.isReason || isUpwardConnection) {
          const curveStrength = 0.2;
          const controlX = (conn.from.x + conn.to.x) / 2;
          let controlY;
          
          if (isUpwardConnection) {
            controlY = conn.to.y - Math.abs(conn.from.y - conn.to.y) * curveStrength;
          } else {
            controlY = conn.from.y - Math.abs(conn.from.y - conn.to.y) * curveStrength;
          }
          
          const pathData = {
            start: conn.from,
            control: { x: controlX, y: controlY },
            end: conn.to,
            type: 'quadratic'
          };
          
          // Get a point near the end for the arrow
          const t = 0.95;
          const x = (1-t)*(1-t)*pathData.start.x + 2*(1-t)*t*pathData.control.x + t*t*pathData.end.x;
          const y = (1-t)*(1-t)*pathData.start.y + 2*(1-t)*t*pathData.control.y + t*t*pathData.end.y;
          const arrowFrom = { x, y };
          
          return (
            <Group key={`conn-${idx}`}>
              {/* Shadow line */}
              <Path
                data={`M ${pathData.start.x} ${pathData.start.y} Q ${pathData.control.x} ${pathData.control.y} ${pathData.end.x} ${pathData.end.y}`}
                stroke="#111827"
                strokeWidth={3}
                opacity={0.3}
                lineCap="round"
                lineJoin="round"
                dash={strokeDashArray}
              />
              
              {/* Main line */}
              <Path
                data={`M ${pathData.start.x} ${pathData.start.y} Q ${pathData.control.x} ${pathData.control.y} ${pathData.end.x} ${pathData.end.y}`}
                stroke={strokeColor}
                strokeWidth={2}
                opacity={0.8}
                lineCap="round"
                lineJoin="round"
                dash={strokeDashArray}
              />
              
              {/* Arrow */}
              {createArrow(arrowFrom, pathData.end, strokeColor, idx)}
            </Group>
          );
        }
        
        // For standard downward connections (simple line)
        return (
          <Group key={`conn-${idx}`}>
            {/* Shadow line */}
            <Line
              points={[conn.from.x, conn.from.y, conn.to.x, conn.to.y]}
              stroke="#111827"
              strokeWidth={3}
              opacity={0.3}
              lineCap="round"
              lineJoin="round"
            />
            
            {/* Main line */}
            <Line
              points={[conn.from.x, conn.from.y, conn.to.x, conn.to.y]}
              stroke={strokeColor}
              strokeWidth={2}
              opacity={0.8}
              lineCap="round"
              lineJoin="round"
              dash={strokeDashArray}
            />
            
            {/* Arrow */}
            {createArrow(conn.from, conn.to, strokeColor, idx)}
          </Group>
        );
      })}
    </Group>
  );
};

export default CanvasConnections;