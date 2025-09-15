// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";
import { getDatabase, ref, set, get, update } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js";
import { firebaseConfig } from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Set Auth Persistence to local (login survives refresh)
setPersistence(auth, browserLocalPersistence)
    .then(() => console.log("Firebase Auth persistence set to local"))
    .catch(err => console.error("Persistence error:", err));

// Helper to encode email to Firebase key
function encodeEmail(email) {
    return email.replace(/\./g, "_");
}

// Buttons
const loginBtn = document.getElementById('login-btn');
const createBtn = document.getElementById('create-btn');

// Forms
const loginForm = document.getElementById('login-form');
const createForm = document.getElementById('create-form');

// Toggle forms
loginBtn.addEventListener('click', () => {
    loginForm.style.display = 'flex';
    createForm.style.display = 'none';
    loginBtn.classList.add('active');
    createBtn.classList.remove('active');
});

createBtn.addEventListener('click', () => {
    createForm.style.display = 'flex';
    loginForm.style.display = 'none';
    createBtn.classList.add('active');
    loginBtn.classList.remove('active');
});

// Check Auth State on Page Load
onAuthStateChanged(auth, async (user) => {
    if(user){
        const userId = encodeEmail(user.email);
        const snapshot = await get(ref(db, `child_panel/${userId}`));
        if(snapshot.exists()){
            console.log("User already logged in:", snapshot.val());
            window.location.href = "dashboard.html";
        }
    }
});

// Create Account
createForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('create-name').value.trim();
    const email = document.getElementById('create-email').value.trim();
    const password = document.getElementById('create-password').value;
    const confirm = document.getElementById('create-confirm').value;
    const referralCode = document.getElementById('create-referral').value || "00000";

    if(password !== confirm){
        alert("Passwords do not match!");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const userId = encodeEmail(email);

        // Full JSON structure for Realtime Database
        const userData = {
            name: name,
            email: email,
            passwordHash: "00",
            lastLogin: new Date().toISOString(),
            referralCode: referralCode,
            referredBy: "00000",
            referralPercent: 0,
            dashboard: {
                summary: { dailyIncome:0, totalEarnings:0, totalWithdrawal:0, totalAvailable:0 },
                dailyStats: {}
            },
            links: {
                link1: { url:"00", type:"00", dashboard5Days:{} },
                link2: { url:"00", type:"00", dashboard5Days:{} }
            },
            withdrawals: {
                totalAmount:0,
                pending:{ req1:{amount:0,date:"0000-00-00",status:"pending"}, req2:{amount:0,date:"0000-00-00",status:"pending"} },
                cancelled:{ req1:{amount:0,date:"0000-00-00",status:"cancelled"} },
                history:{ pay1:{amount:0,date:"0000-00-00",status:"completed"}, pay2:{amount:0,date:"0000-00-00",status:"completed"} }
            },
            support: {
                ticket1:{subject:"00",status:"00",message:"00"},
                ticket2:{subject:"00",status:"00",message:"00"}
            },
            profile: {
                passwordLastChanged:"0000-00-00",
                lastLogin:"0000-00-00T00:00:00",
                email: email,
                referralPercent:0,
                extraSettings:{ theme:"00", notifications:false }
            },
            notifications: {
                note1:{title:"00",message:"00",read:false},
                note2:{title:"00",message:"00",read:false}
            }
        };

        // Initialize dailyStats last 10 days
        for(let i=0;i<10;i++){
            const date = new Date();
            date.setDate(date.getDate() - (10-i-1));
            const dateStr = date.toISOString().split('T')[0];
            userData.dashboard.dailyStats[dateStr] = { impressions:0, earnings:0, cpm:0 };
        }

        // Initialize dashboard5Days for links
        ["link1","link2"].forEach(link => {
            for(let i=1;i<=5;i++){
                userData.links[link].dashboard5Days[`day${i}`] = { views:0, clicks:0 };
            }
        });

        // Write to Realtime Database under child_panel
        await set(ref(db, `child_panel/${userId}`), userData);

        alert("Account created successfully!");
        window.location.href = "dashboard.html"; // Redirect

    } catch(error){
        console.error(error);
        alert("Error: " + error.message);
    }
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userId = encodeEmail(email);

        // Fetch user data
        const userRef = ref(db, `child_panel/${userId}`);
        const snapshot = await get(userRef);

        if(snapshot.exists()){
            const userData = snapshot.val();
            console.log("User Data:", userData);

            // Update lastLogin on login
            const now = new Date().toISOString();
            await update(userRef, { lastLogin: now });
            await update(ref(db, `child_panel/${userId}/profile`), { lastLogin: now });

            // Redirect to dashboard
            window.location.href = "dashboard.html";
        } else {
            alert("No user data found!");
        }

    } catch(error){
        console.error(error);
        alert("Login failed: " + error.message);
    }
});
