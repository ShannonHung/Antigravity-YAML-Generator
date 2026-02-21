import { Suspense } from 'react';
import FileExplorer from '@/components/FileExplorer';
import { EditorConfigProvider, EditorConfig } from '@/components/FileSystemPage/hooks/EditorConfigContext';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getEditorConfig(): Partial<EditorConfig> {
  let config: Partial<EditorConfig> = {};

  // 1. Try reading from mounted file first
  try {
    const configPath = path.join(process.cwd(), 'editorConfig.json');
    if (fs.existsSync(configPath)) {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = { ...fileConfig };
    }
  } catch (e) {
    console.error("Failed to parse editorConfig.json", e);
  }

  // 2. Override with Environment Variables if present
  const parseEnvArray = (envVar: string | undefined): string[] | undefined => {
    if (!envVar) return undefined;
    try {
      // Try JSON parse first (e.g. '["a", "b"]')
      return JSON.parse(envVar);
    } catch {
      // Fallback to comma-separated
      return envVar.split(',').map(s => s.trim()).filter(Boolean);
    }
  };

  const envDataTypes = parseEnvArray(process.env.DATA_TYPES);
  if (envDataTypes) config.DATA_TYPES = envDataTypes;

  const envItemDataTypes = parseEnvArray(process.env.ITEM_DATA_TYPES);
  if (envItemDataTypes) config.ITEM_DATA_TYPES = envItemDataTypes;

  const envDefaultPlugins = parseEnvArray(process.env.DEFAULT_PLUGINS);
  if (envDefaultPlugins) config.DEFAULT_PLUGINS = envDefaultPlugins;

  return config;
}

export default function Page() {
  const config = getEditorConfig();

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950 text-zinc-500">Loading...</div>}>
      <EditorConfigProvider config={config}>
        <FileExplorer />
      </EditorConfigProvider>
    </Suspense>
  );
}
