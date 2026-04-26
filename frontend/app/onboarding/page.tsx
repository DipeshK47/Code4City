"use client";

import { useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import { useAuth } from "@/context/AuthContext";

const MISSION =
  "Volun-Tiers helps neighbors discover local support by turning volunteer energy into coordinated outreach missions. We map priority zones, share practical resource cards, and track every route so the work stays visible, repeatable, and useful.";

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
    background: "#F8F6F0",
    border: "1px solid rgba(11, 11, 10,0.16)",
    borderRadius: 2,
    boxShadow: "none",
    padding: "32px 40px",
    maxWidth: 440,
    margin: "0 auto 24px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 0,
    border: "1px solid rgba(11, 11, 10,0.14)",
    fontSize: 14,
    color: "#0B0B0A",
    marginBottom: 14,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 400,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#1A1917",
    marginBottom: 6,
  };

  const buttonPrimary: React.CSSProperties = {
    width: "100%",
    padding: "12px 20px",
    borderRadius: 0,
    border: "1px solid #D44A12",
    background: "transparent",
    color: "#D44A12",
    fontSize: 12,
    fontWeight: 400,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    cursor: "pointer",
    boxShadow: "none",
  };

  const buttonSecondary: React.CSSProperties = {
    width: "100%",
    padding: "12px 20px",
    borderRadius: 0,
    border: "1.5px solid rgba(11, 11, 10,0.12)",
    background: "transparent",
    color: "#1A1917",
    fontSize: 12,
    fontWeight: 400,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
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
          <p style={{ fontSize: 14, color: "#8A8780" }}>Taking you to your dashboard...</p>
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
            borderRadius: 2,
            overflow: "hidden",
            background: "#F8F6F0",
            border: "1px solid rgba(11, 11, 10, 0.16)",
            boxShadow: "none",
            padding: "40px 48px",
            textAlign: "center",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 0,
              border: "1px solid #D44A12",
              background: "transparent",
              color: "#D44A12",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 500,
              letterSpacing: "0.14em",
              marginBottom: 12,
              lineHeight: 1,
            }}
          >
            VT
          </div>
          <h2
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: 56,
              fontWeight: 400,
              color: "#0B0B0A",
              letterSpacing: "-0.045em",
              lineHeight: 0.9,
              marginBottom: 8,
            }}
          >
            One more step
          </h2>
          <p style={{ fontSize: 22, color: "#1A1917", maxWidth: 520, margin: "0 auto", lineHeight: 1.25 }}>
            Please read our mission and agree to the terms before you start.
          </p>
        </div>

        <div className="anim-fade-up d2" style={cardStyle}>
          <h3
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: 34,
              fontWeight: 400,
              color: "#0B0B0A",
              marginBottom: 16,
            }}
          >
            Our mission
          </h3>
          <p style={{ fontSize: 21, color: "#1A1917", lineHeight: 1.3, marginBottom: 24 }}>{MISSION}</p>
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
              style={{ width: 18, height: 18, marginTop: 2, accentColor: "#D44A12" }}
            />
            <span style={{ fontSize: 13, color: "#8A8780" }}>
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
              fontFamily: "'Instrument Serif', serif",
              fontSize: 56,
              fontWeight: 400,
              color: "#0B0B0A",
              letterSpacing: "-0.045em",
              lineHeight: 0.9,
            }}
          >
            Log in
          </h2>
          <p style={{ fontSize: 14, color: "#8A8780", marginTop: 6 }}>Welcome back to Volun-Tiers.</p>
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
              fontFamily: "'Instrument Serif', serif",
              fontSize: 56,
              fontWeight: 400,
              color: "#0B0B0A",
              letterSpacing: "-0.045em",
              lineHeight: 0.9,
            }}
          >
            Create an account
          </h2>
          <p style={{ fontSize: 14, color: "#8A8780", marginTop: 6 }}>Join the Volun-Tiers volunteer community.</p>
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
    borderRadius: 2,
    border: "1px solid rgba(11, 11, 10, 0.16)",
    textAlign: "left" as const,
    cursor: "pointer",
    minWidth: 200,
    flex: "1 1 200px",
    maxWidth: 280,
    boxShadow: "none",
    transition: "transform 0.25s ease, border-color 0.25s ease",
  };

  return (
    <PageContainer>
      <div
        className="anim-fade-up d1"
        style={{
          position: "relative",
          borderRadius: 2,
          overflow: "hidden",
          background: "#F8F6F0",
          border: "1px solid rgba(11, 11, 10, 0.16)",
          boxShadow: "none",
          padding: "48px 56px",
          textAlign: "center",
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 62,
            height: 62,
            borderRadius: 0,
            border: "1px solid #D44A12",
            background: "transparent",
            color: "#D44A12",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 500,
            letterSpacing: "0.14em",
            marginBottom: 14,
            lineHeight: 1,
          }}
        >
          VT
        </div>
        <h2
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: "clamp(56px, 8vw, 108px)",
            fontWeight: 400,
            color: "#0B0B0A",
            letterSpacing: "-0.045em",
            lineHeight: 0.9,
            marginBottom: 10,
          }}
        >
          Welcome to Volun-Tiers
        </h2>
        <p style={{ fontSize: 24, color: "#1A1917", maxWidth: 620, margin: "0 auto", lineHeight: 1.2 }}>
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
            background: "#F8F6F0",
            color: "#0B0B0A",
            boxShadow: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.borderColor = "rgba(212, 74, 18, 0.55)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.borderColor = "rgba(11, 11, 10, 0.16)";
          }}
        >
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 400, letterSpacing: "0.18em", color: "#D44A12" }}>RETURNING?</span>
          <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.035em", margin: "8px 0 6px" }}>Log in</h3>
          <p style={{ fontSize: 18, color: "#8A8780", lineHeight: 1.3 }}>Use your existing account.</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setError("");
            signInAsGuest();
          }}
          style={{
            ...choiceButtonBase,
            background: "#F8F6F0",
            color: "#0B0B0A",
            boxShadow: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.borderColor = "rgba(212, 74, 18, 0.55)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.borderColor = "rgba(11, 11, 10, 0.16)";
          }}
        >
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 400, letterSpacing: "0.18em", color: "#D44A12" }}>EXPLORE</span>
          <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.035em", margin: "8px 0 6px" }}>Continue as guest</h3>
          <p style={{ fontSize: 18, color: "#8A8780", lineHeight: 1.3 }}>Browse first. Create an account later.</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setStep("signup");
            setError("");
          }}
          style={{
            ...choiceButtonBase,
            background: "#F8F6F0",
            color: "#0B0B0A",
            boxShadow: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.borderColor = "rgba(212, 74, 18, 0.55)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.borderColor = "rgba(11, 11, 10, 0.16)";
          }}
        >
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 400, letterSpacing: "0.18em", color: "#D44A12" }}>NEW HERE?</span>
          <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.035em", margin: "8px 0 6px" }}>Sign up</h3>
          <p style={{ fontSize: 18, color: "#8A8780", lineHeight: 1.3 }}>Join and track your impact.</p>
        </button>
      </div>

      <div className="anim-fade-up d3" style={{ textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#8A8780" }}>
          Looking for more information first? Visit the{" "}
          <Link href="/getstarted" style={{ color: "#D44A12", fontWeight: 700 }}>
            getting started guide
          </Link>
          .
        </p>
      </div>
    </PageContainer>
  );
}
