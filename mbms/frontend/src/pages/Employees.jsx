import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequestWithMeta, apiRequest, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function EmployeesPage() {
  const { hasRole, hasPermission } = useAuth();
  const [employees, setEmployees] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const canManage = hasRole('Super Administrator', 'Human Resources Manager') || hasPermission('employee.manage');

  async function load() {
    setError(null);
    try {
      const { items } = await apiRequestWithMeta('/employees', { pageSize: 100 });
      setEmployees(items);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load employees.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Employees</div>
          <h1>Employees</h1>
        </div>
        {canManage && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New Employee
            </button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="card">
        {employees === null ? (
          <div className="loading">Loading…</div>
        ) : employees.length === 0 ? (
          <div className="empty">No employees to show.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Employee #</th>
                <th>Name</th>
                <th>Job Title</th>
                <th>Start Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.employeeNumber}</td>
                  <td className="rowlink">
                    {e.firstName} {e.lastName}
                  </td>
                  <td>{e.jobTitle || '—'}</td>
                  <td>{e.employmentStartDate ? e.employmentStartDate.slice(0, 10) : '—'}</td>
                  <td>
                    <span className={`badge ${e.status === 'active' ? 'success' : 'neutral'}`}>
                      <span className="dot" />
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateEmployeeModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </Layout>
  );
}

function CreateEmployeeModal({ onClose, onCreated }) {
  const [companyId, setCompanyId] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [employmentStartDate, setEmploymentStartDate] = useState('');
  const [contractType, setContractType] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [nextOfKinName, setNextOfKinName] = useState('');
  const [nextOfKinPhone, setNextOfKinPhone] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [taxIdentificationNumber, setTaxIdentificationNumber] = useState('');
  const [documentReference, setDocumentReference] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/employees', {
        method: 'POST',
        body: {
          companyId,
          employeeNumber,
          firstName,
          lastName,
          nationalId: nationalId || undefined,
          jobTitle: jobTitle || undefined,
          jobDescription: jobDescription || undefined,
          employmentStartDate,
          contractType: contractType || undefined,
          qualifications: qualifications || undefined,
          nextOfKinName: nextOfKinName || undefined,
          nextOfKinPhone: nextOfKinPhone || undefined,
          emergencyContactName: emergencyContactName || undefined,
          emergencyContactPhone: emergencyContactPhone || undefined,
          bankName: bankName || undefined,
          bankAccountNumber: bankAccountNumber || undefined,
          taxIdentificationNumber: taxIdentificationNumber || undefined,
          documentReference: documentReference || undefined,
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create employee.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h2>New Employee</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Company ID <span className="req">*</span>
            </label>
            <input className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="uuid" required />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Employee Number *</label>
              <input className="input" value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} required />
            </div>
            <div className="field">
              <label>Start Date *</label>
              <input
                className="input"
                type="date"
                value={employmentStartDate}
                onChange={(e) => setEmploymentStartDate(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>First Name *</label>
              <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Last Name *</label>
              <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
            <div className="field">
              <label>National ID</label>
              <input className="input" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
            </div>
            <div className="field">
              <label>Contract Type</label>
              <input className="input" value={contractType} onChange={(e) => setContractType(e.target.value)} placeholder="e.g. permanent, fixed-term" />
            </div>
          </div>

          <div className="fs-title">Job</div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Job Title</label>
            <input className="input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Job Description</label>
            <textarea className="input" rows={2} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Qualifications / Skills / Certifications</label>
            <textarea className="input" rows={2} value={qualifications} onChange={(e) => setQualifications(e.target.value)} />
          </div>

          <div className="fs-title">Next of Kin / Emergency Contact</div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Next of Kin Name</label>
              <input className="input" value={nextOfKinName} onChange={(e) => setNextOfKinName(e.target.value)} />
            </div>
            <div className="field">
              <label>Next of Kin Phone</label>
              <input className="input" value={nextOfKinPhone} onChange={(e) => setNextOfKinPhone(e.target.value)} />
            </div>
            <div className="field">
              <label>Emergency Contact Name</label>
              <input className="input" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} />
            </div>
            <div className="field">
              <label>Emergency Contact Phone</label>
              <input className="input" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} />
            </div>
          </div>

          <div className="fs-title">Bank &amp; Tax (FR-EMP-05, masked on read unless you hold employee.view.sensitive)</div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Bank Name</label>
              <input className="input" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div className="field">
              <label>Bank Account Number</label>
              <input className="input" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
            </div>
            <div className="field">
              <label>Tax Identification Number</label>
              <input className="input" value={taxIdentificationNumber} onChange={(e) => setTaxIdentificationNumber(e.target.value)} />
            </div>
          </div>

          <div className="fs-title">Documents</div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Document Reference</label>
            <input
              className="input"
              value={documentReference}
              onChange={(e) => setDocumentReference(e.target.value)}
              placeholder="e.g. contract/ID scan filed as DOC-2026-0041 — file upload is not built in this slice"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
