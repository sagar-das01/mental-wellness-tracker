import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://127.0.0.1:8000/api' 
    : window.location.origin + '/api');

export default function SpotifyPlayer({ currentMood, currentStress, showToast, spotifyClientId }) {
  const [token, setToken] = useState(() => localStorage.getItem('spotify_access_token') || '');
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('spotify_refresh_token') || '');
  const [currentTrack, setCurrentTrack] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Predefined wellness playlists to display as recommendations
  const recommendedPlaylists = [
    { name: '🌱 Calming Rain', id: '37i9dQZF1DWZqd5JICZIa0' },
    { name: '🌊 Ocean Acoustic', id: '37i9dQZF1DWXznn5LI1Ls3' },
    { name: '🧘 Deep Focus Lofi', id: '37i9dQZF1DWZeKFBqXMLi1' },
    { name: '😊 Sunny Vibes', id: '37i9dQZF1DX3rxZdIscKld' }
  ];

  // Extract auth code from URL query params and exchange for access token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    
    if (code) {
      setErrorMsg('');
      fetch(`${API_BASE}/spotify/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          redirect_uri: window.location.origin + '/'
        })
      })
      .then(res => {
        if (!res.ok) throw new Error('Authorization code exchange failed');
        return res.json();
      })
      .then(data => {
        if (data.access_token) {
          setToken(data.access_token);
          localStorage.setItem('spotify_access_token', data.access_token);
          if (data.refresh_token) {
            setRefreshToken(data.refresh_token);
            localStorage.setItem('spotify_refresh_token', data.refresh_token);
          }
          if (data.expires_in) {
            const expiry = Date.now() + (data.expires_in * 1000);
            localStorage.setItem('spotify_token_expiry', String(expiry));
          }
          
          // Clear query parameters from URL without reloading
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
          
          if (showToast) showToast('Successfully connected to Spotify! 🎵');
        } else {
          setErrorMsg('Failed to exchange code for token.');
        }
      })
      .catch(err => {
        console.error('Error exchanging token:', err);
        setErrorMsg('Error exchanging code for token. Check server configurations.');
      });
    }
  }, []);

  useEffect(() => {
    const refreshExpiry = Number(localStorage.getItem('spotify_token_expiry') || '0');
    const refreshStored = localStorage.getItem('spotify_refresh_token') || '';
    if (!token && refreshStored) {
      if (!refreshExpiry || Date.now() > refreshExpiry - 60000) {
        refreshAccessToken(refreshStored);
      }
    }
  }, []);

  // Poll currently playing track if token exists
  useEffect(() => {
    if (!token) return;
    fetchCurrentlyPlaying();
    
    // Poll every 5 seconds to keep track status synchronized
    const interval = setInterval(fetchCurrentlyPlaying, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const handleConnect = () => {
    if (!spotifyClientId) {
      setErrorMsg('Spotify Integration is not configured on the backend. Please add SPOTIFY_CLIENT_ID to your .env file.');
      return;
    }
    setErrorMsg('');

    const redirectUri = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? `${window.location.origin}/`
      : window.location.origin + '/';
    const scopes = [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing'
    ].join('%20');

    // Redirect to Spotify Auth page (Authorization Code Flow)
    window.location.href = `https://accounts.spotify.com/authorize?client_id=${spotifyClientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&show_dialog=true`;
  };

  const handleDisconnect = () => {
    setToken('');
    setRefreshToken('');
    setCurrentTrack(null);
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expiry');
    if (showToast) showToast('Disconnected from Spotify.');
  };

  const refreshAccessToken = async (rt = refreshToken) => {
    if (!rt) return;
    try {
      const res = await fetch(`${API_BASE}/spotify/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          setToken(data.access_token);
          localStorage.setItem('spotify_access_token', data.access_token);
          if (data.refresh_token) {
            setRefreshToken(data.refresh_token);
            localStorage.setItem('spotify_refresh_token', data.refresh_token);
          }
          if (data.expires_in) {
            const expiry = Date.now() + (data.expires_in * 1000);
            localStorage.setItem('spotify_token_expiry', String(expiry));
          }
          return data.access_token;
        }
      }
    } catch (e) {
      console.error('Failed to refresh Spotify token:', e);
    }
    handleDisconnect();
    return null;
  };

  const fetchCurrentlyPlaying = async () => {
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 204) {
        // Active session found, but no track playing
        setCurrentTrack({ name: 'No track playing', artist: 'Open Spotify to play', albumArt: null, isPlaying: false });
        return;
      }
      if (res.status === 401) {
        // Expired token
        if (refreshToken) {
          const fresh = await refreshAccessToken();
          if (fresh) {
            return fetchCurrentlyPlaying();
          }
        }
        handleDisconnect();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data && data.item) {
          setCurrentTrack({
            name: data.item.name,
            artist: data.item.artists.map(a => a.name).join(', '),
            albumArt: data.item.album.images[0]?.url || null,
            isPlaying: data.is_playing,
            progress: data.progress_ms,
            duration: data.item.duration_ms
          });
        }
      }
    } catch (e) {
      console.error('Failed to get playback state:', e);
    }
  };

  const controlPlayback = async (action) => {
    setErrorMsg('');
    setLoading(true);
    try {
      let method = 'POST';
      let endpoint = `https://api.spotify.com/v1/me/player/${action}`;
      
      if (action === 'play' || action === 'pause') {
        method = 'PUT';
      }

      const res = await fetch(endpoint, {
        method,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 404) {
        setErrorMsg('No active Spotify device found. Start music in your Spotify app first.');
      } else if (res.ok) {
        // Force state update immediately
        setTimeout(fetchCurrentlyPlaying, 500);
      }
    } catch (e) {
      console.error(`Failed to trigger ${action}:`, e);
    } finally {
      setLoading(false);
    }
  };

  const playPlaylist = async (playlistId) => {
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          context_uri: `spotify:playlist:${playlistId}`
        })
      });

      if (res.status === 404) {
        setErrorMsg('No active device. Open Spotify on your phone/computer.');
      } else if (res.ok) {
        setTimeout(fetchCurrentlyPlaying, 500);
      }
    } catch (e) {
      console.error('Failed to play playlist:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
      <h3 className="card-title" style={{ fontSize: '1rem', marginBottom: '16px' }}>
        🎵 Calm Music (Spotify)
      </h3>

      {!token ? (
        // DEFAULT STATE: Render direct embedded Spotify player (no active device required to listen)
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Listen to calming lo-fi beats directly in your browser:
          </div>

          <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#000', border: '1px solid var(--border-color)', height: '152px' }}>
            <iframe
              src="https://open.spotify.com/embed/playlist/37i9dQZF1DWZeKFBqXMLi1"
              width="100%"
              height="152"
              frameBorder="0"
              allowFullScreen=""
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{ border: 'none' }}
            ></iframe>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <button 
              type="button" 
              onClick={handleConnect}
              className="btn-secondary"
              disabled={!spotifyClientId}
              style={{ 
                margin: 0, 
                padding: '8px 16px', 
                fontSize: '0.75rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                border: '1px solid var(--border-color)',
                background: 'rgba(255,255,255,0.02)',
                cursor: spotifyClientId ? 'pointer' : 'not-allowed'
              }}
            >
              🔌 Link Spotify (for Remote Device Control)
            </button>
            
            {!spotifyClientId && (
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                💡 Add `SPOTIFY_CLIENT_ID` to `.env` to enable remote playback controls.
              </span>
            )}
            {token && refreshToken && (
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Spotify session is retained locally and will refresh automatically.
              </span>
            )}
            
            {errorMsg && <div style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600, textAlign: 'center', marginTop: '4px' }}>⚠️ {errorMsg}</div>}
          </div>
        </div>
      ) : (
        // Connected Control View
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Currently Playing Widget */}
          {currentTrack ? (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              {currentTrack.albumArt ? (
                <img src={currentTrack.albumArt} alt="Cover" style={{ width: '48px', height: '48px', borderRadius: '6px' }} />
              ) : (
                <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', display: 'flex', alignItems: 'center', justify: 'center', fontSize: '1.2rem' }}>🎵</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.artist}</div>
              </div>
              <div style={{ color: currentTrack.isPlaying ? '#1DB954' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>
                {currentTrack.isPlaying ? 'PLAYING' : 'PAUSED'}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Synchronizing playback...</div>
          )}

          {/* Web Playback Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
            <button 
              type="button" 
              className="btn-icon" 
              onClick={() => controlPlayback('previous')}
              disabled={loading}
              style={{ width: '36px', height: '36px' }}
            >
              ⏮️
            </button>
            <button 
              type="button" 
              className="submit-btn" 
              onClick={() => controlPlayback(currentTrack?.isPlaying ? 'pause' : 'play')}
              disabled={loading}
              style={{ 
                margin: 0, 
                padding: '8px 20px', 
                fontSize: '0.85rem', 
                background: currentTrack?.isPlaying ? 'rgba(255,255,255,0.1)' : '#1DB954',
                borderColor: 'var(--border-color)',
                border: currentTrack?.isPlaying ? '1px solid var(--border-color)' : 'none'
              }}
            >
              {currentTrack?.isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
            <button 
              type="button" 
              className="btn-icon" 
              onClick={() => controlPlayback('next')}
              disabled={loading}
              style={{ width: '36px', height: '36px' }}
            >
              ⏭️
            </button>
          </div>

          {errorMsg && <div style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 500, textAlign: 'center' }}>⚠️ {errorMsg}</div>}

          {/* Recommended Playlists */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
              🧠 Suggested Wellness Playlists:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {recommendedPlaylists.map(pl => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => playPlaylist(pl.id)}
                  className="btn-secondary"
                  style={{ 
                    padding: '8px', 
                    fontSize: '0.7rem', 
                    textAlign: 'left', 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255,255,255,0.01)'
                  }}
                >
                  {pl.name}
                </button>
              ))}
            </div>
          </div>

          {/* Disconnect Button */}
          <button
            type="button"
            className="log-delete-btn"
            style={{ fontSize: '0.7rem', alignSelf: 'center', marginTop: '4px' }}
            onClick={handleDisconnect}
          >
            Disconnect Account
          </button>

        </div>
      )}
    </div>
  );
}
