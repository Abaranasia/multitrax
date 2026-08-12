import './SessionMenu.css';

interface SessionMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onLoadSession: () => void;
  onSaveSession: () => void;
  onSaveNewSession: () => void;
  onNewSession: () => void;
  saveDisabled: boolean;
  loadDisabled: boolean;
}

export const SessionMenu = ({
  isOpen,
  onToggle,
  onClose,
  onLoadSession,
  onSaveSession,
  onSaveNewSession,
  onNewSession,
  saveDisabled,
  loadDisabled,
}: SessionMenuProps) => {
  const handleLoadSession = () => {
    onLoadSession();
    onClose();
  };

  const handleSaveSession = () => {
    onSaveSession();
    onClose();
  };

  const handleSaveNewSession = () => {
    onSaveNewSession();
    onClose();
  };

  const handleNewSession = () => {
    onNewSession();
    onClose();
  };

  return (
    <div className="session-menu">
      <button
        className="session-menu-toggle"
        onClick={onToggle}
        title="Session menu"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        ☰ Session
      </button>

      {isOpen && (
        <div className="session-menu-dropdown" onMouseDown={(e) => e.stopPropagation()}>
          <button
            className="session-menu-item"
            onClick={handleLoadSession}
            disabled={loadDisabled}
            title="Load session from file"
          >
            Load Session
          </button>

          <button
            className="session-menu-item"
            onClick={handleSaveSession}
            disabled={saveDisabled}
            title="Save session to file"
          >
            Save Session
          </button>

          <button
            className="session-menu-item"
            onClick={handleSaveNewSession}
            disabled={saveDisabled}
            title="Save session to a new file"
          >
            Save New Session
          </button>

          <button
            className="session-menu-item"
            onClick={handleNewSession}
            title="Clear the current session and start a new one"
          >
            New Session
          </button>
        </div>
      )}
    </div>
  );
};
