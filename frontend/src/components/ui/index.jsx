// Shared UI primitives matching the Taarifa design system

export function Btn({ kind = 'secondary', size, icon: Icon, iconRight: IconRight, children, full, ...p }) {
  const cls = ['btn', `btn--${kind}`];
  if (size) cls.push(`btn--${size}`);
  if (!children) cls.push('btn--icon');
  if (full) cls.push('btn--full');
  return (
    <button className={cls.join(' ')} {...p}>
      {Icon && <Icon size={size === 'sm' ? 13 : 14} />}
      {children}
      {IconRight && <IconRight size={13} />}
    </button>
  );
}

export function Badge({ kind = 'neutral', children, dot }) {
  return (
    <span className={`badge badge--${kind}`}>
      {dot && <span className={`dot dot--${dot}`} />}
      {children}
    </span>
  );
}

export function StatusDot({ status, pulse }) {
  const map = {
    online: 'ok', offline: 'off', alert: 'danger', maintenance: 'warn',
    warning: 'warn', critical: 'danger', info: 'accent',
    resolved: 'off', acknowledged: 'warn', open: 'danger',
  };
  return <span className={`dot dot--${map[status] || 'off'} ${pulse ? 'dot--pulse' : ''}`} />;
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.value ?? o} onClick={() => onChange(o.value ?? o)}
          className={`seg__btn ${value === (o.value ?? o) ? 'active' : ''}`}>
          {o.icon && <o.icon size={13} />}
          {o.label ?? o}
        </button>
      ))}
    </div>
  );
}

export function Card({ title, sub, actions, children, padding = true, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && (
        <div className="card__head">
          <div>
            {title && <div className="card__title">{title}</div>}
            {sub && <div className="card__sub">{sub}</div>}
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </div>
      )}
      <div className={padding ? 'card__body' : ''}>{children}</div>
    </div>
  );
}

export function Sparkline({ data, color = 'var(--accent)', height = 32, fill = false, animate = true }) {
  if (!data || !data.length) return null;
  const w = 100, h = 100;
  const ys = data.map(d => d.v ?? d);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = max - min || 1;
  const pts = ys.map((v, i) => {
    const x = (i / (ys.length - 1)) * w;
    const y = h - ((v - min) / span) * h;
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }}>
      {fill && <path d={area} fill={color} fillOpacity="0.12" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke"
        className={animate ? 'draw-in' : ''} />
    </svg>
  );
}

export function LineChart({ series, height = 280, yLabel, showLegend = true, area = true, bar = false }) {
  const w = 800, h = height;
  const padL = 44, padR = 16, padT = 14, padB = 28;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  if (!series || !series.length) return null;

  const allPts = series.flatMap(s => s.data);
  const xs = allPts.map(d => d.t);
  const ys = allPts.map(d => d.v);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.floor(Math.min(...ys) * 0.98);
  const yMax = Math.ceil(Math.max(...ys) * 1.02);
  const xSpan = xMax - xMin || 1, ySpan = yMax - yMin || 1;

  const sx = x => padL + ((x - xMin) / xSpan) * innerW;
  const sy = y => padT + (1 - (y - yMin) / ySpan) * innerH;

  const yTicks = 5;
  const yTickVals = Array.from({ length: yTicks }, (_, i) => yMin + (ySpan * i) / (yTicks - 1));
  const xTickCount = 6;
  const xTickIdx = Array.from({ length: xTickCount }, (_, i) =>
    Math.floor((series[0].data.length - 1) * (i / (xTickCount - 1))));

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: 'block' }}>
        {yTickVals.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={sy(v)} y2={sy(v)} stroke="var(--border)" strokeWidth="1" />
            <text x={padL - 8} y={sy(v) + 3} textAnchor="end" fontSize="10" fill="var(--fg-subtle)"
              fontFamily="var(--font-mono)">{v.toFixed(1)}</text>
          </g>
        ))}
        {xTickIdx.map((idx, k) => {
          const d = series[0].data[idx]; if (!d) return null;
          return (
            <text key={k} x={sx(d.t)} y={h - 8} textAnchor="middle" fontSize="10"
              fill="var(--fg-subtle)" fontFamily="var(--font-mono)">{d.label || ''}</text>
          );
        })}
        {bar ? (
          series.map((s) => {
            const bw = Math.max(2, (innerW / (s.data.length || 1)) * 0.65);
            return (
              <g key={s.name}>
                {s.data.map((d) => {
                  const bh = Math.max(1, ((d.v - yMin) / ySpan) * innerH);
                  return (
                    <rect key={d.t}
                      x={sx(d.t) - bw / 2}
                      y={sy(d.v)}
                      width={bw}
                      height={bh}
                      fill={s.color}
                      fillOpacity="0.75"
                    />
                  );
                })}
              </g>
            );
          })
        ) : (
          series.map((s) => {
            const path = s.data.map((d, i) => `${i === 0 ? 'M' : 'L'}${sx(d.t)},${sy(d.v)}`).join(' ');
            const areaP = `${path} L${sx(s.data[s.data.length - 1].t)},${sy(yMin)} L${sx(s.data[0].t)},${sy(yMin)} Z`;
            return (
              <g key={s.name}>
                {area && <path d={areaP} fill={s.color} fillOpacity="0.08" />}
                <path d={path} fill="none" stroke={s.color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })
        )}
        {yLabel && <text x={12} y={padT + 4} fontSize="10" fill="var(--fg-subtle)" fontFamily="var(--font-mono)">{yLabel}</text>}
      </svg>
      {showLegend && (
        <div className="row gap-4" style={{ flexWrap: 'wrap', marginTop: 8 }}>
          {series.map(s => (
            <div key={s.name} className="row gap-2 text-xs">
              <span style={{ width: 10, height: 2, background: s.color, borderRadius: 1, display: 'inline-block' }} />
              <span className="muted">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BarMini({ data, color = 'var(--accent)', height = 36 }) {
  const w = 200, h = 100;
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => d.v ?? d)) || 1;
  const bw = w / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      {data.map((d, i) => {
        const v = d.v ?? d;
        const bh = (v / max) * (h - 4);
        return <rect key={i} x={i * bw + 1} y={h - bh} width={bw - 2} height={bh}
          fill={color} opacity={d.muted ? 0.3 : 0.85} rx="1" />;
      })}
    </svg>
  );
}

export function Empty({ icon: Icon, title, hint, action }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, margin: '0 auto 12px', background: 'var(--bg-subtle)', display: 'grid', placeItems: 'center', color: 'var(--fg-subtle)' }}>
        {Icon && <Icon size={20} />}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      {hint && <div className="muted" style={{ fontSize: 12.5, marginTop: 4, maxWidth: 320, margin: '4px auto 0' }}>{hint}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <svg className="spin" width={24} height={24} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="var(--border-strong)" strokeWidth="2" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
