import React, { useState, useEffect, useRef } from 'react';
import {
  SparklesIcon,
  DownloadIcon,
  TrashIcon,
  ImageIcon,
  RefreshIcon,
  CopyIcon,
  CheckIcon,
  ExpandIcon,
  CloseIcon,
  DiceIcon
} from './components/Icons';

const STYLE_PRESETS = [
  {
    id: 'photorealistic',
    name: 'Photorealistic',
    icon: '📸',
    suffix: ', 8k resolution, highly detailed, photorealistic, cinematic lighting, hyperrealism, 35mm photography'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    icon: '⚡',
    suffix: ', cyberpunk style, neon ambient lighting, futuristic city, high tech, highly detailed, octane render'
  },
  {
    id: 'anime',
    name: 'Anime / Manga',
    icon: '🌸',
    suffix: ', anime aesthetic, Makoto Shinkai style, vibrant colors, clean lineart, beautiful sky, studio ghibli vibe'
  },
  {
    id: 'digital-art',
    name: 'Digital Art',
    icon: '🎨',
    suffix: ', digital art, concept art, trending on ArtStation, dramatic atmosphere, dynamic lighting, masterpiece'
  },
  {
    id: 'cinematic-3d',
    name: 'Cinematic 3D',
    icon: '🎬',
    suffix: ', 3d render, octane render, Unreal Engine 5, volumetric fog, subsurface scattering, Pixar quality'
  },
  {
    id: 'oil-painting',
    name: 'Oil Painting',
    icon: '🖌️',
    suffix: ', classical oil painting, heavy textured impasto brush strokes, Renaissance masterpiece, dramatic chiaroscuro'
  },
  {
    id: 'fantasy',
    name: 'Fantasy Concept',
    icon: '🐉',
    suffix: ', epic mythical fantasy scenery, glowing runes, magical ethereal ambiance, grand scale landscape'
  },
  {
    id: 'vector',
    name: 'Minimal Vector',
    icon: '📐',
    suffix: ', modern minimalist vector illustration, flat design, bold solid colors, geometric harmony, clean line art'
  }
];

const SAMPLE_PROMPTS = [
  'A neon-lit cybernetic samurai wandering in a rainy futuristic Tokyo alley',
  'A magical floating castle surrounded by golden clouds at sunset',
  'A cute astronaut cat exploring an alien crystalline flower garden',
  'An ancient mystical library with glowing spellbooks and spiral staircases',
  'A sleek stealth hypercar speeding across a bioluminescent coastline',
  'A cozy greenhouse cafe with hanging ferns, rain drizzling against glass windows',
  'A majestic cosmic owl with galaxies reflecting inside its eyes'
];

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 Square', width: 1024, height: 1024, class: 'square' },
  { id: '16:9', label: '16:9 Wide', width: 1024, height: 576, class: 'landscape' },
  { id: '9:16', label: '9:16 Story', width: 576, height: 1024, class: 'portrait' }
];

const LOCAL_STORAGE_KEY = 'ai_studio_gallery_v1';

export default function App() {
  const [prompt, setPrompt] = useState('A solitary cyberpunk explorer standing on a neon rooftop overlooking a rain-drenched megacity');
  const [activePreset, setActivePreset] = useState(STYLE_PRESETS[0].id);
  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0].id);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 999999));
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('Synthesizing prompt...');
  const [currentImage, setCurrentImage] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Load gallery from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setGallery(parsed);
          if (parsed.length > 0 && !currentImage) {
            setCurrentImage(parsed[0]);
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse gallery from localStorage:', e);
    }
  }, []);

  // Save gallery to localStorage
  const saveGallery = (newGallery) => {
    setGallery(newGallery);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newGallery));
    } catch (e) {
      console.error('Failed to write to localStorage:', e);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const handleSurprisePrompt = () => {
    const random = SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)];
    setPrompt(random);
    setSeed(Math.floor(Math.random() * 999999));
  };

  const handleGenerate = (customSeed = null) => {
    if (!prompt.trim()) {
      showToast('Please type a prompt first!');
      return;
    }

    const currentSeed = customSeed !== null ? customSeed : Math.floor(Math.random() * 999999);
    setSeed(currentSeed);
    setIsLoading(true);

    const selectedRatio = ASPECT_RATIOS.find((r) => r.id === aspectRatio) || ASPECT_RATIOS[0];
    const selectedPresetObj = STYLE_PRESETS.find((p) => p.id === activePreset);
    const presetSuffix = selectedPresetObj ? selectedPresetObj.suffix : '';
    const fullPrompt = `${prompt.trim()}${presetSuffix}`;

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${selectedRatio.width}&height=${selectedRatio.height}&seed=${currentSeed}&nologo=true&enhance=true`;

    const phases = [
      'Connecting to Pollinations AI...',
      'Synthesizing latent diffusion grid...',
      'Rendering lighting & textures...',
      'Polishing final high-res output...'
    ];

    let phaseIndex = 0;
    setLoadingPhase(phases[0]);
    const phaseInterval = setInterval(() => {
      phaseIndex = (phaseIndex + 1) % phases.length;
      setLoadingPhase(phases[phaseIndex]);
    }, 1800);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;

    img.onload = () => {
      clearInterval(phaseInterval);
      const newEntry = {
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        url,
        prompt: prompt.trim(),
        fullPrompt,
        presetId: activePreset,
        presetName: selectedPresetObj ? selectedPresetObj.name : 'Custom',
        ratioId: selectedRatio.id,
        seed: currentSeed,
        timestamp: new Date().toISOString()
      };

      setCurrentImage(newEntry);
      setIsLoading(false);

      // Append to gallery and save to localStorage
      const updatedGallery = [newEntry, ...gallery.filter((item) => item.url !== url)].slice(0, 50);
      saveGallery(updatedGallery);
      showToast('Image generated & saved to gallery!');
    };

    img.onerror = () => {
      clearInterval(phaseInterval);
      setIsLoading(false);
      showToast('Error loading image from Pollinations. Please try again.');
    };
  };

  const handleDownload = async (item) => {
    const target = item || currentImage;
    if (!target) return;

    showToast('Starting download...');
    try {
      const response = await fetch(target.url, { mode: 'cors' });
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `ai-studio-${target.presetId || 'artwork'}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      showToast('Download complete!');
    } catch (err) {
      // Direct link fallback
      const link = document.createElement('a');
      link.href = target.url;
      link.target = '_blank';
      link.download = `ai-studio-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCopyPrompt = () => {
    const textToCopy = currentImage ? currentImage.prompt : prompt;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    showToast('Prompt copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteItem = (id, e) => {
    e.stopPropagation();
    const updated = gallery.filter((item) => item.id !== id);
    saveGallery(updated);
    if (currentImage && currentImage.id === id) {
      setCurrentImage(updated[0] || null);
    }
    showToast('Removed from gallery');
  };

  const handleClearGallery = () => {
    if (window.confirm('Clear all saved images from your local gallery?')) {
      saveGallery([]);
      showToast('Gallery cleared');
    }
  };

  const activeRatioConfig = ASPECT_RATIOS.find((r) => r.id === aspectRatio) || ASPECT_RATIOS[0];

  return (
    <div className="app-wrapper">
      <div className="ambient-glow" />

      {/* Header */}
      <header className="app-header">
        <div className="brand-badge">
          <div className="brand-icon">
            <SparklesIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="brand-title">Mini AI Image Studio</h1>
            <p className="brand-subtitle">Powered by Pollinations AI • Instant Latent Synthesis</p>
          </div>
        </div>

        <div className="pill-status">
          <span className="pill-dot"></span>
          Ready & Connected
        </div>
      </header>

      {/* Main Studio Grid */}
      <div className="studio-grid">
        {/* Left Column: Creator Controls */}
        <section className="glass-panel">
          <div className="section-title">
            <span>1. Enter Your Vision</span>
            <button
              type="button"
              className="surprise-btn"
              onClick={handleSurprisePrompt}
              title="Pick a random creative prompt"
            >
              <DiceIcon className="w-3.5 h-3.5" />
              Surprise Prompt
            </button>
          </div>

          <div className="prompt-textarea-wrap">
            <textarea
              className="prompt-textarea"
              placeholder="Describe what you want to create in vivid detail..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleGenerate();
                }
              }}
            />
          </div>

          <div className="section-title">
            <span>2. Style Preset</span>
            <span style={{ fontSize: '0.75rem', color: '#818cf8', textTransform: 'none' }}>
              {STYLE_PRESETS.find((p) => p.id === activePreset)?.name}
            </span>
          </div>

          <div className="presets-grid">
            {STYLE_PRESETS.map((preset) => {
              const isActive = activePreset === preset.id;
              return (
                <div
                  key={preset.id}
                  className={`preset-chip ${isActive ? 'active' : ''}`}
                  onClick={() => setActivePreset(preset.id)}
                >
                  <span className="preset-icon">{preset.icon}</span>
                  <span className="preset-name">{preset.name}</span>
                </div>
              );
            })}
          </div>

          <div className="section-title">
            <span>3. Aspect Ratio</span>
          </div>

          <div className="ratio-selector">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio.id}
                type="button"
                className={`ratio-btn ${aspectRatio === ratio.id ? 'active' : ''}`}
                onClick={() => setAspectRatio(ratio.id)}
              >
                {ratio.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn-generate"
            disabled={isLoading || !prompt.trim()}
            onClick={() => handleGenerate()}
          >
            <SparklesIcon className="w-5 h-5" />
            {isLoading ? 'Synthesizing Image...' : 'Generate Artwork'}
          </button>
        </section>

        {/* Right Column: Result / Skeleton Stage */}
        <section className="glass-panel view-container">
          <div className="section-title">
            <span>Visual Canvas</span>
            {currentImage && !isLoading && (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'none' }}>
                Seed: #{currentImage.seed}
              </span>
            )}
          </div>

          <div className={`preview-stage ${activeRatioConfig.class}`}>
            {isLoading ? (
              <div className="skeleton-box">
                <div className="skeleton-spinner"></div>
                <div className="skeleton-text">{loadingPhase}</div>
                <div className="skeleton-progress-bar">
                  <div className="skeleton-progress-fill"></div>
                </div>
              </div>
            ) : currentImage ? (
              <>
                <img
                  src={currentImage.url}
                  alt={currentImage.prompt}
                  className="result-image"
                />
                <div className="result-image-overlay">
                  <button
                    type="button"
                    className="overlay-action-btn"
                    title="Fullscreen Lightbox"
                    onClick={() => setLightboxImage(currentImage.url)}
                  >
                    <ExpandIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="overlay-action-btn"
                    title="Download artwork"
                    onClick={() => handleDownload(currentImage)}
                  >
                    <DownloadIcon className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-preview">
                <div className="empty-icon-wrap">
                  <ImageIcon className="w-7 h-7" />
                </div>
                <p style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.95rem' }}>
                  No Artwork Generated Yet
                </p>
                <p style={{ fontSize: '0.8rem', maxWidth: '280px' }}>
                  Pick a style preset above and press Generate Artwork to produce high-resolution AI visuals.
                </p>
              </div>
            )}
          </div>

          {currentImage && !isLoading && (
            <div className="result-meta-card">
              <p className="result-prompt-display">
                "{currentImage.prompt}"
              </p>

              <div className="result-actions-row">
                <button
                  type="button"
                  className="btn-download-primary"
                  onClick={() => handleDownload(currentImage)}
                >
                  <DownloadIcon className="w-4 h-4" />
                  Download Image
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleGenerate(Math.floor(Math.random() * 999999))}
                  title="Re-generate with a new random seed"
                >
                  <RefreshIcon className="w-4 h-4" />
                  Re-roll
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCopyPrompt}
                >
                  {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Prompt'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Gallery Section */}
      <section className="gallery-section">
        <div className="gallery-header">
          <div className="gallery-title-wrap">
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Saved Generations</h2>
            <span className="gallery-count-badge">{gallery.length} stored</span>
          </div>

          {gallery.length > 0 && (
            <button
              type="button"
              className="btn-clear-gallery"
              onClick={handleClearGallery}
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>

        {gallery.length === 0 ? (
          <div
            className="glass-panel"
            style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}
          >
            <p style={{ fontSize: '0.9rem' }}>
              Your gallery is empty. Every generated image will automatically be saved to your browser's localStorage.
            </p>
          </div>
        ) : (
          <div className="gallery-grid">
            {gallery.map((item) => (
              <div key={item.id} className="gallery-card">
                <div
                  className="gallery-thumb-wrap"
                  onClick={() => {
                    setCurrentImage(item);
                    setPrompt(item.prompt);
                    setActivePreset(item.presetId || STYLE_PRESETS[0].id);
                    setAspectRatio(item.ratioId || ASPECT_RATIOS[0].id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <img src={item.url} alt={item.prompt} className="gallery-thumb" loading="lazy" />
                  <span className="gallery-card-badge">{item.presetName}</span>

                  <div className="gallery-card-actions">
                    <button
                      type="button"
                      className="gallery-mini-btn"
                      title="Download image"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(item);
                      }}
                    >
                      <DownloadIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="gallery-mini-btn"
                      title="Remove from gallery"
                      onClick={(e) => handleDeleteItem(item.id, e)}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="gallery-card-info">
                  <div className="gallery-card-prompt" title={item.prompt}>
                    {item.prompt}
                  </div>
                  <div className="gallery-card-date">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Seed #{item.seed}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="lightbox-backdrop" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setLightboxImage(null)}
            >
              <CloseIcon className="w-5 h-5" />
            </button>
            <img src={lightboxImage} alt="Fullscreen preview" className="lightbox-img" />
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notice">
          <SparklesIcon className="w-4 h-4 text-indigo-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
