import { STATUSES, STATUS_LABELS } from '../constants';

export default function StatusCounts({ jobs }) {
  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = jobs.filter((j) => j.status === s).length;
    return acc;
  }, {});

  return (
    <div className="status-counts">
      {STATUSES.map((s) => (
        <div key={s} className={`count-card count-${s}`}>
          <span className="count-number">{counts[s]}</span>
          <span className="count-label">{STATUS_LABELS[s]}</span>
        </div>
      ))}
      <div className="count-card count-total">
        <span className="count-number">{jobs.length}</span>
        <span className="count-label">Total</span>
      </div>
    </div>
  );
}
