"use client";

import { useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import { useAuth } from "@/context/AuthContext";

const MISSION =
  "Our mission is to connect neighbors with free food resources in their community. By distributing flyers and sharing information about pantries, community fridges, and food programs, we help reduce food insecurity one door at a time. We believe everyone deserves access to nutritious food and that volunteers like you are essential to making that happen.";

type Step = "choice" | "login" | "signup" | "mission";

export default function OnboardingPage() {
  const { user, login, signup, signInAsGuest, agreeToTerms } = useAuth();
  const [step, setStep] = useState<Step>("choice");
  const [error, setError] = useState("");
  const [agree, setAgree] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signFullName, setSignFullName] = useState("");
  const [signUsername, setSignUsername] = useState("");
  const [signEmail, setSignEmail] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [signConfirm, setSignConfirm] = useState("");

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid rgba(190,155,70,0.18)",
    borderRadius: 18,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    padding: "32px 40px",
    maxWidth: 440,
    margin: "0 auto 24px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid rgba(190,155,70,0.25)",
    fontSize: 14,
    color: "#1a1600",
    marginBottom: 14,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#5a4a20",
    marginBottom: 6,
  };

  const buttonPrimary: React.CSSProperties = {
    width: "100%",
    padding: "12px 20px",
    borderRadius: 11,
    border: "none",
    background: "linear-gradient(135deg, #f5c842 0%, #e8a200 100%)",
    color: "#1a1000",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 3px 12px rgba(245,200,66,0.35)",
  };

  const buttonSecondary: React.CSSProperties = {
    width: "100%",
    padding: "12px 20px",
    borderRadius: 11,
    border: "1.5px solid rgba(190,155,70,0.35)",
    background: "transparent",
    color: "#5a4a20",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  };

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    try {
      await login(loginEmail, loginPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (signPassword !== signConfirm) {
      setError("Passwords do not match.");
      return;
    }

    if (signPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      await signup(signFullName, signUsername, signEmail, signPassword);
      setStep("mission");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    }
  }

  async function handleContinue() {
    if (!agree) {
      setError("Please agree to the terms to continue.");
      return;
    }

    setError("");

    try {
      await agreeToTerms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function resetToChoice() {
    setStep("choice");
    setError("");
  }

  if (user && (user.agreed_to_terms || user.isGuest)) {
    return (
      <PageContainer>
        <div style={{ textAlign: "center", padding: 48 }}>
          <p style={{ fontSize: 14, color: "#9a8a60" }}>Taking you to your dashboard...</p>
        </div>
      </PageContainer>
    );
  }

  if (user && step === "mission") {
    return (
      <PageContainer>
        <div
          className="anim-fade-up d1"
          style={{
            position: "relative",
            borderRadius: 20,
            overflow: "hidden",
            background: "linear-gradient(130deg, #f5c842 0%, #fbbf24 60%, #f59e0b 100%)",
            boxShadow: "0 8px 32px rgba(245,200,66,0.35)",
            padding: "40px 48px",
            textAlign: "center",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              fontSize: 48,
              marginBottom: 12,
              lineHeight: 1,
              filter: "drop-shadow(0 0 16px rgba(255,255,255,0.6)) drop-shadow(0 0 32px rgba(245,200,66,0.45))",
            }}
          >
            🍋
          </div>
          <h2
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 28,
              fontWeight: 700,
              color: "#1a1000",
              marginBottom: 8,
            }}
          >
            One more step
          </h2>
          <p style={{ fontSize: 14, color: "rgba(60,40,0,0.7)", maxWidth: 420, margin: "0 auto" }}>
            Please read our mission and agree to the terms to start volunteering.
          </p>
        </div>

        <div className="anim-fade-up d2" style={cardStyle}>
          <h3
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 18,
              fontWeight: 700,
              color: "#1a1600",
              marginBottom: 16,
            }}
          >
            Our mission
          </h3>
          <p style={{ fontSize: 14, color: "#5a4a20", lineHeight: 1.7, marginBottom: 24 }}>{MISSION}</p>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
              marginBottom: 20,
            }}
          >
            <input
              type="checkbox"
              checked={agree}
              onChange={(event) => setAgree(event.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2, accentColor: "#f5c842" }}
            />
            <span style={{ fontSize: 13, color: "#5a4a20" }}>
              I agree to the terms of service and community guidelines.
            </span>
          </label>
          {error ? <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</p> : null}
          <button type="button" style={buttonPrimary} onClick={handleContinue}>
            Continue to dashboard
          </button>
        </div>
      </PageContainer>
    );
  }

  if (step === "login") {
    return (
      <PageContainer>
        <div className="anim-fade-up d1" style={{ textAlign: "center", marginBottom: 24 }}>
          <h2
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 26,
              fontWeight: 700,
              color: "#1a1000",
            }}
          >
            Log in
          </h2>
          <p style={{ fontSize: 14, color: "#9a8a60", marginTop: 6 }}>Welcome back to Lemontree.</p>
        </div>
        <div className="anim-fade-up d2" style={cardStyle}>
          <form onSubmit={handleLogin}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              style={inputStyle}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              style={inputStyle}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
            {error ? <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</p> : null}
            <button type="submit" style={buttonPrimary}>
              Log in
            </button>
            <button type="button" style={buttonSecondary} onClick={resetToChoice}>
              Back
            </button>
          </form>
        </div>
      </PageContainer>
    );
  }

  if (step === "signup") {
    return (
      <PageContainer>
        <div className="anim-fade-up d1" style={{ textAlign: "center", marginBottom: 24 }}>
          <h2
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 26,
              fontWeight: 700,
              color: "#1a1000",
            }}
          >
            Create an account
          </h2>
          <p style={{ fontSize: 14, color: "#9a8a60", marginTop: 6 }}>Join the Lemontree volunteer community.</p>
        </div>
        <div className="anim-fade-up d2" style={cardStyle}>
          <form onSubmit={handleSignup}>
            <label style={labelStyle}>Full name</label>
            <input
              type="text"
              value={signFullName}
              onChange={(event) => setSignFullName(event.target.value)}
              style={inputStyle}
              placeholder="Jane Doe"
              autoComplete="name"
            />
            <label style={labelStyle}>Username</label>
            <input
              type="text"
              value={signUsername}
              onChange={(event) => setSignUsername(event.target.value)}
              style={inputStyle}
              placeholder="johndoe"
              required
              autoComplete="username"
            />
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={signEmail}
              onChange={(event) => setSignEmail(event.target.value)}
              style={inputStyle}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={signPassword}
              onChange={(event) => setSignPassword(event.target.value)}
              style={inputStyle}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <label style={labelStyle}>Confirm password</label>
            <input
              type="password"
              value={signConfirm}
              onChange={(event) => setSignConfirm(event.target.value)}
              style={inputStyle}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
            />
            {error ? <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</p> : null}
            <button type="submit" style={buttonPrimary}>
              Sign up
            </button>
            <button type="button" style={buttonSecondary} onClick={resetToChoice}>
              Back
            </button>
          </form>
        </div>
      </PageContainer>
    );
  }

  const choiceButtonBase = {
    padding: "20px 24px",
    borderRadius: 16,
    border: "none",
    textAlign: "left" as const,
    cursor: "pointer",
    minWidth: 200,
    flex: "1 1 200px",
    maxWidth: 280,
    boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 0 32px rgba(255,255,255,0.15)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  };

  return (
    <PageContainer>
      <div
        className="anim-fade-up d1"
        style={{
          position: "relative",
          borderRadius: 20,
          overflow: "hidden",
          background: "linear-gradient(130deg, #f5c842 0%, #fbbf24 60%, #f59e0b 100%)",
          boxShadow: "0 8px 32px rgba(245,200,66,0.35)",
          padding: "48px 56px",
          textAlign: "center",
          marginBottom: 28,
        }}
      >
        <div
          style={{
            fontSize: 52,
            marginBottom: 14,
            lineHeight: 1,
            filter: "drop-shadow(0 0 20px rgba(255,255,255,0.7)) drop-shadow(0 0 40px rgba(245,200,66,0.5))",
          }}
        >
          🍋
        </div>
        <h2
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: 34,
            fontWeight: 700,
            color: "#1a1000",
            letterSpacing: "-0.8px",
            marginBottom: 10,
          }}
        >
          Welcome to the Hub
        </h2>
        <p style={{ fontSize: 14.5, color: "rgba(60,40,0,0.65)", maxWidth: 520, margin: "0 auto" }}>
          Choose how you want to start. Log in, create an account, or explore as a guest.
        </p>
      </div>

      <div
        className="anim-fade-up d2"
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "stretch",
          gap: 18,
          marginBottom: 24,
          padding: "0 16px",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setStep("login");
            setError("");
          }}
          style={{
            ...choiceButtonBase,
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            color: "#fff",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 0 28px rgba(59,130,246,0.35)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 28px rgba(59,130,246,0.5), 0 0 40px rgba(59,130,246,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.12), 0 0 28px rgba(59,130,246,0.35)";
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(255,255,255,0.9)" }}>RETURNING?</span>
          <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, color: "#fff", margin: "6px 0 4px" }}>Log in</h3>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>Use your existing account.</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setError("");
            signInAsGuest();
          }}
          style={{
            ...choiceButtonBase,
            background: "linear-gradient(135deg, #f5c842 0%, #e8a200 100%)",
            color: "#1a1000",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 0 28px rgba(245,200,66,0.4)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 28px rgba(245,200,66,0.55), 0 0 44px rgba(245,200,66,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.12), 0 0 28px rgba(245,200,66,0.4)";
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(26,16,0,0.7)" }}>EXPLORE</span>
          <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, color: "#1a1000", margin: "6px 0 4px" }}>Continue as guest</h3>
          <p style={{ fontSize: 13, color: "rgba(26,16,0,0.75)", lineHeight: 1.4 }}>Browse first. Create an account later.</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setStep("signup");
            setError("");
          }}
          style={{
            ...choiceButtonBase,
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            color: "#fff",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 0 28px rgba(16,185,129,0.35)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 28px rgba(16,185,129,0.5), 0 0 40px rgba(16,185,129,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.12), 0 0 28px rgba(16,185,129,0.35)";
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(255,255,255,0.9)" }}>NEW HERE?</span>
          <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, color: "#fff", margin: "6px 0 4px" }}>Sign up</h3>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>Join and track your impact.</p>
        </button>
      </div>

      <div className="anim-fade-up d3" style={{ textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#9a8a60" }}>
          Looking for more information first? Visit the{" "}
          <Link href="/getstarted" style={{ color: "#d97706", fontWeight: 600 }}>
            getting started guide
          </Link>
          .
        </p>
      </div>
    </PageContainer>
  );
}