import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

const STATUS_BADGE = { self_assessment_pending: 'neutral', manager_review_pending: 'warning', completed: 'success' };
const STATUS_LABEL = { self_assessment_pending: 'Awaiting self-assessment', manager_review_pending: 'Awaiting manager review', completed: 'Completed' };

export function PerformancePage() {
  const { hasRole, hasPermission } = useAuth();
  const canManage = hasRole('Super Administrator', 'Human Resources Manager') || hasPermission('performance.manage');

  const [cycles, setCycles] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState(null);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [selfTarget, setSelfTarget] = useState(null);
  const [managerTarget, setManagerTarget] = useState(null);

  async function load() {
    setError(null);
    try {
      const [c, r] = await Promise.all([apiRequest('/performance/cycles'), apiRequest('/performance/reviews')]);
      setCycles(c);
      setReviews(r);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load performance data.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Performance</div>
          <h1>Performance Management</h1>
        </div>
        {canManage && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowCycleModal(true)}>
              + New Review Cycle
            </button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">Review Cycles</div>
        {cycles === null ? (
          <div className="loading">Loading…</div>
        ) : cycles.length === 0 ? (
          <div className="empty">No review cycles yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.startDate?.slice(0, 10)}</td>
                  <td>{c.endDate?.slice(0, 10)}</td>
                  <td>
                    <span className={`badge ${c.status === 'open' ? 'success' : 'neutral'}`}>
                      <span className="dot" />
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-head">Reviews</div>
        {reviews === null ? (
          <div className="loading">Loading…</div>
        ) : reviews.length === 0 ? (
          <div className="empty">No performance reviews to show.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Manager Rating</th>
                <th>Promotion</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.status] ?? 'neutral'}`}>
                      <span className="dot" />
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="num mono">{r.managerRating ?? '—'}</td>
                  <td>{r.promotionRecommended ? 'Recommended' : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {r.status === 'self_assessment_pending' && (
                        <button className="btn-ghost" onClick={() => setSelfTarget(r)}>
                          Submit Self-Assessment
                        </button>
                      )}
                      {canManage && r.status === 'manager_review_pending' && (
                        <button className="btn-ghost" onClick={() => setManagerTarget(r)}>
                          Submit Manager Assessment
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCycleModal && <CreateCycleModal onClose={() => setShowCycleModal(false)} onCreated={load} />}
      {selfTarget && <SelfAssessmentModal review={selfTarget} onClose={() => setSelfTarget(null)} onSubmitted={load} />}
      {managerTarget && <ManagerAssessmentModal review={managerTarget} onClose={() => setManagerTarget(null)} onSubmitted={load} />}
    </Layout>
  );
}

function CreateCycleModal({ onClose, onCreated }) {
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/performance/cycles', { method: 'POST', body: { companyId, name, startDate, endDate } });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create review cycle.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Review Cycle</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Company ID <span className="req">*</span>
            </label>
            <input className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="uuid" required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Name <span className="req">*</span>
            </label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2026 H2 Review" required />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Start Date</label>
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>End Date</label>
              <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Cycle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SelfAssessmentModal({ review, onClose, onSubmitted }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/performance/reviews/${review.id}/self-assessment`, { method: 'POST', body: { selfAssessment: text } });
      onSubmitted();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to submit self-assessment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Submit Self-Assessment</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Self-Assessment <span className="req">*</span>
            </label>
            <textarea className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManagerAssessmentModal({ review, onClose, onSubmitted }) {
  const [text, setText] = useState('');
  const [rating, setRating] = useState(3);
  const [promotionRecommended, setPromotionRecommended] = useState(false);
  const [trainingRecommendation, setTrainingRecommendation] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/performance/reviews/${review.id}/manager-assessment`, {
        method: 'POST',
        body: { managerAssessment: text, managerRating: Number(rating), promotionRecommended, trainingRecommendation: trainingRecommendation || undefined },
      });
      onSubmitted();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to submit manager assessment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Submit Manager Assessment</h2>
        {review.selfAssessment && (
          <p style={{ opacity: 0.75, fontSize: '0.9em' }}>
            <b>Self-assessment:</b> {review.selfAssessment}
          </p>
        )}
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Manager Assessment <span className="req">*</span>
            </label>
            <textarea className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} required />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>
                Rating (1-5) <span className="req">*</span>
              </label>
              <input className="input" type="number" min="1" max="5" value={rating} onChange={(e) => setRating(e.target.value)} required />
            </div>
            <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
              <input type="checkbox" checked={promotionRecommended} onChange={(e) => setPromotionRecommended(e.target.checked)} id="promo" />
              <label htmlFor="promo">Recommend promotion</label>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Training Recommendation</label>
            <input className="input" value={trainingRecommendation} onChange={(e) => setTrainingRecommendation(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Submitting…' : 'Complete Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
