// ================================================================
// Code.gs — Google Apps Script Backend
// Bidang Transmigrasi Kabupaten Sijunjung
// ================================================================
// CARA SETUP:
// 1. Buka https://script.google.com → New Project
// 2. Paste seluruh kode ini, ganti SPREADSHEET_ID di bawah
// 3. Deploy → New deployment → Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 4. Salin URL deployment → paste ke APPS_SCRIPT_URL di script.js
// ================================================================

const SPREADSHEET_ID = "GANTI_DENGAN_ID_SPREADSHEET_ANDA";
// Contoh: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
// ID ada di URL spreadsheet: docs.google.com/spreadsheets/d/[ID]/edit

const SHEET_KK      = "DataKK";      // Nama sheet untuk Kepala Keluarga
const SHEET_ANGGOTA = "Anggota";     // Nama sheet untuk Anggota Keluarga

// ----------------------------------------------------------------
// HEADERS — urutan kolom di Spreadsheet
// ----------------------------------------------------------------
const HEADERS_KK = [
  "ID", "No_KK", "Nama_KK", "NIK_KK", "Jenis_Kelamin",
  "Pendidikan", "Wilayah", "GDrive_KK", "GDrive_KTP",
  "Has_Berkas", "Timestamp"
];

const HEADERS_ANGGOTA = [
  "ID", "No_KK", "Nama_Anggota", "NIK_Anggota",
  "Hubungan", "Jenis_Kelamin", "Pendidikan", "Timestamp"
];

// ================================================================
// ENTRY POINT — semua request masuk lewat sini
// ================================================================
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;
    let result   = { success: false, message: "Action tidak dikenal" };

    if      (action === "get_all")       result = getAllData();
    else if (action === "simpan_kk")     result = simpanKK(body.data);
    else if (action === "simpan_anggota")result = simpanAnggota(body.data);
    else if (action === "cari")          result = cariData(body.query);
    else if (action === "hapus_kk")      result = hapusKK(body.nokk);
    else if (action === "update_kk")     result = updateKK(body.data);

    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({
      success: false,
      message: "Server error: " + err.message
    }));
  }

  return output;
}

// Untuk testing via GET (opsional)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "OK", message: "API aktif" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================================================================
// HELPER — ambil atau buat sheet
// ================================================================
function getSheet(name, headers) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    // Format header
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#c9974a");
    headerRange.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function generateID() {
  return Utilities.getUuid().replace(/-/g, "").substring(0, 12).toUpperCase();
}

// ================================================================
// ACTION: get_all — ambil semua data KK + Anggota + statistik
// ================================================================
function getAllData() {
  const sheetKK  = getSheet(SHEET_KK,      HEADERS_KK);
  const sheetAng = getSheet(SHEET_ANGGOTA, HEADERS_ANGGOTA);

  const kkRows  = sheetKK.getDataRange().getValues();
  const angRows = sheetAng.getDataRange().getValues();

  // Lewati baris header (index 0)
  const kkData = kkRows.slice(1).map(row => ({
    id            : row[0],
    nokk          : String(row[1]),
    nama_kk       : row[2],
    nik_kk        : String(row[3]),
    jenis_kelamin : row[4],
    pendidikan    : row[5],
    wilayah       : row[6],
    gdrive_link   : row[7],
    gdrive_ktp_link: row[8],
    has_berkas    : row[9],
    timestamp     : row[10]
  })).filter(k => k.nokk); // buang baris kosong

  const angData = angRows.slice(1).map(row => ({
    id                : row[0],
    nokk              : String(row[1]),
    nama_anggota      : row[2],
    nik_anggota       : String(row[3]),
    hubungan          : row[4],
    jenis_kelamin     : row[5],
    jenis_kelamin_label: row[5] === "L" ? "Laki-laki" : "Perempuan",
    pendidikan        : row[6],
    timestamp         : row[7]
  })).filter(a => a.nokk);

  // Hitung statistik
  const totalKK     = kkData.length;
  const totalAnggota = angData.length;
  const totalWarga  = totalKK + totalAnggota;
  const kkDgnBerkas = kkData.filter(k => k.has_berkas === "Ya").length;

  return {
    success  : true,
    kk       : kkData,
    anggota  : angData,
    stats    : {
      total_kk          : totalKK,
      total_anggota     : totalAnggota,
      total_warga       : totalWarga,
      kk_dengan_berkas  : kkDgnBerkas
    }
  };
}

// ================================================================
// ACTION: simpan_kk — tambah data Kepala Keluarga baru
// ================================================================
function simpanKK(data) {
  if (!data.nokk || !data.nama_kk || !data.nik_kk) {
    return { success: false, message: "Data tidak lengkap" };
  }

  const sheet = getSheet(SHEET_KK, HEADERS_KK);

  // Cek duplikat No. KK
  const existing = sheet.getDataRange().getValues();
  for (let i = 1; i < existing.length; i++) {
    if (String(existing[i][1]) === String(data.nokk)) {
      return { success: false, message: "Nomor KK " + data.nokk + " sudah terdaftar!" };
    }
  }

  const hasBerkas = (data.gdrive_link && data.gdrive_link.trim()) ? "Ya" : "Tidak";
  const id        = generateID();
  const timestamp = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  sheet.appendRow([
    id,
    data.nokk,
    data.nama_kk,
    data.nik_kk,
    data.jenis_kelamin,
    data.pendidikan,
    data.wilayah       || "",
    data.gdrive_link   || "",
    data.gdrive_ktp_link || "",
    hasBerkas,
    timestamp
  ]);

  return { success: true, message: "Data KK berhasil disimpan", id };
}

// ================================================================
// ACTION: simpan_anggota — tambah anggota ke KK yang ada
// ================================================================
function simpanAnggota(data) {
  if (!data.nokk || !data.nama_anggota || !data.nik_anggota) {
    return { success: false, message: "Data tidak lengkap" };
  }

  // Pastikan KK induk ada
  const sheetKK = getSheet(SHEET_KK, HEADERS_KK);
  const kkRows  = sheetKK.getDataRange().getValues();
  const kkFound = kkRows.slice(1).find(r => String(r[1]) === String(data.nokk));
  if (!kkFound) {
    return { success: false, message: "Nomor KK " + data.nokk + " tidak ditemukan" };
  }

  const sheet     = getSheet(SHEET_ANGGOTA, HEADERS_ANGGOTA);
  const id        = generateID();
  const timestamp = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  sheet.appendRow([
    id,
    data.nokk,
    data.nama_anggota,
    data.nik_anggota,
    data.hubungan      || "",
    data.jenis_kelamin || "",
    data.pendidikan    || "",
    timestamp
  ]);

  return { success: true, message: "Anggota berhasil ditambahkan", id };
}

// ================================================================
// ACTION: cari — cari data berdasarkan No. KK atau Nama KK
// ================================================================
function cariData(query) {
  if (!query || query.trim().length < 2) {
    return { success: false, message: "Query terlalu pendek" };
  }

  const allData = getAllData();
  const q       = query.trim().toLowerCase();

  const matched = allData.kk.filter(kk =>
    kk.nokk.includes(q) ||
    kk.nama_kk.toLowerCase().includes(q) ||
    kk.nik_kk.includes(q)
  );

  // Sertakan data anggota untuk tiap KK yang cocok
  matched.forEach(kk => {
    kk.anggota = allData.anggota.filter(a => a.nokk === kk.nokk);
  });

  return { success: true, results: matched };
}

// ================================================================
// ACTION: hapus_kk — hapus KK beserta seluruh anggotanya
// ================================================================
function hapusKK(nokk) {
  if (!nokk) return { success: false, message: "No. KK tidak valid" };

  // Hapus dari sheet KK
  const sheetKK = getSheet(SHEET_KK, HEADERS_KK);
  let   kkRows  = sheetKK.getDataRange().getValues();
  let   deleted = false;

  for (let i = kkRows.length - 1; i >= 1; i--) {
    if (String(kkRows[i][1]) === String(nokk)) {
      sheetKK.deleteRow(i + 1); // +1 karena index array mulai 0
      deleted = true;
      break;
    }
  }

  if (!deleted) return { success: false, message: "No. KK tidak ditemukan" };

  // Hapus semua anggota yang terkait
  const sheetAng = getSheet(SHEET_ANGGOTA, HEADERS_ANGGOTA);
  const angRows  = sheetAng.getDataRange().getValues();

  for (let i = angRows.length - 1; i >= 1; i--) {
    if (String(angRows[i][1]) === String(nokk)) {
      sheetAng.deleteRow(i + 1);
    }
  }

  return { success: true, message: "Data KK dan anggota berhasil dihapus" };
}

// ================================================================
// ACTION: update_kk — perbarui data KK yang sudah ada
// ================================================================
function updateKK(data) {
  if (!data.id) return { success: false, message: "ID tidak valid" };

  const sheet  = getSheet(SHEET_KK, HEADERS_KK);
  const rows   = sheet.getDataRange().getValues();
  let   found  = false;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) {
      const hasBerkas = (data.gdrive_link && data.gdrive_link.trim()) ? "Ya" : "Tidak";
      // Update kolom sesuai urutan HEADERS_KK (skip ID di kolom 0)
      sheet.getRange(i + 1, 3).setValue(data.nama_kk       || rows[i][2]);
      sheet.getRange(i + 1, 4).setValue(data.nik_kk        || rows[i][3]);
      sheet.getRange(i + 1, 5).setValue(data.jenis_kelamin || rows[i][4]);
      sheet.getRange(i + 1, 6).setValue(data.pendidikan    || rows[i][5]);
      sheet.getRange(i + 1, 7).setValue(data.wilayah       !== undefined ? data.wilayah       : rows[i][6]);
      sheet.getRange(i + 1, 8).setValue(data.gdrive_link   !== undefined ? data.gdrive_link   : rows[i][7]);
      sheet.getRange(i + 1, 9).setValue(data.gdrive_ktp_link !== undefined ? data.gdrive_ktp_link : rows[i][8]);
      sheet.getRange(i + 1, 10).setValue(hasBerkas);
      found = true;
      break;
    }
  }

  if (!found) return { success: false, message: "Data tidak ditemukan" };
  return { success: true, message: "Data berhasil diperbarui" };
}
