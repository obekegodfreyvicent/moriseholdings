import React from 'react';
import Logo from './Logo';

// Automatic Staff Identification Card (3 September 2026) — the printable card
// face, shared by the admin gallery (Staff ID Cards) and My HR → My ID Card.
// `card` is a resource from /api/v1/staff-id-cards or /api/v1/my-hr/id-card.
// The QR block is a deterministic monochrome grid derived from the card's
// verificationCode — a stand-in for a real QR encoder (none is bundled in
// this proof-of-concept); the code itself resolves via
// GET /api/v1/staff-id-cards/verify/:code.

const NAVY = '#1E3A5F';
const AMBER = '#D97706';

function fauxQr(seed, n = 11) {
  // xmur3 + a tiny PRNG so the same code always paints the same grid.
  let h = 1779033703 ^ String(seed || '').length;
  for (let i = 0; i < String(seed || '').length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  // A 3×3 "finder" block in three corners, like a real QR code.
  const inFinder = (x, y) =>
    (x < 3 && y < 3) || (x >= n - 3 && y < 3) || (x < 3 && y >= n - 3);
  const cells = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (inFinder(x, y)) {
        // Solid 3×3 square with a hollow centre pixel.
        const lx = x >= n - 3 ? x - (n - 3) : x;
        const ly = y >= n - 3 ? y - (n - 3) : y;
        cells.push(lx === 1 && ly === 1 ? 0 : 1);
      } else {
        cells.push(rand() > 0.55 ? 1 : 0);
      }
    }
  }
  return { n, cells };
}

function statusBadge(card) {
  if (card.status === 'revoked') return { cls: 'error', label: 'Revoked' };
  if (card.status === 'expired') return { cls: 'neutral', label: 'Expired' };
  if (!card.isValid) return { cls: 'warning', label: 'Not valid' };
  return { cls: 'success', label: 'Valid' };
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toISOString().slice(0, 10);
}

export function IdCard({ card, size = 'md' }) {
  const e = card.employee || {};
  const badge = statusBadge(card);
  const qr = fauxQr(card.verificationCode || card.cardNumber);
  const scale = size === 'sm' ? 0.82 : 1;
  const W = Math.round(340 * scale);

  return (
    <div
      className="idcard"
      style={{
        width: W,
        border: '1px solid #d7deea',
        borderRadius: 14,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(16,32,64,.12)',
        fontSize: 13 * scale,
        opacity: card.status === 'active' ? 1 : 0.75,
      }}
    >
      <div
        style={{
          background: NAVY,
          color: '#fff',
          padding: `${10 * scale}px ${14 * scale}px`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ display: 'inline-flex', background: '#fff', borderRadius: 6, padding: 3 }}>
          <Logo size={20 * scale} />
        </span>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 700, fontSize: 12.5 * scale }}>Morise Holdings Limited</div>
          <div style={{ fontSize: 9.5 * scale, opacity: 0.8, letterSpacing: '.08em' }}>STAFF IDENTIFICATION CARD</div>
        </div>
        <span
          className={`badge ${badge.cls}`}
          style={{ marginLeft: 'auto', fontSize: 9 * scale, padding: '2px 7px' }}
        >
          <span className="dot" />
          {badge.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12 * scale, padding: 14 * scale }}>
        <div
          style={{
            width: 74 * scale,
            height: 90 * scale,
            borderRadius: 8,
            flexShrink: 0,
            background: e.photoUrl || card.photoUrl ? `center/cover no-repeat url("${e.photoUrl || card.photoUrl}")` : '#EAEDF3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: NAVY,
            fontWeight: 700,
            fontSize: 26 * scale,
            border: `2px solid ${AMBER}`,
          }}
        >
          {!(e.photoUrl || card.photoUrl) && (e.initials || '')}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 * scale, color: NAVY }}>{e.fullName || `${e.firstName || ''} ${e.lastName || ''}`}</div>
          <div style={{ color: '#5b6a85', marginBottom: 6 * scale }}>{e.jobTitle || '—'}</div>
          <Row label="Staff No." value={e.employeeNumber} scale={scale} />
          <Row label="Company" value={e.companyName} scale={scale} />
          {(e.departmentName || e.branchName) && (
            <Row label="Unit" value={[e.departmentName, e.branchName].filter(Boolean).join(' · ')} scale={scale} />
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12 * scale,
          borderTop: '1px solid #eef1f6',
          padding: `${10 * scale}px ${14 * scale}px`,
        }}
      >
        <svg
          width={58 * scale}
          height={58 * scale}
          viewBox={`0 0 ${qr.n} ${qr.n}`}
          shapeRendering="crispEdges"
          style={{ flexShrink: 0, background: '#fff' }}
          aria-label="Verification code"
        >
          {qr.cells.map((v, i) =>
            v ? <rect key={i} x={i % qr.n} y={Math.floor(i / qr.n)} width="1" height="1" fill={NAVY} /> : null,
          )}
        </svg>
        <div style={{ minWidth: 0, flex: 1, lineHeight: 1.5 }}>
          <div className="mono" style={{ fontWeight: 700, color: NAVY, fontSize: 13 * scale }}>{card.cardNumber}</div>
          <div style={{ fontSize: 10.5 * scale, color: '#5b6a85' }}>
            Issued {fmtDate(card.issuedOn)} · Expires {fmtDate(card.expiresOn)}
            {card.reissueCount > 0 && ` · reissue #${card.reissueCount}`}
          </div>
          {card.status === 'revoked' && card.revokedReason && (
            <div style={{ fontSize: 10.5 * scale, color: 'var(--error, #b3261e)' }}>Revoked — {card.revokedReason}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, scale }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: 11.5 * scale }}>
      <span style={{ color: '#8592a8', minWidth: 62 * scale }}>{label}</span>
      <span style={{ color: '#2b3a52', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value || '—'}
      </span>
    </div>
  );
}

export default IdCard;
