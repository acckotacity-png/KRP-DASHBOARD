import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { firebaseConfig, allowedEmails } from "./auth-config.js?v=3";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const nativeFetch = window.fetch.bind(window);
let idleTimer = null;
let lastActivitySignal = 0;
let resolveAuthReady;
const authReady = new Promise(resolve => { resolveAuthReady = resolve; });

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

["pointerdown", "keydown", "touchstart", "scroll"].forEach(eventName => {
  window.addEventListener(eventName, () => resetIdleTimer(), { passive: true });
});

window.addEventListener("message", event => {
  if (event.origin === location.origin && event.data?.type === "krp-auth-activity") {
    resetIdleTimer(false);
  }
});

function isAllowed(user) {
  if (!allowedEmails.length) return true;
  return allowedEmails.includes(String(user?.email || "").trim().toLowerCase());
}

function isAppsScriptRequest(input) {
  try {
    const raw = typeof input === "string" ? input : input?.url;
    const url = new URL(raw, location.href);
    return url.hostname === "script.google.com" && url.pathname.includes("/macros/s/");
  } catch (_) {
    return false;
  }
}

async function authenticatedFetch(input, init = {}) {
  if (!isAppsScriptRequest(input)) return nativeFetch(input, init);
  const user = await authReady;
  if (!user) throw new Error("Login required");
  const token = await user.getIdToken();
  const raw = typeof input === "string" ? input : input.url;
  const url = new URL(raw, location.href);
  const options = { ...init };
  const method = String(options.method || "GET").toUpperCase();

  if (method === "GET" || method === "HEAD") {
    url.searchParams.set("authToken", token);
  } else if (options.body instanceof URLSearchParams) {
    const body = new URLSearchParams(options.body);
    body.set("authToken", token);
    options.body = body;
  } else if (options.body instanceof FormData) {
    options.body.set("authToken", token);
  } else {
    url.searchParams.set("authToken", token);
  }
  return nativeFetch(url.toString(), options);
}

window.fetch = authenticatedFetch;
window.getKrpIdToken = async () => {
  const user = await authReady;
  if (!user) throw new Error("Login required");
  return user.getIdToken();
};

onAuthStateChanged(auth, async user => {
  if (user && isAllowed(user)) {
    window.currentKrpUser = user;
    resolveAuthReady(user);
    document.getElementById("auth-guard-style")?.remove();
    resetIdleTimer(false);
    return;
  }
  resolveAuthReady(null);
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
