import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';

// 1. GET - Dohvaćanje svih rezervacija iz baze podataka
export async function GET() {
  try {
    const rezultat = await db.query('SELECT * FROM "Rezervacija"');
    return NextResponse.json(rezultat.rows);
  } catch (error) {
    console.error("Greška pri dohvaćanju:", error);
    return NextResponse.json({ message: "Greška pri dohvaćanju" }, { status: 500 });
  }
}

// 2. POST - Spremanje nove rezervacije u bazu podataka
export async function POST(request: Request) {
  try {
    const { ime, telefon, datum, vrijeme } = await request.json();

    // Provjera postoji li već termin za taj dan i sat
    const provjera = await db.query(
      'SELECT * FROM "Rezervacija" WHERE datum = $1 AND vrijeme = $2',
      [datum, vrijeme]
    );

    if (provjera.rows.length > 0) {
      return NextResponse.json(
        { message: "Nažalost, taj termin je u međuvremenu zauzet!" },
        { status: 400 }
      );
    }

    // Upisivanje nove rezervacije u tablicu "Rezervacija" i stupac "createdAt"
    const novaRezervacija = await db.query(
      'INSERT INTO "Rezervacija" (ime, telefon, datum, vrijeme, "createdAt") VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [ime, telefon, datum, vrijeme]
    );

    // -------------------------------------------------------------
    // TELEGRAM INTEGRACIJA (Pokreće se nakon uspješnog upisa u bazu)
    // -------------------------------------------------------------
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      // Formatiranje datuma za ljepši prikaz (opcionalno, npr. iz "2026-06-23" u "23.06.2026.")
      let lijepiDatum = datum;
      try {
        const d = new Date(datum);
        lijepiDatum = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}.`;
      } catch (e) {
        // Ako formatiranje omane, koristi izvorni string
      }

      const tekstPoruke = 
        `🎾 *NOVA REZERVACIJA TERENA!*\n\n` +
        `👤 *Ime:* ${ime}\n` +
        `📞 *Mobitel:* ${telefon}\n` +
        `📅 *Datum:* ${lijepiDatum}\n` +
        `🕒 *Vrijeme:* ${vrijeme}`;

      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      
      try {
        // Šaljemo obavijest asinkrono
        await fetch(telegramUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: tekstPoruke,
            parse_mode: "Markdown",
          }),
        });
        console.log("Telegram obavijest uspješno poslana!");
      } catch (telegramError) {
        // Ako Telegram zakaze, ne želimo srušiti cijelu aplikaciju korisniku jer je upis u bazu već uspio
        console.error("Greška pri slanju na Telegram:", telegramError);
      }
    } else {
      console.warn("Telegram token ili Chat ID nisu konfigurirani u .env datoteci.");
    }
    // -------------------------------------------------------------

    return NextResponse.json(
      { message: "Uspješno spremljeno!", rezervacija: novaRezervacija.rows[0] }, 
      { status: 200 }
    );

  } catch (error) {
    console.error("Greška pri spremanju u terminalu:", error);
    return NextResponse.json({ message: "Greška na serveru prilikom spremanja." }, { status: 500 });
  }
}