import { useState } from 'react';
import { NEXT_STATUSES, STATUS_LABELS } from '../constants';

export default function JobList({ jobs, onUpdateStatus, onDelete }) {
  // Track in-flight action + per-row error independently per job id, so one
  // job's failed action doesn't block or hide errors for another row.
  const [busyId, setBusyId] = useState(null);
  const [rowErrors, setRowErrors] = useState({});

  async function handleStatusChange(job, nextStatus) {
    setBusyId(job.id);
    setRowErrors((prev) => ({ ...prev, [job.id]: null }));
    try {
      await onUpdateStatus(job.id, nextStatus);
    } catch (err) {
      // A 409 here most often means someone else (another tab, or a
      // direct API call) already changed this job's status - refreshing
      // the list (done by the parent after every action) will show the
      // real current state.
      setRowErrors((prev) => ({ ...prev, [job.id]: err.message }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(job) {
    setBusyId(job.id);
    setRowErrors((prev) => ({ ...prev, [job.id]: null }));
    try {
      await onDelete(job.id);
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [job.id]: err.message }));
      setBusyId(null);
    }
  }

  if (jobs.length === 0) {
    return <p className="empty-state">No jobs to show.</p>;
  }

  return (
    <table className="job-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Type</th>
          <th>Status</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => {
          const isBusy = busyId === job.id;
          const nextOptions = NEXT_STATUSES[job.status] || [];
          return (
            <tr key={job.id}>
              <td>{job.title}</td>
              <td>{job.type}</td>
              <td>
                <span className={`badge badge-${job.status}`}>
                  {STATUS_LABELS[job.status]}
                </span>
              </td>
              <td>{new Date(job.createdAt).toLocaleString()}</td>
              <td>
                <div className="row-actions">
                  {nextOptions.map((next) => (
                    <button
                      key={next}
                      disabled={isBusy}
                      onClick={() => handleStatusChange(job, next)}
                    >
                      Mark {STATUS_LABELS[next]}
                    </button>
                  ))}
                  <button
                    className="danger"
                    disabled={isBusy}
                    onClick={() => handleDelete(job)}
                  >
                    Delete
                  </button>
                </div>
                {rowErrors[job.id] && (
                  <p className="error-text row-error">{rowErrors[job.id]}</p>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
