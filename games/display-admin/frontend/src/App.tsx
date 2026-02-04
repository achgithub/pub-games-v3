import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface Display {
  id: number;
  name: string;
  location: string;
  description: string;
  token: string;
  is_active: boolean;
  created_at: string;
}

interface ContentItem {
  id: number;
  title: string;
  content_type: 'image' | 'url' | 'social_feed' | 'leaderboard' | 'schedule' | 'announcement';
  duration_seconds: number;
  file_path?: string;
  url?: string;
  text_content?: string;
  bg_color?: string;
  text_color?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface PlaylistItem {
  id: number;
  playlist_id: number;
  content_item_id: number;
  display_order: number;
  override_duration?: number;
  created_at: string;
  content_item?: ContentItem;
}

interface Playlist {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  items?: PlaylistItem[];
}

interface DisplayAssignment {
  id: number;
  display_id: number;
  playlist_id: number;
  priority: number;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  days_of_week?: string;
  created_at: string;
  updated_at: string;
  display?: Display;
  playlist?: Playlist;
}

type TabType = 'displays' | 'content' | 'playlists' | 'assignments';

// ============================================================================
// MAIN APP
// ============================================================================

const App: React.FC = () => {
  // Get token from URL (passed by identity shell)
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || 'demo-token-admin@pubgames.local';

  // State
  const [activeTab, setActiveTab] = useState<TabType>('displays');
  const [displays, setDisplays] = useState<Display[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [assignments, setAssignments] = useState<DisplayAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedQRDisplay, setSelectedQRDisplay] = useState<Display | null>(null);

  const API_BASE = window.location.origin;

  // Helper: API call with auth
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        alert('Unauthorized. Admin access required.');
        throw new Error('Unauthorized');
      }
      const data = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(data.error || `Request failed: ${res.status}`);
    }

    return res.json();
  };

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadDisplays = useCallback(async () => {
    try {
      const data = await apiCall('/api/displays');
      setDisplays(data.data || []);
    } catch (err: any) {
      setError(`Failed to load displays: ${err.message}`);
    }
  }, [token]);

  const loadContent = useCallback(async () => {
    try {
      const data = await apiCall('/api/content');
      setContent(data.data || []);
    } catch (err: any) {
      setError(`Failed to load content: ${err.message}`);
    }
  }, [token]);

  const loadPlaylists = useCallback(async () => {
    try {
      const data = await apiCall('/api/playlists');
      setPlaylists(data.data || []);
    } catch (err: any) {
      setError(`Failed to load playlists: ${err.message}`);
    }
  }, [token]);

  const loadAssignments = useCallback(async () => {
    try {
      const data = await apiCall('/api/assignments');
      setAssignments(data.data || []);
    } catch (err: any) {
      setError(`Failed to load assignments: ${err.message}`);
    }
  }, [token]);

  useEffect(() => {
    loadDisplays();
    loadContent();
    loadPlaylists();
    loadAssignments();
  }, [loadDisplays, loadContent, loadPlaylists, loadAssignments]);

  // ============================================================================
  // DISPLAY HANDLERS
  // ============================================================================

  const createDisplay = async (name: string, location: string, description: string) => {
    try {
      setLoading(true);
      await apiCall('/api/displays', {
        method: 'POST',
        body: JSON.stringify({ name, location, description }),
      });
      await loadDisplays();
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteDisplay = async (id: number) => {
    if (!window.confirm('Delete this display?')) return;
    try {
      await apiCall(`/api/displays/${id}`, { method: 'DELETE' });
      await loadDisplays();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const showQRCode = (display: Display) => {
    setSelectedQRDisplay(display);
  };

  // ============================================================================
  // CONTENT HANDLERS
  // ============================================================================

  const createContent = async (formData: any) => {
    try {
      setLoading(true);
      await apiCall('/api/content', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      await loadContent();
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File, title: string, duration: number) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('image', file);
      formData.append('title', title);
      formData.append('duration_seconds', duration.toString());

      const res = await fetch(`${API_BASE}/api/content/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      await loadContent();
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteContent = async (id: number) => {
    if (!window.confirm('Delete this content?')) return;
    try {
      await apiCall(`/api/content/${id}`, { method: 'DELETE' });
      await loadContent();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ============================================================================
  // PLAYLIST HANDLERS
  // ============================================================================

  const createPlaylist = async (name: string, description: string) => {
    try {
      setLoading(true);
      await apiCall('/api/playlists', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      await loadPlaylists();
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addToPlaylist = async (playlistId: number, contentId: number) => {
    try {
      await apiCall(`/api/playlists/${playlistId}/items`, {
        method: 'POST',
        body: JSON.stringify({ content_item_id: contentId }),
      });
      await loadPlaylists();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const removeFromPlaylist = async (playlistId: number, itemId: number) => {
    if (!window.confirm('Remove from playlist?')) return;
    try {
      await apiCall(`/api/playlists/${playlistId}/items/${itemId}`, {
        method: 'DELETE',
      });
      await loadPlaylists();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deletePlaylist = async (id: number) => {
    if (!window.confirm('Delete this playlist?')) return;
    try {
      await apiCall(`/api/playlists/${id}`, { method: 'DELETE' });
      await loadPlaylists();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ============================================================================
  // ASSIGNMENT HANDLERS
  // ============================================================================

  const createAssignment = async (formData: any) => {
    try {
      setLoading(true);
      await apiCall('/api/assignments', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      await loadAssignments();
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteAssignment = async (id: number) => {
    if (!window.confirm('Delete this assignment?')) return;
    try {
      await apiCall(`/api/assignments/${id}`, { method: 'DELETE' });
      await loadAssignments();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Display Admin</h1>
        <p style={styles.subtitle}>Manage TV Display Content</p>
      </header>

      {/* Tab Navigation */}
      <div style={styles.tabs}>
        <button
          style={activeTab === 'displays' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('displays')}
        >
          Displays
        </button>
        <button
          style={activeTab === 'content' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('content')}
        >
          Content
        </button>
        <button
          style={activeTab === 'playlists' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('playlists')}
        >
          Playlists
        </button>
        <button
          style={activeTab === 'assignments' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('assignments')}
        >
          Assignments
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={() => setError('')} style={styles.closeBtn}>×</button>
        </div>
      )}

      {/* Tab Content */}
      <div style={styles.content}>
        {activeTab === 'displays' && (
          <DisplaysTab
            displays={displays}
            onCreate={createDisplay}
            onDelete={deleteDisplay}
            onShowQR={showQRCode}
            loading={loading}
          />
        )}
        {activeTab === 'content' && (
          <ContentTab
            content={content}
            onCreate={createContent}
            onUpload={uploadImage}
            onDelete={deleteContent}
            loading={loading}
          />
        )}
        {activeTab === 'playlists' && (
          <PlaylistsTab
            playlists={playlists}
            content={content}
            onCreate={createPlaylist}
            onAddItem={addToPlaylist}
            onRemoveItem={removeFromPlaylist}
            onDelete={deletePlaylist}
            loading={loading}
          />
        )}
        {activeTab === 'assignments' && (
          <AssignmentsTab
            assignments={assignments}
            displays={displays}
            playlists={playlists}
            onCreate={createAssignment}
            onDelete={deleteAssignment}
            loading={loading}
          />
        )}
      </div>

      {/* QR Code Modal */}
      {selectedQRDisplay && (
        <QRModal
          display={selectedQRDisplay}
          onClose={() => setSelectedQRDisplay(null)}
          apiBase={API_BASE}
          token={token}
        />
      )}
    </div>
  );
};

// ============================================================================
// DISPLAYS TAB
// ============================================================================

const DisplaysTab: React.FC<{
  displays: Display[];
  onCreate: (name: string, location: string, description: string) => void;
  onDelete: (id: number) => void;
  onShowQR: (display: Display) => void;
  loading: boolean;
}> = ({ displays, onCreate, onDelete, onShowQR, loading }) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onCreate(name, location, description);
    setName('');
    setLocation('');
    setDescription('');
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>Displays</h2>

      {/* Create Form */}
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formRow}>
          <input
            type="text"
            placeholder="Display Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="text"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={styles.input}
          />
        </div>
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={styles.textarea}
        />
        <button type="submit" disabled={loading} style={styles.button}>
          Create Display
        </button>
      </form>

      {/* Display List */}
      <div style={styles.list}>
        {displays.map((display) => (
          <div key={display.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>{display.name}</h3>
              <div style={styles.cardActions}>
                <button
                  onClick={() => onShowQR(display)}
                  style={styles.btnSecondary}
                >
                  QR Code
                </button>
                <button
                  onClick={() => onDelete(display.id)}
                  style={styles.btnDanger}
                >
                  Delete
                </button>
              </div>
            </div>
            <p style={styles.cardText}><strong>Location:</strong> {display.location}</p>
            <p style={styles.cardText}><strong>Status:</strong> {display.is_active ? 'Active' : 'Inactive'}</p>
            <p style={styles.cardText}><strong>Token:</strong> <code style={styles.code}>{display.token}</code></p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// CONTENT TAB
// ============================================================================

const ContentTab: React.FC<{
  content: ContentItem[];
  onCreate: (data: any) => void;
  onUpload: (file: File, title: string, duration: number) => void;
  onDelete: (id: number) => void;
  loading: boolean;
}> = ({ content, onCreate, onUpload, onDelete, loading }) => {
  const [mode, setMode] = useState<'create' | 'upload'>('create');
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<string>('announcement');
  const [duration, setDuration] = useState(10);
  const [url, setUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [bgColor, setBgColor] = useState('#003366');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const data: any = {
      title,
      content_type: contentType,
      duration_seconds: duration,
    };

    if (contentType === 'url' || contentType === 'social_feed') {
      data.url = url;
    } else if (contentType === 'announcement') {
      data.text_content = textContent;
      data.bg_color = bgColor;
      data.text_color = textColor;
    }

    onCreate(data);
    resetForm();
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile || !title) return;
    onUpload(imageFile, title, duration);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setUrl('');
    setTextContent('');
    setImageFile(null);
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>Content</h2>

      {/* Mode Toggle */}
      <div style={styles.toggleGroup}>
        <button
          onClick={() => setMode('create')}
          style={mode === 'create' ? styles.activeToggle : styles.toggle}
        >
          Create Content
        </button>
        <button
          onClick={() => setMode('upload')}
          style={mode === 'upload' ? styles.activeToggle : styles.toggle}
        >
          Upload Image
        </button>
      </div>

      {/* Create Content Form */}
      {mode === 'create' && (
        <form onSubmit={handleCreate} style={styles.form}>
          <input
            type="text"
            placeholder="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={styles.input}
            required
          />
          <div style={styles.formRow}>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              style={styles.select}
            >
              <option value="announcement">Announcement</option>
              <option value="url">URL/Iframe</option>
              <option value="social_feed">Social Feed</option>
              <option value="leaderboard">Leaderboard</option>
              <option value="schedule">Schedule</option>
            </select>
            <input
              type="number"
              placeholder="Duration (seconds)"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              style={styles.input}
              min="1"
            />
          </div>

          {(contentType === 'url' || contentType === 'social_feed') && (
            <input
              type="url"
              placeholder="URL *"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={styles.input}
              required
            />
          )}

          {contentType === 'announcement' && (
            <>
              <textarea
                placeholder="Announcement Text *"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                style={styles.textarea}
                required
              />
              <div style={styles.formRow}>
                <label style={styles.colorLabel}>
                  Background:
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    style={styles.colorInput}
                  />
                </label>
                <label style={styles.colorLabel}>
                  Text:
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    style={styles.colorInput}
                  />
                </label>
              </div>
            </>
          )}

          <button type="submit" disabled={loading} style={styles.button}>
            Create Content
          </button>
        </form>
      )}

      {/* Upload Image Form */}
      {mode === 'upload' && (
        <form onSubmit={handleUpload} style={styles.form}>
          <input
            type="text"
            placeholder="Image Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="number"
            placeholder="Duration (seconds)"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            style={styles.input}
            min="1"
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            style={styles.fileInput}
            required
          />
          <button type="submit" disabled={loading || !imageFile} style={styles.button}>
            Upload Image
          </button>
        </form>
      )}

      {/* Content List */}
      <div style={styles.list}>
        {content.map((item) => (
          <div key={item.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>{item.title}</h3>
              <button onClick={() => onDelete(item.id)} style={styles.btnDanger}>
                Delete
              </button>
            </div>
            <p style={styles.cardText}>
              <strong>Type:</strong> {item.content_type} | <strong>Duration:</strong> {item.duration_seconds}s
            </p>
            {item.file_path && (
              <img
                src={`${window.location.origin}${item.file_path}`}
                alt={item.title}
                style={styles.thumbnail}
              />
            )}
            {item.url && <p style={styles.cardText}><strong>URL:</strong> {item.url}</p>}
            {item.text_content && <p style={styles.cardText}><strong>Text:</strong> {item.text_content}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// PLAYLISTS TAB
// ============================================================================

const PlaylistsTab: React.FC<{
  playlists: Playlist[];
  content: ContentItem[];
  onCreate: (name: string, description: string) => void;
  onAddItem: (playlistId: number, contentId: number) => void;
  onRemoveItem: (playlistId: number, itemId: number) => void;
  onDelete: (id: number) => void;
  loading: boolean;
}> = ({ playlists, content, onCreate, onAddItem, onRemoveItem, onDelete, loading }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<number | null>(null);
  const [selectedContent, setSelectedContent] = useState<number>(0);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onCreate(name, description);
    setName('');
    setDescription('');
  };

  const handleAddItem = () => {
    if (selectedPlaylist && selectedContent) {
      onAddItem(selectedPlaylist, selectedContent);
    }
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>Playlists</h2>

      {/* Create Form */}
      <form onSubmit={handleCreate} style={styles.form}>
        <input
          type="text"
          placeholder="Playlist Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
          required
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={styles.textarea}
        />
        <button type="submit" disabled={loading} style={styles.button}>
          Create Playlist
        </button>
      </form>

      {/* Playlist List */}
      <div style={styles.list}>
        {playlists.map((playlist) => (
          <div key={playlist.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>{playlist.name}</h3>
              <div style={styles.cardActions}>
                <button
                  onClick={() => setSelectedPlaylist(selectedPlaylist === playlist.id ? null : playlist.id)}
                  style={styles.btnSecondary}
                >
                  {selectedPlaylist === playlist.id ? 'Close' : 'Edit'}
                </button>
                <button onClick={() => onDelete(playlist.id)} style={styles.btnDanger}>
                  Delete
                </button>
              </div>
            </div>
            <p style={styles.cardText}>{playlist.description}</p>
            <p style={styles.cardText}><strong>Items:</strong> {playlist.items?.length || 0}</p>

            {/* Playlist Items */}
            {selectedPlaylist === playlist.id && (
              <div style={styles.playlistEdit}>
                {/* Add Item */}
                <div style={styles.addItem}>
                  <select
                    value={selectedContent}
                    onChange={(e) => setSelectedContent(parseInt(e.target.value))}
                    style={styles.select}
                  >
                    <option value={0}>Select content to add...</option>
                    {content.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} ({item.content_type})
                      </option>
                    ))}
                  </select>
                  <button onClick={handleAddItem} style={styles.btnSecondary}>
                    Add
                  </button>
                </div>

                {/* Current Items */}
                <div style={styles.playlistItems}>
                  {playlist.items?.map((item, index) => (
                    <div key={item.id} style={styles.playlistItem}>
                      <span style={styles.itemOrder}>{index + 1}</span>
                      <span style={styles.itemTitle}>
                        {item.content_item?.title || `Content #${item.content_item_id}`}
                      </span>
                      <span style={styles.itemDuration}>
                        {item.override_duration || item.content_item?.duration_seconds || 10}s
                      </span>
                      <button
                        onClick={() => onRemoveItem(playlist.id, item.id)}
                        style={styles.btnSmall}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {(!playlist.items || playlist.items.length === 0) && (
                    <p style={styles.emptyText}>No items in playlist</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// ASSIGNMENTS TAB
// ============================================================================

const AssignmentsTab: React.FC<{
  assignments: DisplayAssignment[];
  displays: Display[];
  playlists: Playlist[];
  onCreate: (data: any) => void;
  onDelete: (id: number) => void;
  loading: boolean;
}> = ({ assignments, displays, playlists, onCreate, onDelete, loading }) => {
  const [displayId, setDisplayId] = useState<number>(0);
  const [playlistId, setPlaylistId] = useState<number>(0);
  const [priority, setPriority] = useState(5);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayId || !playlistId) return;

    const data: any = {
      display_id: displayId,
      playlist_id: playlistId,
      priority,
    };

    if (startDate) data.start_date = startDate;
    if (endDate) data.end_date = endDate;
    if (startTime) data.start_time = startTime;
    if (endTime) data.end_time = endTime;
    if (daysOfWeek) data.days_of_week = daysOfWeek;

    onCreate(data);
    resetForm();
  };

  const resetForm = () => {
    setDisplayId(0);
    setPlaylistId(0);
    setPriority(5);
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setDaysOfWeek('');
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>Display Assignments</h2>

      {/* Create Form */}
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formRow}>
          <select
            value={displayId}
            onChange={(e) => setDisplayId(parseInt(e.target.value))}
            style={styles.select}
            required
          >
            <option value={0}>Select Display *</option>
            {displays.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.location})
              </option>
            ))}
          </select>
          <select
            value={playlistId}
            onChange={(e) => setPlaylistId(parseInt(e.target.value))}
            style={styles.select}
            required
          >
            <option value={0}>Select Playlist *</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.formRow}>
          <label style={styles.label}>
            Priority:
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value))}
              style={styles.input}
              min="0"
              max="10"
            />
          </label>
        </div>

        <h4 style={styles.subsectionTitle}>Scheduling (Optional)</h4>

        <div style={styles.formRow}>
          <label style={styles.label}>
            Start Date:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            End Date:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={styles.input}
            />
          </label>
        </div>

        <div style={styles.formRow}>
          <label style={styles.label}>
            Start Time:
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            End Time:
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={styles.input}
            />
          </label>
        </div>

        <input
          type="text"
          placeholder="Days of Week (e.g., Mon,Tue,Wed)"
          value={daysOfWeek}
          onChange={(e) => setDaysOfWeek(e.target.value)}
          style={styles.input}
        />

        <button type="submit" disabled={loading} style={styles.button}>
          Create Assignment
        </button>
      </form>

      {/* Assignments List */}
      <div style={styles.list}>
        {assignments.map((assignment) => (
          <div key={assignment.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>
                {assignment.display?.name} → {assignment.playlist?.name}
              </h3>
              <button onClick={() => onDelete(assignment.id)} style={styles.btnDanger}>
                Delete
              </button>
            </div>
            <p style={styles.cardText}><strong>Priority:</strong> {assignment.priority}</p>
            {assignment.start_date && (
              <p style={styles.cardText}><strong>Date Range:</strong> {assignment.start_date} to {assignment.end_date || 'ongoing'}</p>
            )}
            {assignment.start_time && (
              <p style={styles.cardText}><strong>Time Range:</strong> {assignment.start_time} to {assignment.end_time || 'end of day'}</p>
            )}
            {assignment.days_of_week && (
              <p style={styles.cardText}><strong>Days:</strong> {assignment.days_of_week}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// QR CODE MODAL
// ============================================================================

const QRModal: React.FC<{
  display: Display;
  onClose: () => void;
  apiBase: string;
  token: string;
}> = ({ display, onClose, apiBase, token }) => {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>QR Code: {display.name}</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>
        <div style={styles.modalBody}>
          <img
            src={`${apiBase}/api/displays/${display.id}/qr?t=${Date.now()}`}
            alt="QR Code"
            style={styles.qrImage}
            onError={(e) => {
              console.error('QR code failed to load');
            }}
          />
          <p style={styles.modalText}>Scan this QR code on the TV to set up the display.</p>
          <p style={styles.modalText}><strong>Token:</strong></p>
          <code style={styles.codeBlock}>{display.token}</code>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
    borderBottom: '2px solid #003366',
    paddingBottom: '20px',
  },
  title: {
    fontSize: '32px',
    color: '#003366',
    margin: '0 0 10px 0',
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
    margin: 0,
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    borderBottom: '2px solid #ddd',
  },
  tab: {
    padding: '12px 24px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '16px',
    color: '#666',
    borderBottom: '3px solid transparent',
    transition: 'all 0.2s',
  },
  activeTab: {
    padding: '12px 24px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '16px',
    color: '#003366',
    borderBottom: '3px solid #003366',
    fontWeight: 'bold',
  },
  content: {
    background: 'white',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: '24px',
    color: '#003366',
    marginBottom: '20px',
  },
  subsectionTitle: {
    fontSize: '18px',
    color: '#003366',
    margin: '20px 0 10px 0',
  },
  form: {
    marginBottom: '30px',
    padding: '20px',
    background: '#f9f9f9',
    borderRadius: '8px',
  },
  formRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '10px',
  },
  input: {
    flex: 1,
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  textarea: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    minHeight: '80px',
    marginBottom: '10px',
  },
  select: {
    flex: 1,
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  button: {
    padding: '12px 24px',
    background: '#003366',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  btnSecondary: {
    padding: '8px 16px',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  btnDanger: {
    padding: '8px 16px',
    background: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  btnSmall: {
    padding: '4px 8px',
    background: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  list: {
    display: 'grid',
    gap: '15px',
  },
  card: {
    padding: '20px',
    background: '#f9f9f9',
    borderRadius: '8px',
    border: '1px solid #ddd',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  },
  cardTitle: {
    fontSize: '18px',
    color: '#003366',
    margin: 0,
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
  },
  cardText: {
    margin: '8px 0',
    fontSize: '14px',
    color: '#333',
  },
  code: {
    padding: '2px 6px',
    background: '#e0e0e0',
    borderRadius: '3px',
    fontFamily: 'monospace',
    fontSize: '13px',
  },
  codeBlock: {
    display: 'block',
    padding: '10px',
    background: '#e0e0e0',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '13px',
    wordBreak: 'break-all',
  },
  thumbnail: {
    maxWidth: '200px',
    maxHeight: '150px',
    objectFit: 'cover',
    borderRadius: '4px',
    marginTop: '10px',
  },
  error: {
    padding: '15px',
    background: '#f8d7da',
    color: '#721c24',
    borderRadius: '4px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#721c24',
    padding: '0 8px',
  },
  toggleGroup: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  toggle: {
    padding: '10px 20px',
    background: '#e0e0e0',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  activeToggle: {
    padding: '10px 20px',
    background: '#003366',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  colorLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
  },
  colorInput: {
    width: '60px',
    height: '40px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  fileInput: {
    marginBottom: '10px',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    width: '100%',
  },
  playlistEdit: {
    marginTop: '20px',
    padding: '15px',
    background: 'white',
    borderRadius: '4px',
  },
  addItem: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px',
  },
  playlistItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  playlistItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    background: '#f9f9f9',
    borderRadius: '4px',
    border: '1px solid #ddd',
  },
  itemOrder: {
    fontWeight: 'bold',
    color: '#003366',
    minWidth: '30px',
  },
  itemTitle: {
    flex: 1,
    fontSize: '14px',
  },
  itemDuration: {
    fontSize: '14px',
    color: '#666',
    minWidth: '50px',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: '20px',
    fontStyle: 'italic',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'white',
    borderRadius: '8px',
    padding: '20px',
    maxWidth: '500px',
    width: '90%',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '2px solid #003366',
    paddingBottom: '10px',
  },
  modalTitle: {
    fontSize: '20px',
    color: '#003366',
    margin: 0,
  },
  modalBody: {
    textAlign: 'center',
  },
  qrImage: {
    maxWidth: '100%',
    height: 'auto',
    marginBottom: '20px',
  },
  modalText: {
    margin: '10px 0',
    fontSize: '14px',
    color: '#333',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
  },
};

export default App;
