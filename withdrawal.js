import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";
import { getDatabase, ref, child, set, get } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js";
import { fetchAndDecryptConfig } from "./config.js";

let auth, db;

// ===== Firebase Init =====
(async () => {
  const firebaseConfig = await fetchAndDecryptConfig();
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);

  // Auth check & load withdrawals
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    const encodedEmail = encodeEmail(user.email);

    // Load totals
    try {
      const summarySnap = await get(ref(db, `child_panel/${encodedEmail}/dashboard/summary`));
      if (summarySnap.exists()) {
        const data = summarySnap.val();
        document.getElementById("totalAvailable").innerText = data.totalAvailable || 0;
        document.getElementById("totalWithdrawn").innerText = data.totalWithdrawal || 0;
      }
    } catch (err) {
      console.error("❌ Error fetching summary:", err);
    }

    loadWithdrawals(encodedEmail);
  });
})();

// ===== Helpers =====
const encodeEmail = (email) => email.replace(/\./g, "_");

// Safe key generator for new withdrawals
function getNextKey(existingObj) {
  if (!existingObj) return "req1";
  const nums = Object.keys(existingObj)
    .map((k) => parseInt(k.replace("req", ""), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `req${next}`;
}

// ===== Load withdrawals =====
async function loadWithdrawals(encodedEmail) {
  try {
    const snap = await get(ref(db, `child_panel/${encodedEmail}/withdrawals`));
    const container = document.getElementById("withdrawalList");
    container.innerHTML = "";
    if (!snap.exists()) return;

    const data = snap.val();
    ["pending", "cancelled", "history"].forEach((type) => {
      if (data[type]) {
        const section = document.createElement("div");
        section.classList.add("withdrawal-section");

        const h4 = document.createElement("h4");
        h4.textContent = type.charAt(0).toUpperCase() + type.slice(1) + " Withdrawals";
        section.appendChild(h4);

        Object.values(data[type]).forEach((w) => {
          const card = document.createElement("div");
          card.className = "withdrawal-card";

          let info = `${w.method || "Unknown"} • ${w.amount} • ${w.date}`;
          if (w.method === "Bank Transfer") {
            info += ` • ${w.accountHolder}, ${w.bankName}, ${w.IFSC}`;
          } else if (w.method === "Binance Wallet") {
            info += ` • ${w.walletAddress || "No Address"}`;
          }

          const infoDiv = document.createElement("div");
          infoDiv.className = "info";
          infoDiv.textContent = info;

          const status = document.createElement("span");
          status.className = `badge ${w.status}`;
          status.textContent = w.status;

          card.appendChild(infoDiv);
          card.appendChild(status);
          section.appendChild(card);
        });

        container.appendChild(section);
      }
    });
  } catch (err) {
    console.error("❌ Error loading withdrawals:", err);
  }
}

// ===== Common balance check =====
async function validateAndPrepareWithdrawal(encodedEmail, amount) {
  const summaryRef = ref(db, `child_panel/${encodedEmail}/dashboard/summary`);
  const summarySnap = await get(summaryRef);

  let available = 0;
  if (summarySnap.exists()) available = summarySnap.val().totalAvailable || 0;

  if (amount < 10) throw new Error("❌ Minimum withdrawal is $10");
  if (amount > available) throw new Error(`❌ Insufficient balance. Available: $${available}`);

  return { available, summaryRef };
}

// ===== Submit Crypto Withdrawal =====
async function submitCrypto() {
  const address = document.getElementById("cryptoAddress").value.trim();
  const amount = parseFloat(document.getElementById("cryptoAmount").value);

  if (!address || !amount || amount <= 0) {
    alert("⚠️ Enter wallet address and valid amount");
    return;
  }

  const user = auth.currentUser;
  if (!user) return alert("Login required");

  const encodedEmail = encodeEmail(user.email);
  try {
    const { available, summaryRef } = await validateAndPrepareWithdrawal(encodedEmail, amount);

    const pendingRef = ref(db, `child_panel/${encodedEmail}/withdrawals/pending`);
    const snap = await get(pendingRef);
    const nextKey = getNextKey(snap.exists() ? snap.val() : null);

    await set(child(pendingRef, nextKey), {
      walletAddress: address,
      amount,
      date: new Date().toISOString().split("T")[0],
      status: "pending",
      method: "Binance Wallet",
    });

    await set(child(summaryRef, "totalAvailable"), available - amount);

    alert("✅ Crypto withdrawal requested!");
    closeModal("cryptoModal");
    loadWithdrawals(encodedEmail);
  } catch (err) {
    alert(err.message || "❌ Withdrawal failed");
    console.error("❌ Crypto Withdrawal Error:", err);
  }
}

// ===== Submit Bank Withdrawal =====
async function submitBank() {
  const name = document.getElementById("bankName").value.trim();
  const bank = document.getElementById("bankBank").value.trim();
  const ifsc = document.getElementById("bankIFSC").value.trim();
  const acc = document.getElementById("bankAcc").value.trim();
  const amount = parseFloat(document.getElementById("bankAmount").value);

  if (!name || !bank || !ifsc || !acc || !amount || amount <= 0) {
    alert("⚠️ Fill all fields correctly");
    return;
  }

  const user = auth.currentUser;
  if (!user) return alert("Login required");

  const encodedEmail = encodeEmail(user.email);
  try {
    const { available, summaryRef } = await validateAndPrepareWithdrawal(encodedEmail, amount);

    const pendingRef = ref(db, `child_panel/${encodedEmail}/withdrawals/pending`);
    const snap = await get(pendingRef);
    const nextKey = getNextKey(snap.exists() ? snap.val() : null);

    await set(child(pendingRef, nextKey), {
      accountHolder: name,
      bankName: bank,
      IFSC: ifsc,
      accountNumber: acc,
      amount,
      date: new Date().toISOString().split("T")[0],
      status: "pending",
      method: "Bank Transfer",
    });

    await set(child(summaryRef, "totalAvailable"), available - amount);

    alert("✅ Bank withdrawal request submitted!");
    closeModal("bankModal");
    loadWithdrawals(encodedEmail);
  } catch (err) {
    alert(err.message || "❌ Withdrawal failed");
    console.error("❌ Bank Withdrawal Error:", err);
  }
}

// ===== Logout =====
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

// ===== Sidebar =====
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("show");
  document.getElementById("overlay").classList.toggle("active");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("show");
  document.getElementById("overlay").classList.remove("active");
}

// ===== Notifications =====
const notifications = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  text: `🔔 Notification ${i + 1} for Withdrawal`,
  unread: Math.random() > 0.5,
}));
function toggleNotifications() {
  document.getElementById("notificationsPanel").classList.toggle("show");
}
function renderNotifications() {
  const container = document.getElementById("notificationsList");
  container.innerHTML = "";
  notifications.forEach((n) => {
    const div = document.createElement("div");
    div.className = "notification-item" + (n.unread ? " unread" : "");
    div.innerText = n.text;
    div.onclick = () => {
      n.unread = false;
      div.classList.remove("unread");
    };
    container.appendChild(div);
  });
}
renderNotifications();

// ===== Modals =====
function openCryptoModal() {
  document.getElementById("cryptoModal").style.display = "flex";
}
function openBankModal() {
  document.getElementById("bankModal").style.display = "flex";
}
function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

// ===== Expose globally =====
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.toggleNotifications = toggleNotifications;
window.openCryptoModal = openCryptoModal;
window.openBankModal = openBankModal;
window.closeModal = closeModal;
window.submitCrypto = submitCrypto;
window.submitBank = submitBank;
