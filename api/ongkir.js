// File: api/ongkir.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  try {
    const { destination_postal_code, weight_gram } = req.body;

    // Ganti dengan kode pos asal toko Yuwuri (misal Tembalang, Semarang: 50275)
    const ORIGIN_POSTAL_CODE = 50275; 

    const response = await fetch('https://api.biteship.com/v1/rates/couriers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BITESHIP_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        origin_postal_code: ORIGIN_POSTAL_CODE,
        destination_postal_code: Number(destination_postal_code),
        couriers: 'jne,jnt,sicepat', // Kurir yang ingin ditampilkan
        items: [
          {
            name: 'Kemeja / Blouse Yuwuri',
            description: 'Dailywear',
            value: 35000,
            weight: Number(weight_gram) || 250, // Default 250 gram per baju
            quantity: 1
          }
        ]
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal mengambil tarif ongkir', detail: error.message });
  }
}
