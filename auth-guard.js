import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { firebaseConfig, allowedEmails } from "./auth-config.js?v=3";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

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
    return;
  }

  if (user) await signOut(auth);
  const page = location.pathname.split("/").pop() || "index.html";
  const next = page === "transaction.html" ? "index.html" : page;
  location.replace(`login.html?next=${encodeURIComponent(next)}`);
});

window.logoutKrpDashboard = async function logoutKrpDashboard() {
  await signOut(auth);
  location.replace("login.html");
};
