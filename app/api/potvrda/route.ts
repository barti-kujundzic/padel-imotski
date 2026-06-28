import { NextResponse } from 'next/server';
import { db } from '@/lib/db'; // Tvoj ispravni SQL DB klijent

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return new NextResponse("Token nedostaje.", { status: 400 });
    }

    // 1. Pronađi rezervaciju prema tokenu (SQL)
    const rezultat = await db.query('SELECT * FROM "Rezervacija" WHERE token = $1 LIMIT 1', [token]);
    const rezervacija = rezultat.rows[0];

    if (!rezervacija) {
      return new NextResponse("Rezervacija nije pronađena ili je token nevažeći.", { status: 404 });
    }

    // Stilovi gumba za HTML prikaz
    const gumbStilPocetna = "display: inline-block; padding: 10px 20px; background-color: #64748b; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 5px; font-size: 14px;";
    const gumbStilOtkazi = "display: inline-block; padding: 10px 20px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 5px; font-size: 14px;";

    // 2. Ako je već potvrđena od ranije, samo ispiši poruku da se ne radi dupla potvrda
    if (rezervacija.potvrdjeno) {
      return new NextResponse(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #f8fafc;">
            <div style="max-w: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
              <h1 style="color: #2563eb;">Ova rezervacija je već ranije potvrđena! 🎉</h1>
              <p>Vidimo se na terenu.</p>
              <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <a href="/" style="${gumbStilPocetna}">Natrag na raspored</a>
                <a href="/api/otkazivanje?token=${token}" style="${gumbStilOtkazi}">Otkaži rezervaciju</a>
              </div>
            </div>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // 3. Provjeri je li netko drugi u međuvremenu ugrabio i potvrdio taj isti termin (SQL)
    const duplikatRez = await db.query(
      'SELECT * FROM "Rezervacija" WHERE datum = $1 AND vrijeme = $2 AND potvrdjeno = true LIMIT 1',
      [rezervacija.datum, rezervacija.vrijeme]
    );

    if (duplikatRez.rows.length > 0) {
      return new NextResponse(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #f8fafc;">
            <div style="max-w: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
              <h1 style="color: #dc2626;">Nažalost, termin je u međuvremenu zauzet ❌</h1>
              <p>Neko drugi je brže potvrdio isti termin. Molimo odaberite drugi termin na stranici.</p>
              <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <a href="/" style="${gumbStilPocetna}">Natrag na raspored</a>
              </div>
            </div>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // 4. Ako je sve u redu, postavi potvrdjeno = true (SQL)
    await db.query('UPDATE "Rezervacija" SET potvrdjeno = true WHERE token = $1', [token]);

    // -------------------------------------------------------------
    // TELEGRAM INTEGRACIJA - SLANJE FINALNE POTVRDE VODITELJU
    // -------------------------------------------------------------
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      let lijepiDatum = rezervacija.datum;
      try {
        const d = new Date(rezervacija.datum);
        lijepiDatum = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}.`;
      } catch (e) {}

      const tekstPoruke = 
        `✅ *REZERVACIJA POTVRĐENA PUTEM E-MAILA!*\n\n` +
        `👤 *Ime:* ${rezervacija.ime}\n` +
        `📞 *Mobitel:* ${rezervacija.telefon}\n` +
        `📧 *Email:* ${rezervacija.email}\n` +
        `📅 *Datum:* ${lijepiDatum}\n` +
        `🕒 *Vrijeme:* ${rezervacija.vrijeme}`;

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

    // Prikaz uspjeha korisniku u browseru s novim gumbima
    return new NextResponse(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #f8fafc; color: #334155;">
          <div style="max-w: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <h1 style="color: #10b981; margin-bottom: 10px;">Uspješno potvrđeno! 🎾</h1>
            <p style="font-size: 16px; line-height: 1.5;">Vaš termin <strong>${rezervacija.vrijeme}</strong> za dan <strong>${rezervacija.datum}</strong> je službeno rezerviran.</p>
            
            <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              <a href="/" style="${gumbStilPocetna}">Natrag na raspored</a>
              <a href="/api/otkazivanje?token=${token}" style="${gumbStilOtkazi}">Otkaži rezervaciju</a>
            </div>
            <p style="margin-top: 20px; color: #64748b; font-size: 14px;">Vidimo se na terenu!</p>
          </div>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  } catch (error) {
    console.error(error);
    return new NextResponse("Greška na serveru prilikom potvrde.", { status: 500 });
  }
}