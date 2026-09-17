import { STATUSES, STATUS_LABELS } from '../constants';

export default function StatusFilter({ value, onChange }) {
  return (
    <div className="status-filter">
      <label htmlFor="status-filter">Filter by status</label>
      <select
        id="status-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="all">All</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
