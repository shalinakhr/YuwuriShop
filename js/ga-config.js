/**
 * YUWURI — konfigurasi Google Analytics 4 untuk dashboard CMS.
 * ------------------------------------------------------------------
 * Isi dua nilai di bawah, lalu buka admin.html → tab Analytics.
 * Panduan lengkap: ANALYTICS-SETUP.md
 *
 * clientId  : OAuth 2.0 Client ID (Web application) dari Google Cloud Console.
 *             Tambahkan origin tempat admin.html dibuka, mis.
 *             http://127.0.0.1:5500 dan https://yuwuri-shop.vercel.app
 * propertyId: nomor properti GA4 (Admin → Property settings → Property ID),
 *             hanya angka, contoh "123456789".
 */
window.YUWURI_GA_CONFIG = {
  clientId: "835580667745-1sotrh0vjs1g9sfkft7h47nshcg4mu4v.apps.googleusercontent.com",
  propertyId: "565368248",
  scope: "https://www.googleapis.com/auth/analytics.readonly",
  // Kalau belum diisi, dashboard menampilkan data contoh (ditandai DEMO).
  demoWhenUnconfigured: true
};
