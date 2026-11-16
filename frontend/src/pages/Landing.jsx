import { Link } from 'react-router-dom';
import {
  Sparkles,
  Presentation,
  FileText,
  FileCode,
  ArrowRight,
  CheckCircle2,
  Layers,
  Palette,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Landing() {
  const { isAuthenticated, devGuestLogin } = useAuth();

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative pt-12 pb-16 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Powered Multi-Format Document Generation</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Turn Any Topic or Text into{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Professional Presentations & Docs
            </span>
          </h1>

          {/* Subheading */}
          <p className="max-w-2xl mx-auto text-lg text-slate-600 leading-relaxed">
            Enter a topic, paste large research, or upload notes. DocuGenius AI organizes your content,
            applies executive typography, and generates genuine PowerPoint (.pptx), Word (.docx), and Plain Text (.txt) files.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to={isAuthenticated ? '/generate' : '/register'}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5"
            >
              Start Generating Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>

            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs transition-all"
            >
              Sign In to Studio
            </Link>
          </div>

          {/* Features Pills */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Real binary file downloads</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>7 Executive slide themes</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Intelligent slide overflow prevention</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Mermaid flowcharts & diagrams</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Formats Cards */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            One Engine. Three Production Formats.
          </h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">
            Choose your desired format and DocuGenius AI formats your content with industry standards.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* PowerPoint */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <Presentation className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">PowerPoint (.pptx)</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Generates complete multi-slide decks with title slides, section dividers, speaker notes, and 7 switchable themes.
              </p>
              <ul className="text-xs text-slate-500 space-y-2 pt-2">
                <li className="flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mr-2 shrink-0" />
                  Intelligent auto-splitting of overflowing bullets
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mr-2 shrink-0" />
                  Dark/light contrast-calibrated palettes
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mr-2 shrink-0" />
                  Integrated diagram slides & speaker notes
                </li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-orange-600">
              <span>Ready for MS PowerPoint</span>
              <span className="px-2 py-0.5 rounded bg-orange-100">.pptx</span>
            </div>
          </div>

          {/* Word DOCX */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Word Document (.docx)</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Formal reports, proposals, and briefs with structured title pages, automatic tables of contents, and clean headers.
              </p>
              <ul className="text-xs text-slate-500 space-y-2 pt-2">
                <li className="flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mr-2 shrink-0" />
                  Formatted data tables with alternating row shading
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mr-2 shrink-0" />
                  Page numbering (Page X of Y) & headers
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mr-2 shrink-0" />
                  HeadingLevel 1–3 hierarchy
                </li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600">
              <span>Ready for MS Word</span>
              <span className="px-2 py-0.5 rounded bg-blue-100">.docx</span>
            </div>
          </div>

          {/* Plain Text */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FileCode className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Plain Text (.txt)</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Lightweight, portable documentation formatted with clean ASCII title borders and bullet structures.
              </p>
              <ul className="text-xs text-slate-500 space-y-2 pt-2">
                <li className="flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mr-2 shrink-0" />
                  Clean heading underlines (===, ---)
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mr-2 shrink-0" />
                  Portable across Unix/Windows/macOS
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mr-2 shrink-0" />
                  Ideal for READMEs & technical notes
                </li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-600">
              <span>Universal plain text</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100">.txt</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden">
          <div className="space-y-4 text-center max-w-xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold">How DocuGenius Works</h2>
            <p className="text-slate-400 text-sm">
              From raw text or topic to finished presentation in seconds.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-400/30">
                1
              </div>
              <h3 className="text-base font-semibold">1. Enter Topic or Paste Content</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Provide a short topic prompt or paste massive multi-page raw text directly into our lag-free editor.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-sm border border-indigo-400/30">
                2
              </div>
              <h3 className="text-base font-semibold">2. AI Structuring & Layout Engine</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Gemini orchestrates sections, summaries, bullets, and diagrams with strict Zod schema validation.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-400/30">
                3
              </div>
              <h3 className="text-base font-semibold">3. Preview & Instant Download</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Inspect structured slides or document sections in the interactive viewer, then download real PPTX, DOCX, or TXT.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

