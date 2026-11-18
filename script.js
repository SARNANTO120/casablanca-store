/* =====================================================
   ⚙️ الإعدادات — عدّل من هنا فقط!
   ===================================================== */
const CONFIG = {
  // ✏️ اسم المتجر (اسم أخيك)
  storeName: "متجر الفضاء",

  // ✏️✏️ رابط المحل: عندما يضغط الزبون "شراء" ينتقل تلقائياً لهذا الرابط
  // مثال: "https://wa.me/9665xxxxxxxx"
  shopUrl: "https://example.com",

  // ✏️ العملة
  currency: "ريال",

  // 🔐 حساب الأدمن للوضع المحلي (إذا لم يتم ربط Firebase)
  adminUsername: "admin",
  adminPassword: "admin123",

  // 👑 بريد الأدمن الرئيسي في Firebase — من يسجل بهذا البريد يصبح أدمن تلقائياً
  // مثال: "brother@gmail.com"
  adminEmail: "",

  // 🔥 بيانات Firebase (مضبوطة بالفعل من مشروعك)
  firebaseConfig: {
    apiKey: "AIzaSyDKKBOPxfDfV7BtBmJFwoP4LuO5jJ8JGms",
    authDomain: "boutique-dar-al-bayda-562be.firebaseapp.com",
    projectId: "boutique-dar-al-bayda-562be",
    storageBucket: "boutique-dar-al-bayda-562be.firebasestorage.app",
    messagingSenderId: "953069186000",
    appId: "1:953069186000:web:7cc12a06142258b2ed27d5",
    measurementId: "G-YV6WF3T8Y1",
  },
};

/* =====================================================
   🔥 تهيئة Firebase
   ===================================================== */
const USING_FIREBASE = !!CONFIG.firebaseConfig.apiKey;
let auth = null;
let db = null;

if (USING_FIREBASE) {
  firebase.initializeApp(CONFIG.firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  db.enablePersistence().catch((err) => console.log("Persistence offline:", err));
}

/* =====================================================
   🛍️ المنتجات الافتراضية (للوضع المحلي فقط)
   ===================================================== */
const DEFAULT_PRODUCTS = [
  { name: "تيشيرت فضائي", emoji: "👕", desc: "تيشيرت مريح بنقشة فضائية رائعة", price: 50 },
  { name: "ساعة المريخ",  emoji: "⌚", desc: "ساعة أنيقة مقاومة للماء", price: 120 },
  { name: "صاروخ لعبة",   emoji: "🚀", desc: "لعبة صاروخ تنطلق عالياً!", price: 35 },
];

/* =====================================================
   💾 التخزين المحلي (للحل الاحتياطي بدون Firebase)
   ===================================================== */
const K_USERS = "space_users";
const K_PRODUCTS = "space_products";
const K_SESSION = "space_session";
const K_BANS = "space_bans";

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let users = load(K_USERS, null);
if (!USING_FIREBASE) {
  if (!users) {
    users = [{ username: CONFIG.adminUsername, password: CONFIG.adminPassword, isAdmin: true, email: null }];
    save(K_USERS, users);
  } else if (!users.some((u) => u.username === CONFIG.adminUsername)) {
    users.unshift({ username: CONFIG.adminUsername, password: CONFIG.adminPassword, isAdmin: true, email: null });
    save(K_USERS, users);
  }
}

let currentUser = null; // {uid, username, email, isAdmin, isBanned, banReason}

/* =====================================================
   🔧 أدوات الأمان والتحقق
   ===================================================== */
function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = String(text ?? "");
  return d.innerHTML;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function isStrongPassword(password) {
  return password.length >= 6;
}

function sanitizeInput(text) {
  return String(text ?? "").trim();
}

/* =====================================================
   🎨 واجهة المستخدم: تحديث الشريط
   ===================================================== */
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userChip = document.getElementById("userChip");
const navUserName = document.getElementById("navUserName");
const adminPanelBtn = document.getElementById("adminPanelBtn");
const adminSection = document.getElementById("adminSection");

function updateAuthUI() {
  const loggedIn = !!currentUser;
  loginBtn.hidden = loggedIn;
  userChip.hidden = !loggedIn;
  logoutBtn.hidden = !loggedIn;
  adminPanelBtn.hidden = !(loggedIn && currentUser.isAdmin);
  adminSection.hidden = !(loggedIn && currentUser.isAdmin);
  navUserName.textContent = currentUser ? currentUser.username : "";

  if (loggedIn && userChip) {
    if (currentUser.isBanned) {
      userChip.style.background = "rgba(226,55,107,0.25)";
      userChip.style.border = "1px solid #ff7b9c";
      userChip.title = "مُحظور: " + (currentUser.banReason || "");
    } else {
      userChip.style.background = "";
      userChip.style.border = "";
      userChip.title = "";
    }
  }
}

/* =====================================================
   🔑 نافذة المصادقة
   ===================================================== */
const authModal = document.getElementById("authModal");
const loginForm = document.getElementById("loginForm");
const regForm = document.getElementById("regForm");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginMsg = document.getElementById("loginMsg");
const regMsg = document.getElementById("regMsg");

function showMsg(element, text, ok = false) {
  element.textContent = text;
  element.className = "auth-msg " + (ok ? "ok" : "err");
  if (ok) setTimeout(() => (element.textContent = ""), 3500);
}

function openAuth(mode = "login") {
  authModal.hidden = false;
  switchTab(mode);
}
function closeAuth() {
  authModal.hidden = true;
  loginForm.reset();
  regForm.reset();
  showMsg(loginMsg, "");
  showMsg(regMsg, "");
}
function switchTab(mode) {
  loginForm.hidden = mode !== "login";
  regForm.hidden = mode !== "register";
  tabLogin.classList.toggle("active", mode === "login");
  tabRegister.classList.toggle("active", mode === "register");
}

loginBtn.addEventListener("click", () => openAuth("login"));
document.getElementById("authClose").addEventListener("click", closeAuth);
tabLogin.addEventListener("click", () => switchTab("login"));
tabRegister.addEventListener("click", () => switchTab("register"));
authModal.addEventListener("click", (e) => {
  if (e.target === authModal) closeAuth();
});

/* -------- تسجيل الدخول -------- */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const identity = sanitizeInput(document.getElementById("loginUser").value);
  const password = document.getElementById("loginPass").value;

  if (!identity || !password) return showMsg(loginMsg, "❌ يرجى ملء جميع الحقول");

  if (USING_FIREBASE) {
    try {
      const email = isValidEmail(identity) ? identity : identity.toLowerCase() + "@space.store";
      await auth.signInWithEmailAndPassword(email, password);
      closeAuth();
    } catch (err) {
      showMsg(loginMsg, translateAuthError(err));
    }
    return;
  }

  const user = users.find((u) => u.username === identity || u.email === identity);
  if (!user || user.password !== password) {
    showMsg(loginMsg, "❌ اسم المستخدم أو كلمة السر غير صحيحة");
    return;
  }
  currentUser = {
    uid: "local_" + user.username,
    username: user.username,
    email: user.email || null,
    isAdmin: !!user.isAdmin,
    isBanned: !!user.isBanned,
    banReason: user.banReason || "",
  };
  save(K_SESSION, JSON.stringify(currentUser));
  closeAuth();
  updateAuthUI();
  renderProducts();
  renderAdminTabs();
});

/* -------- إنشاء حساب عادي -------- */
regForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = sanitizeInput(document.getElementById("regUser").value);
  const email = sanitizeInput(document.getElementById("regEmail").value);
  const pass1 = document.getElementById("regPass").value;
  const pass2 = document.getElementById("regPass2").value;

  if (!isValidUsername(username)) return showMsg(regMsg, "❌ اسم المستخدم: حروف إنجليزية وأرقام ورمز _ فقط (3-20 حرف)");
  if (!isValidEmail(email)) return showMsg(regMsg, "❌ يرجى إدخال بريد إلكتروني صالح (مثل Gmail)");
  if (!isStrongPassword(pass1)) return showMsg(regMsg, "❌ كلمة السر يجب أن تكون 6 أحرف على الأقل");
  if (pass1 !== pass2) return showMsg(regMsg, "❌ كلمتا السر غير متطابقتين");

  if (USING_FIREBASE) {
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pass1);
      await cred.user.updateProfile({ displayName: username });
      await db.collection("users").doc(cred.user.uid).set({
        username,
        email,
        isAdmin: email.toLowerCase() === (CONFIG.adminEmail || "").toLowerCase(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      closeAuth();
    } catch (err) {
      showMsg(regMsg, translateAuthError(err));
    }
    return;
  }

  if (users.some((u) => u.username === username || u.email === email))
    return showMsg(regMsg, "❌ الاسم أو البريد موجود مسبقاً");

  const isAdmin = username === CONFIG.adminUsername;
  users.push({ username, email, password: pass1, isAdmin });
  save(K_USERS, users);
  currentUser = { uid: "local_" + username, username, email, isAdmin, isBanned: false, banReason: "" };
  save(K_SESSION, JSON.stringify(currentUser));
  closeAuth();
  updateAuthUI();
});

/* -------- تسجيل الدخول بجيميل (Google) -------- */
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

async function handleGoogleAuth(isRegister) {
  try {
    const result = await auth.signInWithPopup(googleProvider);
    const user = result.user;
    const email = user.email || "";
    const displayName = user.displayName || email.split("@")[0] || "مستخدم";

    const docRef = db.collection("users").doc(user.uid);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      await docRef.set({
        username: displayName,
        email,
        isAdmin: email.toLowerCase() === (CONFIG.adminEmail || "").toLowerCase(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        authProvider: "google",
      });
    }
    closeAuth();
  } catch (err) {
    const target = isRegister ? regMsg : loginMsg;
    showMsg(target, translateAuthError(err));
  }
}

document.getElementById("btnGoogleLogin").addEventListener("click", () => handleGoogleAuth(false));
document.getElementById("btnGoogleRegister").addEventListener("click", () => handleGoogleAuth(true));

/* -------- خروج -------- */
logoutBtn.addEventListener("click", async () => {
  if (USING_FIREBASE) {
    await auth.signOut();
  } else {
    currentUser = null;
    localStorage.removeItem(K_SESSION);
  }
  updateAuthUI();
  renderProducts();
  renderAdminTabs();
});

adminPanelBtn.addEventListener("click", () => {
  adminSection.scrollIntoView({ behavior: "smooth" });
});

/* =====================================================
   🔥 مراقبة حالة تسجيل الدخول في Firebase (بما في ذلك البن)
   ===================================================== */
if (USING_FIREBASE) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const docSnap = await db.collection("users").doc(user.uid).get();
      const data = docSnap.exists ? docSnap.data() : {};
      const email = user.email || "";
      currentUser = {
        uid: user.uid,
        username: user.displayName || data.username || email.split("@")[0] || "مستخدم",
        email,
        isAdmin: email.toLowerCase() === (CONFIG.adminEmail || "").toLowerCase() || !!data.isAdmin,
        isBanned: !!data.isBanned,
        banReason: data.banReason || "",
      };
    } else {
      currentUser = null;
    }
    updateAuthUI();
    renderProducts();
    renderAdminTabs();
    renderPosts();
  });
} else {
  try {
    const saved = load(K_SESSION, null);
    if (saved) {
      const parsed = typeof saved === "string" ? JSON.parse(saved) : saved;
      if (parsed && parsed.username) currentUser = parsed;
    }
  } catch {}
  updateAuthUI();
  renderProducts();
  renderAdminTabs();
}

/* =====================================================
   🚫 نظام البن والإلغاء (قواعد الأمان)
   ===================================================== */
function isBanned() {
  return !!currentUser && !!currentUser.isBanned;
}

function requireNotBanned() {
  if (isBanned()) {
    alert("⛔ حسابك محظور من المتجر.\nالسبب: " + (currentUser.banReason || "لا يوجد سبب محدد") + "\nتواصل مع الأدمن للإلغاء.");
    return false;
  }
  return true;
}

function requireAdmin() {
  if (!currentUser || !currentUser.isAdmin) {
    alert("🔐 هذه العملية reserved للأدمن فقط.");
    return false;
  }
  return true;
}

async function banUser(targetUid, targetUsername, reason) {
  if (!requireAdmin()) return;
  if (!reason || reason.trim().length < 3) {
    alert("❌ يجب كتابة سبب البن (3 أحرف على الأقل).");
    return;
  }
  if (targetUid === currentUser.uid) {
    alert("❌ لا يمكنك بن نفسك!");
    return;
  }

  try {
    if (USING_FIREBASE) {
      const targetDoc = await db.collection("users").doc(targetUid).get();
      if (targetDoc.exists && targetDoc.data().isAdmin) {
        alert("❌ لا يمكن بن حساب أدمن!");
        return;
      }
      await db.collection("users").doc(targetUid).update({
        isBanned: true,
        banReason: reason.trim(),
        bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
        bannedBy: currentUser.uid,
      });
      await db.collection("bans").add({
        targetUid,
        targetUsername,
        reason: reason.trim(),
        bannedBy: currentUser.uid,
        bannedByName: currentUser.username,
        bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
        active: true,
      });
    } else {
      const u = users.find((x) => x.username === targetUsername || x.uid === targetUid);
      if (!u) return alert("❌ المستخدم غير موجود");
      if (u.isAdmin) return alert("❌ لا يمكن بن أدمن!");
      u.isBanned = true;
      u.banReason = reason.trim();
      save(K_USERS, users);
      if (currentUser.username === u.username) {
        currentUser.isBanned = true;
        currentUser.banReason = reason.trim();
        save(K_SESSION, JSON.stringify(currentUser));
      }
    }
    renderBannedList();
  } catch (err) {
    alert("❌ خطأ في التنفيذ: " + err.message);
  }
}

async function unbanUser(targetUid) {
  if (!requireAdmin()) return;
  try {
    if (USING_FIREBASE) {
      await db.collection("users").doc(targetUid).update({
        isBanned: false,
        banReason: "",
        unbannedAt: firebase.firestore.FieldValue.serverTimestamp(),
        unbannedBy: currentUser.uid,
      });
      await db.collection("bans").doc(targetUid).update({ active: false });
    } else {
      const u = users.find((x) => x.uid === targetUid);
      if (u) {
        u.isBanned = false;
        u.banReason = "";
        save(K_USERS, users);
      }
    }
    renderBannedList();
  } catch (err) {
    alert("❌ خطأ في الإلغاء: " + err.message);
  }
}

/* =====================================================
   🛒 عرض المنتجات + الشراء (مع فحص البن)
   ===================================================== */
const grid = document.getElementById("productsGrid");
let products = [];

if (!USING_FIREBASE) {
  products = load(K_PRODUCTS, null);
  if (!products) {
    products = DEFAULT_PRODUCTS.map((p) => ({ ...p, id: Date.now() + Math.random() }));
    save(K_PRODUCTS, products);
  }
}

function productCard(p) {
  const visual = p.image
    ? `<img class="card-img" src="${p.image}" alt="${escapeHtml(p.name)}">`
    : `<div class="img">${p.emoji || "🛍️"}</div>`;
  return `
    <div class="card">
      ${visual}
      <h3>${escapeHtml(p.name)}</h3>
      <p class="desc">${escapeHtml(p.desc || "")}</p>
      <p class="price">${p.price} ${CONFIG.currency}</p>
      <button class="buy" ${isBanned() ? "disabled" : ""}>🛒 شراء الآن</button>
    </div>`;
}

function renderProducts() {
  if (grid) grid.innerHTML = products.map(productCard).join("");
}

grid.addEventListener("click", (e) => {
  if (!e.target.classList.contains("buy")) return;
  if (!requireNotBanned()) return;
  if (!currentUser) {
    openAuth("login");
    return;
  }
  window.open(CONFIG.shopUrl, "_blank");
});

/* 🔥 تحديث المنتجات من Firebase في الوقت الفعلي */
if (USING_FIREBASE) {
  db.collection("products")
    .orderBy("createdAt", "desc")
    .onSnapshot(
      (snap) => {
        products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderProducts();
        if (currentUser && currentUser.isAdmin) renderAdminList();
      },
      (err) => console.error("Products listener error:", err)
    );
}

/* =====================================================
   🛠️ لوحة الأدمن: المنتجات
   ===================================================== */
const addProductForm = document.getElementById("addProductForm");
const pName = document.getElementById("pName");
const pPrice = document.getElementById("pPrice");
const pDesc = document.getElementById("pDesc");
const pEmoji = document.getElementById("pEmoji");
const pImage = document.getElementById("pImage");
const imgPreview = document.getElementById("imgPreview");
const adminList = document.getElementById("adminList");

let pendingImage = "";

pImage.addEventListener("change", () => {
  const file = pImage.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 600;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      pendingImage = canvas.toDataURL("image/jpeg", 0.75);
      imgPreview.src = pendingImage;
      imgPreview.hidden = false;
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

addProductForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireAdmin()) return;
  const price = parseFloat(pPrice.value);
  if (isNaN(price) || price < 0) return alert("اكتب سعراً صحيحاً!");
  if (pendingImage && pendingImage.length > 900000) {
    return alert("الصورة كبيرة جداً، اختر صورة أصغر!");
  }

  const data = {
    name: sanitizeInput(pName.value),
    price,
    desc: sanitizeInput(pDesc.value),
    emoji: sanitizeInput(pEmoji.value),
    image: pendingImage,
  };

  if (USING_FIREBASE) {
    try {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      data.createdBy = currentUser.uid;
      await db.collection("products").add(data);
    } catch (err) {
      alert("خطأ في النشر: " + err.message);
      return;
    }
  } else {
    products.unshift({ ...data, id: Date.now() });
    save(K_PRODUCTS, products);
    renderProducts();
  }

  addProductForm.reset();
  pendingImage = "";
  imgPreview.hidden = true;
  pImage.value = "";
});

adminList.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("del")) return;
  if (!requireAdmin()) return;
  const id = e.target.dataset.id;
  if (!confirm("هل تريد حذف هذا المنتج؟")) return;
  if (USING_FIREBASE) {
    try { await db.collection("products").doc(id).delete(); } catch (err) { alert("خطأ: " + err.message); }
  } else {
    products = products.filter((p) => String(p.id) !== id);
    save(K_PRODUCTS, products);
    renderProducts();
    renderAdminList();
  }
});

function renderAdminList() {
  if (!adminList) return;
  adminList.innerHTML = products
    .map((p) => {
      const visual = p.image
        ? `<img src="${p.image}" alt="">`
        : `<span class="a-emoji">${p.emoji || "🛍️"}</span>`;
      return `
        <div class="admin-item">
          ${visual}
          <div class="a-info">
            <strong class="a-name">${escapeHtml(p.name)}</strong>
            <span class="a-price">${p.price} ${CONFIG.currency}</span>
          </div>
          <button class="del" data-id="${p.id}">🗑️ حذف</button>
        </div>`;
    })
    .join("");
}

/* =====================================================
   🚫 واجهة البن والإلغاء
   ===================================================== */
const banForm = document.getElementById("banForm");
const banUserInput = document.getElementById("banUser");
const banReasonInput = document.getElementById("banReason");
const banResult = document.getElementById("banResult");
const bannedList = document.getElementById("bannedList");

let allUsersCache = [];

async function loadUsersList() {
  if (USING_FIREBASE) {
    const snap = await db.collection("users").get();
    allUsersCache = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  } else {
    allUsersCache = users.map((u) => ({
      uid: u.uid || "local_" + u.username,
      username: u.username,
      email: u.email || "",
      isAdmin: !!u.isAdmin,
      isBanned: !!u.isBanned,
      banReason: u.banReason || "",
    }));
  }
  return allUsersCache;
}

function renderBannedList() {
  if (!bannedList) return;
  const banned = allUsersCache.filter((u) => u.isBanned);
  bannedList.innerHTML = banned
    .map((u) => {
      const visual = u.image ? `<img src="${u.image}" alt="">` : `<span class="a-emoji">👤</span>`;
      return `
        <div class="admin-item">
          ${visual}
          <div class="a-info">
            <strong class="a-name">${escapeHtml(u.username)}</strong>
            <span class="a-price">${u.email || "لا يوجد بريد"}</span>
            <span class="a-reason">السبب: ${escapeHtml(u.banReason || "غير محدد")}</span>
          </div>
          <button class="unban" data-id="${u.uid}">✅ إلغاء بن</button>
        </div>`;
    })
    .join("");

  bannedList.querySelectorAll(".unban").forEach((btn) => {
    btn.addEventListener("click", () => unbanUser(btn.dataset.id));
  });
}

banForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireAdmin()) return;
  const identity = sanitizeInput(banUserInput.value);
  const reason = sanitizeInput(banReasonInput.value);
  if (!identity) return alert("❌ يرجى إدخال اسم المستخدم أو البريد");
  if (!reason || reason.length < 3) return alert("❌ يجب كتابة سبب البن (3 أحرف على الأقل)");

  try {
    await loadUsersList();
    const target = allUsersCache.find(
      (u) => u.username === identity || u.email === identity
    );
    if (!target) return alert("❌ المستخدم غير موجود في النظام");
    if (target.isAdmin) return alert("❌ لا يمكن بن حساب أدمن!");
    await banUser(target.uid, target.username, reason);
    banResult.className = "msg ok";
    banResult.textContent = "✅ تم بن المستخدم بنجاح";
    banForm.reset();
    setTimeout(() => (banResult.textContent = ""), 3000);
  } catch (err) {
    banResult.className = "msg err";
    banResult.textContent = "❌ " + err.message;
  }
});

/* =====================================================
   📢 نظام المنشورات والتقييمات
   ===================================================== */
const postsGrid = document.getElementById("postsGrid");
const createPostCard = document.getElementById("createPostCard");
const toggleCreatePost = document.getElementById("toggleCreatePost");
const postTitleInput = document.getElementById("postTitle");
const postContentInput = document.getElementById("postContent");
const btnCreatePost = document.getElementById("btnCreatePost");

let posts = [];
let ratings = [];

function renderPosts() {
  if (!postsGrid) return;
  if (!currentUser) {
    postsGrid.innerHTML = '<div class="card" style="text-align:center;color:#8a8ab0;">سجّل الدخول لرؤية المنشورات والتقييم</div>';
    return;
  }
  if (isBanned()) {
    postsGrid.innerHTML = '<div class="card" style="text-align:center;color:#ff7b9c;">⛔ حسابك محظور، لا يمكنك التفاعل مع المنشورات</div>';
    return;
  }

  postsGrid.innerHTML = posts
    .map((p) => {
      const userRating = ratings.find((r) => r.postId === p.id && r.userId === currentUser.uid);
      const postRatings = ratings.filter((r) => r.postId === p.id);
      const avgRating = postRatings.length > 0
        ? (postRatings.reduce((a, r) => a + r.rating, 0) / postRatings.length).toFixed(1)
        : "—";
      const stars = (n) => "★".repeat(Math.floor(n)) + "☆".repeat(5 - Math.floor(n));
      const isOwner = p.authorId === currentUser.uid;

      return `
        <div class="card post-card">
          <div class="post-meta">
            <span>${escapeHtml(p.authorName)}</span>
            <span>${new Date(p.createdAt?.toDate ? p.createdAt.toDate() : p.createdAt).toLocaleDateString("ar-SA")}</span>
            ${isOwner ? `<span class="a-banner">منشورك</span>` : ""}
          </div>
          <h3 style="margin-bottom:8px;color:#00ffa8;">${escapeHtml(p.title)}</h3>
          <div class="post-content">${escapeHtml(p.content)}</div>
          <div class="post-actions">
            <span>التقييم: ${stars(avgRating)} <span class="my-rating">${avgRating}</span></span>
            ${userRating
              ? `<span class="my-rating">تقييمك: ${userRating.rating}/5</span>`
              : [1,2,3,4,5].map((val) =>
                  `<button class="rate-btn" data-post="${p.id}" data-rating="${val}" title="تقييم ${val}">★${val}</button>`
                ).join("")}
          </div>
        </div>`;
    })
    .join("");

  postsGrid.querySelectorAll(".rate-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!requireNotBanned()) return;
      ratePost(btn.dataset.post, parseInt(btn.dataset.rating, 10));
    });
  });
}

async function ratePost(postId, rating) {
  if (!currentUser) return;
  if (!requireNotBanned()) return;
  if (rating < 1 || rating > 5) return;

  try {
    if (USING_FIREBASE) {
      const docId = `rating_${currentUser.uid}_${postId}`;
      await db.collection("ratings").doc(docId).set({
        postId,
        userId: currentUser.uid,
        userName: currentUser.username,
        rating,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      ratings = ratings.filter((r) => !(r.postId === postId && r.userId === currentUser.uid));
      ratings.push({ postId, userId: currentUser.uid, userName: currentUser.username, rating, createdAt: new Date() });
    }
    renderPosts();
  } catch (err) {
    alert("❌ خطأ في التقييم: " + err.message);
  }
}

async function createPost() {
  if (!currentUser) return;
  if (!requireNotBanned()) return;
  const title = sanitizeInput(postTitleInput.value);
  const content = sanitizeInput(postContentInput.value);
  if (!title || !content) return alert("❌ يرجى ملء العنوان والمحتوى");
  if (title.length > 100) return alert("❌ العنوان طويل جداً (100 حرف كحد أقصى)");
  if (content.length > 500) return alert("❌ المحتوى طويل جداً (500 حرف كحد أقصى)");

  try {
    if (USING_FIREBASE) {
      await db.collection("posts").add({
        title,
        content,
        authorId: currentUser.uid,
        authorName: currentUser.username,
        authorEmail: currentUser.email || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      posts.unshift({
        id: Date.now(),
        title,
        content,
        authorId: currentUser.uid,
        authorName: currentUser.username,
        createdAt: new Date(),
      });
    }
    postTitleInput.value = "";
    postContentInput.value = "";
    createPostCard.hidden = true;
  } catch (err) {
    alert("❌ خطأ في النشر: " + err.message);
  }
}

toggleCreatePost.addEventListener("click", () => {
  if (!currentUser) {
    openAuth("login");
    return;
  }
  createPostCard.hidden = !createPostCard.hidden;
});
btnCreatePost.addEventListener("click", createPost);

/* 🔥 تحديث المنشورات والتقييمات من Firebase */
if (USING_FIREBASE) {
  db.collection("posts")
    .orderBy("createdAt", "desc")
    .onSnapshot(
      (snap) => {
        posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderPosts();
        if (currentUser && currentUser.isAdmin) renderAdminPosts();
      },
      (err) => console.error("Posts listener error:", err)
    );

  db.collection("ratings")
    .onSnapshot(
      (snap) => {
        ratings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderPosts();
      },
      (err) => console.error("Ratings listener error:", err)
    );
}

/* =====================================================
   🛠️ إدارة المنشورات للأدمن
   ===================================================== */
const adminPostsList = document.getElementById("adminPostsList");

function renderAdminPosts() {
  if (!adminPostsList) return;
  adminPostsList.innerHTML = posts
    .map((p) => {
      const postRatings = ratings.filter((r) => r.postId === p.id);
      const avg = postRatings.length > 0
        ? (postRatings.reduce((a, r) => a + r.rating, 0) / postRatings.length).toFixed(1)
        : "—";
      return `
        <div class="admin-item">
          <div class="a-info">
            <strong class="a-name">${escapeHtml(p.title)}</strong>
            <span class="a-price">بởi: ${escapeHtml(p.authorName)}</span>
            <span class="a-reason">التقييم المتوسط: ${avg} (${postRatings.length} تقييم)</span>
          </div>
          <button class="del" data-id="${p.id}">🗑️ حذف المنشور</button>
        </div>`;
    })
    .join("");

  adminPostsList.querySelectorAll(".del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!requireAdmin()) return;
      if (!confirm("هل تريد حذف هذا المنشور؟")) return;
      if (USING_FIREBASE) {
        try { await db.collection("posts").doc(btn.dataset.id).delete(); } catch (err) { alert("خطأ: " + err.message); }
      } else {
        posts = posts.filter((p) => p.id !== btn.dataset.id);
        renderAdminPosts();
      }
    });
  });
}

/* =====================================================
   🔁 تبديل تبويبات الأدمن
   ===================================================== */
function renderAdminTabs() {
  if (!adminSection) return;
  const tabs = adminSection.querySelectorAll(".admin-tab");
  const contents = adminSection.querySelectorAll(".admin-tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      const target = document.getElementById("tab-" + tab.dataset.tab);
      if (target) target.classList.add("active");

      if (tab.dataset.tab === "banned") {
        loadUsersList().then(renderBannedList);
      }
      if (tab.dataset.tab === "posts") {
        renderAdminPosts();
      }
      if (tab.dataset.tab === "products") {
        renderAdminList();
      }
    });
  });
}

/* =====================================================
   🚀 تهيئة الصفحة
   ===================================================== */
document.getElementById("storeName").textContent = CONFIG.storeName + " 🚀";
document.getElementById("navStoreName").textContent = CONFIG.storeName + " 🚀";
document.title = CONFIG.storeName + " 🚀";

document.getElementById("enterBtn").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("store").scrollIntoView({ behavior: "smooth" });
});

updateAuthUI();
renderProducts();
renderAdminTabs();

/* =====================================================
   🌙 مشهد القمر والفضائي (يتكرر كل 14 ثانية)
   ===================================================== */
const CYCLE = 14000;
const TEXT = "هل أعجبكم الموقع؟ 👽💚";
const scene = document.getElementById("scene");
const bubble = document.getElementById("bubble");
let typeTimer = null;

function typeText() {
  bubble.textContent = "";
  let i = 0;
  const t = setInterval(() => {
    bubble.textContent += TEXT[i];
    i++;
    if (i >= TEXT.length) clearInterval(t);
  }, 90);
}

function playScene() {
  scene.classList.remove("run");
  void scene.offsetWidth;
  scene.classList.add("run");
  clearTimeout(typeTimer);
  bubble.textContent = "";
  typeTimer = setTimeout(typeText, 5600);
}

playScene();
setInterval(playScene, CYCLE);

/* =====================================================
   ✨ النجوم المتلألئة والشهب
   ===================================================== */
const cv = document.getElementById("stars");
const ctx = cv.getContext("2d");
let stars = [];
let meteors = [];

function resize() {
  cv.width = innerWidth;
  cv.height = innerHeight;
  stars = Array.from({ length: 250 }, () => ({
    x: Math.random() * cv.width,
    y: Math.random() * cv.height,
    r: 0.3 + Math.random() * 1.4,
    base: 0.3 + Math.random() * 0.7,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 2,
  }));
}
resize();
addEventListener("resize", resize);

setInterval(() => {
  meteors.push({
    x: Math.random() * cv.width * 0.7,
    y: Math.random() * cv.height * 0.3,
    vx: 4 + Math.random() * 4,
    vy: 2 + Math.random() * 2,
    life: 1,
  });
}, 5000);

function drawStars(time) {
  ctx.clearRect(0, 0, cv.width, cv.height);

  for (const s of stars) {
    const a = s.base * (0.5 + 0.5 * Math.sin(time * 0.001 * s.speed + s.phase));
    ctx.globalAlpha = a;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  meteors = meteors.filter((m) => m.life > 0);
  for (const m of meteors) {
    const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 12, m.y - m.vy * 12);
    grad.addColorStop(0, `rgba(255,255,255,${m.life})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth: 2;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x - m.vx * 12, m.y - m.vy * 12);
    ctx.stroke();
    m.x += m.vx;
    m.y += m.vy;
    m.life -= 0.02;
  }

  requestAnimationFrame(drawStars);
}
requestAnimationFrame(drawStars);

/* =====================================================
   🔒 ترجمة أخطاء Firebase إلى العربية
   ===================================================== */
function translateAuthError(error) {
  const code = (error && error.code) || "";
  if (code.includes("email-already-in-use")) return "❌ هذا البريد مستخدم مسبقاً";
  if (code.includes("weak-password")) return "❌ كلمة السر ضعيفة جداً";
  if (code.includes("user-not-found")) return "❌ المستخدم غير موجود";
  if (code.includes("wrong-password") || code.includes("invalid-credential"))
    return "❌ البريد أو كلمة السر غير صحيحة";
  if (code.includes("too-many-requests")) return "❌ محاولات كثيرة، انتظر قليلاً";
  if (code.includes("network-request-failed")) return "❌ تأكد من اتصالك بالإنترنت";
  if (code.includes("popup-closed-by-user")) return "❌ تم إغلاق نافذة تسجيل الدخول";
  return "❌ حدث خطأ: " + (error && error.message ? error.message : "غير معروف");
}