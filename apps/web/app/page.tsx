import Link from 'next/link';
import { APP_FULL_NAME, APP_NAME, APP_VERSION } from '@bhuvi/shared';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Background ambient glow */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-bhuvi-700/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-bhuvi-900/30 rounded-full blur-3xl" />
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-2xl w-full text-center space-y-8">
        {/* Logo / wordmark */}
        <div className="space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bhuvi-gradient shadow-2xl mb-4">
            <span className="text-3xl font-black text-white tracking-tight">B</span>
          </div>
          <h1 className="text-6xl sm:text-7xl font-black tracking-tight text-white">{APP_NAME}</h1>
          <p className="text-lg sm:text-xl text-bhuvi-300 font-medium tracking-wide uppercase">
            {APP_FULL_NAME}
          </p>
        </div>

        {/* Tagline */}
        <p className="text-xl sm:text-2xl text-gray-400 leading-relaxed">
          Your personal AI operating system.
        </p>

        {/* Status badge */}
        <div className="glass-panel inline-flex items-center gap-3 px-6 py-3 mx-auto">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <span className="text-sm font-medium text-gray-300">
            Status: <span className="text-emerald-400 font-semibold">Foundation initialized.</span>
          </span>
        </div>

        {/* Authentication Navigation */}
        <div className="flex items-center justify-center gap-4 pt-1">
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bhuvi-gradient hover:opacity-95 text-white font-semibold text-sm shadow-lg shadow-bhuvi-600/30 transition"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-semibold text-sm transition"
          >
            Create Account
          </Link>
        </div>

        {/* Module roadmap preview */}
        <div className="glass-panel p-6 text-left space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-bhuvi-400">
            Module 01 Active
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            The project foundation has been established. Future modules will add AI brain
            integration, email monitoring, natural language commands, voice interaction, and more.
          </p>
          <div className="pt-2 flex flex-wrap gap-2">
            {['Next.js 14', 'NestJS', 'TypeScript', 'pnpm Workspaces', 'Tailwind CSS'].map(
              (tech) => (
                <span
                  key={tech}
                  className="text-xs px-2 py-1 rounded-md bg-bhuvi-900/60 text-bhuvi-300 border border-bhuvi-700/50"
                >
                  {tech}
                </span>
              ),
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-600 font-mono">v{APP_VERSION} · Local-first · Windows 11</p>
      </div>
    </main>
  );
}
