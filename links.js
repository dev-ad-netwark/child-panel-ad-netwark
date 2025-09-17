import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";
import { getDatabase, ref, set, get, child, remove, update } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js";
import { fetchAndDecryptConfig } from "./config.js";

// ===== Firebase Init =====
let auth, db;
(async () => {
  const firebaseConfig = await fetchAndDecryptConfig();
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);

  // Auth Check
  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.href = "login.html";
    } else {
      await fetchLinks(user);
    }
  });
})();

// ===== Helper Functions =====
const encodeEmail = (email) => email.replace(/\./g, "_");

// Unique 6-char code generator
function generateUniqueCode(existingCodes) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("");
  } while (existingCodes.includes(code));
  return code;
}

// ===== Logout =====
document.getElementById("logoutBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  await signOut(auth);
  window.location.href = "login.html";
});

// ===== Sidebar Toggle =====
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
document.getElementById("hamburger").addEventListener("click", () => {
  sidebar.classList.toggle("show");
  overlay.classList.toggle("active");
});
overlay.addEventListener("click", () => {
  sidebar.classList.remove("show");
  overlay.classList.remove("active");
});

// ===== Notifications =====
const bell = document.getElementById("bell");
const notificationsPanel = document.getElementById("notificationsPanel");
const backBtn = document.getElementById("backBtn");
const notificationsList = document.getElementById("notificationsList");

const notifications = Array.from({ length: 5 }, (_, i) => ({
  id: i + 1,
  text: `🔔 Notification ${i + 1}`,
  unread: true,
}));

bell.addEventListener("click", () => notificationsPanel.classList.toggle("show"));
backBtn.addEventListener("click", () => notificationsPanel.classList.remove("show"));

function renderNotifications() {
  notificationsList.innerHTML = "";
  notifications.forEach((n) => {
    const div = document.createElement("div");
    div.className = "notification-item" + (n.unread ? " unread" : "");
    div.innerText = n.text;
    div.addEventListener("click", () => {
      n.unread = false;
      div.classList.remove("unread");
    });
    notificationsList.appendChild(div);
  });
}
renderNotifications();

// ===== Links Logic =====
const createBtn = document.getElementById("createBtn");
const categoryMenu = document.getElementById("categoryMenu");
const categoryButtons = categoryMenu.querySelectorAll("button[data-type]");
const linksGrid = document.getElementById("linksGrid");

let links = [];
const maxLinks = 20;

// Toggle menu
createBtn.addEventListener("click", () => {
  categoryMenu.style.display = categoryMenu.style.display === "block" ? "none" : "block";
});

// ===== Create Link =====
categoryButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      const type = btn.dataset.type;
      if (links.length >= maxLinks) {
        alert("⚠️ Maximum 20 links allowed!");
        return;
      }

      const userEmail = auth.currentUser.email;
      const encodedEmail = encodeEmail(userEmail);
      const userRef = ref(db, `child_panel/${encodedEmail}/links`);
      const globalRef = ref(db, `all_links`);

      // Existing links
      const snapshot = await get(userRef);
      const existingLinks = snapshot.exists() ? snapshot.val() : {};

      // Global codes
      const globalSnap = await get(globalRef);
      const globalLinks = globalSnap.exists() ? globalSnap.val() : {};
      const globalCodes = Object.values(globalLinks).map((l) => l.code);

      // Unique code
      const code = generateUniqueCode(globalCodes);

      // Prefix by type
      const prefix = type === "movie" ? "m" : type === "adult" ? "a" : "al";
      const url = `https://star5.com/${prefix}/${code}`;

      // 5-day dashboard
      const dashboard5Days = Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [`day${i + 1}`, { views: 0, clicks: 0 }])
      );

      // Timestamp
      const dateCreated = new Date().toISOString();

      // New link object
      const newLink = {
        url,
        type,
        code,
        dashboard5Days,
        createdBy: userEmail,
        dateCreated,
      };

      // Save in user + global
      const linkKey = `link${Object.keys(existingLinks).length + 1}`;
      await set(child(userRef, linkKey), newLink);
      await set(child(globalRef, code), { ...newLink, userKey: linkKey, userEmail });

      // Update local + render
      links.push(newLink);
      categoryMenu.style.display = "none";
      renderLinks();
    } catch (err) {
      console.error("❌ Create Link Error:", err);
      alert("Failed to create link.");
    }
  });
});

// ===== Fetch Links =====
async function fetchLinks(user) {
  try {
    const encodedEmail = encodeEmail(user.email);
    const userRef = ref(db, `child_panel/${encodedEmail}/links`);
    const snapshot = await get(userRef);
    links = snapshot.exists() ? Object.values(snapshot.val()) : [];
    renderLinks();
  } catch (err) {
    console.error("❌ Fetch Links Error:", err);
  }
}

// ===== Render Links =====
function renderLinks() {
  linksGrid.innerHTML = "";
  links.forEach((link, i) => {
    const card = document.createElement("div");
    card.className = "link-card";
    const typeLabel =
      link.type === "movie" ? "🎬 Movie" : link.type === "adult" ? "🔞 Adult" : "🎲 Random";
    card.innerHTML = `
      <h3>Direct Link #${i + 1}</h3>
      <p>${link.url}</p>
      <p>${typeLabel} Link</p>
      <p>Created: ${new Date(link.dateCreated).toLocaleString()}</p>
      <p>By: ${link.createdBy}</p>
      <button class="dashboard-btn">📅 5-Day Dashboard</button>
      <button class="delete-btn" style="margin-top:8px; background:#b30000;">🗑 Delete</button>
      <div class="dashboard" style="display:none;"></div>
    `;
    linksGrid.appendChild(card);

    // Dashboard toggle
    card.querySelector(".dashboard-btn").addEventListener("click", () => {
      const dashDiv = card.querySelector(".dashboard");
      if (dashDiv.style.display === "none") {
        dashDiv.innerHTML = `
          <table class='dashboard-table'>
            <tr><th>Day</th><th>Views</th><th>Clicks</th></tr>
            ${Object.entries(link.dashboard5Days)
              .map(([k, v]) => `<tr><td>${k}</td><td>${v.views}</td><td>${v.clicks}</td></tr>`)
              .join("")}
          </table>
        `;
        dashDiv.style.display = "block";
      } else {
        dashDiv.style.display = "none";
      }
    });

    // Delete link
    card.querySelector(".delete-btn").addEventListener("click", async () => {
      if (confirm("Are you sure you want to delete this link?")) {
        try {
          const encodedEmail = encodeEmail(auth.currentUser.email);
          const userRef = ref(db, `child_panel/${encodedEmail}/links`);

          // Remove from DB (user + global)
          await remove(ref(db, `child_panel/${encodedEmail}/links/link${i + 1}`));
          await remove(ref(db, `all_links/${link.code}`));

          // Re-index user links in DB
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const updatedLinks = Object.values(snapshot.val());
            links = updatedLinks;
            // Reorder as link1, link2...
            const updates = {};
            updatedLinks.forEach((l, idx) => {
              updates[`link${idx + 1}`] = l;
            });
            await set(userRef, updates);
          } else {
            links = [];
          }

          renderLinks();
        } catch (err) {
          console.error("❌ Delete Link Error:", err);
          alert("Failed to delete link.");
        }
      }
    });
  });
}
