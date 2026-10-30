import React from 'react';
import { Sketch } from '../utils/MagicTraceEngine';
import './ObjectBrowser.css';

interface ObjectBrowserProps {
  mesh: any;
  sketches: Sketch[];
  selectedEntity: string | null;
  onSelect: (entityId: string | null) => void;
}

export const ObjectBrowser: React.FC<ObjectBrowserProps> = ({
  mesh,
  sketches,
  selectedEntity,
  onSelect
}) => {
  return (
    <div className="object-browser">
      <h3>Object Browser</h3>
      <div className="tree">
        {mesh && (
          <div className="tree-item">
            <div className="tree-item-header">
              <span className="icon">📦</span>
              <span className="label">Mesh</span>
            </div>
            <div className="tree-item-children">
              <div className="tree-item leaf">
                <span className="icon">🔺</span>
                <span className="label">STL Geometry</span>
              </div>
            </div>
          </div>
        )}

        {sketches.length > 0 && (
          <div className="tree-item">
            <div className="tree-item-header">
              <span className="icon">📐</span>
              <span className="label">Sketches ({sketches.length})</span>
            </div>
            <div className="tree-item-children">
              {sketches.map((sketch) => (
                <div
                  key={sketch.id}
                  className={`tree-item leaf ${selectedEntity === sketch.id ? 'selected' : ''}`}
                  onClick={() => onSelect(sketch.id)}
                >
                  <span className="icon">
                    {sketch.type === 'line' ? '📏' :
                     sketch.type === 'arc' ? '⌒' :
                     sketch.type === 'circle' ? '⭕' : '〰️'}
                  </span>
                  <span className="label">
                    {sketch.type.charAt(0).toUpperCase() + sketch.type.slice(1)} {sketch.id.slice(-4)}
                  </span>
                  {sketch.fitted && (
                    <span className="badge">Fitted</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!mesh && sketches.length === 0 && (
          <div className="empty-state">
            <p>No objects loaded</p>
            <p className="hint">Import an STL file to begin</p>
          </div>
        )}
      </div>
    </div>
  );
};
