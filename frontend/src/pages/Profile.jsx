import { User, Mail, Shield, Calendar, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center">
          <User className="w-6 h-6 text-blue-600 mr-2.5" />
          User Profile
        </h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account credentials and personal preferences.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-blue-500/20">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{user?.name || 'Studio Member'}</h2>
            <p className="text-xs text-slate-400 font-medium">DocuGenius Creator Account</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center">
              <Mail className="w-3.5 h-3.5 mr-1 text-slate-400" /> Email Address
            </span>
            <p className="text-sm font-bold text-slate-800">{user?.email || 'user@docugenius.ai'}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center">
              <Shield className="w-3.5 h-3.5 mr-1 text-slate-400" /> Account Role
            </span>
            <p className="text-sm font-bold text-slate-800 capitalize">{user?.role || 'user'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

