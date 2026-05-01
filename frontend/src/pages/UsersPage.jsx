import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { format } from 'date-fns';
import { Btn, Badge, Card, Empty } from '../components/ui/index.jsx';
import { IcoPlus, IcoMore, IcoX, IcoCheck, IcoUsers } from '../components/ui/Icons.jsx';

const ROLES = ['viewer', 'manager', 'org_admin'];

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
              <th>Status</th>
              <th>Last active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px 14px', color: 'var(--fg-muted)' }}>Loading…</td></tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 32 }}>
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
                  <Badge kind={u.isActive ? 'ok' : 'neutral'} dot={u.isActive ? 'ok' : 'off'}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="muted text-xs">
                  {u.lastLoginAt ? format(new Date(u.lastLoginAt), 'MMM d, HH:mm') : 'Never'}
                </td>
                <td>
                  {canManage && u._id !== me?._id && (
                    <Btn kind="ghost" size="sm" icon={IcoMore} onClick={() => { if (confirm('Deactivate user?')) deleteMut.mutate(u._id); }} />
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
    </div>
  );
}
