import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Wifi,
  WifiOff,
  User,
  KeyRound,
  ArrowRight,
  LifeBuoy,
  CheckCircle2,
  AlertTriangle,
  Users
} from 'lucide-react';
import api from '../services/api';
import {
  saveOfflineUserProfile,
  verifyOfflineLogin,
  getOfflineUsersList,
  createEmergencyOfflineUser
} from '../services/db';

const Login = ({ onLogin, onSwitchToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [cachedUsers, setCachedUsers] = useState([]);
  const [showEmergencyGuestForm, setShowEmergencyGuestForm] = useState(false);
  const [emergencyName, setEmergencyName] = useState('');

  // Detect offline status and load known offline users from IndexedDB
  useEffect(() => {
    const handleStatus = () => {
      setIsOfflineMode(!navigator.onLine);
    };
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);

    getOfflineUsersList().then((users) => {
      setCachedUsers(users || []);
      if (users && users.length > 0 && !email) {
        setEmail(users[0].email || '');
      }
    });

    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const handleOnlineLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password }, { timeout: 7000 });
      localStorage.setItem('token', res.data.token);

      // Cache user profile and hashed credential for future offline access
      await saveOfflineUserProfile(res.data.user, res.data.token, password);

      onLogin(res.data.user);
    } catch (err) {
      console.warn('Online login failed:', err.message);
      if (!navigator.onLine || err.code === 'ERR_NETWORK') {
        // Automatically suggest offline login if network dropped
        setIsOfflineMode(true);
        setError('Connection failed. You can attempt offline login using cached credentials below.');
      } else {
        setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await verifyOfflineLogin(email, password);
      if (result.success && result.user) {
        onLogin(result.user);
      } else {
        setError(result.error || 'Offline verification failed.');
      }
    } catch (err) {
      setError('An error occurred during offline credential validation.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyGuestLogin = async (e) => {
    e.preventDefault();
    if (!emergencyName.trim()) {
      setError('Please provide a responder name or callsign');
      return;
    }
    setLoading(true);
    try {
      const emergencyUser = await createEmergencyOfflineUser(emergencyName);
      onLogin(emergencyUser);
    } catch (err) {
      setError('Failed to initialize emergency offline session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form-card">
        {/* Brand Header */}
        <div className="auth-brand-header">
          <div className="auth-shield-badge">
            <ShieldAlert size={28} color="#FFFFFF" />
          </div>
          <h2>Crisis Ground Truth</h2>
          <p className="auth-subtitle">Emergency Information & Misinformation Detector</p>

          {/* Mode Switcher Pill */}
          <div className="auth-mode-pill-row">
            <button
              type="button"
              className={`mode-toggle-btn ${!isOfflineMode ? 'active' : ''}`}
              onClick={() => {
                setIsOfflineMode(false);
                setError('');
              }}
            >
              <Wifi size={13} />
              <span>Online Login</span>
            </button>
            <button
              type="button"
              className={`mode-toggle-btn ${isOfflineMode ? 'active' : ''}`}
              onClick={() => {
                setIsOfflineMode(true);
                setError('');
              }}
            >
              <WifiOff size={13} />
              <span>Offline Mode</span>
            </button>
          </div>
        </div>

        {/* Offline Banner Notice */}
        {isOfflineMode && (
          <div className="offline-auth-notice">
            <div className="notice-icon">
              <WifiOff size={16} color="#DC2626" />
            </div>
            <div className="notice-text">
              <strong>Offline Authentication Active</strong>
              <p>Verify with device-cached credentials or enter as an Emergency Responder without internet.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="error-banner">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Cached Profiles Quick-Select */}
        {isOfflineMode && cachedUsers.length > 0 && !showEmergencyGuestForm && (
          <div className="cached-users-picker">
            <label className="picker-label">
              <Users size={12} />
              <span>Cached Accounts on this Device:</span>
            </label>
            <div className="cached-users-list">
              {cachedUsers.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  className={`cached-user-chip ${email === u.email ? 'selected' : ''}`}
                  onClick={() => setEmail(u.email)}
                >
                  <User size={12} />
                  <span>{u.name} ({u.email})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Emergency Guest Form */}
        {showEmergencyGuestForm ? (
          <form onSubmit={handleEmergencyGuestLogin} className="auth-form-body">
            <div className="form-group">
              <label className="form-label">Responder Name or Callsign</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Volunteer John, Officer Smith"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-auth-submit"
            >
              <LifeBuoy size={16} />
              <span>{loading ? 'Initializing...' : 'Enter as Emergency Responder'}</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-cancel-guest"
              onClick={() => setShowEmergencyGuestForm(false)}
            >
              Back to Standard Login
            </button>
          </form>
        ) : (
          /* Standard Online / Offline Login Form */
          <form onSubmit={isOfflineMode ? handleOfflineLogin : handleOnlineLogin} className="auth-form-body">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-icon-wrapper">
                <User size={16} className="field-icon" />
                <input
                  type="email"
                  className="form-input with-icon"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-icon-wrapper">
                <KeyRound size={16} className="field-icon" />
                <input
                  type="password"
                  className="form-input with-icon"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-auth-submit"
            >
              <span>{loading ? 'Authenticating...' : isOfflineMode ? 'Verify & Login Offline' : 'Login Online'}</span>
              <ArrowRight size={16} />
            </button>

            {/* Offline Guest Option Button */}
            <div className="offline-quick-actions">
              <button
                type="button"
                className="btn-link-emergency"
                onClick={() => {
                  setShowEmergencyGuestForm(true);
                  setError('');
                }}
              >
                <LifeBuoy size={14} color="#DC2626" />
                <span>No password? Enter as Emergency Offline Responder</span>
              </button>
            </div>

            <p className="auth-footer-text">
              Don't have an account?{' '}
              <span
                onClick={onSwitchToSignup}
                className="auth-link-highlight"
              >
                Sign up
              </span>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
