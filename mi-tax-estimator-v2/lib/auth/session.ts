// Owner-only authentication — deliberately minimal, no new npm
// dependencies (uses Node's built-in `crypto`), since new packages
// have already broken the build once this project. This is NOT a
// multi-user system — per Stacia's own decision, only she needs
// access, so this is a single shared password (OWNER_PASSWORD env
// var) rather than a full user-accounts system, which would be a lot
// of unneeded complexity for one person.
//
// How it works: a signed, HTTP-only session cookie. The signature
// (HMAC-SHA256, keyed by SESSION_SECRET) proves the cookie was issued
// by this server and hasn't been tampered with — a visitor can't just
// invent their own "logged in" cookie. Nothing sensitive is stored IN
// the cookie itself, just an expiry timestamp and the signature.

import crypto from "crypto";

const COOKIE_NAME = "owner_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set. Generate one (any long random string) and set it in your environment — see .env.example.");
  }
  return secret;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function createSessionCookieValue(): string {
  const expires = Date.now() + SESSION_DURATION_MS;
  const payload = `${expires}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySessionCookieValue(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return false;
  if (sign(payload) !== signature) return false; // tampered or forged
  const expires = Number(payload);
  if (Number.isNaN(expires) || Date.now() > expires) return false; // expired
  return true;
}

export function verifyPassword(candidate: string): boolean {
  const real = process.env.OWNER_PASSWORD;
  if (!real) {
    throw new Error("OWNER_PASSWORD is not set. Set it in your environment before the admin login can work.");
  }
  // Constant-time comparison — avoids leaking password length/content
  // through response-timing differences.
  const a = Buffer.from(candidate);
  const b = Buffer.from(real);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
