import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Presentation,
  FileText,
  FileCode,
  Download,
  Eye,
  Settings2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileDown,
  Palette,
} from 'lucide-react';
import api from '../api/axios.js';

export default function Generator() {
  const [searchParams] = useSearchParams();
  const formatParam = searchParams.get('format');

  // Core Form State
  const [docType, setDocType] = useState(() => {
    if (formatParam && ['pptx', 'docx', 'txt'].includes(formatParam)) return formatParam;
    try {
      const stored = localStorage.getItem('docugenius_settings');
      return stored ? JSON.parse(stored).defaultFormat || 'pptx' : 'pptx';
    } catch {
      return 'pptx';
    }
  });
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [inputMode, setInputMode] = useState('topic'); // 'topic' or 'paste'

  // Advanced Generation Settings
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('docugenius_settings');
      return stored ? JSON.parse(stored).defaultTheme || 'corporate' : 'corporate';
    } catch {
      return 'corporate';
    }
  });
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState('professional');
  const [audience, setAudience] = useState('general');
  const [contentLength, setContentLength] = useState('medium');
  const [slideCount, setSlideCount] = useState(10);

  // Status & Feedback
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [previewData, setPreviewData] = useState(null);

  // Ref for the high-performance contentEditable div (preserved from original)
  const contentEditableRef = useRef(null);

  useEffect(() => {
    if (formatParam && ['pptx', 'docx', 'txt'].includes(formatParam)) {
      setDocType(formatParam);
    }
  }, [formatParam]);

  const themes = [
    { id: 'corporate', name: 'Corporate Pro', primary: '#1a3a5c', accent: '#3498db', desc: 'Executive navy & crisp blue' },
    { id: 'minimal', name: 'Minimal Modern', primary: '#333333', accent: '#999999', desc: 'Monochrome grayscale aesthetic' },
    { id: 'academic', name: 'Academic', primary: '#1b5e20', accent: '#4caf50', desc: 'Scholarly forest green & serif' },
    { id: 'businessPitch', name: 'Business Pitch', primary: '#e65100', accent: '#ff9100', desc: 'Dark theme with vibrant orange' },
    { id: 'technology', name: 'Technology', primary: '#6a1b9a', accent: '#ce93d8', desc: 'Cyber dark with neon violet' },
    { id: 'educational', name: 'Educational', primary: '#00695c', accent: '#4db6ac', desc: 'Fresh teal & clean typography' },
    { id: 'creative', name: 'Creative', primary: '#e91e63', accent: '#ff5722', desc: 'Vibrant modern palette' },
  ];

  // Helper to trigger browser download from a binary Blob
  const triggerBrowserDownload = (blobData, filename) => {
    const url = window.URL.createObjectURL(new Blob([blobData]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Preview Content
  const handlePreview = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    const rawPastedText = contentEditableRef.current?.innerText || '';
    const activeTopic = topic.trim() || title.trim();

    if (!activeTopic && !rawPastedText) {
      setErrorMsg('Please enter a topic or paste reference text.');
      return;
    }

    setIsPreviewing(true);
    try {
      const res = await api.post('/generate/preview', {
        title: title || activeTopic,
        topic: activeTopic,
        description: rawPastedText,
        type: docType,
        language,
        tone,
        audience,
        contentLength,
      });

      if (res.data && res.data.success) {
        setPreviewData(res.data.data);
        setSuccessMsg('Structured preview generated successfully!');
      } else {
        setErrorMsg(res.data?.message || 'Preview generation failed.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to connect to generation service.');
    } finally {
      setIsPreviewing(false);
    }
  };

  // Main Generation & Real File Download
  const handleGenerateAndDownload = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    const rawPastedText = contentEditableRef.current?.innerText || '';
    const activeTopic = topic.trim() || title.trim() || 'Untitled Document';
    const documentTitle = title.trim() || activeTopic;

    setIsGenerating(true);
    try {
      // 1. Request generation
      const genRes = await api.post('/generate', {
        title: documentTitle,
        topic: activeTopic,
        description: rawPastedText,
        type: docType,
        language,
        tone,
        audience,
        contentLength,
        slideCount: Number(slideCount),
        theme,
      });

      if (genRes.data && genRes.data.success) {
        const docInfo = genRes.data.data;
        setPreviewData(docInfo.content);

        // 2. Download the binary file using properly configured Axios Blob call
        const downloadEndpoint = docInfo.downloadUrl.startsWith('/api')
          ? docInfo.downloadUrl.replace(/^\/api/, '')
          : docInfo.downloadUrl;

        const downloadRes = await api.get(downloadEndpoint, {
          responseType: 'blob', // Proper Axios binary configuration
        });

        triggerBrowserDownload(downloadRes.data, docInfo.fileName);
        setSuccessMsg(`Successfully generated & downloaded ${docInfo.fileName}!`);
      } else {
        setErrorMsg(genRes.data?.message || 'Generation failed.');
      }
    } catch (err) {
      const serverError = err.response?.data?.message || err.message || 'Generation failed.';
      setErrorMsg(serverError);
    } finally {
      setIsGenerating(false);
    }
  };

  // Legacy direct PPT generator (backward compatibility test)
  const handleLegacyDirectPpt = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    const rawPastedText = contentEditableRef.current?.innerText || '';
    const documentTitle = title.trim() || 'Quick Presentation';

    if (!rawPastedText) {
      setErrorMsg('Please paste text into the editor below for quick direct conversion.');
      return;
    }

    setIsGenerating(true);
    try {
      // Corrected Axios call: { responseType: 'blob' } in the 3rd argument (config object)!
      const response = await api.post(
        '/ppt/generate',
        { title: documentTitle, text: rawPastedText },
        {
          headers: { 'x-user-id': 'docugenius-user' },
          responseType: 'blob',
        }
      );

      triggerBrowserDownload(response.data, `${documentTitle.replace(/\s+/g, '_')}.pptx`);
      setSuccessMsg('Legacy PPTX generated and downloaded successfully!');
    } catch (err) {
      setErrorMsg('Legacy PPT generation failed: ' + (err.message || 'Server error'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center">
            <Sparkles className="w-7 h-7 text-blue-600 mr-2.5" />
            DocuGenius AI Studio
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Generate executive presentations, structured Word reports, and clean specs with Gemini AI.
          </p>
        </div>

        {/* Format Selector Pills */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setDocType('pptx')}
            className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              docType === 'pptx' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Presentation className="w-4 h-4 mr-1.5" />
            PowerPoint (.pptx)
          </button>

          <button
            type="button"
            onClick={() => setDocType('docx')}
            className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              docType === 'docx' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 mr-1.5" />
            Word (.docx)
          </button>

          <button
            type="button"
            onClick={() => setDocType('txt')}
            className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              docType === 'txt' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-4 h-4 mr-1.5" />
            Plain Text (.txt)
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Generation Notice</p>
            <p className="text-xs text-rose-600 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3 text-emerald-700 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="font-medium">{successMsg}</p>
        </div>
      )}

      {/* Main Input Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
        {/* Document Title */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Document / Presentation Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q4 Strategic AI Roadmap & Cloud Migration"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-base font-semibold text-slate-900 transition-all placeholder:text-slate-300"
          />
        </div>

        {/* Input Mode Toggle */}
        <div className="flex items-center space-x-4 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setInputMode('topic')}
            className={`text-xs font-bold uppercase tracking-wider pb-2 border-b-2 transition-all ${
              inputMode === 'topic'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Mode 1: Prompt / Topic
          </button>
          <button
            type="button"
            onClick={() => setInputMode('paste')}
            className={`text-xs font-bold uppercase tracking-wider pb-2 border-b-2 transition-all ${
              inputMode === 'paste'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Mode 2: Paste Raw / Long Text
          </button>
        </div>

        {/* Prompt Input */}
        {inputMode === 'topic' ? (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Topic & Generation Instructions
            </label>
            <textarea
              rows={4}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Describe what to generate. E.g. A comprehensive 10-slide presentation explaining microservices architecture vs monoliths, including trade-offs, system diagrams, and containerization best practices."
              className="w-full p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm text-slate-800 transition-all"
            />
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Pasted Reference Content (Handles Massive Text Lag-Free)
              </label>
              <span className="text-[11px] text-slate-400">Preserved high-speed contentEditable buffer</span>
            </div>
            {/* The high-performance contentEditable div preserved from the original app */}
            <div
              ref={contentEditableRef}
              contentEditable={true}
              data-placeholder="Paste articles, research papers, transcript notes, or ASCII diagrams here..."
              className="w-full h-72 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 outline-none overflow-y-auto whitespace-pre-wrap focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all bg-slate-50/50"
            />
          </div>
        )}

        {/* Advanced Settings Accordion */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="w-full p-4 bg-slate-50 flex items-center justify-between text-left text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100/80 transition-colors"
          >
            <span className="flex items-center">
              <Settings2 className="w-4 h-4 mr-2 text-slate-500" />
              Advanced Document & Theme Settings
            </span>
            {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showSettings && (
            <div className="p-6 space-y-6 bg-white border-t border-slate-200">
              {/* Theme Picker for PPTX */}
              {docType === 'pptx' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center">
                    <Palette className="w-4 h-4 mr-1.5 text-blue-600" />
                    Select Presentation Theme (7 Custom Palettes)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          theme === t.id
                            ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5 mb-2">
                          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: t.primary }}></span>
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.accent }}></span>
                        </div>
                        <p className="text-xs font-bold text-slate-800">{t.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Grid Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Hindi">Hindi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="professional">Professional</option>
                    <option value="executive">Executive</option>
                    <option value="academic">Academic</option>
                    <option value="creative">Creative</option>
                    <option value="persuasive">Persuasive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Target Audience</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="general">General Audience</option>
                    <option value="business">Business Stakeholders</option>
                    <option value="technical">Software Engineers</option>
                    <option value="students">Students / Learners</option>
                  </select>
                </div>

                {docType === 'pptx' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Slide Count</label>
                    <input
                      type="number"
                      min={3}
                      max={30}
                      value={slideCount}
                      onChange={(e) => setSlideCount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Length</label>
                    <select
                      value={contentLength}
                      onChange={(e) => setContentLength(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="short">Brief (2-3 pages)</option>
                      <option value="medium">Standard (4-6 pages)</option>
                      <option value="long">Comprehensive (7+ pages)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePreview}
              disabled={isPreviewing || isGenerating}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-semibold text-sm flex items-center justify-center transition-all disabled:opacity-50"
            >
              {isPreviewing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin text-slate-500" />
                  Generating Preview...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2 text-slate-500" />
                  Preview Content
                </>
              )}
            </button>

            {/* Legacy Direct PPT Export (Preserved feature verification) */}
            <button
              type="button"
              onClick={handleLegacyDirectPpt}
              disabled={isGenerating}
              title="Fast text-to-presentation without AI (Direct legacy pipeline)"
              className="hidden lg:flex items-center px-4 py-3 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <FileDown className="w-4 h-4 mr-1.5" />
              Direct Text → PPT
            </button>
          </div>

          <button
            type="button"
            onClick={handleGenerateAndDownload}
            disabled={isGenerating || isPreviewing}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all flex items-center justify-center disabled:opacity-60 transform hover:-translate-y-0.5"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating & Downloading {docType.toUpperCase()}...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Generate & Download .{docType}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Live Preview Component */}
      {previewData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Generated Preview</span>
              <h2 className="text-xl font-bold text-slate-900 mt-0.5">{previewData.title}</h2>
            </div>
            <button
              onClick={handleGenerateAndDownload}
              className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download File
            </button>
          </div>

          {/* Slides Preview Grid (if PPTX) */}
          {previewData.slides && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {previewData.slides.map((slide, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">Slide {idx + 1}</span>
                    {slide.diagramSuggestion && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                        Diagram Included
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{slide.title}</h3>
                  <ul className="space-y-1.5">
                    {slide.bullets?.map((b, bi) => (
                      <li key={bi} className="text-xs text-slate-600 flex items-start">
                        <span className="text-blue-500 mr-2 shrink-0">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  {slide.notes && (
                    <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-400 italic">
                      Notes: {slide.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Sections Preview (if DOCX or TXT) */}
          {previewData.sections && (
            <div className="space-y-4 divide-y divide-slate-100">
              {previewData.sections.map((sec, idx) => (
                <div key={idx} className="pt-4 first:pt-0 space-y-2">
                  <h3 className="text-base font-bold text-slate-900 flex items-center">
                    <span className="text-xs font-bold text-blue-600 mr-2">§{idx + 1}</span>
                    {sec.heading}
                  </h3>
                  {sec.content && <p className="text-xs text-slate-600 leading-relaxed">{sec.content}</p>}
                  {sec.bullets && sec.bullets.length > 0 && (
                    <ul className="space-y-1 pt-1">
                      {sec.bullets.map((b, bi) => (
                        <li key={bi} className="text-xs text-slate-600 flex items-start">
                          <span className="text-blue-500 mr-2">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

