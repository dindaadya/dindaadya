// ================================================================
// script.js — Bidang Transmigrasi Kabupaten Sijunjung
// Hubungkan ke Google Apps Script
// ================================================================
// WAJIB DIISI: Ganti URL ini setelah deploy Apps Script
// ================================================================
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyYQRDGaxG5D-ho5G-TsGgfzVuyZn5wK1nAFMf606gvNmeOPzOSJjRMVF6UeRuJ8IaMLw/exec";
// Contoh:
// "https://script.google.com/macros/s/AKfycb.../exec"

// ================================================================
// KREDENSIAL LOGIN
// ================================================================
const VALID_USERS = [
  { username: "alvin",       password: "alvin12345" },
  { username: "fadhlanganteng", password: "fadhlan12345" },
  { username: "tammy",       password: "tammy12345" },
  { username: "fauzan",      password: "fauzan12345" },
  { username: "deden",       password: "deden12345" },
  { username: "dinda",       password: "dinda12345" },
  { username: "nadea",       password: "nadea12345" },
  { username: "arni",        password: "arni12345" },
  { username: "resti",       password: "resti12345" },
  { username: "melani",      password: "melani12345" },
  { username: "sucipta",     password: "sucipta12345" },
  { username: "agrestesia",  password: "agrestesia12345" },
];

// ================================================================
// ROUTING — menampilkan/menyembunyikan halaman
// ================================================================
const pages = {
  landing  : document.getElementById("page-landing"),
  login    : document.getElementById("page-login"),
  dashboard: document.getElementById("page-dashboard"),
};

function showLanding() {
  pages.landing.style.display   = "block";
  pages.login.style.display     = "none";
  pages.dashboard.style.display = "none";
  window.scrollTo(0, 0);
  feather.replace();
}

function showLogin() {
  pages.landing.style.display   = "none";
  pages.login.style.display     = "flex";
  pages.dashboard.style.display = "none";
  lucide.createIcons();
  document.getElementById("l-user").focus();
}

function showDashboard() {
  pages.landing.style.display   = "none";
  pages.login.style.display     = "none";
  pages.dashboard.style.display = "block";
  lucide.createIcons();
  dGotoPage("input");
  dRefreshData();
  // Terapkan tema tersimpan
  const saved = localStorage.getItem("d-theme");
  if (saved === "light") {
    document.getElementById("page-dashboard").classList.add("light-mode");
    const icon = document.getElementById("d-theme-icon");
    const lbl  = document.getElementById("d-theme-label");
    if (icon) icon.setAttribute("data-lucide", "moon");
    if (lbl)  lbl.textContent = "Mode Gelap";
    lucide.createIcons();
  }
}

// ================================================================
// LANDING PAGE — Hamburger menu
// ================================================================
const navbarNav = document.querySelector(".navbar-nav");
const hamburger = document.querySelector("#hamburger-menu");

hamburger.onclick = () => navbarNav.classList.toggle("active");

document.addEventListener("click", function (e) {
  if (!hamburger.contains(e.target) && !navbarNav.contains(e.target)) {
    navbarNav.classList.remove("active");
  }
});

// ================================================================
// LOGIN
// ================================================================
function doLogin() {
  const username = document.getElementById("l-user").value.trim();
  const password = document.getElementById("l-pass").value;
  const errEl    = document.getElementById("login-err");
  const btnEl    = document.getElementById("login-btn-el");
  const btnTxt   = document.getElementById("login-btn-txt");

  errEl.style.display = "none";

  if (!username || !password) {
    document.getElementById("login-err-msg").textContent =
      "Username dan password wajib diisi.";
    errEl.style.display = "flex";
    return;
  }

  btnEl.disabled     = true;
  btnTxt.textContent = "Memverifikasi...";

  setTimeout(() => {
    const valid = VALID_USERS.find(
      (u) => u.username === username && u.password === password
    );
    if (valid) {
      sessionStorage.setItem("logged_in", "1");
      sessionStorage.setItem("username", username);
      btnTxt.textContent = "Masuk";
      btnEl.disabled     = false;
      document.getElementById("l-pass").value = "";
      showDashboard();
    } else {
      document.getElementById("login-err-msg").textContent =
        "Username atau password salah.";
      errEl.style.display = "flex";
      btnTxt.textContent  = "Masuk";
      btnEl.disabled      = false;
    }
  }, 600);
}

// Eye toggle password
document.getElementById("eye-btn").onclick = function () {
  const p    = document.getElementById("l-pass");
  const show = p.type === "password";
  p.type     = show ? "text" : "password";
  document
    .getElementById("eye-ic")
    .setAttribute("data-lucide", show ? "eye-off" : "eye");
  lucide.createIcons();
};

// ================================================================
// DASHBOARD — State
// ================================================================
let dKkData      = [];
let dAngData     = [];
let dStats       = {};
let dCurrentPage = "input";
let dSelectedJK  = {};
let dAngKKTarget = null;
let dCharts      = {};
let dEditTarget  = null;

// ================================================================
// DASHBOARD — API (Google Apps Script)
// ================================================================
async function dApiCall(body) {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify(body),
    });
    // Apps Script kadang return redirect, tangani dengan mode no-cors jika perlu
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (e) {
    return { success: false, message: "Gagal menghubungi server: " + e.message };
  }
}

async function dRefreshData() {
  const icon = document.getElementById("d-refresh-icon");
  if (icon) icon.style.animation = "dSpin .7s linear infinite";
  dSetSyncStatus("loading");

  const r = await dApiCall({ action: "get_all" });

  if (icon) icon.style.animation = "";

  if (r.success) {
    dKkData  = r.kk      || [];
    dAngData = r.anggota || [];
    dStats   = r.stats   || {};
    dSetSyncStatus("ok");
    if (dCurrentPage === "rekap")  dRenderRekap();
    if (dCurrentPage === "daftar") dRenderDaftar();
    dUpdateStatCards();
  } else {
    dSetSyncStatus("error");
    dShowToast("Gagal memuat data: " + (r.message || ""), true);
  }
}

function dSetSyncStatus(state) {
  const el = document.getElementById("d-sync-status");
  if (!el) return;
  if (state === "ok")
    el.innerHTML =
      '<i data-lucide="cloud-check" style="width:13px;height:13px;color:var(--green)"></i>' +
      '<span style="color:var(--green)">Terhubung ke Sheets</span>';
  else if (state === "loading")
    el.innerHTML =
      '<div class="d-spinner" style="width:12px;height:12px"></div>' +
      "<span>Menyinkron...</span>";
  else
    el.innerHTML =
      '<i data-lucide="cloud-off" style="width:13px;height:13px;color:var(--red)"></i>' +
      '<span style="color:var(--red)">Gagal terhubung</span>';
  lucide.createIcons();
}

// ================================================================
// DASHBOARD — Navigasi
// ================================================================
function dGotoPage(page) {
  dCurrentPage = page;
  ["input", "anggota", "rekap", "cari", "daftar"].forEach((p) => {
    const pageEl = document.getElementById("d-page-" + p);
    if (pageEl) pageEl.style.display = p === page ? "block" : "none";
    const btn = document.getElementById("d-nav-" + p);
    if (btn) btn.classList.toggle("active", p === page);
  });
  if (page === "rekap")  dRefreshData();
  if (page === "daftar") dRefreshData();
  lucide.createIcons();
}

// ================================================================
// DASHBOARD — JK Toggle
// ================================================================
function dSetJK(val, idA, idB) {
  const key = idA.replace(/-L$/, "");
  dSelectedJK[key] = val;
  [idA, idB].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle("selected", id.endsWith("-" + val));
  });
}
function dGetJK(prefix) {
  return dSelectedJK[prefix] || "";
}

// ================================================================
// DASHBOARD — Simpan KK
// ================================================================
async function dSimpanKK() {
  const nama    = document.getElementById("inp-nama").value.trim();
  const nokk    = document.getElementById("inp-nokk").value.trim();
  const nik     = document.getElementById("inp-nik").value.trim();
  const pend    = document.getElementById("inp-pendidikan").value;
  const wil     = document.getElementById("inp-wilayah").value.trim();
  const gdrv    = document.getElementById("inp-gdrive").value.trim();
  const gdrvKtp = document.getElementById("inp-gdrive-ktp").value.trim();
  const jk      = dGetJK("jk");

  if (!nama)              return dShowToast("Nama wajib diisi", true);
  if (nokk.length !== 16) return dShowToast("Nomor KK harus 16 digit", true);
  if (nik.length  !== 16) return dShowToast("NIK harus 16 digit", true);
  if (!jk)                return dShowToast("Pilih jenis kelamin", true);
  if (!pend)              return dShowToast("Pilih pendidikan terakhir", true);

  const btn = document.getElementById("d-btn-simpan");
  const txt = document.getElementById("d-btn-simpan-text");
  btn.disabled     = true;
  txt.textContent  = "Menyimpan...";

  const r = await dApiCall({
    action: "simpan_kk",
    data  : {
      nokk,
      nama_kk       : nama,
      nik_kk        : nik,
      jenis_kelamin : jk,
      pendidikan    : pend,
      wilayah       : wil,
      gdrive_link   : gdrv,
      gdrive_ktp_link: gdrvKtp,
    },
  });

  btn.disabled    = false;
  txt.textContent = "Simpan ke Spreadsheet";

  if (r.success) {
    dShowToast("✓ Data KK berhasil disimpan!");
    dResetFormKK();
    dRefreshData();
  } else {
    dShowToast(r.message || "Gagal menyimpan", true);
  }
}

function dResetFormKK() {
  ["inp-nama", "inp-nokk", "inp-nik", "inp-gdrive", "inp-gdrive-ktp"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("inp-pendidikan").value = "";
  document.getElementById("inp-wilayah").value    = "";
  dSelectedJK["jk"] = "";
  ["jk-L", "jk-P"].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.classList.remove("selected");
  });
}

// ================================================================
// DASHBOARD — Tambah Anggota
// ================================================================
async function dCariKKUntukAnggota() {
  const nokk = document.getElementById("cari-nokk-ang").value.trim();
  dAngKKTarget = null;
  document.getElementById("d-kk-found").style.display    = "none";
  document.getElementById("d-kk-notfound").style.display = "none";
  document.getElementById("d-form-anggota").style.display = "none";

  if (nokk.length < 6) return;

  let found = dKkData.find((k) => k.nokk === nokk);
  if (!found) {
    await dRefreshData();
    found = dKkData.find((k) => k.nokk === nokk);
  }

  if (found) {
    dAngKKTarget = found;
    const cnt = dAngData.filter((a) => a.nokk === nokk).length;
    document.getElementById("d-kk-found-nama").textContent =
      found.nama_kk;
    document.getElementById("d-kk-found-info").textContent =
      "No.KK: " + nokk + " · Anggota tercatat: " + cnt + " orang";
    document.getElementById("d-kk-found").style.display     = "flex";
    document.getElementById("d-form-anggota").style.display = "block";
  } else if (nokk.length >= 10) {
    document.getElementById("d-kk-notfound").style.display = "block";
  }
  lucide.createIcons();
}

async function dSimpanAnggota() {
  if (!dAngKKTarget) return dShowToast("Cari KK terlebih dahulu", true);

  const nama = document.getElementById("ang-nama").value.trim();
  const nik  = document.getElementById("ang-nik").value.trim();
  const hub  = document.getElementById("ang-hubungan").value;
  const pend = document.getElementById("ang-pendidikan").value;
  const jk   = dGetJK("ang-jk");

  if (!nama)             return dShowToast("Nama anggota wajib diisi", true);
  if (nik.length !== 16) return dShowToast("NIK harus 16 digit", true);
  if (!hub)              return dShowToast("Pilih hubungan keluarga", true);

  const btn = document.getElementById("d-btn-ang");
  const txt = document.getElementById("d-btn-ang-text");
  btn.disabled    = true;
  txt.textContent = "Menyimpan...";

  const r = await dApiCall({
    action: "simpan_anggota",
    data  : {
      nokk          : dAngKKTarget.nokk,
      nama_anggota  : nama,
      nik_anggota   : nik,
      hubungan      : hub,
      jenis_kelamin : jk,
      pendidikan    : pend,
    },
  });

  btn.disabled    = false;
  txt.textContent = "Tambah Anggota";

  if (r.success) {
    dShowToast("✓ Anggota berhasil ditambahkan!");
    ["ang-nama", "ang-nik"].forEach(
      (id) => (document.getElementById(id).value = "")
    );
    document.getElementById("ang-hubungan").value  = "";
    document.getElementById("ang-pendidikan").value = "";
    dSelectedJK["ang-jk"] = "";
    ["ang-jk-L", "ang-jk-P"].forEach((id) => {
      const b = document.getElementById(id);
      if (b) b.classList.remove("selected");
    });
    dCariKKUntukAnggota();
    dRefreshData();
  } else {
    dShowToast(r.message || "Gagal", true);
  }
}

// ================================================================
// DASHBOARD — Rekap / Charts
// ================================================================
function dUpdateStatCards() {
  const stKK  = document.getElementById("d-st-kk");
  const stW   = document.getElementById("d-st-warga");
  const stB   = document.getElementById("d-st-berkas");
  const stA   = document.getElementById("d-st-anggota");

  if (stKK) stKK.textContent = dStats.total_kk       ?? dKkData.length;
  if (stW)  stW.textContent  = dStats.total_warga    ?? dKkData.length + dAngData.length;
  if (stB)  stB.textContent  = dStats.kk_dengan_berkas ?? dKkData.filter((k) => k.has_berkas === "Ya").length;
  if (stA)  stA.textContent  = dStats.total_anggota  ?? dAngData.length;
}

function dRenderRekap() {
  dUpdateStatCards();
  if (!dKkData.length) return;

  const GOLD = "#c9974a", TEAL = "#6ee7b7", ROSE = "#f87171", BLUE = "#93c5fd";

  const base = {
    responsive           : true,
    maintainAspectRatio  : false,
    plugins: {
      legend: {
        labels: {
          color: "#e8c98a",
          font : { family: "Plus Jakarta Sans", size: 11 },
          boxWidth: 14,
        },
      },
    },
  };
  const axisOpts = {
    scales: {
      x: { ticks: { color: "#e8c98a88", font: { size: 10 } }, grid: { color: "#c9974a18" } },
      y: { ticks: { color: "#e8c98a88", font: { size: 10 } }, grid: { color: "#c9974a18" } },
    },
  };

  // Jenis Kelamin
  const jkMap = { "Laki-laki": 0, Perempuan: 0 };
  dKkData.forEach((k) => {
    if (k.jenis_kelamin === "L") jkMap["Laki-laki"]++;
    else jkMap["Perempuan"]++;
  });
  dBuildChart("d-chart-jk", "doughnut", Object.keys(jkMap), Object.values(jkMap), [GOLD, ROSE], base);

  // Pendidikan
  const pendMap = {};
  dKkData.forEach((k) => {
    const p = k.pendidikan || "N/A";
    pendMap[p] = (pendMap[p] || 0) + 1;
  });
  dBuildChart("d-chart-pend", "bar", Object.keys(pendMap), Object.values(pendMap), GOLD, {
    ...base, ...axisOpts,
    plugins: { ...base.plugins, legend: { display: false } },
  });

  // Status Berkas
  const ada = dKkData.filter((k) => k.has_berkas === "Ya").length;
  dBuildChart(
    "d-chart-berkas", "doughnut",
    ["Ada Berkas", "Belum Ada"],
    [ada, dKkData.length - ada],
    [TEAL, "#444"],
    base
  );

  // Anggota per KK
  const angBin = { "1": 0, "2–3": 0, "4–5": 0, "6+": 0 };
  dKkData.forEach((k) => {
    const n = 1 + dAngData.filter((a) => a.nokk === k.nokk).length;
    if      (n === 1) angBin["1"]++;
    else if (n <= 3)  angBin["2–3"]++;
    else if (n <= 5)  angBin["4–5"]++;
    else              angBin["6+"]++;
  });
  dBuildChart("d-chart-ang", "bar", Object.keys(angBin), Object.values(angBin), BLUE, {
    ...base, ...axisOpts,
    plugins: { ...base.plugins, legend: { display: false } },
  });
}

function dBuildChart(id, type, labels, data, color, opts) {
  if (dCharts[id]) dCharts[id].destroy();
  const ctx = document.getElementById(id);
  if (!ctx) return;
  dCharts[id] = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor : Array.isArray(color) ? color : data.map(() => color),
        borderColor     : "transparent",
        borderRadius    : type === "bar" ? 6 : 0,
        borderWidth     : 0,
        hoverOffset     : 6,
      }],
    },
    options: { ...opts, responsive: true, maintainAspectRatio: false },
  });
}

// ================================================================
// DASHBOARD — Cari Data
// ================================================================
async function dDoSearch() {
  const q = document.getElementById("d-q").value.trim();
  if (!q) return;

  document.getElementById("d-cari-hint").style.display    = "none";
  document.getElementById("d-cari-empty").style.display   = "none";
  document.getElementById("d-cari-results").innerHTML     = "";
  document.getElementById("d-cari-loading").style.display = "block";

  const r = await dApiCall({ action: "cari", query: q });
  document.getElementById("d-cari-loading").style.display = "none";

  if (!r.success || !r.results || !r.results.length) {
    document.getElementById("d-cari-empty").style.display = "block";
    return;
  }

  document.getElementById("d-cari-results").innerHTML = r.results
    .map((kk) => {
      const jkBadge =
        kk.jenis_kelamin === "L"
          ? '<span class="d-badge d-badge-l">♂ Laki-laki</span>'
          : '<span class="d-badge d-badge-p">♀ Perempuan</span>';
      const berkBadge =
        kk.has_berkas === "Ya"
          ? '<span class="d-badge d-badge-ya">✓ Ada Berkas</span>'
          : '<span class="d-badge d-badge-tidak">✗ Belum</span>';
      return `<div class="d-card d-slide-up" style="padding:1.25rem">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem">
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.25rem">
        <span style="font-weight:700">${kk.nama_kk}</span>${jkBadge} ${berkBadge}
      </div>
      <p class="d-mono" style="font-size:.75rem;margin-bottom:.125rem;color:var(--text-dim)">No. KK: ${kk.nokk}</p>
      <p style="font-size:.75rem;color:var(--text-dim)">NIK: ${kk.nik_kk} · ${kk.pendidikan} · ${kk.wilayah || "—"}</p>
      <p style="font-size:.75rem;margin-top:.25rem;color:var(--text-dim)">${(kk.anggota || []).length} anggota tercatat</p>
      ${kk.gdrive_link ? `<a href="${kk.gdrive_link}" target="_blank" style="font-size:.75rem;margin-top:.25rem;display:inline-flex;align-items:center;gap:.25rem;margin-right:.75rem;color:var(--gold)"><i data-lucide="external-link" style="width:12px;height:12px"></i>Buka Berkas KK</a>` : ""}
      ${kk.gdrive_ktp_link ? `<a href="${kk.gdrive_ktp_link}" target="_blank" style="font-size:.75rem;display:inline-flex;align-items:center;gap:.25rem;color:var(--gold)"><i data-lucide="id-card" style="width:12px;height:12px"></i>Buka KTP</a>` : ""}
    </div>
    <button onclick='dShowDetail(${JSON.stringify(kk).replace(/'/g, "&#39;")})' class="d-btn-ghost" style="font-size:.75rem;padding:.375rem .75rem;flex-shrink:0">Detail</button>
  </div>
</div>`;
    })
    .join("");
  lucide.createIcons();
}

// ================================================================
// DASHBOARD — Daftar KK (tabel)
// ================================================================
function dRenderDaftar() {
  const tbody = document.getElementById("d-tbl-body");
  const empty = document.getElementById("d-daftar-empty");
  if (!tbody) return;

  const q = (document.getElementById("d-filter-daftar")?.value || "").toLowerCase();
  const filtered = dKkData.filter(
    (k) => !q || k.nokk.includes(q) || k.nama_kk.toLowerCase().includes(q)
  );

  if (!filtered.length) {
    tbody.innerHTML       = "";
    empty.style.display   = "block";
    return;
  }
  empty.style.display = "none";
  tbody.innerHTML = filtered
    .map((kk) => {
      const cnt = dAngData.filter((a) => a.nokk === kk.nokk).length;
      return `<tr>
  <td class="d-mono" style="color:var(--text-dim)">${kk.nokk}</td>
  <td style="font-weight:500">${kk.nama_kk}</td>
  <td class="d-mono" style="font-size:.75rem;color:var(--text-dim)">${kk.nik_kk}</td>
  <td>${kk.jenis_kelamin === "L" ? '<span class="d-badge d-badge-l">L</span>' : '<span class="d-badge d-badge-p">P</span>'}</td>
  <td style="font-size:.75rem;color:var(--text-dim)">${kk.pendidikan}</td>
  <td style="font-size:.75rem;color:var(--text-dim)">${kk.wilayah || "—"}</td>
  <td>${kk.has_berkas === "Ya" ? '<span class="d-badge d-badge-ya">Ya</span>' : '<span class="d-badge d-badge-tidak">Tidak</span>'}</td>
  <td>${kk.gdrive_ktp_link ? '<span class="d-badge d-badge-ya">Ya</span>' : '<span class="d-badge d-badge-tidak">Tidak</span>'}</td>
  <td style="text-align:center">${1 + cnt}</td>
  <td>
    <div style="display:flex;gap:.375rem">
      <button onclick='dOpenEdit(${JSON.stringify(kk).replace(/'/g, "&#39;")})' class="d-btn-ghost" style="font-size:.75rem;padding:.375rem .625rem">Edit</button>
      <button onclick="dHapusKK('${kk.nokk}')" style="padding:.375rem .625rem;font-size:.75rem;border-radius:.5rem;background:rgba(248,113,113,.1);color:var(--red);border:1px solid rgba(248,113,113,.2);cursor:pointer">Hapus</button>
    </div>
  </td>
</tr>`;
    })
    .join("");
  lucide.createIcons();
}

function dFilterDaftar() { dRenderDaftar(); }

// ================================================================
// DASHBOARD — Hapus KK
// ================================================================
async function dHapusKK(nokk) {
  if (!confirm(
    "Hapus data KK " + nokk + " beserta seluruh anggotanya?\nTindakan ini tidak dapat dibatalkan!"
  )) return;

  const r = await dApiCall({ action: "hapus_kk", nokk });
  if (r.success) {
    dShowToast("Data KK berhasil dihapus");
    dRefreshData();
  } else {
    dShowToast(r.message || "Gagal menghapus", true);
  }
}

// ================================================================
// DASHBOARD — Edit KK
// ================================================================
function dOpenEdit(kk) {
  dEditTarget = kk;
  document.getElementById("d-edit-id").value          = kk.id;
  document.getElementById("d-edit-nama").value         = kk.nama_kk;
  document.getElementById("d-edit-nik").value          = kk.nik_kk;
  document.getElementById("d-edit-pend").value         = kk.pendidikan;
  document.getElementById("d-edit-wilayah").value      = kk.wilayah     || "";
  document.getElementById("d-edit-gdrive").value       = kk.gdrive_link || "";
  document.getElementById("d-edit-gdrive-ktp").value   = kk.gdrive_ktp_link || "";

  dSelectedJK["d-edit-jk"] = kk.jenis_kelamin;
  ["d-edit-jk-L", "d-edit-jk-P"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle("selected", id.endsWith("-" + kk.jenis_kelamin));
  });

  document.getElementById("d-modal-edit").style.display = "flex";
  lucide.createIcons();
}

async function dSaveEdit() {
  const btn = document.getElementById("d-btn-edit-save");
  btn.disabled     = true;
  btn.textContent  = "Menyimpan...";

  const r = await dApiCall({
    action: "update_kk",
    data  : {
      id              : document.getElementById("d-edit-id").value,
      nama_kk         : document.getElementById("d-edit-nama").value.trim(),
      nik_kk          : document.getElementById("d-edit-nik").value.trim(),
      jenis_kelamin   : dGetJK("d-edit-jk"),
      pendidikan      : document.getElementById("d-edit-pend").value,
      wilayah         : document.getElementById("d-edit-wilayah").value.trim(),
      gdrive_link     : document.getElementById("d-edit-gdrive").value.trim(),
      gdrive_ktp_link : document.getElementById("d-edit-gdrive-ktp").value.trim(),
    },
  });

  btn.disabled    = false;
  btn.textContent = "Simpan Perubahan";

  if (r.success) {
    dShowToast("Data berhasil diperbarui");
    dCloseModalEdit();
    dRefreshData();
  } else {
    dShowToast(r.message || "Gagal", true);
  }
}

function dCloseModalEdit() {
  document.getElementById("d-modal-edit").style.display = "none";
  dEditTarget = null;
}

// ================================================================
// DASHBOARD — Detail Modal
// ================================================================
function dShowDetail(kk) {
  const anggota = kk.anggota || dAngData.filter((a) => a.nokk === kk.nokk);

  document.getElementById("d-modal-content").innerHTML = `
<div style="display:flex;flex-direction:column;gap:1rem;font-size:.875rem">
  <div style="border-radius:.75rem;padding:1rem;background:var(--gold-dim2);border:1px solid var(--border)">
    <p style="font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.75rem;font-weight:700;color:var(--text-dim)">Kepala Keluarga</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem 1rem">
      <div><p style="font-size:.7rem;color:var(--text-dim)">Nama</p><p style="font-weight:600">${kk.nama_kk}</p></div>
      <div><p style="font-size:.7rem;color:var(--text-dim)">No. KK</p><p class="d-mono">${kk.nokk}</p></div>
      <div><p style="font-size:.7rem;color:var(--text-dim)">NIK</p><p class="d-mono">${kk.nik_kk}</p></div>
      <div><p style="font-size:.7rem;color:var(--text-dim)">JK</p><p>${kk.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</p></div>
      <div><p style="font-size:.7rem;color:var(--text-dim)">Pendidikan</p><p>${kk.pendidikan}</p></div>
      <div><p style="font-size:.7rem;color:var(--text-dim)">Wilayah</p><p>${kk.wilayah || "—"}</p></div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:.75rem;margin-top:.75rem">
      ${kk.gdrive_link     ? `<a href="${kk.gdrive_link}" target="_blank" style="display:inline-flex;align-items:center;gap:.375rem;font-size:.75rem;font-weight:600;color:var(--gold)"><i data-lucide="external-link" style="width:13px;height:13px"></i>Buka Berkas KK</a>` : ""}
      ${kk.gdrive_ktp_link ? `<a href="${kk.gdrive_ktp_link}" target="_blank" style="display:inline-flex;align-items:center;gap:.375rem;font-size:.75rem;font-weight:600;color:var(--gold)"><i data-lucide="id-card" style="width:13px;height:13px"></i>Buka KTP</a>` : ""}
    </div>
  </div>
  ${
    anggota.length
      ? `<div>
    <p style="font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.75rem;font-weight:700;color:var(--text-dim)">Anggota (${anggota.length} orang)</p>
    <div style="display:flex;flex-direction:column;gap:.5rem">
      ${anggota.map((a) => `
      <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem;border-radius:.75rem;background:var(--gold-dim2)">
        <div style="width:2rem;height:2rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.875rem;flex-shrink:0;background:var(--gold-dim);color:var(--gold)">${a.nama_anggota?.[0] || "?"}</div>
        <div style="flex:1;min-width:0">
          <p style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.nama_anggota}</p>
          <p style="font-size:.75rem;color:var(--text-dim)">${a.hubungan} · ${a.jenis_kelamin_label || "—"} · NIK: ${a.nik_anggota}</p>
          ${a.pendidikan ? `<p style="font-size:.75rem;color:var(--text-dim)">${a.pendidikan}</p>` : ""}
        </div>
      </div>`).join("")}
    </div>
  </div>`
      : `<p style="font-size:.75rem;color:var(--text-dim)">Belum ada anggota yang ditambahkan</p>`
  }
</div>`;

  document.getElementById("d-modal").style.display = "flex";
  lucide.createIcons();
}

function dCloseModal() {
  document.getElementById("d-modal").style.display = "none";
}

// Tutup modal saat klik backdrop
document.getElementById("d-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) dCloseModal();
});
document.getElementById("d-modal-edit").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) dCloseModalEdit();
});

// ================================================================
// DASHBOARD — Theme toggle
// ================================================================
function dToggleTheme() {
  const dash    = document.getElementById("page-dashboard");
  const isLight = dash.classList.toggle("light-mode");
  localStorage.setItem("d-theme", isLight ? "light" : "dark");
  document
    .getElementById("d-theme-icon")
    .setAttribute("data-lucide", isLight ? "moon" : "sun");
  document.getElementById("d-theme-label").textContent = isLight
    ? "Mode Gelap"
    : "Mode Terang";
  lucide.createIcons();
}

// ================================================================
// DASHBOARD — Logout
// ================================================================
function doLogout() {
  if (!confirm(
    "Keluar dari aplikasi?\nSemua data tersimpan di Google Spreadsheet dan tidak akan hilang."
  )) return;

  sessionStorage.removeItem("logged_in");
  sessionStorage.removeItem("username");
  dKkData  = [];
  dAngData = [];
  dStats   = {};
  dShowToast("Berhasil logout. Sampai jumpa!");
  setTimeout(() => showLanding(), 1200);
}

// ================================================================
// DASHBOARD — Toast Notification
// ================================================================
let dToastTimer;
function dShowToast(msg, isError = false) {
  const t = document.getElementById("d-toast");
  t.textContent = msg;
  t.className   = "d-fade-in " + (isError ? "error" : "");
  t.id          = "d-toast";
  t.style.display = "block";
  clearTimeout(dToastTimer);
  dToastTimer = setTimeout(() => {
    t.style.display = "none";
  }, 3500);
}

// ================================================================
// INIT — cek sesi saat halaman dimuat
// ================================================================
window.addEventListener("DOMContentLoaded", () => {
  if (sessionStorage.getItem("logged_in") === "1") {
    showDashboard();
  } else {
    showLanding();
    feather.replace();
    lucide.createIcons();
  }
});
