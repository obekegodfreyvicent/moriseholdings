import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Social Media Publishing (3 September 2026) — a mini Buffer / Hootsuite:
// write one master post, fan it out to many connected channels in one
// click with per-platform caption overrides, publish now or schedule, and
// track per-platform success / failure. The platform publish is simulated
// in this build (no real OAuth / platform API) — see docx/24.

const err = (e, f) => (e instanceof ApiRequestError ? e.apiError.message : f);
const MEDIA_TYPES = [
  ['none', 'No media'],
  ['image', 'Image'],
  ['video', 'Video'],
  ['link', 'Link only'],
];
const POST_BADGE = {
  draft: 'neutral',
  scheduled: 'warning',
  publishing: 'warning',
  published: 'success',
  partially_failed: 'warning',
  failed: 'error',
};
const TARGET_BADGE = { pending: 'neutral', publishing: 'warning', success: 'success', failed: 'error', skipped: 'neutral' };

export function SocialPublishingPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('social.post.manage');
  const canPublish = hasPermission('social.post.publish');

  const [tab, setTab] = useState('compose');
  const [platforms, setPlatforms] = useState([]);
  const [posts, setPosts] = useState(null);
  const [dash, setDash] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  function loadPlatforms() {
    return apiRequest('/social/platforms').then(setPlatforms).catch(() => setPlatforms([]));
  }
  function loadPosts() {
    return apiRequest('/social/posts').then(setPosts).catch(() => setPosts([]));
  }
  function loadDash() {
    return apiRequest('/social/dashboard').then(setDash).catch(() => setDash(null));
  }
  useEffect(() => {
    loadPlatforms();
    loadPosts();
    loadDash();
  }, []);

  async function openDetail(id) {
    setDetail(await apiRequest(`/social/posts/${id}`));
  }
  async function act(fn, okMsg) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (okMsg) setNotice(okMsg);
      loadPosts();
      loadDash();
      loadPlatforms();
    } catch (e) {
      setError(err(e, 'Action failed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Admin / Backend</div>
          <h1>Social Publishing</h1>
        </div>
        <div className="tabs" style={{ display: 'flex', gap: 6 }}>
          {[
            ['compose', 'Compose'],
            ['posts', 'Posts'],
            ['channels', 'Channels'],
            ['dashboard', 'Dashboard'],
          ].map(([k, label]) => (
            <button key={k} className={`btn ${tab === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: '#7c8aa3', marginBottom: 12 }}>
        One post → many channels. Publishing is <strong>simulated</strong> in this build (no live platform API); the
        composer, engine, partial‑failure handling, retry and dashboard are all real. See doc 24.
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner info">{notice}</div>}

      {tab === 'compose' && (
        <Composer platforms={platforms} canManage={canManage} canPublish={canPublish} onDone={(msg) => { setNotice(msg); loadPosts(); loadDash(); setTab('posts'); }} />
      )}

      {tab === 'posts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
          <div className="card">
            {posts === null ? (
              <div className="loading">Loading…</div>
            ) : posts.length === 0 ? (
              <div className="empty">No posts yet. Use the Compose tab.</div>
            ) : (
              <table>
                <thead>
                  <tr><th>Post</th><th>Status</th><th style={{ textAlign: 'right' }}>Channels</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id} className={detail?.id === p.id ? 'active' : ''} style={{ cursor: 'pointer' }} onClick={() => openDetail(p.id)}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.title || '(untitled)'}</div>
                        <div style={{ fontSize: 12, color: '#7c8aa3' }}>{p.excerpt}</div>
                      </td>
                      <td><span className={`badge ${POST_BADGE[p.status] || 'neutral'}`}><span className="dot" />{p.status.replace('_', ' ')}</span></td>
                      <td className="mono" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {p.targetsSucceeded}✓{p.targetsFailed ? ` / ${p.targetsFailed}✗` : ''} <span style={{ color: '#8592a8' }}>/ {p.targetCount}</span>
                      </td>
                      <td style={{ fontSize: 12, color: '#7c8aa3' }}>{new Date(p.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <PostDetail
            detail={detail}
            busy={busy}
            canManage={canManage}
            canPublish={canPublish}
            onPublish={() => act(() => apiRequest(`/social/posts/${detail.id}/publish`, { method: 'POST' }).then(setDetail), 'Publish run complete.')}
            onRetry={() => act(() => apiRequest(`/social/posts/${detail.id}/retry`, { method: 'POST' }).then(setDetail), 'Retry complete.')}
            onDelete={() => act(async () => { await apiRequest(`/social/posts/${detail.id}`, { method: 'DELETE' }); setDetail(null); }, 'Post deleted.')}
            onReload={() => openDetail(detail.id)}
          />
        </div>
      )}

      {tab === 'channels' && (
        <div className="card">
          <table>
            <thead>
              <tr><th>Channel</th><th>Status</th><th>Account</th><th>Token expires</th><th>Limit</th>{canManage && <th />}</tr>
            </thead>
            <tbody>
              {platforms.map((p) => (
                <tr key={p.platform}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>
                    <span className={`badge ${p.connected ? 'success' : p.connectionStatus === 'expired' ? 'error' : 'neutral'}`}>
                      <span className="dot" />{p.connected ? 'connected' : p.connectionStatus}
                    </span>
                    {p.expiringSoon && <span className="badge warning" style={{ marginLeft: 6 }}>expiring soon</span>}
                  </td>
                  <td style={{ fontSize: 13 }}>{p.accountLabel || '—'}</td>
                  <td style={{ fontSize: 13 }}>
                    {p.tokenExpiresAt ? `${new Date(p.tokenExpiresAt).toLocaleDateString()} (${p.expiresInDays}d)` : '—'}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{p.charLimit.toLocaleString()} ch{p.mediaRule === 'required' ? ' · media req.' : ''}</td>
                  {canManage && (
                    <td style={{ textAlign: 'right' }}>
                      {p.connected ? (
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} disabled={busy}
                          onClick={() => act(() => apiRequest(`/social/platforms/${p.platform}/disconnect`, { method: 'POST' }))}>Disconnect</button>
                      ) : (
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} disabled={busy}
                          onClick={() => act(() => apiRequest(`/social/platforms/${p.platform}/connect`, { method: 'POST', body: { accountLabel: '@moriseholdings' } }))}>Connect</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11.5, color: '#7c8aa3', marginTop: 8 }}>
            "Connect" here records a simulated OAuth connection with a ~60‑day token — no real platform handshake exists
            in this build. In production this is an OAuth 2.0 redirect per platform.
          </div>
        </div>
      )}

      {tab === 'dashboard' && (
        <Dashboard dash={dash} canPublish={canPublish} onRunScheduled={() => act(() => apiRequest('/social/run-scheduled', { method: 'POST' }), 'Scheduled posts fired.')} />
      )}
    </Layout>
  );
}

// ------------------------------------------------------------------ Composer

function Composer({ platforms, canManage, canPublish, onDone }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mediaType, setMediaType] = useState('none');
  const [mediaUrl, setMediaUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [selected, setSelected] = useState({}); // platform -> {on, caption}
  const [scheduledFor, setScheduledFor] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const chosen = useMemo(
    () => platforms.filter((p) => selected[p.platform]?.on),
    [platforms, selected],
  );

  function toggle(platform) {
    setSelected((s) => ({ ...s, [platform]: { on: !s[platform]?.on, caption: s[platform]?.caption ?? '' } }));
  }
  function setCaption(platform, v) {
    setSelected((s) => ({ ...s, [platform]: { on: true, caption: v } }));
  }

  function targetsPayload() {
    return chosen.map((p) => {
      const cap = (selected[p.platform]?.caption || '').trim();
      return cap ? { platform: p.platform, caption: cap } : { platform: p.platform };
    });
  }

  async function save(publishNow) {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      const created = await apiRequest('/social/posts', {
        method: 'POST',
        body: {
          title: title.trim() || undefined,
          bodyMaster: body,
          mediaType,
          mediaUrl: mediaUrl.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
          targets: targetsPayload(),
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        },
      });
      if (publishNow) {
        if (!canPublish) {
          onDone('Draft saved. You do not have the "publish" permission.');
          return;
        }
        await apiRequest(`/social/posts/${created.id}/publish`, { method: 'POST' });
        onDone('Post published.');
      } else {
        onDone(scheduledFor ? 'Post scheduled.' : 'Draft saved.');
      }
    } catch (e) {
      setError(err(e, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      <div className="card">
        {error && <div className="banner error">{error}</div>}
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Internal title (not published)</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q3 storefront push" />
        </div>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Master text <span className="req">*</span></label>
          <textarea className="input" rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write once — override per channel below where needed." />
        </div>
        <div className="formgrid" style={{ marginBottom: 10 }}>
          <div className="field">
            <label>Media</label>
            <select className="select" value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
              {MEDIA_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Link URL</label>
            <input className="input" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>
        {mediaType !== 'none' && mediaType !== 'link' && (
          <div className="field" style={{ marginBottom: 10 }}>
            <label>{mediaType === 'video' ? 'Video' : 'Image'} URL <span style={{ color: '#8592a8', fontWeight: 400 }}>(text reference — no upload in this build)</span></label>
            <input className="input" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…" />
          </div>
        )}

        <label style={{ fontSize: 12, fontWeight: 700, color: '#5b6a85' }}>Channels</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '6px 0 12px' }}>
          {platforms.map((p) => (
            <button
              key={p.platform}
              type="button"
              className={`btn ${selected[p.platform]?.on ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '5px 12px', fontSize: 12.5, opacity: p.connected ? 1 : 0.6 }}
              onClick={() => toggle(p.platform)}
              title={p.connected ? '' : 'Not connected — connect it on the Channels tab first'}
            >
              <span style={{ color: p.connected ? 'var(--success,#2E7D4F)' : '#c33', marginRight: 5 }}>●</span>
              {p.name}
            </button>
          ))}
        </div>

        <div className="formgrid" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Schedule for (optional)</label>
            <input className="input" type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
          </div>
        </div>

        <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-secondary" disabled={busy || !canManage || !body.trim() || chosen.length === 0} onClick={() => save(false)}>
            {scheduledFor ? 'Schedule' : 'Save draft'}
          </button>
          <button className="btn btn-primary" disabled={busy || !canManage || !canPublish || !body.trim() || chosen.length === 0} onClick={() => save(true)}>
            Publish now
          </button>
        </div>
        {!canPublish && <div style={{ fontSize: 11.5, color: '#7c8aa3', marginTop: 6 }}>You can draft and schedule; publishing needs the <code>social.post.publish</code> permission.</div>}
      </div>

      {/* live per-channel preview */}
      <div className="card">
        <strong style={{ fontSize: 13 }}>Preview</strong>
        {chosen.length === 0 ? (
          <div className="empty" style={{ marginTop: 10 }}>Pick one or more channels to preview.</div>
        ) : (
          chosen.map((p) => {
            const cap = (selected[p.platform]?.caption || '').trim() || body;
            const over = cap.length > p.charLimit;
            const truncates = p.platform === 'x';
            return (
              <div key={p.platform} style={{ border: '1px solid #e6eaf1', borderRadius: 8, padding: 10, marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 12.5 }}>{p.name}</strong>
                  <span className="mono" style={{ fontSize: 11, color: over ? 'var(--error,#b3261e)' : '#7c8aa3' }}>
                    {cap.length.toLocaleString()} / {p.charLimit.toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap', margin: '6px 0', color: '#2b3a52' }}>
                  {cap.slice(0, p.charLimit) || <span style={{ color: '#aab' }}>(no caption)</span>}
                  {over && truncates && '…'}
                </div>
                {over && !truncates && <div style={{ fontSize: 11, color: 'var(--error,#b3261e)' }}>Over the {p.name} limit — this channel will reject it.</div>}
                {over && truncates && <div style={{ fontSize: 11, color: 'var(--warning,#D98C00)' }}>Will be trimmed to {p.charLimit} characters on {p.name}.</div>}
                {p.mediaRule === 'required' && mediaType === 'none' && <div style={{ fontSize: 11, color: 'var(--error,#b3261e)' }}>{p.name} requires an image or video.</div>}
                {!p.connected && <div style={{ fontSize: 11, color: 'var(--error,#b3261e)' }}>{p.name} is not connected.</div>}
                <details style={{ fontSize: 12 }}>
                  <summary style={{ cursor: 'pointer', color: '#5b6a85' }}>Override caption for {p.name}</summary>
                  <textarea className="input" rows={3} style={{ marginTop: 6 }} value={selected[p.platform]?.caption || ''} onChange={(e) => setCaption(p.platform, e.target.value)} placeholder="Leave blank to use the master text" />
                </details>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- PostDetail

function PostDetail({ detail, busy, canManage, canPublish, onPublish, onRetry, onDelete }) {
  if (!detail) return <div className="card"><div className="empty">Select a post.</div></div>;
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <strong>{detail.title || '(untitled)'}</strong>
          <div><span className={`badge ${POST_BADGE[detail.status] || 'neutral'}`}><span className="dot" />{detail.status.replace('_', ' ')}</span></div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {canPublish && detail.canPublish && <button className="btn btn-primary" style={{ padding: '5px 10px', fontSize: 12 }} disabled={busy} onClick={onPublish}>Publish</button>}
          {canPublish && detail.canRetry && <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} disabled={busy} onClick={onRetry}>Retry failed</button>}
          {canManage && detail.status !== 'published' && <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} disabled={busy} onClick={onDelete}>Delete</button>}
        </div>
      </div>

      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: '10px 0', color: '#2b3a52' }}>{detail.bodyMaster}</div>
      {detail.linkUrl && <div style={{ fontSize: 12 }}><span style={{ color: '#8592a8' }}>Link: </span><a href={detail.linkUrl} target="_blank" rel="noreferrer">{detail.linkUrl}</a></div>}
      {detail.mediaUrl && <div style={{ fontSize: 12 }}><span style={{ color: '#8592a8' }}>{detail.mediaType}: </span>{detail.mediaUrl}</div>}
      {detail.scheduledFor && <div style={{ fontSize: 12, color: '#7c8aa3' }}>Scheduled for {new Date(detail.scheduledFor).toLocaleString()}</div>}

      <table style={{ marginTop: 12 }}>
        <thead><tr><th>Channel</th><th>Status</th><th>Result</th></tr></thead>
        <tbody>
          {detail.targets.map((t) => (
            <tr key={t.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{t.platformName}</div>
                <div className="mono" style={{ fontSize: 11, color: t.overLimit ? 'var(--error,#b3261e)' : '#8592a8' }}>{t.charCount}/{t.charLimit}{t.willTruncate ? ' (trim)' : ''}</div>
              </td>
              <td><span className={`badge ${TARGET_BADGE[t.status] || 'neutral'}`}><span className="dot" />{t.status}</span></td>
              <td style={{ fontSize: 12 }}>
                {t.externalUrl && <a href={t.externalUrl} target="_blank" rel="noreferrer">View live post ↗</a>}
                {t.error && <span style={{ color: 'var(--error,#b3261e)' }}>{t.error}</span>}
                {!t.externalUrl && !t.error && t.warnings.length > 0 && <span style={{ color: 'var(--warning,#D98C00)' }}>{t.warnings[0]}</span>}
                {t.caption && <div style={{ color: '#7c8aa3', marginTop: 2 }}>override: {t.caption.slice(0, 80)}{t.caption.length > 80 ? '…' : ''}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- Dashboard

function Dashboard({ dash, canPublish, onRunScheduled }) {
  if (!dash) return <div className="card"><div className="loading">Loading…</div></div>;
  const tile = (label, value, tone) => (
    <div className="card" style={{ textAlign: 'center', minWidth: 120 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: tone === 'bad' ? 'var(--error,#b3261e)' : tone === 'warn' ? 'var(--warning,#D98C00)' : 'var(--navy,#1E3A5F)' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#7c8aa3' }}>{label}</div>
    </div>
  );
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {tile('Published', dash.posts.published)}
        {tile('Scheduled', dash.posts.scheduled, dash.posts.scheduled ? 'warn' : undefined)}
        {tile('Drafts', dash.posts.draft)}
        {tile('Partial / failed', dash.posts.partiallyFailed + dash.posts.failed, dash.posts.partiallyFailed + dash.posts.failed ? 'bad' : undefined)}
        {tile('Channels connected', dash.connections.connected)}
        {tile('Tokens expiring', dash.connections.expiringSoon, dash.connections.expiringSoon ? 'warn' : undefined)}
        {tile('Deliveries ✓', dash.targets.success)}
        {tile('Deliveries ✗', dash.targets.failed, dash.targets.failed ? 'bad' : undefined)}
      </div>
      {canPublish && dash.posts.scheduled > 0 && (
        <button className="btn btn-secondary" style={{ marginBottom: 14 }} onClick={onRunScheduled}>Run {dash.posts.scheduled} scheduled post(s) now</button>
      )}
      <div className="card">
        <strong style={{ fontSize: 13 }}>Recent activity</strong>
        <table style={{ marginTop: 8 }}>
          <thead><tr><th>Post</th><th>Status</th><th>Channels</th></tr></thead>
          <tbody>
            {dash.recent.map((r) => (
              <tr key={r.id}>
                <td>{r.title || r.excerpt}</td>
                <td><span className={`badge ${POST_BADGE[r.status] || 'neutral'}`}><span className="dot" />{r.status.replace('_', ' ')}</span></td>
                <td style={{ fontSize: 12 }}>
                  {r.outcomes.map((o) => (
                    <span key={o.platform} title={o.error || ''} style={{ marginRight: 8, color: o.status === 'success' ? 'var(--success,#2E7D4F)' : o.status === 'failed' ? 'var(--error,#b3261e)' : '#8592a8' }}>
                      {o.platformName}{o.status === 'success' ? ' ✓' : o.status === 'failed' ? ' ✗' : ` (${o.status})`}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
