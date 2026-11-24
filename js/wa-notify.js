/**
 * NOTIFIKASI WHATSAPP — YUWURI SHOP
 * Dipakai oleh checkout.html dan payment.html.
 * Konfigurasi ada di js/wa-config.js
 */
(function () {
  const ORDERS_KEY = 'yuwuri_orders';
  const MAX_ORDERS = 100;

  const cfg = () =>
    Object.assign(
      {
        enabled: true,
        provider: 'callmebot',
        ownerPhone: '',
        callmebotApiKey: '',
        fonnteToken: '',
        fonnteDevice: '',
        storePhone: '',
        notifyOnCheckout: true,
        notifyOnPaymentConfirm: true,
      },
      window.YUWURI_WA_CONFIG || {}
    );

  const rp = (n) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

  function newOrderCode(date) {
    const d = date || new Date();
    const pad = (v, len) => String(v).padStart(len || 2, '0');
    return (
      'YW-' +
      pad(d.getFullYear() % 100) +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      '-' +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds())
    );
  }

  function formatWaktu(d) {
    return new Date(d).toLocaleString('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function normalizePhone(phone) {
    let p = String(phone || '').replace(/[^0-9+]/g, '');
    if (p.startsWith('+')) p = p.slice(1);
    if (p.startsWith('0')) p = '62' + p.slice(1);
    if (p.startsWith('8')) p = '62' + p;
    return p;
  }

  function buildMessage(order, status) {
    const items = Array.isArray(order.items) ? order.items : [];
    const lines = [];
    lines.push('🛍️ *PESANAN ' + (status === 'paid' ? 'DIBAYAR' : 'BARU') + ' — YUWURI.SHOP*');
    lines.push('Kode: ' + (order.code || '-'));
    lines.push('Waktu: ' + formatWaktu(order.createdAt || Date.now()));
    lines.push('Status: ' + (status === 'paid' ? 'Pembayaran dikonfirmasi pembeli' : 'Menunggu pembayaran QRIS'));
    lines.push('━━━━━━━━━━━━━━━');
    lines.push('*Pembeli*');
    lines.push('Nama: ' + (order.name || '-'));
    lines.push('WA: ' + (order.phone || '-'));
    lines.push('Email: ' + (order.email || '-'));
    lines.push('Alamat: ' + [order.address, order.subdistrict, order.city, order.province, order.postalCode].filter(Boolean).join(', '));
    lines.push('Ekspedisi: ' + (order.shipping || '-'));
    lines.push('Catatan: ' + (order.notes || '-'));
    lines.push('━━━━━━━━━━━━━━━');
    lines.push('*Item*');
    if (items.length) {
      items.forEach((it, i) => {
        const qty = Number(it.quantity) || 1;
        const price = Number(it.price) || 0;
        lines.push(
          i + 1 + '. ' + (it.name || 'Produk') + ' (' + (it.color || 'Default') + ') x' + qty + ' = ' + rp(price * qty)
        );
      });
    } else {
      lines.push('-');
    }
    lines.push('━━━━━━━━━━━━━━━');
    if (order.subtotal) lines.push('Subtotal: ' + order.subtotal);
    if (order.shippingCost) lines.push('Ongkir: ' + order.shippingCost);
    lines.push('*TOTAL: ' + (order.total || '-') + '*');
    return lines.join('\n');
  }

  function callmebotUrl(c, text) {
    return (
      'https://api.callmebot.com/whatsapp.php?phone=' +
      encodeURIComponent(normalizePhone(c.ownerPhone)) +
      '&text=' +
      encodeURIComponent(text) +
      '&apikey=' +
      encodeURIComponent(c.callmebotApiKey)
    );
  }

  function waMeLink(order, status) {
    const c = cfg();
    const target = normalizePhone(c.storePhone || c.ownerPhone);
    const text = buildMessage(order, status);
    return 'https://wa.me/' + target + '?text=' + encodeURIComponent(text);
  }

  function saveOrder(order) {
    try {
      const list = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
      list.unshift(order);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(list.slice(0, MAX_ORDERS)));
    } catch (e) {
      /* storage penuh / private mode — abaikan */
    }
  }

  function markPaid(code) {
    try {
      const list = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
      const next = list.map((o) => (o.code === code ? Object.assign({}, o, { paidAt: Date.now() }) : o));
      localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
    } catch (e) {}
  }

  async function send(c, text) {
    if (c.provider === 'fonnte') {
      if (!c.fonnteToken) return { ok: false, reason: 'fonnteToken kosong' };
      try {
        const res = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: { Authorization: c.fonnteToken },
          body: new URLSearchParams({ target: normalizePhone(c.ownerPhone), message: text }),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok && data.status !== false, channel: 'fonnte', data };
      } catch (e) {
        return { ok: false, reason: String(e && e.message) };
      }
    }

    // callmebot: GET, tidak ada header CORS → pakai no-cors
    if (!c.callmebotApiKey) return { ok: false, reason: 'callmebotApiKey kosong' };
    const url = callmebotUrl(c, text);
    try {
      await fetch(url, { mode: 'no-cors', keepalive: true, cache: 'no-store' });
      return { ok: true, channel: 'callmebot', url };
    } catch (e) {
      // fallback terakhir: image pixel (tetap terkirim walau fetch diblokir)
      try {
        new Image().src = url + '&_=' + Date.now();
        return { ok: true, channel: 'callmebot-pixel', url };
      } catch (err) {
        return { ok: false, reason: String(e && e.message) };
      }
    }
  }

  /**
   * Kirim notifikasi pesanan.
   * @param {object} order  data pesanan (lihat checkout.html)
   * @param {'new'|'paid'} status
   * @returns {Promise<{ok:boolean, channel?:string, url?:string, reason?:string}>}
   */
  async function notifyOrder(order, status) {
    const c = cfg();
    const normalized = Object.assign({}, order);
    normalized.code = normalized.code || newOrderCode();
    normalized.createdAt = normalized.createdAt || Date.now();
    normalized.status = status || 'new';
    saveOrder(normalized);

    if (!c.enabled || c.provider === 'off') {
      return { ok: false, reason: 'notifikasi dimatikan' };
    }
    const text = buildMessage(normalized, status);
    const result = await send(c, text);
    result.message = text;
    result.waMe = waMeLink(normalized, status);
    if (status === 'paid') markPaid(normalized.code);
    return result;
  }

  window.YuwuriWA = { notifyOrder, buildMessage, waMeLink, newOrderCode, normalizePhone, saveOrder };
})();
