import { useState } from 'react';
import { authenticate, saveSession } from '../auth';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      const user = authenticate(email.trim(), password);
      if (user) {
        const session = saveSession(user);
        onLogin(session);
      } else {
        setError('Invalid email or password.');
        setIsLoading(false);
      }
    }, 400);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">⚖️</div>
          <h1 className="login-title">AI Document Automation</h1>
          <p className="login-subtitle">Sign in to access the demo workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@lawfirm.com"
              required
              autoFocus
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="primary login-submit"
            disabled={isLoading || !email || !password}
          >
            {isLoading ? (
              <span className="processing-label">Signing in…</span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-hint">
          <strong>Demo accounts:</strong>
          <br />
          demo@lawfirm.com / demo2024
          <br />
          admin@lawfirm.com / admin2024
        </div>
      </div>
    </div>
  );
}
