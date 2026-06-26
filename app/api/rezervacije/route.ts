import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import crypto from 'crypto';
import { db } from '@/lib/db'; // Tvoj ispravni SQL DB klijent

// Inicijalizacija Resend-a pomoću ključa iz .env datoteke
const resend = new Resend(process.env.RESEND_API_KEY);

// 1. GET - Dohvaćanje SAMO POTVRĐENIH rezervacija za prikaz na kalendaru
export async function GET() {
  try {
    // Korištenje čistog SQL-a umjesto Prisme
    const rezultat = await db.query('SELECT * FROM "Rezervacija" WHERE potvrdjeno = true');
    return NextResponse.json(rezultat.rows);
  } catch (error) {
    console.error("Greška pri dohvaćanju:", error);
    return NextResponse.json({ message: "Greška pri dohvaćanju" }, { status: 500 });
  }
}

// 2. POST - Pokretanje procesa rezervacije (slanje maila za potvrdu)
export async function POST(request: Request) {
  try {
    const { ime, telefon, email, datum, vrijeme } = await request.json();
    const origin = new URL(request.url).origin; 

    if (!ime || !telefon || !email || !datum || !vrijeme) {
      return NextResponse.json({ message: "Sva polja su obavezna!" }, { status: 400 });
    }

    // Provjera postoji li već POTVRĐEN termin za taj dan i sat (SQL)
    const postojecaRezervacija = await db.query(
      'SELECT * FROM "Rezervacija" WHERE datum = $1 AND vrijeme = $2 AND potvrdjeno = true LIMIT 1',
      [datum, vrijeme]
    );

    if (postojecaRezervacija.rows.length > 0) {
      return NextResponse.json(
        { message: "Nažalost, taj termin je u međuvremenu zauzet!" },
        { status: 400 }
      );
    }

    const jedinstveniToken = crypto.randomUUID();

    // Upisivanje u bazu sa statusom potvrdjeno: false (SQL)
    // Napomena: "createdAt" stavljamo pod navodnike jer PostgreSQL razlikuje velika i mala slova za stupce
    await db.query(
      'INSERT INTO "Rezervacija" (ime, telefon, email, datum, vrijeme, token, potvrdjeno, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
      [ime, telefon, email, datum, vrijeme, jedinstveniToken, false]
    );

    // Kreiranje linka koji će korisnik kliknuti u mailu
    const linkZaPotvrdu = `${origin}/api/potvrda?token=${jedinstveniToken}`;

    // -------------------------------------------------------------
    // SLANJE EMAILA PREKO RESEND-A
    // -------------------------------------------------------------
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'Padel Rezervacije <onboarding@resend.dev>', 
          to: email,
          subject: 'Potvrdite vašu rezervaciju termina 🎾',
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
              <h2>Pozdrav ${ime},</h2>
              <p>Zaprimili smo vaš zahtjev za rezervaciju padel terena.</p>
              <p><strong>Detalji termina:</strong></p>
              <ul>
                <li><strong>Datum:</strong> ${datum}</li>
                <li><strong>Vrijeme:</strong> ${vrijeme}</li>
              </ul>
              <p>Kako biste dovršili rezervaciju i zaključali termin, molimo vas da je potvrdite klikom na gumb ispod:</p>
              <p style="margin-top: 25px; text-align: center;">
                <a href="${linkZaPotvrdu}" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  POTVRDI REZERVACIJU
                </a>
              </p>
              <br/>
              <p style="font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 10px;">Ako niste zatražili ovu rezervaciju, možete ignorirati ovaj e-mail.</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Greška pri slanju e-maila:", emailError);
      }
    } else {
      console.warn("RESEND_API_KEY nije konfigurisan u .env datoteci.");
    }

    // -------------------------------------------------------------
    // TELEGRAM: Privremena obavijest
    // -------------------------------------------------------------
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      const tekstPoruke = 
        `⏳ *ZAKAZAN ZAHTJEV ZA REZERVACIJU (Čeka se potvrda na e-mailu)*\n\n` +
        `👤 *Ime:* ${ime}\n` +
        `📅 *Datum:* ${datum}\n` +
        `🕒 *Vrijeme:* ${vrijeme}`;

      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: tekstPoruke, parse_mode: "Markdown" }),
        });
      } catch (e) {
        console.error("Telegram error:", e);
      }
    }

    return NextResponse.json(
      { message: "Zahtjev zaprimljen! Molimo provjerite e-mail kako biste potvrdili rezervaciju." }, 
      { status: 200 }
    );

  } catch (error) {
    console.error("Greška pri spremanju:", error);
    return NextResponse.json({ message: "Greška na serveru prilikom spremanja." }, { status: 500 });
  }
}