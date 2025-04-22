// src/hooks/useCoordinateSystem.js

import { useRef, useCallback, useEffect } from 'react';
import { CoordinateSystem, ConnectionManager, Vector2D, NodeBounds } from '../lib/CoordinateSystem';

export function useCoordinateSystem(graphData) {
  const coordSystemRef = useRef(null);
  const connectionManagerRef = useRef(null);

  // Initialize systems in an effect to ensure consistent initialization
  useEffect(() => {
    if (!coordSystemRef.current) {
      console.log('Initializing coordinate system');
      coordSystemRef.current = new CoordinateSystem();
    }
    if (!connectionManagerRef.current) {
      console.log('Initializing connection manager');
      connectionManagerRef.current = new ConnectionManager(coordSystemRef.current);
    }
  }, []); // Empty dependency array means this runs once on mount

  // Update node bounds in the coordinate system
  const updateNodeBounds = useCallback((nodeId, bounds) => {
    if (!coordSystemRef.current) return;
    if (!bounds || !(bounds instanceof NodeBounds)) {
      console.warn('Invalid bounds object received:', bounds); 
      return;
    }
    coordSystemRef.current.setNodeBounds(nodeId, bounds);

    // After updating bounds, refresh connections for this node
    if (connectionManagerRef.current) {
      connectionManagerRef.current.updateNodeConnections(nodeId);
    }
  }, []);

  // Update transform (scale and offset)
  const updateTransform = useCallback((scale, offset) => {
    if (!coordSystemRef.current) return;
    if (typeof scale !== 'number' || !offset || typeof offset.x !== 'number' || typeof offset.y !== 'number') {
      console.warn('Invalid transform parameters:', { scale, offset });
      return;
    }
    coordSystemRef.current.updateTransform(scale, new Vector2D(offset.x, offset.y));
  }, []);

  // Set up a connection between nodes
  const setConnection = useCallback(({ sourceId, targetId, isReason }) => {
    if (!connectionManagerRef.current || !coordSystemRef.current) return;
    
    console.log('Setting up connection:', { sourceId, targetId, isReason });
    if (!sourceId || !targetId) {
      console.warn('Invalid connection parameters:', { sourceId, targetId });
      return;
    }

    const sourceNode = coordSystemRef.current.getNodeBounds(sourceId);
    const targetNode = coordSystemRef.current.getNodeBounds(targetId);
    
    if (!sourceNode || !targetNode) {
      console.warn('Missing node bounds for connection:', {
        sourceId,
        targetId,
        sourceExists: !!sourceNode,
        targetExists: !!targetNode
      });
      return;
    }

    connectionManagerRef.current.setConnection(sourceId, targetId, isReason ? 'reason' : 'identical');
  }, []);

  // Reset all connections
  const resetConnections = useCallback(() => {
    if (!connectionManagerRef.current) return;
    console.log('Resetting all connections');
    connectionManagerRef.current.clear();
  }, []);

  // Get current connections
  const getConnections = useCallback(() => {
    if (!connectionManagerRef.current) {
      console.warn('Connection manager not initialized');
      return [];
    }
    const connections = connectionManagerRef.current.getScreenConnections();
    console.log('Getting screen connections:', connections);
    return connections;
  }, []);

  // No cleanup needed as we want to persist the refs throughout component lifecycle
  
  return {
    updateNodeBounds,
    updateTransform,
    getConnections,
    setConnection,
    resetConnections
  };
}