import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";
import { getDatabase, ref, set, get, child, remove } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js";
import { firebaseConfig } from "./config.js";

// Firebase Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ===== Auth Check =====
onAuthStateChanged(auth, async user => {
    if(!user){ window.location.href = "login.html"; }
    else { await fetchLinks(user); }
});

// ===== Logout =====
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = "login.html";
});

// ===== Sidebar Toggle =====
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const hamburger = document.getElementById('hamburger');
hamburger.addEventListener('click', ()=>{ sidebar.classList.toggle('show'); overlay.classList.toggle('active'); });
overlay.addEventListener('click', ()=>{ sidebar.classList.remove('show'); overlay.classList.remove('active'); });

// ===== Notifications =====
const bell = document.getElementById('bell');
const notificationsPanel = document.getElementById('notificationsPanel');
const backBtn = document.getElementById('backBtn');
const notificationsList = document.getElementById('notificationsList');
const notifications = [];
for(let i=1;i<=8;i++){ notifications.push({id:i,text:`🔔 Notification ${i}`, unread:Math.random()>0.5}); }
bell.addEventListener('click', ()=> notificationsPanel.classList.toggle('show'));
backBtn.addEventListener('click', ()=> notificationsPanel.classList.remove('show'));
function renderNotifications(){
  notificationsList.innerHTML = "";
  notifications.forEach(n=>{
    const div=document.createElement('div');
    div.className="notification-item"+(n.unread?" unread":"");
    div.innerText=n.text;
    div.addEventListener('click',()=>{ n.unread=false; div.classList.remove('unread'); });
    notificationsList.appendChild(div);
  });
}
renderNotifications();

// ===== Links Logic =====
const createBtn = document.getElementById('createBtn');
const categoryMenu = document.getElementById('categoryMenu');
const categoryButtons = categoryMenu.querySelectorAll('button[data-type]');
const linksGrid = document.getElementById('linksGrid');

let links = [];
const maxLinks = 20;

createBtn.addEventListener('click', ()=>{ categoryMenu.style.display = (categoryMenu.style.display==="none"||categoryMenu.style.display==="")?"block":"none"; });

// ===== Unique 6-char code generator =====
function generateUniqueCode(existingCodes){
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    do {
        code = '';
        for(let i=0;i<6;i++){ code += chars.charAt(Math.floor(Math.random()*chars.length)); }
    } while(existingCodes.includes(code));
    return code;
}

// ===== Encode email for Firebase node =====
function encodeEmail(email){ return email.replace(/\./g,'_'); }

// ===== Create Link =====
categoryButtons.forEach(btn=>{
    btn.addEventListener('click', async ()=>{
        const type = btn.dataset.type;
        if(links.length >= maxLinks){ alert("⚠️ Maximum 20 links allowed!"); return; }

        const userId = auth.currentUser.email;
        const encodedEmail = encodeEmail(userId);
        const userRef = ref(db, `child_panel/${encodedEmail}/links`);

        // Get existing links
        const snapshot = await get(userRef);
        const existingLinks = snapshot.exists() ? snapshot.val() : {};
        const existingCodes = Object.values(existingLinks).map(l=>l.code);

        // Generate unique code
        const code = generateUniqueCode(existingCodes);

        // Domain prefix
        let prefix = type==='movie'?'m':type==='adult'?'a':'al';
        const url = `https://star5.com/${prefix}/${code}`;

        // 5-day dashboard
        const dashboard5Days = {
            day1:{views:0,clicks:0}, day2:{views:0,clicks:0}, day3:{views:0,clicks:0},
            day4:{views:0,clicks:0}, day5:{views:0,clicks:0}
        };

        // Determine link key
        const linkKey = `link${Object.keys(existingLinks || {}).length + 1}`;

        // New link object
        const newLink = { url, type, code, dashboard5Days };

        // Save in Firebase
        await set(child(userRef, linkKey), newLink);

        // Update local links array
        links = [...Object.values(existingLinks || {}), newLink];

        categoryMenu.style.display='none';
        renderLinks();
    });
});

// ===== Fetch Links =====
async function fetchLinks(user){
    const encodedEmail = encodeEmail(user.email);
    const userRef = ref(db, `child_panel/${encodedEmail}/links`);
    const snapshot = await get(userRef);
    links = snapshot.exists() ? Object.values(snapshot.val()) : [];
    renderLinks();
}

// ===== Render Links =====
function renderLinks(){
    linksGrid.innerHTML = '';
    links.forEach((link,i)=>{
        const card=document.createElement('div');
        card.className='link-card';
        const typeLabel = link.type==='movie'?'🎬 Movie':link.type==='adult'?'🔞 Adult':'🎲 Random';
        card.innerHTML = `
            <h3>Direct Link #${i+1}</h3>
            <p>${link.url}</p>
            <p>${typeLabel} Link</p>
            <button class="dashboard-btn">📅 5-Day Dashboard</button>
            <button class="delete-btn" style="margin-top:8px; background:#b30000;">🗑 Delete</button>
            <div class="dashboard" style="display:none;"></div>
        `;
        linksGrid.appendChild(card);

        const dashBtn = card.querySelector('.dashboard-btn');
        const dashDiv = card.querySelector('.dashboard');
        dashBtn.addEventListener('click', ()=>{
            if(dashDiv.style.display==='none'){
                let html="<table class='dashboard-table'><tr><th>Day</th><th>Views</th><th>Clicks</th></tr>";
                Object.values(link.dashboard5Days).forEach((d,k)=>{
                    html+=`<tr><td>Day ${k+1}</td><td>${d.views}</td><td>${d.clicks}</td></tr>`;
                });
                html+="</table>";
                dashDiv.innerHTML = html;
                dashDiv.style.display='block';
            } else { dashDiv.style.display='none'; }
        });

        // ===== Delete link =====
        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async ()=>{
            if(confirm("Are you sure you want to delete this link?")){
                const encodedEmail = encodeEmail(auth.currentUser.email);
                const linkKey = `link${i+1}`;
                await remove(ref(db, `child_panel/${encodedEmail}/links/${linkKey}`));
                links.splice(i,1);
                renderLinks();
            }
        });
    });
}
