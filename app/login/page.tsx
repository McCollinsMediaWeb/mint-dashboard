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
        /* Premium Scoped Styling for Login Page */
        .login-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: #0f172a; /* Rich Slate 900 background */
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-family: 'Outfit', sans-serif;
          z-index: 99999;
        }

        /* Ambient Glowing Backdrops */
        .glow-circle {
          position: absolute;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.15;
          z-index: 1;
        }
        .gc-1 {
          background: #d97706; /* Amber/Orange */
          top: 10%;
          left: 15%;
          animation: floatGlow 15s infinite alternate ease-in-out;
        }
        .gc-2 {
          background: #f59e0b; /* Bright Yellow-Amber */
          bottom: 10%;
          right: 15%;
          animation: floatGlow 18s infinite alternate-reverse ease-in-out;
        }

        @keyframes floatGlow {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(40px, 40px) scale(1.1); }
        }

        /* Glassmorphic Login Card */
        .login-card {
          width: 100%;
          max-width: 440px;
          padding: 40px;
          background: rgba(30, 41, 59, 0.7); /* Dark semi-transparent Slate */
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          text-align: center;
          z-index: 10;
          color: #f8fafc;
          animation: slideUp 0.5s ease-out;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Brand Logo styling matching TopNav */
        .brand-logo {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(217, 119, 6, 0.15); /* Tint of amber */
          color: #f59e0b;
          border: 1px solid rgba(217, 119, 6, 0.3);
          border-radius: 12px;
          padding: 8px 16px;
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.05em;
          margin-bottom: 24px;
        }

        .brand-logo i {
          font-size: 16px;
        }

        .login-card h2 {
          font-family: 'Syne', sans-serif;
          font-size: 26px;
          font-weight: 700;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }

        .subtitle {
          color: #94a3b8;
          font-size: 14px;
          margin-bottom: 30px;
          line-height: 1.5;
        }

        /* Error Alert Banner */
        .error-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 10px;
          padding: 12px 16px;
          color: #f87171;
          font-size: 13px;
          text-align: left;
          margin-bottom: 24px;
        }

        .error-alert i {
          font-size: 16px;
          flex-shrink: 0;
        }

        /* Form Inputs style */
        .input-group {
          margin-bottom: 20px;
          text-align: left;
        }

        .input-group label {
          display: block;
          font-size: 13px;
          color: #94a3b8;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-wrapper i {
          position: absolute;
          left: 14px;
          color: #64748b;
          font-size: 16px;
          pointer-events: none;
          transition: color 0.3s;
        }

        .input-wrapper input {
          width: 100%;
          padding: 12px 16px 12px 42px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #f8fafc;
          font-size: 14px;
          outline: none;
          transition: border-color 0.3s, box-shadow 0.3s, background 0.3s;
        }

        .input-wrapper input:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
          background: rgba(15, 23, 42, 0.8);
        }

        .input-wrapper input:focus + i {
          color: #f59e0b;
        }

        /* Premium Accent Login Button */
        .login-btn {
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border: none;
          border-radius: 12px;
          color: #0f172a;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 28px;
          transition: transform 0.2s, box-shadow 0.3s, background 0.3s;
          box-shadow: 0 4px 12px rgba(217, 119, 6, 0.25);
        }

        .login-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(217, 119, 6, 0.35);
        }

        .login-btn:active {
          transform: translateY(1px);
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2.5px solid rgba(15, 23, 42, 0.2);
          border-top: 2.5px solid #0f172a;
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
          margin-top: 32px;
          font-size: 11px;
          color: #64748b;
        }

        .footer-notes i {
          font-size: 13px;
        }
      `}} />
    </div>
  );
}
