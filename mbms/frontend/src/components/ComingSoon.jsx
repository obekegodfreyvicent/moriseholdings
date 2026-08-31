import React from 'react';
import { Layout } from './Layout';

// Navigation redesign (27 August 2026) — the admin sidebar was regrouped
// into four collapsible categories (Admin / Backend, Human Resources, My HR,
// Financial & Accounting) to match the agreed screen taxonomy. Several menu
// entries in that taxonomy have no backend service in the current slice;
// they route here so the structure is navigable end to end without dead
// links. See the root README ("Admin navigation redesign") and the
// "Implementation Status Update (27 August 2026)" section appended to every
// numbered docx.
export function ComingSoon({ title, category, summary, planned = [] }) {
  return (
    <Layout>
      <div className="pagehead">
        <div>
          {category && <div className="crumbs">{category}</div>}
          <h1>{title}</h1>
        </div>
        <span className="badge">Planned</span>
      </div>
      <div className="card">
        <div className="card-body">
          <p style={{ marginTop: 0 }}>{summary}</p>
          {planned.length > 0 && (
            <>
              <p style={{ fontWeight: 700, marginBottom: 6 }}>Planned capabilities</p>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                {planned.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </>
          )}
          <p style={{ opacity: 0.6, fontSize: 12, marginTop: 16, marginBottom: 0 }}>
            This screen is part of the navigation redesign (27 August 2026). Its
            backend service is not built in the current slice — see the root
            README and the docx status logs.
          </p>
        </div>
      </div>
    </Layout>
  );
}
