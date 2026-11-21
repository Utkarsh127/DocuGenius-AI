import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Presentation,
  FileText,
  FileCode,
  Sparkles,
  Download,
  Plus,
  Clock,
  ArrowRight,
  Database,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/axios.js';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, byType: { pptx: 0, docx: 0, txt: 0 } });
  const [recentDocs, setRecentDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, historyRes] = await Promise.allSettled([
          api.get('/history/stats'),
          api.get('/history?limit=5'),
        ]);

        if (statsRes.status === 'fulfilled' && statsRes.value?.data?.success) {
          setStats(statsRes.value.data.data);
        }

        if (historyRes.status === 'fulfilled' && historyRes.value?.data?.success) {
          setRecentDocs(historyRes.value.data.data.documents || []);
        }
      } catch {
        // Handled silently
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleDownload = async (doc) => {
    try {
      const res = await api.get(`/history/${doc._id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.fileName || `${doc.title}.${doc.type}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download failed: ' + (err.response?.data?.message || err.message || 'File not available'));
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFormatBadge = (type) => {
    switch (type) {
      case 'pptx':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">PPTX</span>;
      case 'docx':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">DOCX</span>;
      case 'txt':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700">TXT</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">{type}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-blue-100">
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>AI Studio Ready</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.name || 'Creator'}
          </h1>
          <p className="text-sm text-blue-100/90 leading-relaxed">
            Create presentations, Word reports, and structured documents powered by Gemini.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/generate"
            className="inline-flex items-center px-5 py-3 rounded-xl text-sm font-semibold bg-white text-blue-700 hover:bg-blue-50 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Open Studio Generator
          </Link>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/generate?format=pptx"
          className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-orange-300 hover:shadow-md transition-all group flex items-start space-x-4"
        >
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Presentation className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base group-hover:text-orange-600 transition-colors">
              PowerPoint Deck
            </h3>
            <p className="text-xs text-slate-500">
              7 themes, smart slide overflow handling & diagrams.
            </p>
          </div>
        </Link>

        <Link
          to="/generate?format=docx"
          className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 hover:shadow-md transition-all group flex items-start space-x-4"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
              Word Document
            </h3>
            <p className="text-xs text-slate-500">
              Title pages, table of contents, headers & styled tables.
            </p>
          </div>
        </Link>

        <Link
          to="/generate?format=txt"
          className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all group flex items-start space-x-4"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <FileCode className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-600 transition-colors">
              Plain Text Spec
            </h3>
            <p className="text-xs text-slate-500">
              Clean structured ASCII formatting and bullet notes.
            </p>
          </div>
        </Link>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-medium">Total Generated</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-medium">PowerPoint Decks</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{stats.byType?.pptx || 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-medium">Word Documents</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.byType?.docx || 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-medium">Text Files</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.byType?.txt || 0}</p>
        </div>
      </div>

      {/* Recent Documents Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-bold text-slate-900">Recent Documents</h2>
          </div>
          <Link to="/history" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center">
            View All History <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        {recentDocs.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {recentDocs.map((doc) => (
              <div
                key={doc._id}
                className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  {getFormatBadge(doc.type)}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{doc.title}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(doc.createdAt).toLocaleDateString()} • {formatFileSize(doc.fileSize)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    className="p-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors text-xs flex items-center font-medium cursor-pointer"
                    title="Download file"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No generated documents yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Ready to generate your first professional presentation or document? Launch the studio to start.
            </p>
            <Link
              to="/generate"
              className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 mt-2 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Generate First Document
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

