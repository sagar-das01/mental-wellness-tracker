import React, { useState, useEffect } from 'react';

const MOOD_PLAYLISTS = {
  sad: {
    name: 'Comforting Melodies (Cozy & Soft)',
    url: 'https://open.spotify.com/embed/playlist/37i9dQZF1DWZqd5JICZIa0',
  },
  neutral: {
    name: 'Acoustic Calm (Peaceful Vibes)',
    url: 'https://open.spotify.com/embed/playlist/37i9dQZF1DWXznn5LI1Ls3',
  },
  happy: {
    name: 'Sunny Beats (Upbeat & Positive)',
    url: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX3rxZdIscKld',
  },
  stressed: {
    name: 'Deep Focus (Quiet Lofi & Ambient)',
    url: 'https://open.spotify.com/embed/playlist/37i9dQZF1DWZeKFBqXMLi1',
  }
};

export default function SpotifyPlayer({ currentMood, currentStress }) {
  const [playlistUrl, setPlaylistUrl] = useState(MOOD_PLAYLISTS.neutral.url);
  const [customUrl, setCustomUrl] = useState('');
  const [customEmbeddedUrl, setCustomEmbeddedUrl] = useState(null);

  // Automatically suggest a playlist based on the latest mood/stress levels
  useEffect(() => {
    if (currentStress >= 4) {
      setPlaylistUrl(MOOD_PLAYLISTS.stressed.url);
    } else if (currentMood <= 2) {
      setPlaylistUrl(MOOD_PLAYLISTS.sad.url);
    } else if (currentMood >= 4) {
      setPlaylistUrl(MOOD_PLAYLISTS.happy.url);
    } else {
      setPlaylistUrl(MOOD_PLAYLISTS.neutral.url);
    }
  }, [currentMood, currentStress]);

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customUrl.trim()) return;

    // Convert standard Spotify playlist link to Embed link
    // Standard format: https://open.spotify.com/playlist/37i9dQZF1DWZqd5JICZIa0?si=...
    // Embed format: https://open.spotify.com/embed/playlist/37i9dQZF1DWZqd5JICZIa0
    const match = customUrl.match(/playlist\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      const embedLink = `https://open.spotify.com/embed/playlist/${match[1]}`;
      setCustomEmbeddedUrl(embedLink);
      setPlaylistUrl(embedLink);
    } else {
      alert('Invalid Spotify Playlist URL. Please copy a playlist share link.');
    }
  };

  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
      <h3 className="card-title" style={{ fontSize: '1rem', marginBottom: '16px' }}>
        🎵 Calm Music (Spotify)
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Suggestion Label */}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Suggested playlist based on your current wellness state:
        </div>

        {/* Built-in Selector */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setPlaylistUrl(MOOD_PLAYLISTS.sad.url)}
            style={{
              background: playlistUrl === MOOD_PLAYLISTS.sad.url ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              border: `1px solid ${playlistUrl === MOOD_PLAYLISTS.sad.url ? 'var(--color-primary)' : 'var(--border-color)'}`,
              color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600
            }}
          >
            😢 Comforting
          </button>
          <button
            type="button"
            onClick={() => setPlaylistUrl(MOOD_PLAYLISTS.neutral.url)}
            style={{
              background: playlistUrl === MOOD_PLAYLISTS.neutral.url ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              border: `1px solid ${playlistUrl === MOOD_PLAYLISTS.neutral.url ? 'var(--color-primary)' : 'var(--border-color)'}`,
              color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600
            }}
          >
            😐 Peaceful
          </button>
          <button
            type="button"
            onClick={() => setPlaylistUrl(MOOD_PLAYLISTS.happy.url)}
            style={{
              background: playlistUrl === MOOD_PLAYLISTS.happy.url ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              border: `1px solid ${playlistUrl === MOOD_PLAYLISTS.happy.url ? 'var(--color-primary)' : 'var(--border-color)'}`,
              color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600
            }}
          >
            😊 Uplifting
          </button>
          <button
            type="button"
            onClick={() => setPlaylistUrl(MOOD_PLAYLISTS.stressed.url)}
            style={{
              background: playlistUrl === MOOD_PLAYLISTS.stressed.url ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              border: `1px solid ${playlistUrl === MOOD_PLAYLISTS.stressed.url ? 'var(--color-primary)' : 'var(--border-color)'}`,
              color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600
            }}
          >
            ⚡ Deep Focus
          </button>
        </div>

        {/* Embedded Iframe Player */}
        <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#000', border: '1px solid var(--border-color)', height: '152px' }}>
          <iframe
            src={playlistUrl}
            width="100%"
            height="152"
            frameBorder="0"
            allowFullScreen=""
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            style={{ border: 'none' }}
          ></iframe>
        </div>

        {/* Paste Custom Playlist */}
        <form onSubmit={handleCustomSubmit} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="form-textarea"
            style={{ minHeight: '36px', height: '36px', padding: '6px 12px', fontSize: '0.8rem', flex: 1, margin: 0 }}
            placeholder="Paste your own Spotify Playlist URL..."
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
          />
          <button 
            type="submit" 
            className="submit-btn" 
            style={{ margin: 0, padding: '0 12px', fontSize: '0.8rem', height: '36px' }}
          >
            Load
          </button>
        </form>

      </div>
    </div>
  );
}
