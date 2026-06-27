import React, { useState, useRef, useEffect } from 'react';

export default function AmbientPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundType, setSoundType] = useState('rain'); // 'rain' | 'hum' | 'waves'
  const [volume, setVolume] = useState(0.3);

  const audioCtxRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const filterNodeRef = useRef(null);
  const oscillatorNodesRef = useRef([]);

  useEffect(() => {
    // Cleanup audio context on unmount
    return () => {
      stopAudio();
    };
  }, []);

  useEffect(() => {
    if (isPlaying && gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume, isPlaying]);

  // Handle sound type switch while playing
  useEffect(() => {
    if (isPlaying) {
      stopAudio();
      startAudio();
    }
  }, [soundType]);

  const initAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const createPinkNoiseBuffer = () => {
    const ctx = audioCtxRef.current;
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11; // scale to prevent clipping
      b6 = white * 0.115926;
    }
    return noiseBuffer;
  };

  const startAudio = () => {
    initAudioContext();
    const ctx = audioCtxRef.current;

    // Create Gain Node
    gainNodeRef.current = ctx.createGain();
    gainNodeRef.current.gain.value = volume;

    if (soundType === 'rain') {
      // 1. Synthesize Rain (Filtered Pink Noise)
      const noiseBuffer = createPinkNoiseBuffer();
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;

      // Low pass filter for soft rain rumble
      filterNodeRef.current = ctx.createBiquadFilter();
      filterNodeRef.current.type = 'lowpass';
      filterNodeRef.current.frequency.setValueAtTime(800, ctx.currentTime);

      source.connect(filterNodeRef.current);
      filterNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(ctx.destination);

      source.start(0);
      sourceNodeRef.current = source;

    } else if (soundType === 'hum') {
      // 2. Synthesize Cosmic Binaural Hum (Dual detuned sine oscillators + low-frequency pulse)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(85, ctx.currentTime); // 85Hz Base

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(87.5, ctx.currentTime); // 87.5Hz Binaural

      // Low pass to ensure deep bass feel
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(150, ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNodeRef.current);
      gainNodeRef.current.connect(ctx.destination);

      osc1.start(0);
      osc2.start(0);

      oscillatorNodesRef.current = [osc1, osc2];

    } else if (soundType === 'waves') {
      // 3. Synthesize Ocean Waves (Filtered white noise modulated by a very slow LFO)
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      // Dynamic Bandpass filter
      const waveFilter = ctx.createBiquadFilter();
      waveFilter.type = 'bandpass';
      waveFilter.Q.setValueAtTime(2.0, ctx.currentTime);

      // LFO to modulate filter frequency (creates wave swelling effect)
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.12, ctx.currentTime); // 0.12Hz (8 second wave cycle)

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(300, ctx.currentTime); // Swell amplitude

      // Connect LFO modulation
      lfo.connect(lfoGain);
      lfoGain.connect(waveFilter.frequency);

      noiseSource.connect(waveFilter);
      waveFilter.connect(gainNodeRef.current);
      gainNodeRef.current.connect(ctx.destination);

      lfo.start(0);
      noiseSource.start(0);

      sourceNodeRef.current = noiseSource;
      oscillatorNodesRef.current = [lfo];
      filterNodeRef.current = waveFilter;
    }

    setIsPlaying(true);
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current = null;
    }
    if (oscillatorNodesRef.current.length > 0) {
      oscillatorNodesRef.current.forEach((osc) => {
        try { osc.stop(); } catch {}
      });
      oscillatorNodesRef.current = [];
    }
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      startAudio();
    }
  };

  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
      <h3 className="card-title" style={{ fontSize: '1rem', marginBottom: '16px' }}>
        🎧 Ambient Soundscapes
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Play & Selection Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            onClick={togglePlay}
            className="submit-btn" 
            style={{ 
              margin: 0, 
              padding: '8px 16px', 
              fontSize: '0.85rem',
              minWidth: '90px',
              background: isPlaying ? 'linear-gradient(135deg, #ef4444, #f59e0b)' : 'var(--gradient-brand)'
            }}
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
          </button>

          <div style={{ display: 'flex', gap: '6px', background: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setSoundType('rain')}
              style={{
                background: soundType === 'rain' ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600
              }}
            >
              🌧️ Rain
            </button>
            <button
              type="button"
              onClick={() => setSoundType('waves')}
              style={{
                background: soundType === 'waves' ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600
              }}
            >
              🌊 Waves
            </button>
            <button
              type="button"
              onClick={() => setSoundType('hum')}
              style={{
                background: soundType === 'hum' ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600
              }}
            >
              🌌 Cosmic Hum
            </button>
          </div>
        </div>

        {/* Volume slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>🔊 Volume</span>
          <input
            type="range"
            min="0"
            max="0.8"
            step="0.05"
            className="range-slider"
            style={{ margin: 0, flex: 1 }}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
          />
        </div>

      </div>
    </div>
  );
}
