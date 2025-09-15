import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";
import { getDatabase, ref, child, set, get } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Auth check & load totals & withdrawal list
onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    const encodedEmail = user.email.replace(/\./g, '_');

    // Load totals
    const summarySnap = await get(ref(db, `child_panel/${encodedEmail}/dashboard/summary`));
    if (summarySnap.exists()) {
        const data = summarySnap.val();
        document.getElementById('totalAvailable').innerText = data.totalAvailable || 0;
        document.getElementById('totalWithdrawn').innerText = data.totalWithdrawal || 0;
    }

    // Load withdrawals
    loadWithdrawals(encodedEmail);
});

// Load withdrawals
async function loadWithdrawals(encodedEmail) {
    const snap = await get(ref(db, `child_panel/${encodedEmail}/withdrawals`));
    const container = document.getElementById('withdrawalList');
    container.innerHTML = "";
    if (!snap.exists()) return;

    const data = snap.val();
    ['pending', 'cancelled', 'history'].forEach(type => {
        if (data[type]) {
            const section = document.createElement('div');
            section.classList.add('withdrawal-section');

            const h4 = document.createElement('h4');
            h4.textContent = type.charAt(0).toUpperCase() + type.slice(1) + ' Withdrawals';
            section.appendChild(h4);

            Object.values(data[type]).forEach(w => {
                const card = document.createElement('div');
                card.className = "withdrawal-card";

                let info = `${w.method || 'Unknown'} • ${w.amount} • ${w.date}`;
                if (w.method === "Bank Transfer") {
                    info += ` • ${w.accountHolder}, ${w.bankName}, ${w.IFSC}`;
                } else if (w.method === "Binance Wallet") {
                    info += ` • ${w.walletAddress || "No Address"}`;
                }

                const infoDiv = document.createElement('div');
                infoDiv.className = "info";
                infoDiv.textContent = info;

                const status = document.createElement('span');
                status.className = `badge ${w.status}`;
                status.textContent = w.status;

                card.appendChild(infoDiv);
                card.appendChild(status);
                section.appendChild(card);
            });

            container.appendChild(section);
        }
    });
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = "login.html";
});

// Sidebar
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('show');
    document.getElementById('overlay').classList.toggle('active');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('show');
    document.getElementById('overlay').classList.remove('active');
}

// Notifications
const notifications = [];
for (let i = 1; i <= 6; i++) {
    notifications.push({ id: i, text: `🔔 Notification ${i} for Withdrawal`, unread: Math.random() > 0.5 });
}
function toggleNotifications() {
    document.getElementById('notificationsPanel').classList.toggle('show');
}
function renderNotifications() {
    const container = document.getElementById('notificationsList');
    container.innerHTML = "";
    notifications.forEach(n => {
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

// Modals
function openCryptoModal() { document.getElementById('cryptoModal').style.display = 'flex'; }
function openBankModal() { document.getElementById('bankModal').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ✅ Submit Crypto Withdrawal
async function submitCrypto() {
    const address = document.getElementById('cryptoAddress').value.trim();
    const amount = parseFloat(document.getElementById('cryptoAmount').value);

    if (!address || !amount || amount <= 0) {
        alert("⚠️ Enter wallet address and valid amount");
        return;
    }

    const user = auth.currentUser;
    if (!user) { alert("Login required"); return; }

    const encodedEmail = user.email.replace(/\./g, '_');

    // Check balance
    const summaryRef = ref(db, `child_panel/${encodedEmail}/dashboard/summary`);
    const summarySnap = await get(summaryRef);
    let available = 0;
    if (summarySnap.exists()) {
        available = summarySnap.val().totalAvailable || 0;
    }

    if (amount < 10) {
        alert("❌ Minimum withdrawal is $10");
        return;
    }
    if (amount > available) {
        alert(`❌ Insufficient balance. Available: $${available}`);
        return;
    }

    const pendingRef = ref(db, `child_panel/${encodedEmail}/withdrawals/pending`);
    const snap = await get(pendingRef);
    const nextKey = snap.exists() ? `req${Object.keys(snap.val()).length + 1}` : 'req1';

    await set(child(pendingRef, nextKey), {
        walletAddress: address,
        amount,
        date: new Date().toISOString().split('T')[0],
        status: "pending",
        method: "Binance Wallet"
    });

    // Update balance
    await set(child(summaryRef, "totalAvailable"), available - amount);

    alert("✅ Crypto withdrawal requested!");
    closeModal('cryptoModal');
    loadWithdrawals(encodedEmail);
}

// ✅ Submit Bank Withdrawal
async function submitBank() {
    const name = document.getElementById('bankName').value.trim();
    const bank = document.getElementById('bankBank').value.trim();
    const ifsc = document.getElementById('bankIFSC').value.trim();
    const acc = document.getElementById('bankAcc').value.trim();
    const amount = parseFloat(document.getElementById('bankAmount').value);

    if (!name || !bank || !ifsc || !acc || !amount || amount <= 0) {
        alert("⚠️ Fill all fields correctly");
        return;
    }

    const user = auth.currentUser;
    if (!user) { alert("Login required"); return; }

    const encodedEmail = user.email.replace(/\./g, '_');

    // Check balance
    const summaryRef = ref(db, `child_panel/${encodedEmail}/dashboard/summary`);
    const summarySnap = await get(summaryRef);
    let available = 0;
    if (summarySnap.exists()) {
        available = summarySnap.val().totalAvailable || 0;
    }

    if (amount < 10) {
        alert("❌ Minimum withdrawal is $10");
        return;
    }
    if (amount > available) {
        alert(`❌ Insufficient balance. Available: $${available}`);
        return;
    }

    const pendingRef = ref(db, `child_panel/${encodedEmail}/withdrawals/pending`);
    const snap = await get(pendingRef);
    const nextKey = snap.exists() ? `req${Object.keys(snap.val()).length + 1}` : 'req1';

    await set(child(pendingRef, nextKey), {
        accountHolder: name,
        bankName: bank,
        IFSC: ifsc,
        accountNumber: acc,
        amount,
        date: new Date().toISOString().split('T')[0],
        status: "pending",
        method: "Bank Transfer"
    });

    // Update balance
    await set(child(summaryRef, "totalAvailable"), available - amount);

    alert("✅ Bank withdrawal request submitted!");
    closeModal('bankModal');
    loadWithdrawals(encodedEmail);
}

// Expose globally
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.toggleNotifications = toggleNotifications;
window.openCryptoModal = openCryptoModal;
window.openBankModal = openBankModal;
window.closeModal = closeModal;
window.submitCrypto = submitCrypto;
window.submitBank = submitBank;
