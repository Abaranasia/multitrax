import './TrackContextMenu.css';

interface TrackContextMenuProps {
  x: number;
  y: number;
  onDuplicate: () => void;
}

export const TrackContextMenu = ({ x, y, onDuplicate }: TrackContextMenuProps) => {
  return (
    <div
      className="track-context-menu"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button className="track-context-menu-item" onClick={onDuplicate}>
        Duplicate
      </button>
    </div>
  );
};
