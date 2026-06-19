import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { checkHealth } from '../api/products';

export function Navbar() {
  const [healthStatus, setHealthStatus] = useState('checking'); // 'online' | 'offline' | 'checking'

  const verifyHealth = async () => {
    try {
      await checkHealth();
      setHealthStatus('online');
    } catch {
      setHealthStatus('offline');
    }
  };

  useEffect(() => {
    verifyHealth();
    const interval = setInterval(verifyHealth, 30000); // verify every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand">
          <div className="brand-icon">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <span>PriceTracker</span>
        </NavLink>

        <nav className="navbar-links" aria-label="Main Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Search & Track
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Tracked Dashboard
          </NavLink>

          <div
            className="nav-health-status"
            title={`Backend status: ${healthStatus} (click to recheck)`}
            onClick={verifyHealth}
            style={{ cursor: 'pointer' }}
          >
            <span className={`health-dot ${healthStatus}`} />
            <span>API {healthStatus}</span>
          </div>
        </nav>
      </div>
    </header>
  );
}
