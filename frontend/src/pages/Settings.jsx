import { useState } from 'react';
import { Settings as SettingsIcon, CheckCircle2, ShieldCheck, Cpu } from 'lucide-react';

export default function Settings() {
  const [defaultFormat, setDefaultFormat] = useState(() => {
    try {
      const stored = localStorage.getItem('docugenius_settings');
      return stored ? JSON.parse(stored).defaultFormat || 'pptx' : 'pptx';
    } catch {
      return 'pptx';
    }
  });

  const [defaultTheme, setDefaultTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('docugenius_settings');
      return stored ? JSON.parse(stored).defaultTheme || 'corporate' : 'corporate';
    } catch {
      return 'corporate';
    }
  });

  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem('docugenius_settings', JSON.stringify({ defaultFormat, defaultTheme }));
    } catch {}
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center">
          <SettingsIcon className="w-6 h-6 text-blue-600 mr-2.5" />
          Studio Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">Configure your default AI output preferences and studio parameters.</p>
      </div>

      {savedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Settings saved successfully!
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Default Generation Preferences</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Preferred Default Format</label>
              <select
                value={defaultFormat}
                onChange={(e) => setDefaultFormat(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white"
              >
                <option value="pptx">PowerPoint (.pptx)</option>
                <option value="docx">Word (.docx)</option>
                <option value="txt">Plain Text (.txt)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Default PPT Theme</label>
              <select
                value={defaultTheme}
                onChange={(e) => setDefaultTheme(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white"
              >
                <option value="corporate">Corporate Professional</option>
                <option value="minimal">Minimal Modern</option>
                <option value="academic">Academic</option>
                <option value="businessPitch">Business Pitch</option>
                <option value="technology">Technology</option>
                <option value="educational">Educational</option>
                <option value="creative">Creative</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center text-xs text-slate-400">
            <Cpu className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Active Model: Gemini AI (via Backend Orchestrator)
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors"
          >
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
}

