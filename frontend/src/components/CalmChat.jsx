import React, { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://127.0.0.1:8000/api' 
    : window.location.origin + '/api');

const SUGGESTIONS = [
  "I am feeling very anxious today.",
  "How does sleep affect my stress levels?",
  "I want to practice a quick CBT exercise.",
  "Can you help me reframe a negative thought?"
];

export default function CalmChat({ apiKey }) {
  const [messages, setMessages] = useState([
    {
      role: 'model',
      content: "Hello, I am CalmMind, your CBT-trained wellness companion. I can see your recent check-in patterns. How are you feeling today? We can talk about your day, explore stress triggers, or do a quick mindfulness exercise together."
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() || loading) return;

    if (!textToSend) setInputText('');

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['X-Gemini-Api-Key'] = apiKey;
      }

      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: newMessages })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: 'model', content: data.response }]);
      } else {
        throw new Error('Failed to fetch chat response');
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        { role: 'model', content: "⚠️ Sorry, I'm having trouble connecting to my cognitive model right now. Please try again in a moment." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card animate-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: '500px', padding: '20px', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
        <span style={{ fontSize: '1.5rem' }}>🤖</span>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>Calm Companion Chat</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CBT & Mindfulness Assistant</span>
        </div>
      </div>

      <div style={{ marginBottom: '14px', padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', color: '#fff' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '4px' }}>Start here</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Send a short message, tap one of the examples, or ask for a grounding exercise.
        </div>
      </div>

      {/* Messages Stream */}
      <div style={{ flex: 1, minHeight: '280px', overflowY: 'auto', paddingRight: '6px', display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              background: msg.role === 'user' ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'rgba(255, 255, 255, 0.05)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--border-color)',
              color: '#fff',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
              fontSize: '0.85rem',
              lineHeight: '1.4',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
            }}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', padding: '12px 16px', borderRadius: '12px 12px 12px 0', display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ width: '6px', height: '6px', background: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both' }}></span>
            <span style={{ width: '6px', height: '6px', background: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both 0.2s' }}></span>
            <span style={{ width: '6px', height: '6px', background: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both 0.4s' }}></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      {messages.length === 1 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {SUGGESTIONS.map((sug, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(sug)}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '20px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)', cursor: 'pointer' }}
            >
              💡 {sug}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
      >
        <input
          type="text"
          className="form-textarea"
          style={{ minHeight: '44px', height: '44px', padding: '10px 16px', fontSize: '0.85rem', flex: 1, margin: 0, borderRadius: '22px', color: '#fff', backgroundColor: 'rgba(255,255,255,0.06)' }}
          placeholder="Type your message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="submit-btn"
          style={{ margin: 0, height: '44px', width: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justify: 'center', padding: 0 }}
          disabled={loading || !inputText.trim()}
        >
          🚀
        </button>
      </form>
    </div>
  );
}
