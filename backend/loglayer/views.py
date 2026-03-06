"""
Saved Views Management

Allows users to save and restore layer configurations as named views.
Inspired by Kibana's saved objects and Grafana's dashboard feature.

Features:
- Save current layer configuration as a named view
- Load saved views
- Delete views
- Export/import views as JSON
- Auto-save per-workspace views
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime


class SavedView:
    """Represents a saved view configuration."""
    
    def __init__(self, name: str, layers: List[Dict], 
                 metadata: Optional[Dict] = None):
        self.name = name
        self.layers = layers
        self.metadata = metadata or {}
        self.created_at = self.metadata.get('created_at', datetime.now().isoformat())
        self.updated_at = datetime.now().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'layers': self.layers,
            'metadata': {
                **self.metadata,
                'created_at': self.created_at,
                'updated_at': self.updated_at
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SavedView':
        return cls(
            name=data['name'],
            layers=data['layers'],
            metadata=data.get('metadata', {})
        )


class ViewManager:
    """
    Manage saved views for LogLayer.
    
    Views are stored in:
    - Global: ~/.loglayer/views/
    - Per-workspace: .loglayer/views/
    """
    
    def __init__(self, workspace_path: Optional[str] = None):
        self.workspace_path = workspace_path
        self.global_views_dir = Path.home() / '.loglayer' / 'views'
        self.workspace_views_dir = None
        
        if workspace_path:
            self.workspace_views_dir = Path(workspace_path) / '.loglayer' / 'views'
        
        # Ensure directories exist
        self.global_views_dir.mkdir(parents=True, exist_ok=True)
        if self.workspace_views_dir:
            self.workspace_views_dir.mkdir(parents=True, exist_ok=True)
    
    def save_view(self, name: str, layers: List[Dict], 
                  workspace_only: bool = False) -> SavedView:
        """
        Save a view with the given name and layer configuration.
        
        Args:
            name: View name
            layers: List of layer configurations
            workspace_only: If True, save only to workspace (not global)
            
        Returns:
            SavedView instance
        """
        view = SavedView(name, layers)
        
        # Determine save location
        if workspace_only and self.workspace_views_dir:
            save_dir = self.workspace_views_dir
        else:
            save_dir = self.global_views_dir
        
        # Save to file
        view_file = save_dir / f"{self._sanitize_name(name)}.json"
        with open(view_file, 'w', encoding='utf-8') as f:
            json.dump(view.to_dict(), f, indent=2, ensure_ascii=False)
        
        return view
    
    def load_view(self, name: str, 
                  prefer_workspace: bool = True) -> Optional[SavedView]:
        """
        Load a saved view by name.
        
        Args:
            name: View name
            prefer_workspace: If True, check workspace first
            
        Returns:
            SavedView or None if not found
        """
        sanitized = self._sanitize_name(name)
        
        # Check workspace first if preferred
        if prefer_workspace and self.workspace_views_dir:
            workspace_file = self.workspace_views_dir / f"{sanitized}.json"
            if workspace_file.exists():
                return self._load_from_file(workspace_file)
        
        # Check global views
        global_file = self.global_views_dir / f"{sanitized}.json"
        if global_file.exists():
            return self._load_from_file(global_file)
        
        # Check workspace second if not preferred
        if not prefer_workspace and self.workspace_views_dir:
            workspace_file = self.workspace_views_dir / f"{sanitized}.json"
            if workspace_file.exists():
                return self._load_from_file(workspace_file)
        
        return None
    
    def delete_view(self, name: str, 
                    from_workspace: bool = False) -> bool:
        """
        Delete a saved view.
        
        Args:
            name: View name
            from_workspace: If True, delete from workspace; else from global
            
        Returns:
            True if deleted, False if not found
        """
        sanitized = self._sanitize_name(name)
        
        if from_workspace and self.workspace_views_dir:
            view_file = self.workspace_views_dir / f"{sanitized}.json"
        else:
            view_file = self.global_views_dir / f"{sanitized}.json"
        
        if view_file.exists():
            view_file.unlink()
            return True
        
        return False
    
    def list_views(self, include_workspace: bool = True) -> List[Dict[str, Any]]:
        """
        List all saved views.
        
        Args:
            include_workspace: Include workspace views
            
        Returns:
            List of view metadata dicts
        """
        views = []
        seen_names = set()
        
        # Load workspace views first (higher priority)
        if include_workspace and self.workspace_views_dir:
            for view_file in self.workspace_views_dir.glob('*.json'):
                try:
                    view = self._load_from_file(view_file)
                    if view and view.name not in seen_names:
                        views.append({
                            'name': view.name,
                            'created_at': view.created_at,
                            'updated_at': view.updated_at,
                            'source': 'workspace'
                        })
                        seen_names.add(view.name)
                except Exception:
                    continue
        
        # Load global views
        for view_file in self.global_views_dir.glob('*.json'):
            try:
                view = self._load_from_file(view_file)
                if view and view.name not in seen_names:
                    views.append({
                        'name': view.name,
                        'created_at': view.created_at,
                        'updated_at': view.updated_at,
                        'source': 'global'
                    })
                    seen_names.add(view.name)
            except Exception:
                continue
        
        # Sort by updated_at (most recent first)
        views.sort(key=lambda x: x['updated_at'], reverse=True)
        
        return views
    
    def export_views(self, output_path: str, 
                     view_names: Optional[List[str]] = None) -> bool:
        """
        Export views to a JSON file.
        
        Args:
            output_path: Output file path
            view_names: List of view names to export (None = all)
            
        Returns:
            True if successful
        """
        all_views = self.list_views(include_workspace=True)
        
        if view_names:
            all_views = [v for v in all_views if v['name'] in view_names]
        
        export_data = {
            'exported_at': datetime.now().isoformat(),
            'views': []
        }
        
        for view_meta in all_views:
            view = self.load_view(view_meta['name'])
            if view:
                export_data['views'].append(view.to_dict())
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)
        
        return True
    
    def import_views(self, input_path: str, 
                     overwrite: bool = False) -> Dict[str, bool]:
        """
        Import views from a JSON file.
        
        Args:
            input_path: Input file path
            overwrite: If True, overwrite existing views
            
        Returns:
            Dict mapping view names to success status
        """
        with open(input_path, 'r', encoding='utf-8') as f:
            import_data = json.load(f)
        
        results = {}
        
        for view_dict in import_data.get('views', []):
            try:
                view = SavedView.from_dict(view_dict)
                
                # Check if view exists
                existing = self.load_view(view.name, prefer_workspace=False)
                if existing and not overwrite:
                    results[view.name] = False
                    continue
                
                # Save to global views
                self.save_view(view.name, view.layers, workspace_only=False)
                results[view.name] = True
            except Exception as e:
                results[view_dict.get('name', 'unknown')] = False
        
        return results
    
    def _load_from_file(self, file_path: Path) -> Optional[SavedView]:
        """Load a view from a file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return SavedView.from_dict(data)
        except Exception:
            return None
    
    def _sanitize_name(self, name: str) -> str:
        """Sanitize view name for use as filename."""
        # Replace invalid filename characters
        sanitized = name.replace('/', '_').replace('\\', '_')
        sanitized = sanitized.replace(':', '_').replace('*', '_')
        sanitized = sanitized.replace('?', '_').replace('"', '_')
        sanitized = sanitized.replace('<', '_').replace('>', '_').replace('|', '_')
        return sanitized.strip()


# Global instance (workspace-agnostic)
_manager: Optional[ViewManager] = None


def get_view_manager(workspace_path: Optional[str] = None) -> ViewManager:
    """Get or create view manager instance."""
    global _manager
    if _manager is None or (workspace_path and _manager.workspace_path != workspace_path):
        _manager = ViewManager(workspace_path)
    return _manager
