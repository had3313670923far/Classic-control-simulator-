import { useState } from 'react';
import {
  Bell, BookOpen, Camera, Eraser, FolderOpen, Info, Link2, MessageSquare, Moon, PanelRight,
  Play, Radio, Redo2, RotateCcw, Save, Send, Square, Sun, Undo2, User, X, Zap,
} from 'lucide-react';
import type { Account, Lang, Mode } from '../types';
import { EXAMPLES } from '../lib/examples';
import { LANGS } from '../lib/i18n';

interface Props {
  t: (k: string) => string;
  lang: Lang;
  setLang: (l: Lang) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  speed: number;
  setSpeed: (s: number) => void;
  onReset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  onExample: (key: string) => void;
  dark: boolean;
  onToggleDark: () => void;
  onCapture: () => void;
  onComm: () => void;
  onShare: () => void;
  onTelegram: () => void;
  notifCount: number;
  notifOpen: boolean;
  onNotifToggle: () => void;
  commentsActive: boolean;
  onComments: () => void;
  onAbout: () => void;
  account: Account | null;
  onAccount: () => void;
  leftOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onProject: () => void;
}

const Btn = ({ children, onClick, title, active, tone = 'default', disabled, badge, big }: { children: React.ReactNode; onClick?: () => void; title?: string; active?: boolean; tone?: 'default' | 'run' | 'stop'; disabled?: boolean; badge?: number; big?: boolean }) => {
  const base = `relative inline-flex shrink-0 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-35 ${big ? 'h-9 w-9' : 'h-8 w-8'}`;
  const cls =
    tone === 'run'
      ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
      : tone === 'stop'
        ? 'border-red-500/60 bg-red-500/20 text-red-200 hover:bg-red-500/30'
        : active
          ? 'border-sky-500 bg-sky-500/20 text-sky-100'
          : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500 hover:bg-slate-700';
  return (
    <button onClick={onClick} title={title} disabled={disabled} className={`${base} ${cls}`}>
      {children}
      {!!badge && badge > 0 && <span className="absolute -end-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">{badge > 9 ? '9+' : badge}</span>}
    </button>
  );
};

const Sep = () => <div className="mx-0.5 h-6 w-px shrink-0 bg-slate-700" />;
const LANG_SHORT: Record<string, string> = { en: 'EN', bn: 'BN', ar: 'AR' };

export default function Toolbar(p: Props) {
  const { t } = p;
  const [exOpen, setExOpen] = useState(false);
  const run = p.mode === 'run';
  return (
    <>
      <header className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-slate-700 bg-slate-900/95 px-2 py-1.5 backdrop-blur">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 shadow" title={t('app_title')}>
          <Zap size={16} className="text-slate-900" fill="currentColor" />
        </div>

        <button onClick={p.onToggleLeft} title={t('components')} className={`inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md border px-2 text-[11px] font-semibold transition ${p.leftOpen ? 'border-sky-500 bg-sky-500/20 text-sky-100' : 'border-slate-700 bg-slate-800 text-sky-300 hover:border-slate-500 hover:bg-slate-700'}`}>
          {t('parts')}
        </button>
        <Sep />
        {run ? (
          <Btn onClick={() => p.setMode('edit')} tone="stop" title={t('stop')}>
            <Square size={15} color="#f87171" fill="currentColor" />
          </Btn>
        ) : (
          <Btn onClick={() => p.setMode('run')} tone="run" title={t('run')}>
            <Play size={16} color="#34d399" fill="currentColor" />
          </Btn>
        )}
        {run && (
          <>
            <Btn onClick={p.onReset} title={`${t('reset')} — ${t('reset_sim')}`}>
              <RotateCcw size={16} color="#fb923c" />
            </Btn>
            <select value={p.speed} onChange={(e) => p.setSpeed(Number(e.target.value))} className="h-8 shrink-0 rounded-md border border-slate-700 bg-slate-800 px-1 text-[11px] text-slate-100 outline-none" title={t('speed')}>
              <option value={1}>×1</option>
              <option value={5}>×5</option>
              <option value={20}>×20</option>
            </select>
          </>
        )}
        <Sep />
        <Btn onClick={p.onUndo} disabled={!p.canUndo} title={`${t('undo')} (Ctrl+Z)`} big>
          <Undo2 size={22} color="#60a5fa" />
        </Btn>
        <Btn onClick={p.onRedo} disabled={!p.canRedo} title={`${t('redo')} (Ctrl+Y)`} big>
          <Redo2 size={22} color="#818cf8" />
        </Btn>
        <Sep />
        <Btn onClick={p.onCapture} title={t('capture')}>
          <Camera size={16} color="#a78bfa" />
        </Btn>
        <button onClick={p.onProject} title={t('project')} className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md border border-slate-700 bg-slate-800 px-2 text-[11px] font-semibold text-amber-300 transition hover:border-slate-500 hover:bg-slate-700">
          {t('project')}
        </button>
        <Sep />
        <Btn onClick={p.onSave} title={t('save')}>
          <Save size={16} color="#4ade80" />
        </Btn>
        <Btn onClick={p.onLoad} title={t('load_file')}>
          <FolderOpen size={16} color="#fbbf24" />
        </Btn>
        <Btn onClick={p.onClear} title={t('clear')}>
          <Eraser size={16} color="#fb7185" />
        </Btn>
        <Sep />
        <Btn onClick={() => setExOpen(true)} title={`${t('examples')} (${EXAMPLES.length})`}>
          <BookOpen size={16} color="#22d3ee" />
        </Btn>
        <Sep />
        <Btn onClick={p.onToggleDark} active={p.dark} title={t('night')}>
          {p.dark ? <Sun size={16} color="#facc15" /> : <Moon size={16} color="#c4b5fd" />}
        </Btn>
        <Sep />
        <Btn onClick={p.onComm} title={t('communication')}>
          <Radio size={16} color="#a3e635" />
        </Btn>
        <Btn onClick={p.onShare} title={t('share')}>
          <Link2 size={16} color="#f472b6" />
        </Btn>
        <Btn onClick={p.onTelegram} title="Telegram">
          <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: '#229ED9' }}>
            <Send size={12} color="#fff" />
          </span>
        </Btn>
        <Btn onClick={p.onNotifToggle} active={p.notifOpen} title={t('notifications')} badge={p.notifCount}>
          <Bell size={16} color="#facc15" />
        </Btn>
        <Btn onClick={p.onComments} active={p.commentsActive} title={t('comments')}>
          <MessageSquare size={16} color="#2dd4bf" />
        </Btn>
        <Sep />
        <Btn onClick={p.onAbout} title={t('about')}>
          <Info size={16} color="#60a5fa" />
        </Btn>
        <select value={p.lang} onChange={(e) => p.setLang(e.target.value as Lang)} className="h-8 shrink-0 rounded-md border border-slate-700 bg-slate-800 px-1 text-[11px] font-bold text-slate-100 outline-none" title={t('lang')}>
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {LANG_SHORT[l.code] || l.code}
            </option>
          ))}
        </select>
        <Btn onClick={p.onAccount} title={t('accounts')}>
          {p.account ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-white">{(p.account.name || 'U').slice(0, 1).toUpperCase()}</span> : <User size={16} color="#c084fc" />}
        </Btn>
        <button onClick={p.onToggleRight} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-200 md:hidden" title={t('properties')}>
          <PanelRight size={16} color="#94a3b8" />
        </button>
      </header>

      {exOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setExOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-100">
                <BookOpen size={15} color="#22d3ee" /> {t('examples')} ({EXAMPLES.length})
              </h2>
              <button onClick={() => setExOpen(false)} className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-1">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={ex.key}
                  onClick={() => {
                    setExOpen(false);
                    p.onExample(ex.key);
                  }}
                  className="block w-full rounded-lg border border-slate-700/60 px-3 py-2 text-start hover:bg-slate-700/60"
                >
                  <div className="text-xs font-semibold text-slate-100">
                    {i + 1}. {t(ex.titleKey)}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{t(ex.descKey)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
