import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://127.0.0.1:8001/api' 
    : window.location.origin + '/api');

// A simple and robust Markdown-to-HTML parser function to render wellness insights beautifully
const parseMarkdown = (text) => {
  if (!text) return '';
  const lines = text.split('\n');
  let html = [];
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Handle Headings (### or **)
    if (line.startsWith('###') || line.startsWith('**') && line.endsWith('**')) {
      if (inList) { html.push('</ul>'); inList = false; }
      let content = line.startsWith('###') ? line.substring(3).trim() : line.substring(2, line.length - 2).trim();
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      html.push(`<h3>${content}</h3>`);
      continue;
    }
    
    // Handle Horizontal Rule
    if (line === '---' || line === '***') {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push('<hr />');
      continue;
    }
    
    // Handle Lists
    if (line.startsWith('*') || line.startsWith('-')) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      let content = line.substring(1).trim();
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      html.push(`<li>${content}</li>`);
      continue;
    } else {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
    }
    
    if (line === '') continue;
    
    // Regular Paragraphs
    let content = line;
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html.push(`<p>${content}</p>`);
  }
  
  if (inList) html.push('</ul>');
  return html.join('');
};

function App() {
  const [logs, setLogs] = useState([]);
  const [mood, setMood] = useState(3);
  const [sleepHours, setSleepHours] = useState(7);
  const [stressLevel, setStressLevel] = useState(3);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('calmmind_gemini_key') || '');
  const [backendHealthy, setBackendHealthy] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [openLogId, setOpenLogId] = useState(null);

  // Statistics
  const [stats, setStats] = useState({ avgMood: 0, avgSleep: 0, avgStress: 0 });

  useEffect(() => {
    checkHealth();
    fetchLogs();
  }, []);

  useEffect(() => {
    calculateStats(logs);
  }, [logs]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        setBackendHealthy(true);
      } else {
        setBackendHealthy(false);
      }
    } catch {
      setBackendHealthy(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error('Failed to fetch logs:', e);
      setBackendHealthy(false);
    }
  };

  const calculateStats = (currentLogs) => {
    if (currentLogs.length === 0) {
      setStats({ avgMood: 0, avgSleep: 0, avgStress: 0 });
      return;
    }
    const totalMood = currentLogs.reduce((acc, l) => acc + l.mood, 0);
    const totalSleep = currentLogs.reduce((acc, l) => acc + l.sleep_hours, 0);
    const totalStress = currentLogs.reduce((acc, l) => acc + l.stress_level, 0);
    
    setStats({
      avgMood: (totalMood / currentLogs.length).toFixed(1),
      avgSleep: (totalSleep / currentLogs.length).toFixed(1),
      avgStress: (totalStress / currentLogs.length).toFixed(1),
    });
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!notes.trim()) {
      showToast('Please add some notes about your day');
      return;
    }

    setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['X-Gemini-API-Key'] = apiKey;
      }

      const res = await fetch(`${API_BASE}/logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mood,
          sleep_hours: parseFloat(sleepHours),
          stress_level: stressLevel,
          notes,
        }),
      });

      if (res.ok) {
        const newLog = await res.json();
        setLogs((prev) => [newLog, ...prev]);
        setNotes('');
        setMood(3);
        setSleepHours(7);
        setStressLevel(3);
        setOpenLogId(newLog.id); // Open the details of the latest log immediately
        showToast('Wellness check-in saved!');
      } else {
        showToast('Failed to save check-in');
      }
    } catch (e) {
      console.error('Failed to submit log:', e);
      showToast('Error connecting to backend');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (e, logId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this check-in?')) return;

    try {
      const res = await fetch(`${API_BASE}/logs/${logId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setLogs((prev) => prev.filter((l) => l.id !== logId));
        if (openLogId === logId) setOpenLogId(null);
        showToast('Check-in deleted');
      }
    } catch (e) {
      console.error('Failed to delete log:', e);
      showToast('Failed to delete check-in');
    }
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('calmmind_gemini_key', apiKey);
    setShowSettings(false);
    showToast('API Key saved successfully!');
  };

  const handleClearApiKey = () => {
    setApiKey('');
    localStorage.removeItem('calmmind_gemini_key');
    setShowSettings(false);
    showToast('API Key cleared');
  };

  const moods = [
    { rating: 1, emoji: '😢', label: 'Struggling' },
    { rating: 2, emoji: '🙁', label: 'Down' },
    { rating: 3, emoji: '😐', label: 'Okay' },
    { rating: 4, emoji: '🙂', label: 'Good' },
    { rating: 5, emoji: '😊', label: 'Joyful' },
  ];

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="app-wrapper">
      {toastMessage && <div className="toast">{toastMessage}</div>}

      {/* Navbar */}
      <header className="navbar">
        <div className="logo-container">
          <span className="logo-icon">🌱</span>
          <span className="logo-title">CalmMind</span>
        </div>

        <div className="nav-actions">
          <div className="status-tag">
            <span className={`status-dot ${apiKey ? 'active' : 'inactive'}`}></span>
            <span>{apiKey ? 'API Active' : 'Fallback Mock Mode'}</span>
          </div>
          <button className="btn-icon" onClick={() => setShowSettings(true)}>
            ⚙️
          </button>
          {!backendHealthy && (
            <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
              ⚠️ Server Offline
            </span>
          )}
        </div>
      </header>

      {/* Dashboard Body */}
      <main className="dashboard-container">
        <div className="dashboard-grid">
          
          {/* Left Column: Check-in Form */}
          <div className="glass-card checkin-card animate-fade">
            <h2 className="card-title">🌱 Check In with Yourself</h2>
            <form onSubmit={handleCheckIn}>
              
              {/* Mood Selection */}
              <div className="form-group">
                <label className="form-label">How are you feeling right now?</label>
                <div className="mood-grid">
                  {moods.map((m) => (
                    <button
                      key={m.rating}
                      type="button"
                      className={`mood-btn ${mood === m.rating ? 'selected' : ''}`}
                      onClick={() => setMood(m.rating)}
                    >
                      <span className="mood-emoji">{m.emoji}</span>
                      <span className="mood-label">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sleep Slider */}
              <div className="form-group">
                <label className="form-label">
                  Sleep Duration <span className="label-val">{sleepHours} Hours</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.5"
                  className="range-slider"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                />
              </div>

              {/* Stress Level Selection */}
              <div className="form-group">
                <label className="form-label">
                  Stress Level <span className="label-val">{stressLevel}/5</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  className="range-slider"
                  value={stressLevel}
                  onChange={(e) => setStressLevel(e.target.value)}
                />
              </div>

              {/* Journal Notes */}
              <div className="form-group">
                <label className="form-label">Journal Notes / Thoughts</label>
                <textarea
                  className="form-textarea"
                  placeholder="What is on your mind? How was your day? Write down any reflections or stressors..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Analyzing with AI...' : 'Complete Check-In ✨'}
              </button>
            </form>
          </div>

          {/* Right Column: Stats & Log History */}
          <div className="animate-fade" style={{ animationDelay: '0.1s' }}>
            
            {/* Stats Summary Cards */}
            <div className="stats-summary">
              <div className="stat-item">
                <span className="stat-val">{stats.avgMood || '-'}</span>
                <span className="stat-label">Avg Mood (1-5)</span>
              </div>
              <div className="stat-item">
                <span className="stat-val">{stats.avgSleep ? `${stats.avgSleep}h` : '-'}</span>
                <span className="stat-label">Avg Sleep</span>
              </div>
              <div className="stat-item">
                <span className="stat-val">{stats.avgStress || '-'}</span>
                <span className="stat-label">Avg Stress (1-5)</span>
              </div>
            </div>

            {/* Check-In History Logs */}
            <div className="logs-section">
              <h3 className="card-title">📖 Your Wellness History</h3>
              {logs.length === 0 ? (
                <div className="glass-card empty-logs-card">
                  <span className="empty-icon">🌱</span>
                  <p>No check-ins yet. Take your first check-in to begin tracking your wellness journey!</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`log-card ${openLogId === log.id ? 'open' : ''}`}
                  >
                    {/* Collapsed Header */}
                    <div
                      className="log-header"
                      onClick={() => setOpenLogId(openLogId === log.id ? null : log.id)}
                    >
                      <div className="log-meta">
                        <span className="log-mood-emoji">
                          {moods.find((m) => m.rating === log.mood)?.emoji || '😐'}
                        </span>
                        <div className="log-date-wrapper">
                          <span className="log-date">{formatDate(log.created_at)}</span>
                          <span className="log-time">{formatTime(log.created_at)}</span>
                        </div>
                      </div>

                      <div className="log-badges">
                        <span className="badge badge-sleep">💤 {log.sleep_hours}h</span>
                        <span className={`badge badge-stress ${log.stress_level <= 2 ? 'low' : ''}`}>
                          ⚡ Stress: {log.stress_level}
                        </span>
                        <span className="log-expand-icon">▼</span>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {openLogId === log.id && (
                      <div className="log-details">
                        <div className="log-notes-section">
                          <span className="section-label">Your Thoughts</span>
                          <p className="log-notes-text">{log.notes}</p>
                        </div>

                        {log.insights && (
                          <div className="insight-box">
                            <span className="section-label" style={{ color: '#8b5cf6', marginBottom: '8px', display: 'block' }}>
                              🧠 AI Wellness Insight
                            </span>
                            <div
                              className="markdown-content"
                              dangerouslySetInnerHTML={{ __html: parseMarkdown(log.insights) }}
                            />
                          </div>
                        )}

                        <button
                          className="log-delete-btn"
                          onClick={(e) => handleDeleteLog(e, log.id)}
                        >
                          Delete Entry
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-backdrop">
          <div className="modal-content animate-fade">
            <div className="modal-header">
              <h3 className="modal-title">⚙️ Settings</h3>
              <button className="close-btn" onClick={() => setShowSettings(false)}>
                &times;
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Gemini API Key</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter your GEMINI_API_KEY"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <span className="form-help">
                Your key is stored locally in your browser and used only to query the Gemini models. Leave empty to use the server's default configuration or the built-in wellness insights mock generator.
              </span>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleClearApiKey}>
                Clear Key
              </button>
              <button className="btn-primary" onClick={handleSaveApiKey}>
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
