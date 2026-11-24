/**
 * KONFIGURASI NOTIFIKASI WHATSAPP — YUWURI SHOP
 * ---------------------------------------------
 * Cukup edit file ini. Tidak perlu ubah file lain.
 *
 * PROVIDER:
 *  - 'callmebot' : gratis, tanpa server. Aktivasi sekali dari HP penerima:
 *                  kirim WA ke +34 621 33 17 77 dengan teks:
 *                  "I allow callmebot to send me messages"
 *                  lalu kamu terima API key via balasan WA.
 *  - 'fonnte'    : berbayar, bisa kirim ke nomor mana saja. Butuh token
 *                  dari https://fonnte.com (Authorization: <token>).
 *  - 'off'       : matikan notifikasi otomatis (tombol wa.me tetap ada).
 */
window.YUWURI_WA_CONFIG = {
  enabled: true,
  provider: 'callmebot',

  // Nomor penerima notifikasi (pemilik toko). Format 628xxxxxxxxxx tanpa + / spasi.
  ownerPhone: '6281234567890',

  // Provider callmebot
  callmebotApiKey: '', // isi API key dari CallMeBot

  // Provider fonnte
  fonnteToken: '',
  fonnteDevice: '', // opsional

  // Nomor WA toko untuk tombol fallback "Chat Toko" (boleh sama dengan ownerPhone)
  storePhone: '6281234567890',

  // Kirim notifikasi saat pesanan dibuat (tombol "Lanjut ke Pembayaran QRIS")
  notifyOnCheckout: true,
  // Kirim notifikasi saat pembeli klik "Saya Sudah Bayar"
  notifyOnPaymentConfirm: true,
};
