import React, { useState } from 'react';
import Logo from './Logo';

// Automatic Staff Identification Card — the printable card, shared by the
// admin gallery (Staff ID Cards) and My HR → My ID Card. `card` is a
// resource from /api/v1/staff-id-cards or /api/v1/my-hr/id-card.
//
// The card has a FRONT and a BACK (3 September 2026):
//   • front — logo header, photo / initials, holder details, the QR block,
//     card number and issue / expiry;
//   • back  — a signature-panel strip, standard conditions of use, the
//     "property of / if found return to" block with the issuer's address,
//     the holder's emergency contact / national ID / blood group, any
//     free-text note, and a Code 128-style barcode of the card number.
//
// The QR block and the barcode are deterministic monochrome stand-ins (no
// real encoder is bundled in this proof-of-concept); the verification code
// itself resolves via GET /api/v1/staff-id-cards/verify/:code.

const NAVY = '#1E3A5F';
const AMBER = '#D97706';
const CARD_W = 340;

function fauxQr(seed, n = 11) {
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
  const inFinder = (x, y) => (x < 3 && y < 3) || (x >= n - 3 && y < 3) || (x < 3 && y >= n - 3);
  const cells = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (inFinder(x, y)) {
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

// A Code 128-ish set of vertical bars derived from the card number — a
// placeholder, not a scannable symbology.
function fauxBars(seed) {
  let h = 2166136261;
  for (let i = 0; i < String(seed || '').length; i++) {
    h = (h ^ seed.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  const bars = [];
  let x = 0;
  for (let i = 0; i < 48; i++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const w = 1 + (h % 4);
    bars.push({ x, w, on: i % 2 === 0 });
    x += w;
  }
  return { total: x, bars };
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

const DEFAULT_TERMS = [
  'This card remains the property of Morise Holdings Limited and must be surrendered on request or when employment ends.',
  'Use of this card is limited to the named holder. It is not transferable and must not be altered.',
  'Report a lost or stolen card to Human Resources immediately.',
];

/** One card face (front or back). `side` is 'front' | 'back'. */
export function IdCardFace({ card, side = 'front', scale = 1 }) {
  const e = card.employee || {};
  const back = card.back || {};
  const badge = statusBadge(card);
  const W = Math.round(CARD_W * scale);
  const pad = 14 * scale;
  const photo = e.photoUrl || card.photoUrl;

  const shell = {
    width: W,
    border: '1px solid #d7deea',
    borderRadius: 14,
    overflow: 'hidden',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(16,32,64,.12)',
    fontSize: 13 * scale,
    opacity: card.status === 'active' ? 1 : 0.8,
  };

  if (side === 'back') {
    const bars = fauxBars(card.cardNumber);
    const terms = Array.isArray(back.terms) && back.terms.length ? back.terms : DEFAULT_TERMS;
    return (
      <div className="idcard idcard-back" style={shell}>
        <div style={{ background: NAVY, color: '#fff', padding: `${8 * scale}px ${pad}px`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', background: '#fff', borderRadius: 6, padding: 3 }}>
            <Logo size={16 * scale} />
          </span>
          <div style={{ fontSize: 9.5 * scale, letterSpacing: '.08em', opacity: 0.85 }}>STAFF IDENTIFICATION CARD — BACK</div>
        </div>

        {/* signature panel / "magnetic stripe" strip */}
        <div style={{ height: 22 * scale, background: '#11213a', margin: `${10 * scale}px 0` }} />

        <div style={{ padding: `0 ${pad}px ${pad}px` }}>
          <div style={{ display: 'flex', gap: 10 * scale, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120 * scale }}>
              <BackRow label="National ID" value={back.nationalId} scale={scale} />
              <BackRow label="Blood group" value={back.bloodGroup} scale={scale} />
              <BackRow label="Emergency" value={back.emergencyContactName} scale={scale} />
              <BackRow label="Emerg. tel." value={back.emergencyContactPhone} scale={scale} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <svg width={58 * scale} height={58 * scale} viewBox={`0 0 ${fauxQr(card.verificationCode || card.cardNumber).n} ${fauxQr(card.verificationCode || card.cardNumber).n}`} shapeRendering="crispEdges" style={{ background: '#fff' }} aria-label="Verification code">
                {fauxQr(card.verificationCode || card.cardNumber).cells.map((v, i) =>
                  v ? <rect key={i} x={i % 11} y={Math.floor(i / 11)} width="1" height="1" fill={NAVY} /> : null,
                )}
              </svg>
              <div style={{ fontSize: 8 * scale, color: '#8592a8' }}>scan to verify</div>
            </div>
          </div>

          {back.notes && (
            <div style={{ marginTop: 8 * scale, fontSize: 10.5 * scale, color: '#2b3a52' }}>
              <span style={{ color: '#8592a8' }}>Note: </span>{back.notes}
            </div>
          )}

          <ol style={{ margin: `${10 * scale}px 0 0`, paddingLeft: 16 * scale, fontSize: 9 * scale, color: '#5b6a85', lineHeight: 1.5 }}>
            {terms.map((t, i) => <li key={i}>{t}</li>)}
          </ol>

          <div style={{ marginTop: 8 * scale, fontSize: 9.5 * scale, color: '#2b3a52' }}>
            <strong>If found</strong>, return to {back.issuingAuthority || 'Morise Holdings Limited'}
            {back.issuerAddress ? `, ${back.issuerAddress}` : ''}
            {back.issuerContact ? ` · ${back.issuerContact}` : ''}.
          </div>

          {/* barcode of the card number */}
          <div style={{ marginTop: 10 * scale }}>
            <svg width="100%" height={30 * scale} viewBox={`0 0 ${bars.total} 30`} preserveAspectRatio="none" shapeRendering="crispEdges" aria-label={`Barcode ${card.cardNumber}`}>
              {bars.bars.map((b, i) => (b.on ? <rect key={i} x={b.x} y="0" width={b.w} height="30" fill="#11213a" /> : null))}
            </svg>
            <div className="mono" style={{ textAlign: 'center', fontSize: 10 * scale, letterSpacing: '.15em', color: NAVY }}>{card.cardNumber}</div>
          </div>

          <div style={{ marginTop: 8 * scale, display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 8.5 * scale, color: '#8592a8' }}>
            <span style={{ borderTop: '1px solid #c6d1e3', paddingTop: 2, flex: 1 }}>Holder's signature</span>
            <span style={{ borderTop: '1px solid #c6d1e3', paddingTop: 2, flex: 1, textAlign: 'right' }}>Issuing officer</span>
          </div>
        </div>
      </div>
    );
  }

  // ---- front ----
  const qr = fauxQr(card.verificationCode || card.cardNumber);
  return (
    <div className="idcard idcard-front" style={shell}>
      <div style={{ background: NAVY, color: '#fff', padding: `${10 * scale}px ${pad}px`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', background: '#fff', borderRadius: 6, padding: 3 }}>
          <Logo size={20 * scale} />
        </span>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 700, fontSize: 12.5 * scale }}>Morise Holdings Limited</div>
          <div style={{ fontSize: 9.5 * scale, opacity: 0.8, letterSpacing: '.08em' }}>STAFF IDENTIFICATION CARD</div>
        </div>
        <span className={`badge ${badge.cls}`} style={{ marginLeft: 'auto', fontSize: 9 * scale, padding: '2px 7px' }}>
          <span className="dot" />
          {badge.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12 * scale, padding: pad }}>
        <div
          style={{
            width: 74 * scale,
            height: 90 * scale,
            borderRadius: 8,
            flexShrink: 0,
            background: photo ? `center/cover no-repeat url("${photo}")` : '#EAEDF3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: NAVY,
            fontWeight: 700,
            fontSize: 26 * scale,
            border: `2px solid ${AMBER}`,
          }}
        >
          {!photo && (e.initials || '')}
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 * scale, borderTop: '1px solid #eef1f6', padding: `${10 * scale}px ${pad}px` }}>
        <svg width={58 * scale} height={58 * scale} viewBox={`0 0 ${qr.n} ${qr.n}`} shapeRendering="crispEdges" style={{ flexShrink: 0, background: '#fff' }} aria-label="Verification code">
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

/**
 * The full card. By default shows the front with a "Flip" control; pass
 * `both` to render front and back side by side (used on My ID Card and for
 * printing).
 */
export function IdCard({ card, size = 'md', both = false }) {
  const scale = size === 'sm' ? 0.82 : 1;
  const [side, setSide] = useState('front');

  if (both) {
    return (
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <figure style={{ margin: 0 }}>
          <IdCardFace card={card} side="front" scale={scale} />
          <figcaption style={{ fontSize: 10, color: '#8592a8', textAlign: 'center', marginTop: 4 }}>Front</figcaption>
        </figure>
        <figure style={{ margin: 0 }}>
          <IdCardFace card={card} side="back" scale={scale} />
          <figcaption style={{ fontSize: 10, color: '#8592a8', textAlign: 'center', marginTop: 4 }}>Back</figcaption>
        </figure>
      </div>
    );
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, width: Math.round(CARD_W * scale) }}>
      <IdCardFace card={card} side={side} scale={scale} />
      <button
        type="button"
        className="btn btn-secondary"
        style={{ padding: '4px 10px', fontSize: 12, alignSelf: 'flex-start' }}
        onClick={() => setSide((s) => (s === 'front' ? 'back' : 'front'))}
      >
        ⟲ Show {side === 'front' ? 'back' : 'front'}
      </button>
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

function BackRow({ label, value, scale }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: 10 * scale, marginBottom: 2 * scale }}>
      <span style={{ color: '#8592a8', minWidth: 66 * scale }}>{label}</span>
      <span style={{ color: '#2b3a52', fontWeight: 600 }}>{value || '—'}</span>
    </div>
  );
}

export default IdCard;
