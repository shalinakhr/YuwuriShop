// File: api/ongkir.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method tidak diizinkan' });
  }

  if (!process.env.BITESHIP_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'BITESHIP_API_KEY belum diatur di Environment Variables Vercel.'
    });
  }

  try {
    const { destination_postal_code, weight_gram } = req.body;
    const ORIGIN_POSTAL_CODE = 50275; // Tembalang, Semarang

    const response = await fetch('https://api.biteship.com/v1/rates/couriers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BITESHIP_API_KEY.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        origin_postal_code: ORIGIN_POSTAL_CODE,
        destination_postal_code: Number(destination_postal_code),
        couriers: 'jne,jnt,sicepat,anteraja,pos,tiki,ninja,lion',
        items: [
          {
            name: 'Kemeja / Blouse Yuwuri',
            description: 'Dailywear',
            value: 35000,
            weight: Number(weight_gram) || 250,
            quantity: 1
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return res.status(response.status || 400).json({
        success: false,
        error: data.error || data.message || `Biteship menolak permintaan (HTTP ${response.status})`,
        raw: data
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Gagal menghubungi server Biteship: ' + error.message
    });
  }
}
