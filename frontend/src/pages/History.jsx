import { useState, useEffect } from 'react';
import {
  Clock,
  Search,
  Filter,
  Download,
  Trash2,
  Presentation,
  FileText,
  FileCode,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import api from '../api/axios.js';

export default function History() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let query = `/history?search=${encodeURIComponent(search)}`;
      if (filterType !== 'all') {
        query += `&type=${filterType}`;
      }
      const res = await api.get(query);
      if (res.data && res.data.success) {
        setDocuments(res.data.data.documents || []);
      }
    } catch {
      // Ignored if offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [filterType]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchHistory();
  };

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/history/${id}`);
      if (res.data && res.data.success) {
        setDocuments(documents.filter((d) => d._id !== id));
        setStatusMsg('Document removed from history.');
      }
    } catch (err) {
      setStatusMsg('Failed to delete: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeleteConfirmId(null);
    }
  };

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
      setStatusMsg('Download failed: ' + (err.message || 'File not available'));
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFormatIcon = (type) => {
    switch (type) {
      case 'pptx':
        return <Presentation className="w-5 h-5 text-orange-600" />;
      case 'docx':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'txt':
        return <FileCode className="w-5 h-5 text-emerald-600" />;
      default:
        return <FileText className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Clock className="w-6 h-6 text-blue-600 mr-2.5" />
            Document History
          </h1>
          <p className="text-sm text-slate-500 mt-1">Review, re-download, or delete previously generated files.</p>
        </div>

        {/* Filter Pills */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 self-start sm:self-auto">
          {['all', 'pptx', 'docx', 'txt'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                filterType === t ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium flex items-center justify-between">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg('')} className="text-blue-500 hover:text-blue-800">
            ×
          </button>
        </div>
      )}

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents by title..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Documents List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading documents...</p>
        </div>
      ) : documents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div
              key={doc._id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                    {getFormatIcon(doc.type)}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug">{doc.title}</h3>

                <p className="text-xs text-slate-500">
                  Size: {formatFileSize(doc.fileSize)} • {doc.settings?.theme || doc.type.toUpperCase()}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => handleDownload(doc)}
                  className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download File
                </button>

                {deleteConfirmId === doc._id ? (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDelete(doc._id)}
                      className="text-xs font-bold text-rose-600 hover:underline"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(doc._id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <Clock className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">No documents found</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {search
              ? 'No documents matched your search term.'
              : 'You have not generated any documents in this category yet.'}
          </p>
        </div>
      )}
    </div>
  );
}

