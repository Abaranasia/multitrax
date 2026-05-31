import React from 'react';
import { createRoot } from 'react-dom/client';
import { AudioProvider } from './context/AudioContext';
import { Canvas } from './components/Canvas';
import './index.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <AudioProvider>
      <Canvas />
    </AudioProvider>
  </React.StrictMode>,
);
