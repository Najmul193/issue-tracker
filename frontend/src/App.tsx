import { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState<string>('');
  const [dbStatus, setDbStatus] = useState<string>('');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setStatus(data.status);
        setDbStatus(data.database);
      })
      .catch(() => {
        setStatus('error');
        setDbStatus('unknown');
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-gray-900">Issue Tracker</h1>
        <p className="mb-6 text-lg text-gray-600">
          Multi-tenant issue tracking system
        </p>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold text-gray-800">
            System Status
          </h2>
          <div className="space-y-2 text-left text-sm text-gray-600">
            <p>
              API:{' '}
              <span
                className={`font-medium ${status === 'ok' ? 'text-green-600' : 'text-red-600'}`}
              >
                {status || 'checking...'}
              </span>
            </p>
            <p>
              Database:{' '}
              <span
                className={`font-medium ${dbStatus === 'connected' ? 'text-green-600' : 'text-red-600'}`}
              >
                {dbStatus || 'checking...'}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
