'use client';

export default function AppVersion() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME;

  return (
    <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center" data-testid="app-version">
      {version === 'dev' ? 'Versión dev' : `Versión ${version}${buildTime ? ` · ${buildTime}` : ''}`}
    </p>
  );
}
