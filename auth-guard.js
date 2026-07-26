import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { firebaseConfig, allowedEmails } from "./auth-config.js?v=3";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
let idleTimer = null;
let lastActivitySignal = 0;

async function logoutForInactivity() {
  await signOut(auth);
  location.replace("login.html?reason=idle");
}

function resetIdleTimer(notifyParent = true) {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(logoutForInactivity, IDLE_TIMEOUT_MS);

  if (notifyParent && window.parent !== window) {
    const now = Date.now();
    if (now - lastActivitySignal > 1000) {
      lastActivitySignal = now;
      window.parent.postMessage({ type: "krp-auth-activity" }, location.origin);
    }
  }
}

["pointerdown", "keydown", "touchstart", "scroll"].forEach((eventName) => {
  window.addEventListener(eventName, () => resetIdleTimer(), { passive: true });
});

window.addEventListener("message", (event) => {
  if (event.origin === location.origin && event.data?.type === "krp-auth-activity") {
    resetIdleTimer(false);
  }
});

function isAllowed(user) {
  if (!allowedEmails.length) return true;
  return allowedEmails.includes(String(user?.email || "").trim().toLowerCase());
}

function showProtectedPage() {
  document.getElementById("auth-guard-style")?.remove();
}

onAuthStateChanged(auth, async (user) => {
  if (user && isAllowed(user)) {
    showProtectedPage();
    window.currentKrpUser = user;
    resetIdleTimer(false);
    return;
  }

  if (user) await signOut(auth);
  const page = location.pathname.split("/").pop() || "index.html";
  const next = page === "transaction.html" ? "index.html" : page;
  location.replace(`login.html?next=${encodeURIComponent(next)}`);
});

window.logoutKrpDashboard = async function logoutKrpDashboard() {
  clearTimeout(idleTimer);
  await signOut(auth);
  location.replace("login.html");
};
