import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ email: '', password: '', fullName: '', orgName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.register(form);
      // After register, auto-login
      const loginData = await api.login({ email: form.email, password: form.password });
      setAuth(loginData.user, loginData.token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const field = (name, type, placeholder, label) => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type} required className="input"
        value={form[name]}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-primary-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🌍</div>
          <h1 className="text-3xl font-bold text-white">Taarifa.live</h1>
          <p className="text-gray-400 mt-1">Create your organization</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t('auth.register')}</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {field('orgName',  'text',     'My Organization', t('auth.orgName'))}
            {field('fullName', 'text',     'Jane Doe',        t('auth.fullName'))}
            {field('email',    'email',    'you@example.com', t('auth.email'))}
            {field('password', 'password', '••••••••',        t('auth.password'))}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? t('common.loading') : t('auth.register')}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
