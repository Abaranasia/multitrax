import type { ViewMode } from '../Canvas/useCanvas';

import './ViewMenu.css';

interface ViewMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  viewMode: ViewMode;
  onOrganizeTracks: () => void;
  organizeDisabled: boolean;
  onSwitchView: () => void;
}

export const ViewMenu = ({
  isOpen,
  onToggle,
  onClose,
  viewMode,
  onOrganizeTracks,
  organizeDisabled,
  onSwitchView,
}: ViewMenuProps) => {
  const handleOrganizeTracks = () => {
    onOrganizeTracks();
    onClose();
  };

  const handleSwitchView = () => {
    onSwitchView();
    onClose();
  };

  return (
    <div className="view-menu">
      <button className="view-menu-toggle" onClick={onToggle} title="View menu">
        ▤ View
      </button>

      {isOpen && (
        <div className="view-menu-dropdown" onMouseDown={(e) => e.stopPropagation()}>
          {viewMode === 'canvas' && (
            <button
              className="view-menu-item"
              onClick={handleOrganizeTracks}
              disabled={organizeDisabled}
              title="Arrange tracks in a grid"
            >
              ⊞ Organize Tracks
            </button>
          )}

          <button
            className="view-menu-item"
            onClick={handleSwitchView}
            title={viewMode === 'canvas' ? 'Switch to mixer view' : 'Switch to track view'}
          >
            {viewMode === 'canvas' ? '🎚 Switch to Mixer View' : '🖼 Switch to Track View'}
          </button>
        </div>
      )}
    </div>
  );
};
