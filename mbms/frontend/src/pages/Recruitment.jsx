import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

const VACANCY_BADGE = { draft: 'neutral', pending_approval: 'warning', open: 'success', on_hold: 'warning', closed: 'neutral' };
const APP_BADGE = {
  applied: 'neutral',
  shortlisted: 'neutral',
  interview_scheduled: 'warning',
  interviewed: 'warning',
  offered: 'warning',
  hired: 'success',
  rejected: 'error',
};

export function RecruitmentPage() {
  const { hasRole, hasPermission } = useAuth();
  const canManage = hasRole('Super Administrator', 'Human Resources Manager') || hasPermission('recruitment.manage');
  const canApprove = hasRole('Super Administrator', 'Managing Director') || hasPermission('recruitment.approve');

  const [vacancies, setVacancies] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [interviewTarget, setInterviewTarget] = useState(null);
  const [completeInterviewTarget, setCompleteInterviewTarget] = useState(null);
  const [offerTarget, setOfferTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      const items = await apiRequest('/recruitment/vacancies');
      setVacancies(items);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load vacancies.');
    }
  }

  async function openVacancy(id) {
    setError(null);
    try {
      const detail = await apiRequest(`/recruitment/vacancies/${id}`);
      setSelected(detail);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load vacancy detail.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function vacancyAction(action) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/recruitment/vacancies/${selected.id}/${action}`, { method: 'POST' });
      await load();
      await openVacancy(selected.id);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError(`Unable to ${action.replace(/-/g, ' ')}.`);
    } finally {
      setBusy(false);
    }
  }

  async function appAction(appId, action, body) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/recruitment/applications/${appId}/${action}`, { method: 'POST', body });
      await openVacancy(selected.id);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError(`Unable to ${action}.`);
    } finally {
      setBusy(false);
    }
  }

  async function respondOffer(offerId, status) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/recruitment/offers/${offerId}/respond`, { method: 'POST', body: { status } });
      await openVacancy(selected.id);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to record the response.');
    } finally {
      setBusy(false);
    }
  }

  async function onboard(offerId) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/recruitment/offers/${offerId}/onboard`, { method: 'POST' });
      await openVacancy(selected.id);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to onboard this candidate.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Recruitment</div>
          <h1>Recruitment</h1>
        </div>
        {canManage && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New Vacancy
            </button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="grid-2">
        <div className="card">
          <div className="card-head">Vacancies</div>
          {vacancies === null ? (
            <div className="loading">Loading…</div>
          ) : vacancies.length === 0 ? (
            <div className="empty">No vacancies yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vacancies.map((v) => (
                  <tr key={v.id}>
                    <td className="rowlink" onClick={() => openVacancy(v.id)} style={{ cursor: 'pointer' }}>
                      {v.title}
                    </td>
                    <td>
                      <span className={`badge ${VACANCY_BADGE[v.status] ?? 'neutral'}`}>
                        <span className="dot" />
                        {v.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <button className="btn-ghost" onClick={() => openVacancy(v.id)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-head">{selected ? selected.title : 'Vacancy Detail'}</div>
          {!selected ? (
            <div className="empty">Select a vacancy to see applications.</div>
          ) : (
            <div className="card-body">
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {canManage && selected.status === 'draft' && (
                  <button className="btn-ghost" disabled={busy} onClick={() => vacancyAction('submit-for-approval')}>
                    Submit for Approval
                  </button>
                )}
                {canApprove && selected.status === 'pending_approval' && (
                  <button className="btn-ghost" disabled={busy} onClick={() => vacancyAction('approve')}>
                    Approve &amp; Post
                  </button>
                )}
                {canManage && selected.status !== 'closed' && (
                  <button className="btn-ghost" disabled={busy} onClick={() => vacancyAction('close')}>
                    Close Vacancy
                  </button>
                )}
                {canManage && (
                  <button className="btn-ghost" disabled={busy} onClick={() => setShowApplicationModal(true)}>
                    + Add Application
                  </button>
                )}
              </div>

              {(selected.applications ?? []).length === 0 ? (
                <div className="empty">No applications yet.</div>
              ) : (
                selected.applications.map((a) => (
                  <div key={a.id} className="card" style={{ marginBottom: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <b>{a.applicantName}</b> — {a.applicantEmail}
                        {a.cvReference && <span style={{ opacity: 0.6, marginLeft: 6 }}>(CV: {a.cvReference})</span>}
                      </div>
                      <span className={`badge ${APP_BADGE[a.status] ?? 'neutral'}`}>
                        <span className="dot" />
                        {a.status.replace('_', ' ')}
                      </span>
                    </div>
                    {canManage && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {a.status === 'applied' && (
                          <button className="btn-ghost" disabled={busy} onClick={() => appAction(a.id, 'shortlist')}>
                            Shortlist
                          </button>
                        )}
                        {['shortlisted', 'interview_scheduled'].includes(a.status) && (
                          <button className="btn-ghost" disabled={busy} onClick={() => setInterviewTarget(a)}>
                            Schedule Interview
                          </button>
                        )}
                        {a.status === 'interviewed' && (
                          <button className="btn-ghost" disabled={busy} onClick={() => setOfferTarget(a)}>
                            Make Offer
                          </button>
                        )}
                        {!['hired', 'rejected'].includes(a.status) && (
                          <button className="btn-ghost" disabled={busy} onClick={() => appAction(a.id, 'reject', {})}>
                            Reject
                          </button>
                        )}
                        {a.status === 'offered' && a.offer?.status === 'pending' && (
                          <>
                            <button className="btn-ghost" disabled={busy} onClick={() => respondOffer(a.offer.id, 'accepted')}>
                              Record Accept
                            </button>
                            <button className="btn-ghost" disabled={busy} onClick={() => respondOffer(a.offer.id, 'declined')}>
                              Record Decline
                            </button>
                          </>
                        )}
                        {a.offer?.status === 'accepted' && !a.offer.onboardedEmployeeId && (
                          <button className="btn-primary" style={{ padding: '4px 12px', fontSize: 12 }} disabled={busy} onClick={() => onboard(a.offer.id)}>
                            Onboard
                          </button>
                        )}
                        {a.offer?.onboardedEmployeeId && <span style={{ opacity: 0.7, fontSize: 12, alignSelf: 'center' }}>Onboarded ✓</span>}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showCreate && <CreateVacancyModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {showApplicationModal && selected && (
        <AddApplicationModal
          vacancyId={selected.id}
          onClose={() => setShowApplicationModal(false)}
          onAdded={() => openVacancy(selected.id)}
        />
      )}
      {interviewTarget && (
        <ScheduleInterviewModal application={interviewTarget} onClose={() => setInterviewTarget(null)} onScheduled={() => openVacancy(selected.id)} />
      )}
      {offerTarget && <MakeOfferModal application={offerTarget} onClose={() => setOfferTarget(null)} onOffered={() => openVacancy(selected.id)} />}
    </Layout>
  );
}

function CreateVacancyModal({ onClose, onCreated }) {
  const [companyId, setCompanyId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [employmentType, setEmploymentType] = useState('full_time');
  const [numberOfPositions, setNumberOfPositions] = useState(1);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/recruitment/vacancies', {
        method: 'POST',
        body: { companyId, title, description: description || undefined, employmentType, numberOfPositions: Number(numberOfPositions) },
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create vacancy.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Job Vacancy</h2>
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
              Title <span className="req">*</span>
            </label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Description</label>
            <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Employment Type</label>
              <input className="input" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} />
            </div>
            <div className="field">
              <label>Positions</label>
              <input className="input" type="number" min="1" value={numberOfPositions} onChange={(e) => setNumberOfPositions(e.target.value)} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Vacancy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddApplicationModal({ vacancyId, onClose, onAdded }) {
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [cvReference, setCvReference] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/recruitment/vacancies/${vacancyId}/applications`, {
        method: 'POST',
        body: { applicantName, applicantEmail, applicantPhone: applicantPhone || undefined, cvReference: cvReference || undefined },
      });
      onAdded();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to add application.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add Application</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Applicant Name <span className="req">*</span>
            </label>
            <input className="input" value={applicantName} onChange={(e) => setApplicantName(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Email <span className="req">*</span>
            </label>
            <input className="input" type="email" value={applicantEmail} onChange={(e) => setApplicantEmail(e.target.value)} required />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Phone</label>
              <input className="input" value={applicantPhone} onChange={(e) => setApplicantPhone(e.target.value)} />
            </div>
            <div className="field">
              <label>CV Reference</label>
              <input className="input" value={cvReference} onChange={(e) => setCvReference(e.target.value)} placeholder="text reference — no file upload" />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScheduleInterviewModal({ application, onClose, onScheduled }) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [mode, setMode] = useState('in_person');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/recruitment/applications/${application.id}/interviews`, { method: 'POST', body: { scheduledAt, mode } });
      onScheduled();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to schedule interview.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Schedule Interview — {application.applicantName}</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Date &amp; Time <span className="req">*</span>
            </label>
            <input className="input" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Mode</label>
            <input className="input" value={mode} onChange={(e) => setMode(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MakeOfferModal({ application, onClose, onOffered }) {
  const [offeredSalary, setOfferedSalary] = useState('');
  const [currency, setCurrency] = useState('UGX');
  const [proposedStartDate, setProposedStartDate] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/recruitment/applications/${application.id}/offer`, {
        method: 'POST',
        body: { offeredSalary: Number(offeredSalary), currency, proposedStartDate },
      });
      onOffered();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to make offer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Make Offer — {application.applicantName}</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>
                Offered Salary <span className="req">*</span>
              </label>
              <input className="input" type="number" min="0" value={offeredSalary} onChange={(e) => setOfferedSalary(e.target.value)} required />
            </div>
            <div className="field">
              <label>Currency</label>
              <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Proposed Start Date <span className="req">*</span>
            </label>
            <input className="input" type="date" value={proposedStartDate} onChange={(e) => setProposedStartDate(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Sending…' : 'Send Offer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
