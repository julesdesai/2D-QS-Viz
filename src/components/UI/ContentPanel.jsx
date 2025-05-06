import React, { useState, useEffect, useCallback } from 'react';
import { ref, uploadBytes, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase.js';

const ContentPanel = ({ node }) => {
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  const loadImages = useCallback(async () => {
    if (!node) return;
    
    try {
      // Use the node's unique identifier from the graph data
      const nodeId = Object.keys(node).find(key => key !== 'content' && key !== 'summary' && key !== 'node_type');
      if (!nodeId) return;

      const imagesRef = ref(storage, `nodes/${nodeId}`);
      const result = await listAll(imagesRef);
      
      const urls = await Promise.all(
        result.items.map(async (item) => {
          const url = await getDownloadURL(item);
          return { url, name: item.name };
        })
      );
      
      setImages(urls);
    } catch (error) {
      console.error('Error loading images:', error);
    }
  }, [node]);

  useEffect(() => {
    if (node) {
      loadImages();
    }
  }, [node, loadImages]);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !node) return;

    setUploading(true);
    try {
      // Use the node's unique identifier from the graph data
      const nodeId = Object.keys(node).find(key => key !== 'content' && key !== 'summary' && key !== 'node_type');
      if (!nodeId) return;

      const storageRef = ref(storage, `nodes/${nodeId}/${file.name}`);
      await uploadBytes(storageRef, file);
      await loadImages(); // Reload images after upload
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploading(false);
    }
  };

  if (!node) return (
    <div className="bg-neutral-800 rounded-lg p-6 text-neutral-400 font-serif">
      <p>Select a node to view its content</p>
    </div>
  );
  
  // Extract numbered points from content
  const extractPoints = (content) => {
    if (!content) return [];
    const matches = content.match(/\{([^}]+)\}/g) || [];
    return matches.map(match => match.slice(1, -1).trim());
  };

  const points = extractPoints(node.content);

  return (
    <div className="bg-neutral-800 rounded-lg p-6 text-neutral-200 font-serif">
      <div>
        <h3 className="text-2xl font-semibold mb-4 pb-2 border-b border-neutral-600 text-neutral-100 leading-snug">
          {node.summary}
        </h3>
        <div className="space-y-4">
          {points.map((point, index) => (
            <div key={index} className="flex gap-4">
              <span className="text-neutral-400 font-semibold min-w-[1.5rem]">
                {index + 1}.
              </span>
              <p className="text-neutral-300 whitespace-pre-wrap leading-relaxed text-lg">
                {point}
              </p>
            </div>
          ))}
        </div>
        <div className="text-sm text-neutral-400 mt-4 italic">
          Type: {node.node_type}
        </div>

        {/* Image Upload Section */}
        <div className="mt-6">
          <label className="block mb-2 text-sm font-medium text-neutral-300">
            Upload Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploading}
            className="block w-full text-sm text-neutral-300
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-neutral-700 file:text-neutral-200
              hover:file:bg-neutral-600"
          />
          {uploading && (
            <p className="mt-2 text-sm text-neutral-400">Uploading...</p>
          )}
        </div>

        {/* Display Images */}
        {images.length > 0 && (
          <div className="mt-6">
            <h4 className="text-lg font-semibold mb-3 text-neutral-300">Images</h4>
            <div className="grid grid-cols-2 gap-4">
              {images.map((image, index) => (
                <div key={index} className="relative">
                  <img
                    src={image.url}
                    alt={`Uploaded content for ${node.summary}`}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentPanel;