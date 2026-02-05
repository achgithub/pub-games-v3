import React, { useState, useEffect, useCallback } from 'react';
import ContentRenderer from './ContentRenderer';

interface SlideshowPageProps {
  token: string;
  onResetToken: () => void;
}

interface Display {
  id: number;
  name: string;
  location: string;
  description: string;
  is_active: boolean;
}

interface ContentItem {
  id: number;
  title: string;
  content_type: string;
  duration_seconds: number;
  file_path?: string;
  url?: string;
  text_content?: string;
  bg_color?: string;
  text_color?: string;
}

interface PlaylistData {
  playlist: {
    id: number;
    name: string;
    description: string;
  };
  items: ContentItem[];
}

const API_BASE = 'http://192.168.1.45:5050/api';
const REFRESH_INTERVAL = 60000; // Check for playlist changes every minute

const SlideshowPage: React.FC<SlideshowPageProps> = ({ token, onResetToken }) => {
  const [display, setDisplay] = useState<Display | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // Fetch display info
  const fetchDisplay = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/display/by-token/${token}`);
      if (!response.ok) {
        throw new Error('Failed to fetch display');
      }
      const data = await response.json();
      if (data.success && data.data) {
        setDisplay(data.data);
        return data.data.id;
      } else {
        throw new Error('Invalid display data');
      }
    } catch (err) {
      console.error('Error fetching display:', err);
      setError('Failed to load display information');
      return null;
    }
  }, [token]);

  // Fetch active playlist for display
  const fetchPlaylist = useCallback(async (displayId: number) => {
    try {
      const response = await fetch(`${API_BASE}/preview/display/${displayId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch playlist');
      }
      const data = await response.json();
      if (data.success && data.data) {
        setPlaylist(data.data);
        setCurrentIndex(0); // Reset to first item when playlist changes
        setError('');
      } else {
        setError('No active playlist assigned');
        setPlaylist(null);
      }
    } catch (err) {
      console.error('Error fetching playlist:', err);
      setError('No content to display');
      setPlaylist(null);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      const displayId = await fetchDisplay();
      if (displayId) {
        await fetchPlaylist(displayId);
      }
    };
    init();
  }, [fetchDisplay, fetchPlaylist]);

  // Periodic refresh of playlist
  useEffect(() => {
    if (!display) return;

    const interval = setInterval(() => {
      fetchPlaylist(display.id);
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [display, fetchPlaylist]);

  // Auto-advance slideshow
  useEffect(() => {
    if (!playlist || !playlist.items || playlist.items.length === 0) return;

    const currentItem = playlist.items[currentIndex];
    const duration = (currentItem.duration_seconds || 10) * 1000;

    console.log(`Showing item ${currentIndex + 1}/${playlist.items.length}: ${currentItem.title} (${currentItem.content_type}) for ${duration}ms`);

    const timer = setTimeout(() => {
      console.log(`Advancing from item ${currentIndex + 1} to ${((currentIndex + 1) % playlist.items.length) + 1}`);
      setCurrentIndex((prev) => (prev + 1) % playlist.items.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [playlist, currentIndex]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Show controls on mouse move
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  if (error && !playlist) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: '#ffffff'
      }}>
        <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</h1>
        <p style={{ fontSize: '24px', marginBottom: '20px' }}>{error}</p>
        {display && (
          <p style={{ fontSize: '18px', color: '#888' }}>
            Display: {display.name} ({display.location})
          </p>
        )}
        <button
          onClick={onResetToken}
          style={{
            marginTop: '40px',
            padding: '15px 30px',
            fontSize: '18px',
            backgroundColor: '#666',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Reset Token
        </button>
      </div>
    );
  }

  if (!playlist || !playlist.items || playlist.items.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: '#ffffff',
        fontSize: '24px'
      }}>
        Loading content...
      </div>
    );
  }

  const currentItem = playlist.items[currentIndex];

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {currentItem ? (
        <ContentRenderer item={currentItem} />
      ) : (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#1a1a1a',
          color: '#fff'
        }}>
          Loading content...
        </div>
      )}

      {/* Control bar (shows on mouse move) */}
      {showControls && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#ffffff',
          padding: '15px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 1000,
          transition: 'opacity 0.3s'
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {display?.name} - {display?.location}
            </div>
            <div style={{ fontSize: '14px', color: '#ccc' }}>
              {playlist.playlist.name} ({currentIndex + 1}/{playlist.items.length})
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setCurrentIndex((prev) => (prev - 1 + playlist.items.length) % playlist.items.length)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              ◀ Prev
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % playlist.items.length)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Next ▶
            </button>
            <button
              onClick={toggleFullscreen}
              style={{
                padding: '10px 20px',
                backgroundColor: '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              {isFullscreen ? '⊟ Exit Fullscreen' : '⊡ Fullscreen'}
            </button>
            <button
              onClick={onResetToken}
              style={{
                padding: '10px 20px',
                backgroundColor: '#d32f2f',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '4px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        zIndex: 999
      }}>
        <div style={{
          height: '100%',
          backgroundColor: '#4CAF50',
          width: `${((currentIndex + 1) / playlist.items.length) * 100}%`,
          transition: 'width 0.3s'
        }} />
      </div>
    </div>
  );
};

export default SlideshowPage;
