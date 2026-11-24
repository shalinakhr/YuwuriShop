# Notifikasi WhatsApp untuk Pembelian — YuwuriShop

Setiap kali pembeli menyelesaikan checkout atau konfirmasi bayar, toko dapat notifikasi WhatsApp otomatis berisi detail pesanan.

## File yang terlibat

| File | Fungsi |
|---|---|
| `js/wa-config.js` | **Satu-satunya file yang perlu kamu edit** (nomor WA, API key, provider) |
| `js/wa-notify.js` | Logic pembuat pesan + pengiriman |
| `checkout.html` | Kirim notifikasi "PESANAN BARU" saat klik *Lanjut ke Pembayaran QRIS* |
| `payment.html` | Kirim notifikasi "PESANAN DIBAYAR" saat klik *Saya Sudah Bayar* |

## Setup CallMeBot (gratis, tanpa server) — rekomendasi

1. Dari HP yang nomornya mau menerima notifikasi, simpan nomor **+34 621 33 17 77**.
2. Kirim WhatsApp ke nomor itu dengan teks persis:
   ```
   I allow callmebot to send me messages
   ```
3. Tunggu balasan berisi **API key** (contoh `123456`).
4. Buka `js/wa-config.js`, isi:
   ```js
   provider: 'callmebot',
   ownerPhone: '62812xxxxxxx',   // nomor penerima, format 62...
   callmebotApiKey: 'APIKEY_KAMU',
   storePhone: '62812xxxxxxx',
   ```
5. Buka `payment.html`, klik *Saya Sudah Bayar* → cek WhatsApp.

Batas CallMeBot gratis: beberapa pesan per menit, cukup untuk toko kecil/demo.

## Alternatif: Fonnte (bisa ke nomor mana saja, berbayar)

1. Daftar di https://fonnte.com, hubungkan device, ambil token.
2. Isi config:
   ```js
   provider: 'fonnte',
   fonnteToken: 'TOKEN_FONNTE',
   ownerPhone: '62812xxxxxxx',
   ```
3. Fonnte butuh kuota pesan; pastikan device status *connect*.

## Fallback otomatis

Kalau API key/token belum diisi atau provider mati (`provider: 'off'`), pembeli tetap melihat tombol **"Kirim konfirmasi ke WhatsApp toko"** (`wa.me` link berisi teks pesanan yang sama). Jadi alur tidak pernah buntu.

## Yang dikirim

```
🛍️ *PESANAN BARU — YUWURI.SHOP*
Kode: YW-261123-162720
Waktu: Senin, 23 November 2026 pukul 16.27
Status: Menunggu pembayaran QRIS
━━━━━━━━━━━━━━━
*Pembeli*
Nama / WA / Email / Alamat / Ekspedisi / Catatan
━━━━━━━━━━━━━━━
*Item*
1. Kemeja Linen Vintage (Olive) x2 = Rp 360.000
━━━━━━━━━━━━━━━
Subtotal, Ongkir, *TOTAL*
```

Semua pesanan juga disimpan di `localStorage` key `yuwuri_orders` (100 terakhir, ada `paidAt` bila sudah dikonfirmasi).

## Peringatan keamanan

Site ini static (tanpa backend), jadi API key CallMeBot/Fonnte **terlihat di source code** oleh siapa pun yang membuka DevTools. Untuk demo/tugas aman; untuk produksi, pindahkan pengiriman ke backend atau serverless function (Cloudflare Worker / Vercel / Supabase Edge Function) lalu simpan token sebagai secret di sana.

Nomor HP pembeli juga ikut terkirim ke CallMeBot (pihak ketiga) — beri tahu pembeli di halaman checkout/privacy policy.
