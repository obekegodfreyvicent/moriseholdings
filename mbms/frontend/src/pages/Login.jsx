import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiRequestError } from '../lib/api';
import Logo from '../components/Logo';

export function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('m.okurut@morise-holdings.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to reach the server.');
    }
  }

  return (
    <div className="loginwrap">
      <div className="loginbox">
        <div className="lmark"><Logo size={32} /></div>
        <h1>Morise Holdings Limited</h1>
        <div className="sub">Business Management System</div>

        {error && (
          <div className="banner error">
            <span>&#9888;</span> {error}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Log In'}
          </button>
        </form>

        <div className="demo">
          Demo accounts (seeded, local dev only):
          <br />
          m.okurut@morise-holdings.com — Managing Director
          <br />
          g.obeke@morise-holdings.com — IT Administrator
          <br />
          p.kintu@morise-holdings.com — Branch Manager (Morise Agro Ltd only)
          <br />
          m.nakato@morise-holdings.com — HR Manager (Morise Logistics Ltd only)
          <br />
          a.smith@morise-holdings.com — Finance Manager (Morise Agro Ltd only)
          <br />
          s.namuli@morise-holdings.com — Sales Manager (Morise Agro Ltd only)
          <br />
          r.kato@morise-holdings.com — Procurement Manager (Morise Agro Ltd only)
          <br />
          Password for all: <span className="mono">Passw0rd!23</span>
        </div>
      </div>
    </div>
  );
}
