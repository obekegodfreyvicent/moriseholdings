import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, ApiRequestError } from '../lib/api';

export function ProfilePage() {
  const [me, setMe] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState(null);
  const [pwSaved, setPwSaved] = useState(false);

  useEffect(() => {
    apiRequest('/identity/users/me').then((data) => {
      setMe(data);
      setFirstName(data.firstName);
      setLastName(data.lastName);
    });
  }, []);

  async function onSave(e) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      const updated = await apiRequest('/identity/users/me', { method: 'PATCH', body: { firstName, lastName } });
      setMe(updated);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to save changes.');
    }
  }

  async function onChangePassword(e) {
    e.preventDefault();
    setPwError(null);
    setPwSaved(false);
    try {
      await apiRequest('/identity/users/me/change-password', { method: 'POST', body: { currentPassword, newPassword } });
      setCurrentPassword('');
      setNewPassword('');
      setPwSaved(true);
    } catch (err) {
      if (err instanceof ApiRequestError) setPwError(err.apiError.message);
      else setPwError('Unable to change password.');
    }
  }

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">My Profile</div>
          <h1>My Profile</h1>
        </div>
      </div>

      {!me ? (
        <div className="loading">Loading…</div>
      ) : (
        <div className="grid-2">
          <div className="card">
            <div className="card-body">
              {error && <div className="banner error">{error}</div>}
              {saved && <div className="banner info">Saved.</div>}
              <form onSubmit={onSave}>
                <div className="formsection">
                  <div className="fs-title">Contact Information</div>
                  <div className="formgrid">
                    <div className="field">
                      <label>First Name</label>
                      <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Last Name</label>
                      <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Email</label>
                      <div className="input" style={{ background: '#F4F6FA' }}>
                        {me.email}
                      </div>
                    </div>
                  </div>
                </div>
                <button className="btn btn-primary" type="submit">
                  Save Changes
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-head">Change Password</div>
            <div className="card-body">
              {pwError && <div className="banner error">{pwError}</div>}
              {pwSaved && <div className="banner info">Password changed. Other signed-in sessions have been signed out.</div>}
              <form onSubmit={onChangePassword}>
                <div className="formgrid">
                  <div className="field">
                    <label>Current Password</label>
                    <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                  </div>
                  <div className="field">
                    <label>New Password</label>
                    <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                  </div>
                </div>
                <button className="btn btn-primary" type="submit">
                  Change Password
                </button>
              </form>
              <div className="hint" style={{ marginTop: 10 }}>
                Forgot your current password instead? Sign out and use "Forgot Password?" on the login screen.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">Role & Access (read-only)</div>
            <div className="card-body">
              <table>
                <tbody>
                  <tr>
                    <td>Roles</td>
                    <td>{me.roles.map((r) => r.name).join(', ') || '—'}</td>
                  </tr>
                  <tr>
                    <td>Company Scope</td>
                    <td>
                      {me.scopes.length > 0 ? (
                        me.scopes.map((s) => (
                          <div key={s.id} className="mono">
                            {s.companyId}
                          </div>
                        ))
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="hint" style={{ marginTop: 10 }}>
                Role and scope changes must be requested from your administrator.
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
