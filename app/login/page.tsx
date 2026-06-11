"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setError("");
      setLoading(true);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Redirect to dashboard page
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch (err) {
      console.error("Login client error:", err);
      setError("Failed to connect to the authentication server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Dynamic backdrop glow circles */}
      <div className="glow-circle gc-1"></div>
      <div className="glow-circle gc-2"></div>

      <div className="login-card">
        <div className="brand-logo">
          <i className="ti ti-truck-delivery"></i> MINT OPS
        </div>
        
        <h2>Operations Login</h2>
        <p className="subtitle">Enter your credentials to access the scheduling dashboard</p>

        {error && (
          <div className="error-alert">
            <i className="ti ti-alert-circle"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <div className="input-wrapper">
              <i className="ti ti-user"></i>
              <input
                id="username"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <i className="ti ti-lock"></i>
              <input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span> Logging in...
              </>
            ) : (
              <>
                Access Platform <i className="ti ti-arrow-right"></i>
              </>
            )}
          </button>
        </form>

        <div className="footer-notes">
          <i className="ti ti-info-circle"></i> Authorized personnel only. Access logging is active.
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        /* Premium Scoped X.com-Inspired Styling for Login Page */
        .login-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: #000000; /* Pure black backdrop like X.com */
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          z-index: 99999;
        }

        /* Ambient Glowing Backdrops (Subtle deep glow) */
        .glow-circle {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          filter: blur(140px);
          opacity: 0.08;
          z-index: 1;
        }
        .gc-1 {
          background: #1d9bf0; /* X Blue */
          top: 5%;
          left: 10%;
          animation: floatGlow 20s infinite alternate ease-in-out;
        }
        .gc-2 {
          background: #f59e0b; /* Amber */
          bottom: 5%;
          right: 10%;
          animation: floatGlow 25s infinite alternate-reverse ease-in-out;
        }

        @keyframes floatGlow {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(30px, 30px) scale(1.05); }
        }

        /* X-Style Clean Login Card */
        .login-card {
          width: 100%;
          max-width: 420px;
          padding: 40px;
          background: #000000;
          border-radius: 16px;
          text-align: left; /* Left align text to match X */
          z-index: 10;
          color: #e7e9ea;
          animation: fadeIn 0.4s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }

        /* Brand Logo styled to match top branding */
        .brand-logo {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #f59e0b;
          font-weight: 800;
          font-size: 20px;
          letter-spacing: 0.05em;
          margin-bottom: 28px;
        }

        .brand-logo i {
          font-size: 24px;
        }

        /* X Headline: 31px bold */
        .login-card h2 {
          font-size: 31px;
          font-weight: 800;
          margin-bottom: 12px;
          letter-spacing: -0.03em;
          color: #f7f9f9;
          line-height: 36px;
        }

        .subtitle {
          color: #71767b; /* X secondary text color */
          font-size: 15px;
          margin-bottom: 30px;
          line-height: 20px;
        }

        /* Error Alert Banner */
        .error-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(244, 33, 46, 0.1); /* X red color */
          border: 1px solid rgba(244, 33, 46, 0.2);
          border-radius: 12px;
          padding: 12px 16px;
          color: #f4212e;
          font-size: 14px;
          margin-bottom: 24px;
        }

        .error-alert i {
          font-size: 18px;
          flex-shrink: 0;
        }

        /* Form Inputs style */
        .input-group {
          margin-bottom: 24px;
        }

        .input-group label {
          display: block;
          font-size: 13px;
          color: #71767b;
          margin-bottom: 6px;
          font-weight: 500;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-wrapper i {
          position: absolute;
          left: 16px;
          color: #71767b;
          font-size: 18px;
          pointer-events: none;
          transition: color 0.2s;
        }

        /* Input height set to X standard (56px) */
        .input-wrapper input {
          width: 100%;
          height: 56px;
          padding: 12px 16px 12px 48px;
          background: #000000;
          border: 1px solid #2f3336; /* X border color */
          border-radius: 4px; /* X input border-radius */
          color: #e7e9ea;
          font-size: 16px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        /* X Signature blue outline on focus */
        .input-wrapper input:focus {
          border-color: #1d9bf0;
          box-shadow: 0 0 0 1px #1d9bf0;
        }

        .input-wrapper input:focus + i {
          color: #1d9bf0;
        }

        /* Primary Action Button: Pill Shape, bold text, high contrast */
        .login-btn {
          width: 100%;
          height: 40px; /* X standard button height */
          background-color: #eff3f4; /* High-contrast white */
          border: none;
          border-radius: 9999px; /* Pill Shape */
          color: #0f1419; /* High-contrast black text */
          font-size: 15px; /* X button font size */
          font-weight: 700; /* Bold font weight */
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 32px;
          transition: background-color 0.2s, box-shadow 0.2s;
        }

        .login-btn:hover {
          background-color: #d7dbdc; /* Light grey hover */
        }

        .login-btn:active {
          transform: scale(0.99);
        }

        .login-btn:disabled {
          background-color: #787a7a;
          color: #0f1419;
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(15, 20, 25, 0.25);
          border-top: 2px solid #0f1419;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .footer-notes {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 36px;
          font-size: 13px;
          color: #71767b;
          text-align: center;
        }

        .footer-notes i {
          font-size: 15px;
        }
      `}} />
    </div>
  );
}
