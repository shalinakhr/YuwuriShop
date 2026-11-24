/**
 * YUWURI — konfigurasi Google Analytics 4 untuk dashboard CMS.
 * ------------------------------------------------------------------
 * Isi dua nilai di bawah, lalu buka cms.html → tab Analytics.
 * Panduan lengkap: ANALYTICS-SETUP.md
 *
 * clientId  : OAuth 2.0 Client ID (Web application) dari Google Cloud Console.
 *             Tambahkan origin tempat cms.html dibuka, mis.
 *             http://localhost:8000 dan https://domainmu.com
 * propertyId: nomor properti GA4 (Admin → Property settings → Property ID),
 *             hanya angka, contoh "123456789".
 */
window.YUWURI_GA_CONFIG = {
  clientId: "",
  propertyId: "",
  scope: "https://www.googleapis.com/auth/analytics.readonly",
  // Kalau belum diisi, dashboard menampilkan data contoh (ditandai DEMO).
  demoWhenUnconfigured: true
};
