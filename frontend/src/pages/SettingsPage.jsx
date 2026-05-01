import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { Btn, Badge, Card, Seg } from '../components/ui/index.jsx';
import { IcoCheck } from '../components/ui/Icons.jsx';

const INTEGRATIONS = [
  { key: 'mqtt',  name: 'MQTT broker',            sub: 'mqtt.taarifa.live · IoT device transport', on: true },
  { key: 'email', name: 'Email (SMTP)',            sub: 'Alert and report delivery',                on: true },
  { key: 'sms',   name: 'SMS (Africa\'s Talking)', sub: 'Critical alert SMS dispatch',             on: false },
  { key: 'slack', name: 'Slack',                  sub: 'Not connected',                            on: false },
  { key: 'hooks', name: 'Webhooks',               sub: '2 endpoints registered',                   on: true },
];

export default function SettingsPage() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me });
  const [orgName, setOrgName] = useState('');
  const [timezone, setTimezone] = useState('Africa/Nairobi');
  const [units, setUnits] = useState('metric');
  const [saved, setSaved] = useState(false);

  function handleSave(e) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Settings</h1>
          <div className="page__sub">Organisation, billing, integrations.</div>
        </div>
      </div>

      <div className="grid grid-cols-2">
        <Card title="Organisation">
          <form onSubmit={handleSave}>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field__label">Name</label>
              <input
                className="input"
                value={orgName}
                placeholder={me?.orgId || 'Your organisation'}
                onChange={e => setOrgName(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field__label">Default timezone</label>
              <select className="select" value={timezone} onChange={e => setTimezone(e.target.value)}>
                <option value="Africa/Nairobi">Africa/Nairobi (EAT +03:00)</option>
                <option value="Africa/Dar_es_Salaam">Africa/Dar es Salaam (EAT +03:00)</option>
                <option value="Africa/Kampala">Africa/Kampala (EAT +03:00)</option>
                <option value="Africa/Lagos">Africa/Lagos (WAT +01:00)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label className="field__label">Default units</label>
              <Seg value={units} onChange={setUnits} options={[
                { value: 'metric',   label: 'Metric' },
                { value: 'imperial', label: 'Imperial' },
              ]} />
            </div>
            <Btn kind="primary" size="sm" icon={IcoCheck} type="submit">
              {saved ? 'Saved' : 'Save changes'}
            </Btn>
          </form>
        </Card>

        <Card title="Integrations">
          {INTEGRATIONS.map(intg => (
            <div key={intg.key} className="row gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{intg.name}</div>
                <div className="text-xs muted">{intg.sub}</div>
              </div>
              <Badge kind={intg.on ? 'ok' : 'neutral'} dot={intg.on ? 'ok' : 'off'}>
                {intg.on ? 'Connected' : 'Disconnected'}
              </Badge>
              <Btn kind="ghost" size="sm">Configure</Btn>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid grid-cols-2" style={{ marginTop: 16 }}>
        <Card title="Account" sub="Your personal preferences">
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Full name</label>
            <input className="input" defaultValue={me?.fullName || ''} readOnly style={{ background: 'var(--bg-subtle)' }} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Email</label>
            <input className="input" defaultValue={me?.email || ''} readOnly style={{ background: 'var(--bg-subtle)' }} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Role</label>
            <input className="input" defaultValue={me?.role?.replace(/_/g, ' ') || ''} readOnly style={{ background: 'var(--bg-subtle)' }} />
          </div>
          <Btn kind="secondary" size="sm">Change password</Btn>
        </Card>

        <Card title="Danger zone">
          <div className="row gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>Export all data</div>
              <div className="text-xs muted">Download a full archive of your organisation's data.</div>
            </div>
            <Btn kind="secondary" size="sm">Export</Btn>
          </div>
          <div className="row gap-3" style={{ padding: '10px 0' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: 'var(--danger)' }}>Delete organisation</div>
              <div className="text-xs muted">Permanently remove all data. This cannot be undone.</div>
            </div>
            <Btn kind="danger" size="sm">Delete</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
