// src/lib/CoordinateSystem.js

export class Vector2D {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  add(other) {
    return new Vector2D(this.x + other.x, this.y + other.y);
  }

  subtract(other) {
    return new Vector2D(this.x - other.x, this.y - other.y);
  }

  scale(factor) {
    return new Vector2D(this.x * factor, this.y * factor);
  }
}

export class NodeBounds {
  constructor(position, width, height) {
    this.position = position;
    this.width = width;
    this.height = height;
  }

  get center() {
    return new Vector2D(
      this.position.x + this.width / 2,
      this.position.y + this.height / 2
    );
  }
}

export class CoordinateSystem {
  constructor() {
    this.nodes = new Map();
    this.scale = 1;
    this.offset = new Vector2D(0, 0);
  }

  setNodeBounds(nodeId, bounds) {
    // Now expecting a NodeBounds object directly
    if (!(bounds instanceof NodeBounds)) {
      console.warn(`CoordinateSystem: Invalid bounds for node ${nodeId}`, bounds);
      return;
    }
    console.log(`CoordinateSystem: Setting bounds for node ${nodeId}`, bounds);
    this.nodes.set(nodeId, bounds);
  }

  getNodeBounds(nodeId) {
    return this.nodes.get(nodeId);
  }

  getNodeCenter(nodeId) {
    const bounds = this.nodes.get(nodeId);
    if (!bounds) {
      console.warn(`CoordinateSystem: No bounds found for node ${nodeId}`);
      return null;
    }
    return bounds.center;
  }

  toScreen(position) {
    if (!position || !(position instanceof Vector2D)) {
      console.warn('Invalid position:', position);
      return position;
    }
    const scaled = position.scale(this.scale);
    return scaled.add(this.offset);
  }

  toLogical(position) {
    if (!position || !(position instanceof Vector2D)) {
      console.warn('Invalid position:', position);
      return position;
    }
    const translated = position.subtract(this.offset);
    return translated.scale(1 / this.scale);
  }

  updateTransform(scale, offset) {
    this.scale = scale;
    this.offset = offset;
  }
}

// In CoordinateSystem.js

export class ConnectionManager {
  constructor(coordinateSystem) {
    this.coordinates = coordinateSystem;
    this.connections = new Map();
  }

  setConnection(sourceId, targetId, type = 'default') {
    console.log(`ConnectionManager: Setting up connection ${sourceId} -> ${targetId} (${type})`);
    if (!sourceId || !targetId) {
      console.warn('ConnectionManager: Invalid sourceId or targetId', { sourceId, targetId });
      return;
    }

    const id = `${sourceId}-${targetId}`;
    
    const sourceCenter = this.coordinates.getNodeCenter(sourceId);
    const targetCenter = this.coordinates.getNodeCenter(targetId);

    if (!sourceCenter || !targetCenter) {
      console.warn(`ConnectionManager: Missing centers for connection ${id}`, {
        sourceId,
        targetId,
        sourceCenter,
        targetCenter
      });
      return;
    }

    const connection = {
      id,
      sourceId,
      targetId,
      type,
      from: sourceCenter,
      to: targetCenter,
      points: this.calculateManhattanPoints(sourceCenter, targetCenter),
      isReason: type === 'reason'
    };

    console.log('Creating connection:', connection);
    this.connections.set(id, connection);
  }

  setIdenticalConnection(sourceId, targetId) {
    console.log(`ConnectionManager: Setting up identity connection ${sourceId} -> ${targetId}`);
    if (!sourceId || !targetId) {
      console.warn('ConnectionManager: Invalid sourceId or targetId for identity connection', { sourceId, targetId });
      return;
    }

    const id = `identity-${sourceId}-${targetId}`;
    
    const sourceCenter = this.coordinates.getNodeCenter(sourceId);
    const targetCenter = this.coordinates.getNodeCenter(targetId);

    if (!sourceCenter || !targetCenter) {
      console.warn(`ConnectionManager: Missing centers for identity connection ${id}`, {
        sourceId,
        targetId,
        sourceCenter,
        targetCenter
      });
      return;
    }

    // Use a curved path for identity connections
    const connection = {
      id,
      sourceId,
      targetId,
      type: 'identical',
      from: sourceCenter,
      to: targetCenter,
      points: this.calculateCurvedPath(sourceCenter, targetCenter),
      isReason: false,
      isIdentical: true
    };

    console.log('Creating identity connection:', connection);
    this.connections.set(id, connection);
  }

  calculateCurvedPath(start, end) {
    // Calculate a curved path with more pronounced curve than Manhattan
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    // Create an offset to make the curve more pronounced
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate if this is more horizontal or vertical
    const isMoreHorizontal = Math.abs(dx) > Math.abs(dy);
    
    // Create a stronger curve for horizontal lines
    let curveMagnitude = isMoreHorizontal ? 0.5 : 0.3;
    
    // For very horizontal connections, create an even stronger curve
    if (isMoreHorizontal && Math.abs(dy) < distance * 0.2) {
      curveMagnitude = 0.8;
    }
    
    // For very long horizontal connections, create an even stronger curve
    if (isMoreHorizontal && Math.abs(dx) > 1500) {
      curveMagnitude = Math.min(curveMagnitude + 0.3, 1.0);
    }
    
    // Perpendicular offset - create a curve that's perpendicular to the line between points
    const perpX = -dy / distance * distance * curveMagnitude;
    const perpY = dx / distance * distance * curveMagnitude;
    
    // Control point with offset for a nice curve
    const controlPoint = new Vector2D(midX + perpX, midY + perpY);
    
    // For extra complex paths on very long horizontal connections, create a path with multiple control points
    if (isMoreHorizontal && Math.abs(dx) > 2000) {
      // Create a path with three control points for very long connections
      const controlPoint1 = new Vector2D(
        start.x + dx * 0.25,
        start.y + dy * 0.25 + perpY * 0.7
      );
      
      const controlPoint2 = new Vector2D(
        midX,
        midY + perpY
      );
      
      const controlPoint3 = new Vector2D(
        start.x + dx * 0.75,
        start.y + dy * 0.75 + perpY * 0.7
      );
      
      return [
        start,
        controlPoint1,
        controlPoint2,
        controlPoint3,
        end
      ];
    }
    
    return [
      start,
      controlPoint,
      end
    ];
  }

  getScreenConnections() {
    console.log('Getting screen connections. Total connections:', this.connections.size);
    return Array.from(this.connections.values()).map(conn => {
      const screenFrom = this.coordinates.toScreen(conn.from);
      const screenTo = this.coordinates.toScreen(conn.to);
      
      return {
        sourceId: conn.sourceId,
        targetId: conn.targetId,
        from: screenFrom,
        to: screenTo,
        isReason: conn.type === 'reason',
        points: conn.points.map(p => this.coordinates.toScreen(p))
      };
    });
  }

  calculateManhattanPoints(start, end) {
    const verticalFirst = Math.abs(end.y - start.y) > Math.abs(end.x - start.x);
    
    if (verticalFirst) {
      const midY = start.y + (end.y - start.y) / 2;
      return [
        start,
        new Vector2D(start.x, midY),
        new Vector2D(end.x, midY),
        end
      ];
    } else {
      const midX = start.x + (end.x - start.x) / 2;
      return [
        start,
        new Vector2D(midX, start.y),
        new Vector2D(midX, end.y),
        end
      ];
    }
  }

  updateNodeConnections(nodeId) {
    // Update connections where this node is source or target
    this.connections.forEach((conn, connId) => {
      if (conn.sourceId === nodeId || conn.targetId === nodeId) {
        this.setConnection(conn.sourceId, conn.targetId, conn.type);
      }
    });
  }

  clear() {
    this.connections.clear();
  }
}