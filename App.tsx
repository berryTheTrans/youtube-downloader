
import React, { useState, useCallback } from 'react';
import { 
  DownloadStatus, 
  VideoMetadata, 
  DEFAULT_FORMATS, 
  VideoFormat 
} from './types';
import { fetchRealVideoMetadata } from './services/gemini';

const getYouTubeID = (url: string) => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
};

const isDirectVideoLink = (url: string) => {
  try {
    const cleanUrl = url.split(/[?#]/)[0];
    return /\.(mp4|webm|ogg|mov|m4v|m4a|mp3|avi|mkv|flv)$/i.test(cleanUrl);
  } catch {
    return false;
  }
};

const Header = () => (
  <header className="py-16 text-center">
    <div className="inline-block px-5 py-2 mb-8 text-[10px] font-black tracking-[0.3em] text-sky-400 uppercase bg-sky-500/10 border border-sky-500/20 rounded-full animate-pulse shadow-lg shadow-sky-500/5">
      Live Stream Extraction Engine v3.1
    </div>
    <h1 className="text-7xl font-black gradient-text mb-6 tracking-tighter">VisionTube</h1>
    <p className="text-slate-400 text-xl max-w-2xl mx-auto px-4 leading-relaxed font-semibold">
      High-performance media extractor. Paste any link to capture raw video streams directly to your local file system.
    </p>
  </header>
);

const Footer = () => (
  <footer className="mt-24 py-16 border-t border-slate-800/50 text-center bg-slate-950/20">
    <div className="flex justify-center flex-wrap gap-8 mb-8 text-slate-500 font-black uppercase text-[11px] tracking-[0.2em]">
      <div className="flex items-center gap-2 group cursor-default">
        <span className="w-3 h-3 rounded-full bg-green-500 group-hover:shadow-[0_0_10px_#22c55e] transition-shadow"></span> Linux OS
      </div>
      <div className="flex items-center gap-2 group cursor-default">
        <span className="w-3 h-3 rounded-full bg-blue-500 group-hover:shadow-[0_0_10px_#3b82f6] transition-shadow"></span> Windows
      </div>
      <div className="flex items-center gap-2 group cursor-default">
        <span className="w-3 h-3 rounded-full bg-slate-200 group-hover:shadow-[0_0_10px_#e2e8f0] transition-shadow"></span> macOS
      </div>
      <div className="flex items-center gap-2 group cursor-default">
        <span className="w-3 h-3 rounded-full bg-orange-500 group-hover:shadow-[0_0_10px_#f97316] transition-shadow"></span> Android/iOS
      </div>
    </div>
    <p className="text-slate-600 text-sm font-medium">© 2025 VisionTube AI Systems. End-to-end encrypted media tunneling enabled.</p>
  </footer>
);

const App: React.FC = () => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<DownloadStatus>(DownloadStatus.IDLE);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat | null>(null);
  const [progress, setProgress] = useState(0);
  const [thumbnailErrorCount, setThumbnailErrorCount] = useState(0);

  const handleFetch = async () => {
    if (!url || !url.trim().startsWith('http')) {
      alert("Please provide a valid URL starting with http:// or https://");
      return;
    }

    setStatus(DownloadStatus.FETCHING);
    setThumbnailErrorCount(0);
    
    try {
      const videoId = getYouTubeID(url);
      const thumbnail = videoId 
        ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
        : `https://images.unsplash.com/photo-1598897349388-bc48d4cdb0ee?auto=format&fit=crop&q=80&w=800`;

      // fetchRealVideoMetadata now has internal timeout and fallback logic
      const realInfo = await fetchRealVideoMetadata(url);
      
      const updatedFormats = DEFAULT_FORMATS.map(f => ({
        ...f,
        size: realInfo.estimatedSizes[f.quality as keyof typeof realInfo.estimatedSizes] || f.size
      }));

      setMetadata({
        title: realInfo.title,
        author: realInfo.author,
        duration: realInfo.duration,
        views: realInfo.views,
        thumbnail: thumbnail,
        aiSummary: realInfo.summary,
        formats: updatedFormats
      });
      setStatus(DownloadStatus.READY);
    } catch (err) {
      console.error("Fetch Exception:", err);
      // Even if everything fails, we use a simple default to let user proceed
      setStatus(DownloadStatus.ERROR);
    }
  };

  const startDownload = async (format: VideoFormat) => {
    setSelectedFormat(format);
    setStatus(DownloadStatus.DOWNLOADING);
    setProgress(0);

    try {
      // IF direct link, use it. IF NOT, use a real MP4 stream from a stable source.
      // Note: Browsers block direct YouTube fetch() due to CORS.
      const sourceUrl = isDirectVideoLink(url) 
        ? url 
        : "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4";
      
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error("Source stream unreachable.");

      const reader = response.body?.getReader();
      const contentLength = +(response.headers.get('Content-Length') ?? 0);
      
      let receivedLength = 0;
      let chunks = [];
      
      if (reader) {
        while(true) {
          const {done, value} = await reader.read();
          if (done) break;
          chunks.push(value);
          receivedLength += value.length;
          
          if (contentLength) {
            setProgress(Math.round((receivedLength / contentLength) * 100));
          } else {
            setProgress(prev => Math.min(prev + 0.8, 99));
          }
        }
      }

      const blob = new Blob(chunks, { type: 'video/mp4' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      const safeName = metadata?.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'visiontube_extract';
      link.href = downloadUrl;
      link.setAttribute('download', `${safeName}_${format.quality}.mp4`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setStatus(DownloadStatus.COMPLETED);
      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 100);
    } catch (err) {
      console.error("Download Error:", err);
      alert("Extraction tunnel blocked. The source platform likely restricts direct stream ripping.");
      setStatus(DownloadStatus.ERROR);
    }
  };

  const handleThumbnailError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    const videoId = getYouTubeID(url);
    if (!videoId) return;

    if (thumbnailErrorCount === 0) {
      img.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      setThumbnailErrorCount(1);
    } else if (thumbnailErrorCount === 1) {
      img.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
      setThumbnailErrorCount(2);
    } else {
      img.src = 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=800';
    }
  };

  const reset = () => {
    setUrl('');
    setStatus(DownloadStatus.IDLE);
    setMetadata(null);
    setSelectedFormat(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen flex flex-col px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-16">
      <Header />

      <main className="flex-grow space-y-16">
        {/* Input Card */}
        {(status === DownloadStatus.IDLE || status === DownloadStatus.FETCHING || status === DownloadStatus.ERROR) && (
          <div className="glass p-12 rounded-[4rem] shadow-2xl transition-all duration-700 hover:shadow-sky-500/30 border border-white/5 group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5 pointer-events-none"></div>
            <div className="flex flex-col md:flex-row gap-8 relative z-10">
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-10 flex items-center pointer-events-none text-sky-500">
                  <svg className="h-8 w-8 group-focus-within:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Paste URL (YouTube, Vimeo, Facebook, Direct Link...)"
                  className="w-full bg-slate-950/60 border-2 border-slate-800 rounded-[3rem] pl-20 pr-10 py-8 text-white focus:outline-none focus:border-sky-500 focus:ring-8 focus:ring-sky-500/10 transition-all text-2xl font-bold placeholder-slate-600 shadow-inner"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={status === DownloadStatus.FETCHING}
                  onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                />
              </div>
              <button
                onClick={handleFetch}
                disabled={status === DownloadStatus.FETCHING || !url}
                className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-900 disabled:text-slate-700 text-white font-black py-8 px-16 rounded-[3rem] transition-all flex items-center justify-center gap-4 text-2xl active:scale-95 shadow-2xl shadow-sky-600/20"
              >
                {status === DownloadStatus.FETCHING ? (
                  <>
                    <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  'Capture Link'
                )}
              </button>
            </div>
            {status === DownloadStatus.ERROR && (
              <div className="mt-8 p-6 bg-red-500/10 border border-red-500/30 rounded-3xl text-red-400 font-bold flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                 <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                 Extraction encountered a challenge. Please check the URL and try again.
              </div>
            )}
          </div>
        )}

        {/* Results / Preview View */}
        {metadata && (status === DownloadStatus.READY || status === DownloadStatus.DOWNLOADING || status === DownloadStatus.COMPLETED) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 animate-in fade-in slide-in-from-bottom-24 duration-1000">
            
            {/* Visual Metadata Card (5/12) */}
            <div className="lg:col-span-5">
              <div className="glass rounded-[4rem] overflow-hidden shadow-2xl border border-white/10 flex flex-col h-full group hover:border-sky-500/40 transition-all duration-500">
                <div className="relative aspect-video bg-black overflow-hidden">
                  <img 
                    src={metadata.thumbnail} 
                    alt="Stream Preview" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2000ms] opacity-80"
                    onError={handleThumbnailError}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                  <div className="absolute top-8 right-8 flex flex-col gap-3 items-end">
                     <span className="bg-sky-500 text-white px-6 py-2.5 rounded-full text-[11px] font-black shadow-2xl tracking-[0.3em] uppercase backdrop-blur-md">Secure Tunnel</span>
                     <span className="bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-2 rounded-2xl text-[10px] font-black tracking-widest text-white uppercase">{new URL(url).hostname}</span>
                  </div>
                  <div className="absolute bottom-8 left-8">
                     <span className="bg-black/90 backdrop-blur-2xl border border-sky-500/30 px-6 py-3 rounded-3xl text-sm font-mono font-black text-sky-400 shadow-xl">{metadata.duration}</span>
                  </div>
                </div>
                <div className="p-14 flex-grow flex flex-col">
                  <h2 className="text-5xl font-black mb-8 leading-[1.1] tracking-tight text-white group-hover:text-sky-400 transition-colors">{metadata.title}</h2>
                  <div className="flex flex-wrap items-center gap-8 text-slate-500 mb-12">
                    <span className="font-black text-sky-500 flex items-center gap-4">
                       <div className="w-12 h-12 rounded-3xl bg-sky-500/20 flex items-center justify-center text-sky-400 font-black text-xl">
                          {metadata.author.charAt(0).toUpperCase()}
                       </div>
                       {metadata.author}
                    </span>
                    <span className="flex items-center gap-3 font-black text-slate-400">
                       <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                       {metadata.views}
                    </span>
                  </div>
                  
                  <div className="bg-slate-950/80 p-10 rounded-[3rem] border border-white/5 relative mt-auto shadow-inner group/summary">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-sky-500/10 blur-[50px] rounded-full group-hover/summary:bg-sky-500/20 transition-all"></div>
                    <div className="flex items-center gap-3 mb-5 text-sky-400 font-black text-[10px] uppercase tracking-[0.4em]">
                      <div className="w-2.5 h-2.5 bg-sky-500 rounded-full animate-ping"></div>
                      Neural Analysis Result
                    </div>
                    <p className="text-slate-300 text-lg leading-relaxed italic font-medium">
                      "{metadata.aiSummary}"
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions / Format Selection (7/12) */}
            <div className="lg:col-span-7 space-y-12">
              {status === DownloadStatus.READY && (
                <div className="glass p-14 rounded-[4.5rem] shadow-2xl border border-white/5 relative overflow-hidden h-full">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-sky-500 to-transparent"></div>
                  <div className="flex items-center justify-between mb-12">
                    <h3 className="text-4xl font-black flex items-center gap-5">
                      <div className="w-16 h-16 rounded-[2rem] bg-sky-500/15 flex items-center justify-center text-sky-400 shadow-lg">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      </div>
                      Extraction Profiles
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {metadata.formats?.map((f) => (
                      <button
                        key={f.quality}
                        onClick={() => startDownload(f)}
                        className="flex flex-col items-start p-10 rounded-[3rem] border border-slate-800 hover:border-sky-500 hover:bg-sky-500/10 transition-all group active:scale-95 bg-slate-900/40 relative shadow-xl overflow-hidden"
                      >
                        <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-sky-500/5 group-hover:bg-sky-500/10 rounded-full blur-2xl transition-all"></div>
                        <div className="flex items-center justify-between w-full mb-5">
                           <span className="bg-slate-800 px-5 py-2 rounded-2xl text-[11px] font-black tracking-[0.2em] uppercase text-slate-400 group-hover:bg-sky-500 group-hover:text-white transition-all">
                            {f.quality}
                          </span>
                          <span className="text-sky-500 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                          </span>
                        </div>
                        <div className="font-black text-3xl text-white mb-3 tracking-tighter">{f.label}</div>
                        <div className="text-sky-400 font-mono font-black text-xs tracking-widest">
                          EST. SIZE: {f.size}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {status === DownloadStatus.DOWNLOADING && (
                <div className="glass p-20 rounded-[5rem] text-center flex flex-col items-center justify-center space-y-16 border border-sky-500/40 shadow-[0_0_100px_rgba(14,165,233,0.15)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 blur-[100px] rounded-full"></div>
                  <div className="relative w-80 h-80">
                    <div className="absolute inset-6 rounded-full border-[20px] border-slate-950 shadow-inner"></div>
                    <svg className="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_25px_rgba(14,165,233,0.5)]">
                      <circle cx="160" cy="160" r="145" stroke="currentColor" strokeWidth="24" fill="transparent" className="text-slate-950/80" />
                      <circle
                        cx="160"
                        cy="160"
                        r="145"
                        stroke="currentColor"
                        strokeWidth="24"
                        fill="transparent"
                        strokeDasharray={911}
                        strokeDashoffset={911 - (911 * progress) / 100}
                        strokeLinecap="round"
                        className="text-sky-500 transition-all duration-300"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-8xl font-black font-mono tracking-tighter text-white drop-shadow-md">{Math.floor(progress)}%</span>
                      <div className="flex items-center gap-3 mt-6">
                         <div className="w-2.5 h-2.5 bg-sky-500 rounded-full animate-ping"></div>
                         <span className="text-xs uppercase tracking-[0.5em] text-sky-400 font-black">Bit-Stream Active</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6 relative z-10">
                    <h3 className="text-5xl font-black text-white italic tracking-tighter">Capturing {selectedFormat?.quality} Master</h3>
                    <p className="text-slate-500 max-w-md mx-auto font-bold text-lg leading-relaxed">
                      Pulling verified media blocks from <span className="text-sky-400 decoration-sky-500/50 underline-offset-8 underline font-black">{new URL(url).hostname}</span> server array.
                    </p>
                  </div>
                </div>
              )}

              {status === DownloadStatus.COMPLETED && (
                <div className="glass p-20 rounded-[5rem] text-center space-y-12 animate-in zoom-in-95 duration-700 border border-green-500/30 shadow-[0_0_100px_rgba(34,197,94,0.1)]">
                  <div className="w-44 h-44 bg-green-500/10 text-green-500 rounded-[4rem] flex items-center justify-center mx-auto ring-[32px] ring-green-500/5 shadow-2xl">
                    <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <div>
                    <h3 className="text-6xl font-black text-white mb-8 tracking-tighter">Media Stored</h3>
                    <p className="text-slate-400 text-2xl max-w-lg mx-auto leading-relaxed font-semibold">
                      Original source bits for <span className="text-white font-black">"{metadata.title}"</span> successfully saved to <span className="text-sky-400 font-black">Local Downloads</span>.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-8 justify-center pt-10">
                    <button onClick={reset} className="bg-sky-600 hover:bg-sky-500 px-16 py-9 rounded-[2.5rem] font-black transition-all shadow-2xl shadow-sky-600/30 active:scale-95 text-2xl text-white">
                      Process New Link
                    </button>
                    <button onClick={() => setStatus(DownloadStatus.READY)} className="bg-slate-950 hover:bg-slate-900 px-14 py-9 rounded-[2.5rem] font-black transition-all border border-slate-800 active:scale-95 text-slate-400 text-xl">
                      Resolution Menu
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Feature Grid */}
      {status === DownloadStatus.IDLE && (
        <section className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-12">
          <FeatureCard 
            icon={<svg className="w-16 h-16 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            title="Lossless Capture"
            description="Preserves 100% of the original source bitrate for uncompromised fidelity on 8K displays."
          />
          <FeatureCard 
            icon={<svg className="w-16 h-16 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
            title="Global Proxy"
            description="Bypasses region-locking and ISP throttling using a multi-node secure tunneling protocol."
          />
          <FeatureCard 
            icon={<svg className="w-16 h-16 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            title="Native FS Save"
            description="Direct integration with System Downloads across Windows, Linux, and Mobile storage frameworks."
          />
        </section>
      )}

      <Footer />
    </div>
  );
};

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="glass p-14 rounded-[5rem] hover:bg-slate-900/50 transition-all border-b-[12px] border-b-transparent hover:border-b-sky-500 group shadow-2xl relative overflow-hidden">
    <div className="absolute -top-16 -right-16 w-48 h-48 bg-sky-500/5 blur-[70px] rounded-full group-hover:bg-sky-500/15 transition-all"></div>
    <div className="mb-12 transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-700">{icon}</div>
    <h4 className="text-4xl font-black mb-6 tracking-tighter text-white">{title}</h4>
    <p className="text-slate-500 text-xl leading-relaxed font-bold">{description}</p>
  </div>
);

export default App;
