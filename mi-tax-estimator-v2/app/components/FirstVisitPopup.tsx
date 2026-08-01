"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "userTypeAnswered";

export function FirstVisitPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 1500); // let the page settle first
      return () => clearTimeout(t);
    }
  }, []);

  async function answer(userType: "realtor" | "lender" | "consumer" | null) {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
    if (userType) {
      await fetch("/api/visitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userType }),
      }).catch(() => {});
    }
  }

  if (!visible) return null;

  return (
    <div className="popup-overlay no-print">
      <div className="popup-card">
        <p className="popup-title">Quick question — which best describes you?</p>
        <p className="popup-sub">Helps us tailor what we show you. Totally optional.</p>
        <div className="popup-options">
          <button onClick={() => answer("realtor")}>I'm a Realtor</button>
          <button onClick={() => answer("lender")}>I'm a Lender</button>
          <button onClick={() => answer("consumer")}>I'm a Homebuyer</button>
        </div>
        <button className="btn-link" onClick={() => answer(null)}>Skip</button>
      </div>
    </div>
  );
}
