// Shared UI primitives matching the Taarifa design system
import {
  ResponsiveContainer, ComposedChart, AreaChart, BarChart,
  Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

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

export function Card({ title, sub, actions, children, padding = true, className = '', style }) {
  return (
    <div className={`card ${className}`} style={style}>
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
  if (!data?.length) return null;
  const d = data.map((p, i) => ({ i, v: typeof p === 'number' ? p : (p.v ?? 0) }));
  const gId = `sg${color.replace(/[^a-z0-9]/gi, '').slice(0, 14)}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={d} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.28} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={fill ? `url(#${gId})` : 'none'} dot={false} isAnimationActive={animate} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LineChart({ series, height = 260, yLabel, showLegend = true, area = false, bar = false, normalize = false }) {
  if (!series?.length) return null;
  const len = Math.max(...series.map(s => s.data?.length ?? 0));
  if (len === 0) return null;

  // When normalize=true, scale each series independently to 0-100 so all fit on the same axis.
  // Real values are stored alongside for tooltip display.
  const scaledSeries = normalize ? series.map(s => {
    const vals = s.data.map(d => d.v).filter(v => v != null);
    if (!vals.length) return s;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    return { ...s, _min: min, _max: max, data: s.data.map(d => ({ ...d, _orig: d.v, v: d.v != null ? ((d.v - min) / range) * 100 : null })) };
  }) : series;

  const chartData = Array.from({ length: len }, (_, i) => {
    const row = { _i: i, _label: '' };
    scaledSeries.forEach(s => {
      const pt = s.data?.[i];
      if (pt) {
        row[s.name] = pt.v;
        if (normalize && pt._orig != null) row[`_r_${s.name}`] = pt._orig;
        if (pt.label) row._label = pt.label;
      }
    });
    return row;
  });

  const ttStyle = { background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' };

  const tooltipFormatter = normalize
    ? (value, name, props) => {
        const real = props.payload[`_r_${name}`];
        const unit = series.find(s => s.name === name)?.unit || '';
        return real != null ? `${real.toFixed(2)}${unit ? ' ' + unit : ''}` : `${value?.toFixed(1)}%`;
      }
    : undefined;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: yLabel ? 8 : 0 }}>
          <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="_label" tick={{ fontSize: 10, fill: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}
            tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}
            tickLine={false} axisLine={false} width={normalize ? 28 : (yLabel ? 46 : 36)}
            domain={normalize ? [0, 100] : undefined}
            tickFormatter={normalize ? v => `${v}%` : undefined}
            label={!normalize && yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', offset: 12, style: { fontSize: 10, fill: 'var(--fg-subtle)' } } : undefined} />
          <Tooltip contentStyle={ttStyle} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
            labelStyle={{ color: 'var(--fg-muted)', fontSize: 11 }}
            formatter={tooltipFormatter} />
          {scaledSeries.map(s => bar
            ? <Bar key={s.name} dataKey={s.name} fill={s.color} fillOpacity={0.85} radius={[3,3,0,0]} maxBarSize={20} isAnimationActive={false} />
            : area
              ? <Area key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} fill={s.color} fillOpacity={0.1} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive={false} />
              : <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: s.color, strokeWidth: 0 }} isAnimationActive={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      {showLegend && series.length > 1 && (
        <div className="row gap-4" style={{ flexWrap: 'wrap', marginTop: 8, paddingLeft: 44 }}>
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
  if (!data?.length) return null;
  const d = data.map((p, i) => ({ i, v: typeof p === 'number' ? p : (p.v ?? 0), muted: !!(p?.muted) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={d} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="12%">
        <Bar dataKey="v" isAnimationActive={false} radius={[2,2,0,0]}>
          {d.map((entry, i) => <Cell key={i} fill={color} fillOpacity={entry.muted ? 0.25 : 0.85} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
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
