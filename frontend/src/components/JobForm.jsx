import { useState } from 'react';

export default function JobForm({ onCreate, creating }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [formError, setFormError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    if (!title.trim() || !type.trim()) {
      setFormError('Title and type are both required.');
      return;
    }

    try {
      await onCreate({ title: title.trim(), type: type.trim() });
      setTitle('');
      setType('');
    } catch (err) {
      setFormError(err.message);
    }
  }

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Send weekly report"
          disabled={creating}
        />
      </div>
      <div className="field">
        <label htmlFor="type">Type</label>
        <input
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="e.g. email"
          disabled={creating}
        />
      </div>
      <button type="submit" disabled={creating}>
        {creating ? 'Creating...' : 'Create Job'}
      </button>
      {formError && <p className="error-text">{formError}</p>}
    </form>
  );
}
