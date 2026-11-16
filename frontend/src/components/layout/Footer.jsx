import { Sparkles, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-800 text-sm">DocuGenius AI</span>
            <span className="text-slate-400 text-xs">— Document & Presentation Studio</span>
          </div>

          <p className="text-xs text-slate-500">
            Powered by Google Gemini & LangChain • PptxGenJS • Docx Library
          </p>

          <div className="flex items-center space-x-6 text-xs text-slate-500">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              ● API Operational
            </span>
            <span>v2.0.0 Production</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

