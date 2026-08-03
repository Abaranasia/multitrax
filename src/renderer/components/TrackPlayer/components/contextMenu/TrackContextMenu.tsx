import './TrackContextMenu.css';

interface TrackContextMenuProps {
  x: number;
  y: number;
  onDuplicate: () => void;
  onReveal: () => void;
  revealDisabled?: boolean;
}

export const TrackContextMenu = ({
  x,
  y,
  onDuplicate,
  onReveal,
  revealDisabled = false,
}: TrackContextMenuProps) => {
  return (
    <div
      className="track-context-menu"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button className="track-context-menu-item" onClick={onDuplicate}>
        Duplicate
      </button>

      <button
        className="track-context-menu-item"
        onClick={onReveal}
        disabled={revealDisabled}
        title={revealDisabled ? 'Source file location is unavailable for this track' : undefined}
      >
        Show in Folder
      </button>
    </div>
  );
};
