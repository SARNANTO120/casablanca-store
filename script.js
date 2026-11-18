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

  // 🔐 حساب الأدمن للوضع المحلي (قبل ربط Firebase)
  adminUsername: "king",
  adminPassword: "casa1990ccs@!",

  // 👑 بريد أخيك الإلكتروني — من يسجل به يصبح أدمن (وضع Firebase)
  // مثال: "brother@gmail.com"
  adminEmail: "",

  // 🔥 بيانات Firebase — الصقها هنا بعد إنشاء مشروعك
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
   🔥 الاتصال بـ Firebase (إن وُجدت البيانات)
   ===================================================== */
const USING_FIREBASE = !!CONFIG.firebaseConfig.apiKey;
let auth = null;
let db = null;

if (USING_FIREBASE) {
  firebase.initializeApp(CONFIG.firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
}

/* =====================================================
   🛍️ المنتجات الافتراضية (للوضع المحلي فقط — أول مرة)
   ===================================================== */
const DEFAULT_PRODUCTS = [
  { name: "تيشيرت فضائي", emoji: "👕", desc: "تيشيرت مريح بنقشة فضائية رائعة", price: 50 },
  { name: "ساعة المريخ",  emoji: "⌚", desc: "ساعة أنيقة مقاومة للماء", price: 120 },
  { name: "صاروخ لعبة",   emoji: "🚀", desc: "لعبة صاروخ تنطلق عالياً!", price: 35 },
];

/* =====================================================
   💾 التخزين المحلي (قبل ربط Firebase)
   ===================================================== */
const K_USERS = "space_users";
const K_PRODUCTS = "space_products";
const K_SESSION = "space_session";

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
    users = [{ username: CONFIG.adminUsername, password: CONFIG.adminPassword, isAdmin: true }];
    save(K_USERS, users);
  } else if (!users.some((u) => u.username === CONFIG.adminUsername)) {
    users.unshift({ username: CONFIG.adminUsername, password: CONFIG.adminPassword, isAdmin: true });
    save(K_USERS, users);
  }
}

// من المسجّل دخوله الآن؟ {username, email, isAdmin} أو null
let currentUser = null;

/* =====================================================
   🔧 أدوات صغيرة
   ===================================================== */
function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = String(text);
  return d.innerHTML;
}

function mapUsernameToEmail(username) {
  return username.toLowerCase() + "@space.store";
}

function translateAuthError(error) {
  const code = (error && error.code) || "";
  if (code.includes("email-already-in-use")) return "❌ اسم المستخدم موجود مسبقاً";
  if (code.includes("weak-password")) return "❌ كلمة السر ضعيفة (6 أحرف على الأقل)";
  if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential"))
    return "❌ اسم المستخدم أو كلمة السر غير صحيحة";
  if (code.includes("too-many-requests")) return "❌ محاولات كثيرة، انتظر قليلاً";
  return "❌ حدث خطأ، حاول مرة أخرى";
}

/* =====================================================
   🎨 تحديث الشريط العلوي حسب حالة الدخول
   ===================================================== */
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userChip = document.getElementById("userChip");
const navUserName = document.getElementById("navUserName");
const adminPanelBtn = document.getElementById("adminPanelBtn");
const adminSection = document.getElementById("adminSection");

function updateAuthUI() {
  loginBtn.hidden = !!currentUser;
  userChip.hidden = !currentUser;
  logoutBtn.hidden = !currentUser;
  adminPanelBtn.hidden = !(currentUser && currentUser.isAdmin);
  adminSection.hidden = !(currentUser && currentUser.isAdmin);
  navUserName.textContent = currentUser ? currentUser.username : "";
}

/* =====================================================
   🔑 نافذة الدخول / إنشاء الحساب
   ===================================================== */
const authModal = document.getElementById("authModal");
const authMsg = document.getElementById("authMsg");
const loginForm = document.getElementById("loginForm");
const regForm = document.getElementById("regForm");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");

function showMsg(text, ok = false) {
  authMsg.textContent = text;
  authMsg.classList.toggle("ok", ok);
  if (ok) setTimeout(() => (authMsg.textContent = ""), 2500);
}

function openAuth(mode = "login", message = "") {
  authModal.hidden = false;
  showMsg(message);
  switchTab(mode);
}
function closeAuth() {
  authModal.hidden = true;
  loginForm.reset();
  regForm.reset();
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

// تسجيل الدخول
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value;

  if (USING_FIREBASE) {
    try {
      const email = username.includes("@") ? username : mapUsernameToEmail(username);
      await auth.signInWithEmailAndPassword(email, password);
      closeAuth();
    } catch (err) {
      showMsg(translateAuthError(err));
    }
    return;
  }

  // الوضع المحلي
  const user = users.find((u) => u.username === username);
  if (!user || user.password !== password) {
    showMsg("❌ اسم المستخدم أو كلمة السر غير صحيحة");
    return;
  }
  currentUser = { username: user.username, email: null, isAdmin: !!user.isAdmin };
  save(K_SESSION, user.username);
  closeAuth();
  updateAuthUI();
  renderProducts();
});

// إنشاء حساب جديد (زائر)
regForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("regUser").value.trim();
  const pass1 = document.getElementById("regPass").value;
  const pass2 = document.getElementById("regPass2").value;

  if (pass1.length < 4) return showMsg("❌ كلمة السر يجب أن تكون 4 أحرف على الأقل");
  if (pass1 !== pass2) return showMsg("❌ كلمتا السر غير متطابقتين");

  if (USING_FIREBASE) {
    if (!username.includes("@") && !/^[a-zA-Z0-9_]{3,}$/.test(username))
      return showMsg("❌ اسم المستخدم: حروف إنجليزية وأرقام فقط (3 أحرف على الأقل)");
    try {
      const email = username.includes("@") ? username : mapUsernameToEmail(username);
      const cred = await auth.createUserWithEmailAndPassword(email, pass1);
      await cred.user.updateProfile({ displayName: username.includes("@") ? username.split("@")[0] : username });
      closeAuth();
    } catch (err) {
      showMsg(translateAuthError(err));
    }
    return;
  }

  // الوضع المحلي
  if (username.length < 3) return showMsg("❌ اسم المستخدم قصير جداً (3 أحرف على الأقل)");
  if (users.some((u) => u.username === username)) return showMsg("❌ اسم المستخدم موجود مسبقاً");

  const isAdmin = username === CONFIG.adminUsername;
  users.push({ username, password: pass1, isAdmin });
  save(K_USERS, users);
  currentUser = { username, email: null, isAdmin };
  save(K_SESSION, username);
  closeAuth();
  updateAuthUI();
});

logoutBtn.addEventListener("click", () => {
  if (USING_FIREBASE) {
    auth.signOut();
    return;
  }
  currentUser = null;
  localStorage.removeItem(K_SESSION);
  updateAuthUI();
  renderProducts();
});

adminPanelBtn.addEventListener("click", () => {
  adminSection.scrollIntoView({ behavior: "smooth" });
});

/* =====================================================
   🔥 حالة الدخول في Firebase
   ===================================================== */
if (USING_FIREBASE) {
  auth.onAuthStateChanged((user) => {
    if (user) {
      const email = user.email || "";
      currentUser = {
        username: user.displayName || email.split("@")[0],
        email,
        isAdmin: email.toLowerCase() === (CONFIG.adminEmail || "").toLowerCase(),
      };
    } else {
      currentUser = null;
    }
    updateAuthUI();
    renderProducts();
    if (currentUser && currentUser.isAdmin) renderAdminList();
  });
} else {
  // استعادة الجلسة المحلية
  const savedSession = load(K_SESSION, null);
  if (savedSession) {
    const u = users.find((x) => x.username === savedSession);
    if (u) currentUser = { username: u.username, email: null, isAdmin: !!u.isAdmin };
  }
}

/* =====================================================
   🛒 عرض المنتجات + الشراء
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
      <button class="buy">🛒 شراء الآن</button>
    </div>`;
}

function renderProducts() {
  grid.innerHTML = products.map(productCard).join("");
}

// عند الضغط على "شراء": الزبون ينتقل تلقائياً لموقع المحل
grid.addEventListener("click", (e) => {
  if (!e.target.classList.contains("buy")) return;
  if (!currentUser) {
    openAuth("login", "سجّل الدخول أولاً لتتمكن من الشراء 🛒");
    return;
  }
  window.open(CONFIG.shopUrl, "_blank"); // 👈 يخرج مباشرة لموقع المحل
});

// 🔥 استقبال المنتجات لحظة بلحظة من Firebase
if (USING_FIREBASE) {
  db.collection("products")
    .orderBy("createdAt", "desc")
    .onSnapshot(
      (snap) => {
        products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderProducts();
        if (currentUser && currentUser.isAdmin) renderAdminList();
      },
      (err) => console.error(err)
    );
}

/* =====================================================
   🛠️ لوحة الأدمن: نشر منتجات بالاسم والصورة
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

// 📷 اختيار صورة من الجهاز + تصغيرها تلقائياً
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

// ➕ نشر المنتج
addProductForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const price = parseFloat(pPrice.value);
  if (isNaN(price) || price < 0) return alert("اكتب سعراً صحيحاً!");
  if (pendingImage && pendingImage.length > 900000) {
    return alert("الصورة كبيرة جداً، اختر صورة أصغر!");
  }

  const data = {
    name: pName.value.trim(),
    price,
    desc: pDesc.value.trim(),
    emoji: pEmoji.value.trim(),
    image: pendingImage,
  };

  if (USING_FIREBASE) {
    try {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
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

  // تنظيف النموذج
  addProductForm.reset();
  pendingImage = "";
  imgPreview.hidden = true;
  pImage.value = "";
});

// 🗑️ حذف منتج
adminList.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("del")) return;
  const id = e.target.dataset.id;
  if (!confirm("هل تريد حذف هذا المنتج؟")) return;

  if (USING_FIREBASE) {
    try {
      await db.collection("products").doc(id).delete();
    } catch (err) {
      alert("خطأ في الحذف: " + err.message);
    }
  } else {
    products = products.filter((p) => String(p.id) !== id);
    save(K_PRODUCTS, products);
    renderProducts();
    renderAdminList();
  }
});

function renderAdminList() {
  adminList.innerHTML = products
    .map((p) => {
      const visual = p.image
        ? `<img src="${p.image}" alt="">`
        : `<span class="a-emoji">${p.emoji || "🛍️"}</span>`;
      return `
        <div class="admin-item">
          ${visual}
          <div class="a-info">
            <strong>${escapeHtml(p.name)}</strong>
            <span class="a-price">${p.price} ${CONFIG.currency}</span>
          </div>
          <button class="del" data-id="${p.id}">🗑️ حذف</button>
        </div>`;
    })
    .join("");
}

/* =====================================================
   🚀 تشغيل الصفحة
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
if (!USING_FIREBASE) renderAdminList();

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
    ctx.lineWidth = 2;
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