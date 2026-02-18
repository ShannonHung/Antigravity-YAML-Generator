import { Suspense } from 'react';
import FileExplorer from '@/components/FileExplorer';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950 text-zinc-500">Loading...</div>}>
      <FileExplorer />
    </Suspense>
  );
}
