"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { InviteRequestForm } from "../InviteRequestForm";
import { SIGNUP_PATHS, type SignupPath } from "./homeV8Content";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email-first closing form. It submits nothing itself:
 * Individual / Creator -> the existing /signup page; Business / Team -> the existing pilot request form.
 */
export function FinalSignup() {
  const router = useRouter();
  const [path, setPath] = useState<SignupPath>("individual");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pilotEmail, setPilotEmail] = useState<string | null>(null);

  function choose(next: SignupPath) {
    setPath(next);
    setPilotEmail(null);
    setError("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL.test(value)) {
      setError("Enter a valid email address to continue.");
      document.getElementById("v8-signup-email")?.focus();
      return;
    }
    setError("");
    if (path === "team") {
      setPilotEmail(value);
      return;
    }
    router.push(`/signup?email=${encodeURIComponent(value)}`);
  }

  const current = SIGNUP_PATHS[path];

  return (
    <section className="closing" id="start">
      <div className="final-signup">
        <div className="final-pitch">
          <div className="eyebrow">CRAFTMYFUNNEL / GET STARTED</div>
          <h2>The next enquiry<br /><span className="highlight">is your move.</span></h2>
          <p>Social, landing pages, outreach, follow-up and calls&mdash;one clear path from first signal to next action.</p>
          <div className="phase">CAPTURE · CONNECT · CONVERT</div>
        </div>
        <form className="signup-form" onSubmit={submit} noValidate>
          <div className="form-topline"><span className="form-dot" />YOUR NEXT MOVE STARTS HERE</div>
          <h3>One good lead deserves a next move.</h3>
          <p>Choose your path. Then get started.</p>
          <div className="signup-choice" role="group" aria-label="Account type">
            {(Object.keys(SIGNUP_PATHS) as SignupPath[]).map((key) => (
              <button key={key} type="button" className={`choice-btn${path === key ? " selected" : ""}`} aria-pressed={path === key} onClick={() => choose(key)}>
                {SIGNUP_PATHS[key].label}
              </button>
            ))}
          </div>
          <p className="scope-note">{current.hint}</p>
          <label htmlFor="v8-signup-email">Email address <span aria-hidden="true">*</span></label>
          <input
            id="v8-signup-email"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            aria-invalid={error ? true : undefined}
            aria-describedby="v8-signup-status"
          />
          <button className="primary signup-submit" type="submit">{current.cta}</button>
          <p id="v8-signup-status" className={`form-message${error ? " invalid" : ""}`} role="status" aria-live="polite">
            {error || (path === "team" ? "Teams join through a short pilot request, reviewed by hand." : "You will create your account on the next screen.")}
          </p>
        </form>
      </div>
      {pilotEmail && (
        <div className="pilot-request">
          <h3>Tell us about your team</h3>
          <p>A few details so we can review your pilot request. We reply by email.</p>
          <InviteRequestForm showOutcomePreview={false} initialEmail={pilotEmail} />
        </div>
      )}
    </section>
  );
}
