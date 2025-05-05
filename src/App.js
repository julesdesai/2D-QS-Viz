// src/App.js
import React, { useState, useEffect } from 'react';
import OptimizedGraph from './components/Graph/OptimizedGraph';
import './styles/App.css';
import { getUserModifiedGraph,getFullGraph } from './firebase';
import { BookOpen } from 'lucide-react';

const GRAPH_CONFIG = {
  'knowledge': {
    name: 'What is Knowledge?',
    description: 'The Socratic Question',
    icon: <BookOpen className="w-6 h-6" />,
    rootNode: '004d648a-1557-4549-8b22-fd1ae43fcd33'
  },
  'freedom': {
    name: 'What is Freedom (in the sense of Liberty)?',
    description: 'Philosophical perspectives on freedom and liberty',
    icon: <BookOpen className="w-6 h-6" />,
    rootNode: 'a5e92802-75b0-4c29-ad4f-f07d15889d15'
  },
  'reasons': {
    name: 'What are Reasons?',
    description: 'Philosophical perspectives on reasons',
    icon: <BookOpen className="w-6 h-6" />,
    rootNode: 'afb54e2d-3b82-464a-80d1-f766da42395b'
  },
  'semantics': {
    name: 'What is Semantics?',
    description: 'Philosophical perspectives on semantics',
    icon: <BookOpen className="w-6 h-6" />,
    rootNode: '069e0a67-8365-46b0-a5db-6c8013f18563'
  }
};

function App() {
  const [graphs, setGraphs] = useState([]);
  const [selectedGraph, setSelectedGraph] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get the base URL dynamically
  const baseUrl = process.env.PUBLIC_URL || '/3D-Question-Space-Visualiser';

  // Load list of available graphs
  useEffect(() => {
    const loadGraphs = async () => {
      try {
        let graphs = [];
        // Populate graphs from GRAPH_CONFIG:
        for (const [key, value] of Object.entries(GRAPH_CONFIG)) {
          graphs.push({
            id: key,
            name: value.name,
            description: value.description,
            filename: null
          });
        }
        setGraphs(graphs);
        if (graphs.length > 0) {
          setSelectedGraph(graphs[0].id);
        }
      } catch (err) {
        console.error('Error loading graph list:', err);
        setError(`Failed to load graph list. Error: ${err.message}`);
      }
    };

    loadGraphs();
  }, [baseUrl]);

  // Load selected graph data
  useEffect(() => {
    const loadGraphData = async () => {
      if (!selectedGraph) return;
      
      setLoading(true);
      try {
        console.log('Loading graph:', selectedGraph);
        const graphResponse = await getFullGraph(selectedGraph);
        setGraphData(graphResponse);
        setError(null);
        console.log('Successfully loaded graph data:', graphResponse);
      } catch (err) {
        console.error('Error loading graph data:', err);
        setError(`Failed to load graph data. Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadGraphData();
  }, [selectedGraph, baseUrl]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
          <div className="text-red-600 font-semibold mb-2">Error</div>
          <div className="text-gray-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Graph selector */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col space-y-2 max-w-xl mx-auto">
          <select 
            value={selectedGraph || ''} 
            onChange={(e) => setSelectedGraph(e.target.value)}
            className="bg-white text-gray-800 px-4 py-2 rounded-md border border-gray-300 
                      hover:border-gray-400 focus:border-blue-500 focus:outline-none
                      transition-colors duration-200"
            style={{ fontFamily: 'Crimson Text, Georgia, serif' }}
          >
            <option value="" disabled>Select a graph...</option>
            {graphs.map((graph) => (
              <option key={graph.id} value={graph.id}>
                {graph.name}
              </option>
            ))}
          </select>
          
          {selectedGraph && (
            <div 
              className="text-gray-600 text-sm px-1"
              style={{ fontFamily: 'Crimson Text, Georgia, serif' }}
            >
              {graphs.find(g => g.id === selectedGraph)?.description}
            </div>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-gray-600 flex items-center">
            <div>Loading graph data...</div>
            <svg className="animate-spin h-5 w-5 ml-3" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
                fill="none"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        </div>
      ) : (
        graphData && (
          <OptimizedGraph data={graphData} />
        )
      )}
    </div>
  );
}

export default App;