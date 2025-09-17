// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  setPersistence, browserLocalPersistence, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";
import { getDatabase, ref, set, get, update } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js";
import { fetchAndDecryptConfig } from "./config.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 🔹 Firebase config from backend
  const firebaseConfig = await fetchAndDecryptConfig();

  // 🔹 Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);

  // 🔹 Set persistence
  await setPersistence(auth, browserLocalPersistence)
    .then(() => console.log("✅ Auth persistence set"))
    .catch(err => console.error("⚠️ Persistence error:", err));

  // Helper
  const encodeEmail = (email) => email.replace(/\./g, "_");

  // Buttons & Forms
  const loginBtn = document.getElementById("login-btn");
  const createBtn = document.getElementById("create-btn");
  const loginForm = document.getElementById("login-form");
  const createForm = document.getElementById("create-form");

  // Toggle forms
  loginBtn.addEventListener("click", () => {
    loginForm.style.display = "flex";
    createForm.style.display = "none";
    loginBtn.classList.add("active");
    createBtn.classList.remove("active");
  });

  createBtn.addEventListener("click", () => {
    createForm.style.display = "flex";
    loginForm.style.display = "none";
    createBtn.classList.add("active");
    loginBtn.classList.remove("active");
  });

  // Auto redirect if already logged in
  onAuthStateChanged(auth, async (user) => {
    if(user){
      const userId = encodeEmail(user.email);
      const snapshot = await get(ref(db, `child_panel/${userId}`));
      if(snapshot.exists()){
        console.log("🔐 Already logged in:", snapshot.val());
        window.location.href = "dashboard.html";
      }
    }
  });

  // Create account
  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("create-name").value.trim();
    const email = document.getElementById("create-email").value.trim();
    const pass = document.getElementById("create-password").value;
    const confirm = document.getElementById("create-confirm").value;
    const referral = document.getElementById("create-referral").value || "00000";

    if(pass !== confirm){ alert("⚠️ Passwords do not match!"); return; }

    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      const userId = encodeEmail(email);
      const now = new Date().toISOString();

      // userData structure
      const userData = {
        name, email, lastLogin: now, referralCode: referral,
        referredBy:"00000", referralPercent:0,
        dashboard:{ summary:{ dailyIncome:0,totalEarnings:0,totalWithdrawal:0,totalAvailable:0 }, dailyStats:{} },
        links:{ link1:{url:"00",type:"00",dashboard5Days:{}}, link2:{url:"00",type:"00",dashboard5Days:{}} },
        withdrawals:{ totalAmount:0,pending:{},cancelled:{},history:{} },
        support:{},
        profile:{ passwordLastChanged:"0000-00-00",lastLogin:now,email,referralPercent:0,extraSettings:{theme:"light",notifications:false}},
        notifications:{}
      };

      // Daily stats (10 days)
      for(let i=0;i<10;i++){
        const d = new Date(); d.setDate(d.getDate()-(10-i-1));
        const ds = d.toISOString().split("T")[0];
        userData.dashboard.dailyStats[ds] = { impressions:0, earnings:0, cpm:0 };
      }

      // Links (5 days)
      ["link1","link2"].forEach(link=>{
        for(let i=1;i<=5;i++) userData.links[link].dashboard5Days[`day${i}`]={views:0,clicks:0};
      });

      await set(ref(db, `child_panel/${userId}`), userData);
      alert("🎉 Account created successfully!");
      window.location.href = "dashboard.html";
    } catch(err) {
      console.error("❌ Create Error:", err);
      alert("Error: " + err.message);
    }
  });

  // Login
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-password").value;

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      const userId = encodeEmail(email);
      const userRef = ref(db, `child_panel/${userId}`);
      const snapshot = await get(userRef);

      if(snapshot.exists()){
        const now = new Date().toISOString();
        await update(userRef, { lastLogin: now });
        await update(ref(db, `child_panel/${userId}/profile`), { lastLogin: now });
        console.log("✅ Login successful:", snapshot.val());
        window.location.href = "dashboard.html";
      } else {
        alert("⚠️ No user data found!");
      }
    } catch(err) {
      console.error("❌ Login Error:", err);
      alert("Login failed: " + err.message);
    }
  });
});
