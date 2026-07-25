import { Suspense, lazy } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import { BASSession } from '@/pages/BASSession';
import { PlaybookSelector } from '@/pages/PlaybookSelector';

// The report and comparison views pull in recharts and the syntax highlighter.
// Loading them on demand keeps the playbook library and the session console —
// the two screens a learner actually starts on — off the critical path.
const ReportPage = lazy(() => import('@/pages/ReportPage').then((m) => ({ default: m.ReportPage })));
const ComparisonPage = lazy(() =>
  import('@/pages/ComparisonPage').then((m) => ({ default: m.ComparisonPage })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="animate-pulse text-sm text-slate-500">Loading…</p>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<PlaybookSelector />} />
          <Route path="/session" element={<BASSession />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/comparison" element={<ComparisonPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
