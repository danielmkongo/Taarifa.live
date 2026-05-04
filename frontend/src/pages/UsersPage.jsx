import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { format } from 'date-fns';
import { Btn, Badge, Card, Empty } from '../components/ui/index.jsx';
import { IcoPlus, IcoMore, IcoX, IcoCheck, IcoUsers, IcoLayers } from '../components/ui/Icons.jsx';

const ROLES = ['viewer', 'manager', 'org_admin'];
const ALL_MODULES = ['weather', 'energy', 'ecalendar'];
const MODULE_LABELS = { weather: 'Weather', energy: 'Energy', ecalendar: 'e-Calendar' };

function InviteModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'viewer' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.createUser(form);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Invite member</div>
          <Btn kind="ghost" size="sm" icon={IcoX} onClick={onClose} />
        </div>
        <div className="modal__body">
          {error && <div className="error-banner">{error}</div>}
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Full name</label>
            <input required className="input" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Email</label>
            <input required type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">Password</label>
            <input required type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="field">
            <label className="field__label">Role</label>
            <select className="select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="modal__foot">
          <Btn kind="secondary" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon={IcoCheck} onClick={submit} disabled={loading}>
            {loading ? 'Inviting…' : 'Invite'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function ModulesModal({ user, onClose, onSaved }) {
  const [modules, setModules] = useState(user.modules || ALL_MODULES);
  const [loading, setLoading] = useState(false);

  function toggle(key) {
    setModules(ms => ms.includes(key) ? ms.filter(m => m !== key) : [...ms, key]);
  }

  async function save() {
    setLoading(true);
    try {
      await api.updateUser(user._id, { modules });
      onSaved();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Module access — {user.fullName}</div>
          <button className="btn btn--ghost btn--icon btn--sm" onClick={onClose}>
            <IcoX size={14} />
          </button>
        </div>
        <div className="modal__body">
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 16 }}>
            Select which modules this user can access.
          </div>
          {ALL_MODULES.map(key => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 6, border: '1px solid', borderColor: modules.includes(key) ? 'var(--accent)' : 'var(--border)', background: modules.includes(key) ? 'var(--accent-soft)' : 'transparent' }}>
              <input type="checkbox" checked={modules.includes(key)} onChange={() => toggle(key)} style={{ accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--fg)' }}>{MODULE_LABELS[key]}</span>
            </label>
          ))}
        </div>
        <div className="modal__foot">
          <Btn kind="secondary" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon={IcoCheck} onClick={save} disabled={loading || modules.length === 0}>
            {loading ? 'Saving…' : 'Save'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function roleKind(role) {
  if (role === 'super_admin' || role === 'org_admin') return 'accent';
  if (role === 'manager') return 'info';
  return 'neutral';
}

function roleLabel(role) {
  return role?.replace(/_/g, ' ') || 'viewer';
}

function initials(name) {
  return (name || '?').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [modulesUser, setModulesUser] = useState(null);

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: api.listUsers });
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me });

  const deleteMut = useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => qc.invalidateQueries(['users']),
  });

  const canManage = ['super_admin', 'org_admin'].includes(me?.role);
  const list = Array.isArray(users) ? users : [];

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Members</h1>
          <div className="page__sub">{list.length} members · per-site permissions</div>
        </div>
        <div className="page__actions">
          {canManage && (
            <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowInvite(true)}>Invite</Btn>
          )}
        </div>
      </div>

      <Card padding={false}>
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Modules</th>
              <th>Status</th>
              <th>Last active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px 14px', color: 'var(--fg-muted)' }}>Loading…</td></tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32 }}>
                  <Empty icon={IcoUsers} title="No members yet" hint="Invite your first team member." action={canManage && <Btn kind="primary" size="sm" icon={IcoPlus} onClick={() => setShowInvite(true)}>Invite</Btn>} />
                </td>
              </tr>
            ) : list.map(u => (
              <tr key={u._id}>
                <td>
                  <div className="row gap-2">
                    <div className="avatar avatar--sm">{initials(u.fullName)}</div>
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {u.fullName}
                        {u._id === me?._id && <span style={{ marginLeft: 6 }}><Badge kind="accent">You</Badge></span>}
                      </div>
                      <div className="text-xs muted mono">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <Badge kind={roleKind(u.role)}>{roleLabel(u.role)}</Badge>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(u.modules || ALL_MODULES).map(m => (
                      <span key={m} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-subtle)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>
                        {MODULE_LABELS[m] || m}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <Badge kind={u.isActive ? 'ok' : 'neutral'} dot={u.isActive ? 'ok' : 'off'}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="muted text-xs">
                  {u.lastLoginAt ? format(new Date(u.lastLoginAt), 'MMM d, HH:mm') : 'Never'}
                </td>
                <td>
                  {canManage && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Btn kind="ghost" size="sm" icon={IcoLayers} title="Edit module access" onClick={() => setModulesUser(u)} />
                      {u._id !== me?._id && (
                        <Btn kind="ghost" size="sm" icon={IcoMore} title="Deactivate" onClick={() => { if (confirm('Deactivate user?')) deleteMut.mutate(u._id); }} />
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSaved={() => qc.invalidateQueries(['users'])}
        />
      )}
      {modulesUser && (
        <ModulesModal
          user={modulesUser}
          onClose={() => setModulesUser(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['users'] }); setModulesUser(null); }}
        />
      )}
    </div>
  );
}
