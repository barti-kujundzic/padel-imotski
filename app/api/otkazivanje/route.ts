import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return new NextResponse("Token nedostaje.", { status: 400 });
    }

    // 1. Dohvati rezervaciju prije brisanja kako bismo imali podatke za Telegram
    const rezultat = await db.query('SELECT * FROM "Rezervacija" WHERE token = $1 LIMIT 1', [token]);
    const rezervacija = rezultat.rows[0];

    if (!rezervacija) {
      return new NextResponse(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #f8fafc;">
            <div style="max-w: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
              <h1 style="color: #dc2626;">Rezervacija nije pronađena ❌</h1>
              <p>Moguće je da je već ranije otkazana ili je token nevažeći.</p>
              <a href="/" style="display: inline-block; padding: 10px 20px; background-color: #64748b; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; font-weight: bold;">Natrag na raspored</a>
            </div>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // 2. Brišemo rezervaciju iz baze podataka kako bi se termin potpuno oslobodio na kalendaru
    await db.query('DELETE FROM "Rezervacija" WHERE token = $1', [token]);

    // 3. Obavijesti voditelja na Telegram da je termin otkazan
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      let lijepiDatum = rezervacija.datum;
      try {
        const d = new Date(rezervacija.datum);
        lijepiDatum = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}.`;
      } catch (e) {}

      const tekstPoruke = 
        `🚨 *REZERVACIJA OTKAZANA PUTEM STRANICE!*\n\n` +
        `👤 *Ime:* ${rezervacija.ime}\n` +
        `📅 *Datum:* ${lijepiDatum}\n` +
        `🕒 *Vrijeme:* ${rezervacija.vrijeme}\n\n` +
        `Termin je ponovno slobodan za rezervaciju na kalendaru.`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: tekstPoruke,
          parse_mode: "Markdown",
        }),
      }).catch(err => console.error("Telegram error:", err));
    }

    // 4. Prikaz uspješnog otkazivanja korisniku
    return new NextResponse(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #f8fafc; color: #334155;">
          <div style="max-w: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <h1 style="color: #ef4444; margin-bottom: 10px;">Rezervacija otkazana 🗑️</h1>
            <p style="font-size: 16px; line-height: 1.5;">Vaš termin u <strong>${rezervacija.vrijeme}</strong> dana <strong>${rezervacija.datum}</strong> je uspješno otkazan i oslobođen.</p>
            
            <div style="margin-top: 30px;">
              <a href="/" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Natrag na raspored</a>
            </div>
          </div>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  } catch (error) {
    console.error(error);
    return new NextResponse("Greška na serveru prilikom otkazivanja.", { status: 500 });
  }
}