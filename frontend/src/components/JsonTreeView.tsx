import React, { useState } from 'react';
import { JsonTreeNode, parseJsonToTree } from '../utils/jsonTree';

interface JsonTreeViewProps {
  jsonString: string;
}

const typeColors: Record<string, string> = {
  string: 'text-green-400',
  number: 'text-blue-400',
  boolean: 'text-purple-400',
  null: 'text-gray-500',
  object: 'text-yellow-400',
  array: 'text-orange-400'
};

const TreeNode: React.FC<{ node: JsonTreeNode; depth: number }> = ({ node, depth }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  
  const hasChildren = node.children && node.children.length > 0;
  
  const renderValue = () => {
    if (node.type === 'object') {
      return <span className="text-gray-400">{`{${node.value}}`}</span>;
    }
    if (node.type === 'array') {
      return <span className="text-gray-400">{`[${node.value}]`}</span>;
    }
    if (node.type === 'string') {
      return <span className="text-green-300">"{node.value}"</span>;
    }
    if (node.type === 'null') {
      return <span className="text-gray-500">null</span>;
    }
    return <span className={typeColors[node.type]}>{String(node.value)}</span>;
  };
  
  return (
    <div className="ml-3 text-[11px] font-mono">
      <div 
        className="flex items-start hover:bg-theme-elevated rounded cursor-pointer"
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          <span className="w-3 text-theme-muted mr-1">
            {expanded ? '▼' : '▶'}
          </span>
        ) : (
          <span className="w-3 mr-1" />
        )}
        <span className="text-blue-300 mr-1">{node.key}:</span>
        {renderValue()}
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child, idx) => (
            <TreeNode key={idx} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const JsonTreeView: React.FC<JsonTreeViewProps> = ({ jsonString }) => {
  const { valid, data } = (() => {
    try {
      return { valid: true, data: JSON.parse(jsonString) };
    } catch {
      return { valid: false, data: null };
    }
  })();
  
  if (!valid) {
    return <span className="text-red-400">Invalid JSON</span>;
  }
  
  const tree = parseJsonToTree(data);
  
  return (
    <div className="bg-theme-surface border border-theme-subtle rounded p-2 max-h-60 overflow-auto">
      {tree.children?.map((child, idx) => (
        <TreeNode key={idx} node={child} depth={0} />
      ))}
    </div>
  );
};
