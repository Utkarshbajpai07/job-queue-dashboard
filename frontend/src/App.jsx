import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import JobForm from './components/JobForm';
import JobList from './components/JobList';
import StatusFilter from './components/StatusFilter';
import StatusCounts from './components/StatusCounts';

const POLL_INTERVAL_MS = 5000;

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);

  const loadJobs = useCallback(async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const data = await api.listJobs();
      setJobs(data);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    // Poll in the background so that if another browser tab (or another
    // user) changes a job, this tab converges on the true state without
    // the person needing to hit refresh. This is what makes the "two tabs
    // racing to start the same job" scenario visible in practice: whichever
    // tab's click loses the race will see its own action rejected with a
    // conflict message, and the next poll confirms the job is already
    // running.
    const interval = setInterval(() => loadJobs({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadJobs]);

  async function handleCreate(data) {
    setCreating(true);
    try {
      await api.createJob(data);
      await loadJobs({ silent: true });
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateStatus(id, status) {
    await api.updateStatus(id, status);
    await loadJobs({ silent: true });
  }

  async function handleDelete(id) {
    await api.deleteJob(id);
    await loadJobs({ silent: true });
  }

  const visibleJobs =
    filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

  return (
    <div className="app">
      <header>
        <h1>Job Queue Dashboard</h1>
        <button className="secondary" onClick={() => loadJobs()}>
          Refresh
        </button>
      </header>

      <StatusCounts jobs={jobs} />

      <section className="panel">
        <h2>Create a job</h2>
        <JobForm onCreate={handleCreate} creating={creating} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Jobs</h2>
          <StatusFilter value={filter} onChange={setFilter} />
        </div>

        {loading && <p>Loading jobs...</p>}
        {!loading && loadError && (
          <p className="error-text">
            Failed to load jobs: {loadError}{' '}
            <button className="link-button" onClick={() => loadJobs()}>
              Try again
            </button>
          </p>
        )}
        {!loading && !loadError && (
          <JobList
            jobs={visibleJobs}
            onUpdateStatus={handleUpdateStatus}
            onDelete={handleDelete}
          />
        )}
      </section>
    </div>
  );
}
