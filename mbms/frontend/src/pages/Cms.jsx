import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Admin » CMS / Site Builder (28 August 2026). Editable storefront content —
// landing copy, static pages (About, Terms), legal text. Each block has a
// working copy and a published snapshot; the storefront only ever serves the
// published snapshot.

export function CmsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('cms.manage');

  const [blocks, setBlocks] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [showNew, setShowNew] = useState(false);

  async function load(keepId) {
    setError(null);
    try {
      const rows = await apiRequest('/cms/blocks');
      setBlocks(rows);
      if (keepId) setSelectedId(keepId);
      else if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (err) {
      setBlocks([]);
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load content.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = (blocks || []).find((b) => b.id === selectedId) || null;

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Admin / Backend</div>
          <h1>CMS / Site Builder</h1>
        </div>
        {canManage && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New page</button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 0 }}>
          {blocks === null ? (
            <div className="loading">Loading…</div>
          ) : blocks.length === 0 ? (
            <div className="empty">No content pages yet.</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {blocks.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => setSelectedId(b.id)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', cursor: 'pointer',
                      background: b.id === selectedId ? '#EEF2FB' : 'transparent',
                      borderLeft: b.id === selectedId ? '3px solid var(--navy)' : '3px solid transparent',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{b.title}</div>
                    <div className="mono" style={{ fontSize: 11, color: '#7c8aa3' }}>{b.slug}</div>
                    <span className={`badge ${b.status === 'published' ? 'success' : 'neutral'}`} style={{ marginTop: 4 }}>
                      <span className="dot" />{b.status}{b.hasUnpublishedChanges ? ' • edited' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {selected ? (
            <BlockEditor key={selected.id} block={selected} canManage={canManage} onSaved={(id) => load(id)} onDeleted={() => { setSelectedId(null); load(); }} />
          ) : (
            <div className="card"><div className="empty">Select a page.</div></div>
          )}
        </div>
      </div>

      <SocialLinksPanel canManage={canManage} />
      <DisclaimerPanel canManage={canManage} />
      <FaqPanel canManage={canManage} />
      <NewsletterPanel canManage={canManage} />

      {showNew && <NewBlockModal onClose={() => setShowNew(false)} onCreated={(id) => { setShowNew(false); load(id); }} />}
    </Layout>
  );
}

// Social media channels (29 August 2026) — site-wide, shown in the
// storefront / corporate-site footer. Same permissions as content pages:
// cms.viewAll to see, cms.manage to change.
const SOCIAL_PLATFORMS = ['facebook', 'x', 'instagram', 'linkedin', 'youtube', 'tiktok', 'whatsapp', 'telegram', 'other'];
const PLATFORM_LABEL = {
  facebook: 'Facebook', x: 'X (Twitter)', instagram: 'Instagram', linkedin: 'LinkedIn',
  youtube: 'YouTube', tiktok: 'TikTok', whatsapp: 'WhatsApp', telegram: 'Telegram', other: 'Other',
};

function SocialLinksPanel({ canManage }) {
  const [links, setLinks] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ platform: 'facebook', url: '', label: '' });
  const [adding, setAdding] = useState(false);

  // Shared social content (2 September 2026) — one canonical record pushed to
  // every channel in a single click, so all channels carry the same info.
  const [content, setContent] = useState(null);
  const [cForm, setCForm] = useState({ handle: '', displayName: '', tagline: '', isVisible: true });
  const [overwriteUrls, setOverwriteUrls] = useState(false);
  const [cBusy, setCBusy] = useState(false);
  const [cMsg, setCMsg] = useState(null);

  async function load() {
    setError(null);
    try {
      setLinks(await apiRequest('/cms/social-links'));
    } catch (err) {
      setLinks([]);
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load social channels.');
    }
  }

  async function loadContent() {
    try {
      const c = await apiRequest('/cms/social-content');
      setContent(c);
      setCForm({
        handle: c.handle || '',
        displayName: c.displayName || '',
        tagline: c.tagline || '',
        isVisible: c.isVisible !== false,
      });
    } catch {
      setContent({ handle: null, displayName: null, tagline: null, isVisible: true });
    }
  }

  useEffect(() => { load(); loadContent(); }, []);

  async function saveContent(e) {
    e.preventDefault();
    setCBusy(true); setError(null); setCMsg(null);
    try {
      await apiRequest('/cms/social-content', {
        method: 'PUT',
        body: {
          handle: cForm.handle.trim() || null,
          displayName: cForm.displayName.trim() || null,
          tagline: cForm.tagline.trim() || null,
          isVisible: cForm.isVisible,
        },
      });
      setCMsg('Shared content saved. Use a button below to push it to the channels.');
      await loadContent();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Save failed.');
    } finally { setCBusy(false); }
  }

  // One-click: push the shared content onto every channel. `createMissing`
  // also adds a channel for every supported platform first.
  async function applyToAll(createMissing) {
    if (createMissing && !cForm.handle.trim()) {
      setError('Set a handle first — new channels build their URL from it.');
      return;
    }
    setCBusy(true); setError(null); setCMsg(null);
    try {
      const r = await apiRequest('/cms/social-content/apply', {
        method: 'POST',
        body: { createMissing: !!createMissing, overwriteUrls },
      });
      setCMsg(`Done — ${r.created} channel(s) added, ${r.updated} updated with the shared content.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Apply failed.');
    } finally { setCBusy(false); }
  }

  async function clearAll() {
    if (!window.confirm('Delete every social channel? They will all disappear from the storefront. The shared content record is kept.')) return;
    setCBusy(true); setError(null); setCMsg(null);
    try {
      const r = await apiRequest('/cms/social-content/channels', { method: 'DELETE' });
      setCMsg(`Deleted ${r.deleted} channel(s).`);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Clear failed.');
    } finally { setCBusy(false); }
  }

  async function add(e) {
    e.preventDefault();
    setAdding(true); setError(null);
    try {
      const nextOrder = (links || []).reduce((m, l) => Math.max(m, l.sortOrder), 0) + 1;
      await apiRequest('/cms/social-links', {
        method: 'POST',
        body: { platform: form.platform, url: form.url.trim(), label: form.label.trim() || undefined, sortOrder: nextOrder },
      });
      setForm({ platform: 'facebook', url: '', label: '' });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Add failed.');
    } finally { setAdding(false); }
  }

  async function patch(id, body) {
    setBusyId(id); setError(null);
    try {
      await apiRequest(`/cms/social-links/${id}`, { method: 'PATCH', body });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Update failed.');
    } finally { setBusyId(null); }
  }

  async function remove(id, label) {
    if (!window.confirm(`Remove the ${label} channel? It will disappear from the storefront.`)) return;
    setBusyId(id); setError(null);
    try {
      await apiRequest(`/cms/social-links/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Remove failed.');
    } finally { setBusyId(null); }
  }

  function move(link, dir) {
    const sorted = [...links].sort((a, b) => a.sortOrder - b.sortOrder);
    const i = sorted.findIndex((l) => l.id === link.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    patch(link.id, { sortOrder: sorted[j].sortOrder });
    patch(sorted[j].id, { sortOrder: link.sortOrder });
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Social media channels</h2>
        <span style={{ fontSize: 12, color: '#7c8aa3' }}>Shown in the storefront footer. Hidden channels are kept but not displayed.</span>
      </div>

      {error && <div className="banner error" style={{ marginTop: 10 }}>{error}</div>}
      {cMsg && <div className="banner info" style={{ marginTop: 10 }}>{cMsg}</div>}

      {/* Shared content — one edit, applied to every channel in a single click */}
      <div style={{ marginTop: 12, padding: 14, border: '1px solid #e6ebf3', borderRadius: 8, background: '#f8fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Shared content — one edit, all channels</h3>
          <span style={{ fontSize: 12, color: '#7c8aa3' }}>
            {content && content.updatedAt ? `Last saved ${new Date(content.updatedAt).toLocaleString()}` : 'Not saved yet'}
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#5b6a85', margin: '6px 0 12px' }}>
          One canonical handle, label and tagline. The buttons below push it to every social channel at once —
          so every channel shows the same information.
        </p>

        <form onSubmit={saveContent} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Handle</label>
            <input className="input mono" value={cForm.handle} disabled={!canManage}
              onChange={(e) => setCForm({ ...cForm, handle: e.target.value })} placeholder="moriseholdings" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Display name (label for every channel)</label>
            <input className="input" value={cForm.displayName} disabled={!canManage}
              onChange={(e) => setCForm({ ...cForm, displayName: e.target.value })} placeholder="Morise Holdings" />
          </div>
          <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
            <label>Tagline (shown above the channel row in the footer)</label>
            <input className="input" value={cForm.tagline} disabled={!canManage}
              onChange={(e) => setCForm({ ...cForm, tagline: e.target.value })} placeholder="Follow us for group news and updates." />
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={cForm.isVisible} disabled={!canManage}
              onChange={(e) => setCForm({ ...cForm, isVisible: e.target.checked })} />
            Channels visible after apply
          </label>
          {canManage && (
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-secondary" disabled={cBusy}>{cBusy ? 'Working…' : 'Save shared content'}</button>
            </div>
          )}
        </form>

        {canManage && (
          <div style={{ marginTop: 12, borderTop: '1px solid #e6ebf3', paddingTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={cBusy} onClick={() => applyToAll(false)}>Apply to all channels</button>
            <button className="btn btn-primary" disabled={cBusy} onClick={() => applyToAll(true)}>Add &amp; sync every platform</button>
            <button className="btn btn-secondary" disabled={cBusy} onClick={clearAll}>Clear all channels</button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5b6a85' }}>
              <input type="checkbox" checked={overwriteUrls} onChange={(e) => setOverwriteUrls(e.target.checked)} />
              also rebuild URLs from the handle
            </label>
          </div>
        )}
      </div>

      {links === null ? (
        <div className="loading">Loading…</div>
      ) : links.length === 0 ? (
        <div className="empty" style={{ marginTop: 10 }}>No social channels yet.</div>
      ) : (
        <table style={{ marginTop: 10, width: '100%' }}>
          <thead>
            <tr><th>Order</th><th>Platform</th><th>Label</th><th>URL</th><th>Shown</th>{canManage && <th />}</tr>
          </thead>
          <tbody>
            {[...links].sort((a, b) => a.sortOrder - b.sortOrder).map((l) => (
              <tr key={l.id}>
                <td>
                  {canManage ? (
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary" style={{ padding: '2px 7px' }} disabled={busyId === l.id} onClick={() => move(l, -1)}>↑</button>{' '}
                      <button className="btn btn-secondary" style={{ padding: '2px 7px' }} disabled={busyId === l.id} onClick={() => move(l, 1)}>↓</button>
                    </span>
                  ) : l.sortOrder}
                </td>
                <td>{PLATFORM_LABEL[l.platform] || l.platform}</td>
                <td>{l.label || <span style={{ color: '#7c8aa3' }}>—</span>}</td>
                <td className="mono" style={{ fontSize: 12, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <a href={l.url} target="_blank" rel="noreferrer">{l.url}</a>
                </td>
                <td>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={l.isVisible}
                      disabled={!canManage || busyId === l.id}
                      onChange={(e) => patch(l.id, { isVisible: e.target.checked })}
                    />
                    <span className={`badge ${l.isVisible ? 'success' : 'neutral'}`}><span className="dot" />{l.isVisible ? 'shown' : 'hidden'}</span>
                  </label>
                </td>
                {canManage && (
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-secondary" disabled={busyId === l.id} onClick={() => remove(l.id, PLATFORM_LABEL[l.platform] || l.platform)}>Remove</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={add} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 14, borderTop: '1px solid #e6ebf3', paddingTop: 14 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Platform</label>
            <select className="input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
              {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0, flex: '1 1 260px' }}>
            <label>URL <span className="req">*</span></label>
            <input className="input mono" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://facebook.com/yourpage" required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Label</label>
            <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Facebook" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={adding}>{adding ? 'Adding…' : '+ Add channel'}</button>
        </form>
      )}
    </div>
  );
}

function BlockEditor({ block, canManage, onSaved, onDeleted }) {
  const [title, setTitle] = useState(block.title);
  const [slug, setSlug] = useState(block.slug);
  const [body, setBody] = useState(block.body);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const dirty = title !== block.title || slug !== block.slug || body !== block.body;

  async function save() {
    setBusy(true); setError(null); setMsg(null);
    try {
      await apiRequest(`/cms/blocks/${block.id}`, { method: 'PATCH', body: { title, slug, body } });
      setMsg('Saved as draft copy.');
      onSaved(block.id);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Save failed.');
    } finally { setBusy(false); }
  }

  async function act(action) {
    setBusy(true); setError(null); setMsg(null);
    try {
      if (action === 'delete') {
        if (!window.confirm(`Delete "${block.title}"? This cannot be undone.`)) { setBusy(false); return; }
        await apiRequest(`/cms/blocks/${block.id}`, { method: 'DELETE' });
        onDeleted();
        return;
      }
      await apiRequest(`/cms/blocks/${block.id}/${action}`, { method: 'POST' });
      setMsg(action === 'publish' ? 'Published — the storefront now serves this.' : 'Unpublished — hidden from the storefront.');
      onSaved(block.id);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Action failed.');
    } finally { setBusy(false); }
  }

  return (
    <div className="card">
      {error && <div className="banner error">{error}</div>}
      {msg && <div className="banner info">{msg}</div>}

      <div className="formgrid" style={{ marginBottom: 12 }}>
        <div className="field">
          <label>Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canManage} />
        </div>
        <div className="field">
          <label>Slug (storefront path key)</label>
          <input className="input mono" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={!canManage} />
        </div>
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>Body {block.hasUnpublishedChanges && <span style={{ color: 'var(--warning)', fontSize: 12 }}>· unpublished changes</span>}</label>
        <textarea className="input" rows={12} value={body} onChange={(e) => setBody(e.target.value)} disabled={!canManage} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#7c8aa3' }}>
          {block.status === 'published'
            ? `Published ${block.publishedAt ? new Date(block.publishedAt).toLocaleString() : ''}`
            : 'Draft — not visible on the storefront'}
        </div>
        {canManage && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => act('delete')} disabled={busy}>Delete</button>
            {block.status === 'published' && <button className="btn btn-secondary" onClick={() => act('unpublish')} disabled={busy}>Unpublish</button>}
            <button className="btn btn-secondary" onClick={save} disabled={busy || !dirty}>Save draft</button>
            <button className="btn btn-primary" onClick={() => act('publish')} disabled={busy}>
              {block.status === 'published' ? 'Re-publish' : 'Publish'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NewBlockModal({ onClose, onCreated }) {
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const created = await apiRequest('/cms/blocks', { method: 'POST', body: { slug: slug.trim(), title: title.trim(), body } });
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Create failed.');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <h2>New content page</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Slug <span className="req">*</span></label>
            <input className="input mono" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="about" required />
            <div style={{ fontSize: 12, color: '#7c8aa3', marginTop: 4 }}>Lowercase, dot / hyphen / underscore. The storefront reads it at <span className="mono">/page/&lt;slug&gt;</span>.</div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Title <span className="req">*</span></label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Body</label>
            <textarea className="input" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create draft'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Landing-page FAQ (29 August 2026) — site-wide, shown in the FAQ section of
// the corporate landing page. Same permissions as content pages.
function FaqPanel({ canManage }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ question: '', answer: '' });
  const [adding, setAdding] = useState(false);

  async function load() {
    setError(null);
    try {
      setItems(await apiRequest('/cms/faqs'));
    } catch (err) {
      setItems([]);
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load FAQ.');
    }
  }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    setAdding(true); setError(null);
    try {
      const nextOrder = (items || []).reduce((m, i) => Math.max(m, i.sortOrder), 0) + 1;
      await apiRequest('/cms/faqs', { method: 'POST', body: { question: form.question.trim(), answer: form.answer.trim(), sortOrder: nextOrder } });
      setForm({ question: '', answer: '' });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Add failed.');
    } finally { setAdding(false); }
  }

  async function patch(id, body) {
    setBusyId(id); setError(null);
    try { await apiRequest(`/cms/faqs/${id}`, { method: 'PATCH', body }); await load(); }
    catch (err) { setError(err instanceof ApiRequestError ? err.apiError.message : 'Update failed.'); }
    finally { setBusyId(null); }
  }

  async function remove(id, q) {
    if (!window.confirm(`Remove the FAQ "${q.slice(0, 60)}"?`)) return;
    setBusyId(id); setError(null);
    try { await apiRequest(`/cms/faqs/${id}`, { method: 'DELETE' }); await load(); }
    catch (err) { setError(err instanceof ApiRequestError ? err.apiError.message : 'Remove failed.'); }
    finally { setBusyId(null); }
  }

  function move(item, dir) {
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
    const i = sorted.findIndex((x) => x.id === item.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    patch(item.id, { sortOrder: sorted[j].sortOrder });
    patch(sorted[j].id, { sortOrder: item.sortOrder });
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Landing-page FAQ</h2>
        <span style={{ fontSize: 12, color: '#7c8aa3' }}>Shown in the FAQ section of the landing page. Hidden items are kept but not displayed.</span>
      </div>
      {error && <div className="banner error" style={{ marginTop: 10 }}>{error}</div>}

      {items === null ? (
        <div className="loading">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty" style={{ marginTop: 10 }}>No FAQ items yet.</div>
      ) : (
        <table style={{ marginTop: 10, width: '100%' }}>
          <thead><tr><th>Order</th><th>Question</th><th>Answer</th><th>Shown</th>{canManage && <th />}</tr></thead>
          <tbody>
            {[...items].sort((a, b) => a.sortOrder - b.sortOrder).map((it) => (
              <tr key={it.id}>
                <td>
                  {canManage ? (
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary" style={{ padding: '2px 7px' }} disabled={busyId === it.id} onClick={() => move(it, -1)}>↑</button>{' '}
                      <button className="btn btn-secondary" style={{ padding: '2px 7px' }} disabled={busyId === it.id} onClick={() => move(it, 1)}>↓</button>
                    </span>
                  ) : it.sortOrder}
                </td>
                <td style={{ maxWidth: 260, fontWeight: 600 }}>
                  {canManage ? (
                    <input className="input" defaultValue={it.question} onBlur={(e) => e.target.value.trim() !== it.question && patch(it.id, { question: e.target.value.trim() })} />
                  ) : it.question}
                </td>
                <td style={{ maxWidth: 380, color: '#5b6a85', fontSize: 12.5 }}>
                  {canManage ? (
                    <textarea className="input" rows={2} defaultValue={it.answer} onBlur={(e) => e.target.value.trim() !== it.answer && patch(it.id, { answer: e.target.value.trim() })} />
                  ) : it.answer}
                </td>
                <td>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={it.isVisible} disabled={!canManage || busyId === it.id} onChange={(e) => patch(it.id, { isVisible: e.target.checked })} />
                    <span className={`badge ${it.isVisible ? 'success' : 'neutral'}`}><span className="dot" />{it.isVisible ? 'shown' : 'hidden'}</span>
                  </label>
                </td>
                {canManage && (
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-secondary" disabled={busyId === it.id} onClick={() => remove(it.id, it.question)}>Remove</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={add} style={{ display: 'grid', gap: 10, marginTop: 14, borderTop: '1px solid #e6ebf3', paddingTop: 14 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Question <span className="req">*</span></label>
            <input className="input" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="How do I…?" required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Answer <span className="req">*</span></label>
            <textarea className="input" rows={3} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} required />
          </div>
          <div><button type="submit" className="btn btn-primary" disabled={adding}>{adding ? 'Adding…' : '+ Add FAQ'}</button></div>
        </form>
      )}
    </div>
  );
}

// Newsletter sign-ups (29 August 2026) — captured from the landing page's
// newsletter section. Read-only list for cms.viewAll; cms.manage can remove.
function NewsletterPanel({ canManage }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setError(null);
    try { setData(await apiRequest('/cms/newsletter-subscribers')); }
    catch (err) { setData({ total: 0, subscribed: 0, unsubscribed: 0, subscribers: [] }); setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load subscribers.'); }
  }
  useEffect(() => { load(); }, []);

  async function remove(id, email) {
    if (!window.confirm(`Remove ${email} from the newsletter list?`)) return;
    setBusyId(id); setError(null);
    try { await apiRequest(`/cms/newsletter-subscribers/${id}`, { method: 'DELETE' }); await load(); }
    catch (err) { setError(err instanceof ApiRequestError ? err.apiError.message : 'Remove failed.'); }
    finally { setBusyId(null); }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Newsletter sign-ups</h2>
        {data && <span style={{ fontSize: 12, color: '#7c8aa3' }}>{data.subscribed} subscribed · {data.total} total</span>}
      </div>
      {error && <div className="banner error" style={{ marginTop: 10 }}>{error}</div>}

      {data === null ? (
        <div className="loading">Loading…</div>
      ) : data.subscribers.length === 0 ? (
        <div className="empty" style={{ marginTop: 10 }}>No sign-ups yet. The form is on the landing page.</div>
      ) : (
        <table style={{ marginTop: 10, width: '100%' }}>
          <thead><tr><th>Email</th><th>Source</th><th>Status</th><th>Date</th>{canManage && <th />}</tr></thead>
          <tbody>
            {data.subscribers.map((s) => (
              <tr key={s.id}>
                <td className="mono" style={{ fontSize: 12.5 }}>{s.email}</td>
                <td>{s.source || '—'}</td>
                <td><span className={`badge ${s.status === 'subscribed' ? 'success' : 'neutral'}`}><span className="dot" />{s.status}</span></td>
                <td style={{ fontSize: 12, color: '#7c8aa3' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                {canManage && (
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-secondary" disabled={busyId === s.id} onClick={() => remove(s.id, s.email)}>Remove</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Site disclaimer (30 August 2026) — the statements shown on the full-page
// disclaimer gate a signed-out visitor acknowledges before the landing page
// (10-second hold + "I Understand, Continue"). Same permissions as the FAQ.
function DisclaimerPanel({ canManage }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  async function load() {
    setError(null);
    try {
      setItems(await apiRequest('/cms/disclaimer-items'));
    } catch (err) {
      setItems([]);
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load disclaimer.');
    }
  }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    setAdding(true); setError(null);
    try {
      const nextOrder = (items || []).reduce((m, i) => Math.max(m, i.sortOrder), 0) + 1;
      await apiRequest('/cms/disclaimer-items', { method: 'POST', body: { body: draft.trim(), sortOrder: nextOrder } });
      setDraft('');
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Add failed.');
    } finally { setAdding(false); }
  }

  async function patch(id, body) {
    setBusyId(id); setError(null);
    try { await apiRequest(`/cms/disclaimer-items/${id}`, { method: 'PATCH', body }); await load(); }
    catch (err) { setError(err instanceof ApiRequestError ? err.apiError.message : 'Update failed.'); }
    finally { setBusyId(null); }
  }

  async function remove(id) {
    if (!window.confirm('Remove this disclaimer statement?')) return;
    setBusyId(id); setError(null);
    try { await apiRequest(`/cms/disclaimer-items/${id}`, { method: 'DELETE' }); await load(); }
    catch (err) { setError(err instanceof ApiRequestError ? err.apiError.message : 'Remove failed.'); }
    finally { setBusyId(null); }
  }

  function move(item, dir) {
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
    const i = sorted.findIndex((x) => x.id === item.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    patch(item.id, { sortOrder: sorted[j].sortOrder });
    patch(sorted[j].id, { sortOrder: item.sortOrder });
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Site disclaimer</h2>
        <span style={{ fontSize: 12, color: '#7c8aa3' }}>Shown on the full-page disclaimer gate before the landing page (10-second hold). Hidden statements are kept but not shown.</span>
      </div>
      {error && <div className="banner error" style={{ marginTop: 10 }}>{error}</div>}

      {items === null ? (
        <div className="loading">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty" style={{ marginTop: 10 }}>No disclaimer statements yet — add at least one.</div>
      ) : (
        <table style={{ marginTop: 10, width: '100%' }}>
          <thead><tr><th>Order</th><th>Statement</th><th>Shown</th>{canManage && <th />}</tr></thead>
          <tbody>
            {[...items].sort((a, b) => a.sortOrder - b.sortOrder).map((it) => (
              <tr key={it.id}>
                <td>
                  {canManage ? (
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary" style={{ padding: '2px 7px' }} disabled={busyId === it.id} onClick={() => move(it, -1)}>↑</button>{' '}
                      <button className="btn btn-secondary" style={{ padding: '2px 7px' }} disabled={busyId === it.id} onClick={() => move(it, 1)}>↓</button>
                    </span>
                  ) : it.sortOrder}
                </td>
                <td style={{ color: '#334', fontSize: 13 }}>
                  {canManage ? (
                    <textarea className="input" rows={2} defaultValue={it.body} onBlur={(e) => e.target.value.trim() !== it.body && patch(it.id, { body: e.target.value.trim() })} />
                  ) : it.body}
                </td>
                <td>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={it.isVisible} disabled={!canManage || busyId === it.id} onChange={(e) => patch(it.id, { isVisible: e.target.checked })} />
                    <span className={`badge ${it.isVisible ? 'success' : 'neutral'}`}><span className="dot" />{it.isVisible ? 'shown' : 'hidden'}</span>
                  </label>
                </td>
                {canManage && (
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-secondary" disabled={busyId === it.id} onClick={() => remove(it.id)}>Remove</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={add} style={{ display: 'grid', gap: 10, marginTop: 14, borderTop: '1px solid #e6ebf3', paddingTop: 14 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>New statement <span className="req">*</span></label>
            <textarea className="input" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. This is a demonstration environment — no real orders or payments are processed." required />
          </div>
          <div><button type="submit" className="btn btn-primary" disabled={adding}>{adding ? 'Adding…' : '+ Add statement'}</button></div>
        </form>
      )}
    </div>
  );
}
