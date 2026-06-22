"use client";
import { useState, useEffect } from "react";

interface Rezervacija {
  id: number;
  ime: string;
  telefon: string;
  datum: string;
  vrijeme: string;
}

export default function Home() {
  // 1. POPIS SVIH MOGUĆIH TERMINA TIJEKOM DANA
  const sviTermini = [
    "08:00 - 09:00",
    "09:00 - 10:00",
    "10:00 - 11:00",
    "11:00 - 12:00",
    "12:00 - 13:00",
    "13:00 - 14:00",
    "14:00 - 15:00",
    "15:00 - 16:00",
    "16:00 - 17:00",
    "17:00 - 18:00",
    "18:00 - 19:00",
    "19:00 - 20:00",
    "20:00 - 21:00",
    "21:00 - 22:00",
    "22:00 - 23:00",
    "23:00 - 00:00",
  ];

  // Funkcija koja sigurno računa lokalni datum na uređaju korisnika (izbjegava UTC pomak)
  const dobijLokalniDatum = () => {
    const d = new Date();
    const godina = d.getFullYear();
    const mjesec = String(d.getMonth() + 1).padStart(2, "0");
    const dan = String(d.getDate()).padStart(2, "0");
    return `${godina}-${mjesec}-${dan}`;
  };

  const danasnjiDatum = dobijLokalniDatum();

  // 2. STANJA ZA PODATKE I INTERAKCIJU
  const [rezervacije, setRezervacije] = useState<Rezervacija[]>([]);
  const [odabraniDatum, setOdabraniDatum] = useState(danasnjiDatum);
  const [odabranoVrijeme, setOdabranoVrijeme] = useState<string | null>(null);

  // Stanja za formu
  const [ime, setIme] = useState("");
  const [telefon, setTelefon] = useState("");
  const [poruka, setPoruka] = useState<{
    tekst: string;
    tip: "uspjeh" | "greska";
  } | null>(null);

  // KORAK A: Dohvaćanje i provjera datuma iz localStorage-a nakon montiranja komponente
  useEffect(() => {
    const spremljeniDatum = localStorage.getItem("zadnjiOdabraniDatum");
    const lokalniDanas = dobijLokalniDatum();

    if (spremljeniDatum) {
      // Ako je spremljeni datum stariji od današnjeg, resetiraj na danasnji dan
      if (spremljeniDatum < lokalniDanas) {
        setOdabraniDatum(lokalniDanas);
        localStorage.setItem("zadnjiOdabraniDatum", lokalniDanas);
      } else {
        setOdabraniDatum(spremljeniDatum);
      }
    } else {
      setOdabraniDatum(lokalniDanas);
    }
  }, []);

  // KORAK B: DOHVAĆANJE REZERVACIJA IZ BAZE PRILIKOM UCITAVANJA STRANICE ILI PROMJENE DATUMA
  useEffect(() => {
    fetch("/api/rezervacije")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRezervacije(data);
        }
      })
      .catch((err) => console.error("Greška pri dohvaćanju s baze:", err));
  }, [odabraniDatum]); // Osvježi podatke ako se promijeni datum

  // 4. LOGIKA ZA SPREMANJE REZERVACIJE U BAZU PREKO API RUTE
  const handleRezervacija = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!odabranoVrijeme || !ime || !telefon) return;

    try {
      const res = await fetch("/api/rezervacije", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ime,
          telefon,
          datum: odabraniDatum,
          vrijeme: odabranoVrijeme,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setPoruka({
          tekst: `Uspješno ste rezervirali termin ${odabranoVrijeme}!`,
          tip: "uspjeh",
        });

        // Osiguravamo da je trenutni datum spremljen u localStorage nakon uspješne rezervacije
        localStorage.setItem("zadnjiOdabraniDatum", odabraniDatum);

        // Povuci svježe podatke kako bi gumb odmah postao siv bez F5 osvježavanja
        const osvjezi = await fetch("/api/rezervacije");
        const noveRezervacije = await osvjezi.json();
        if (Array.isArray(noveRezervacije)) {
          setRezervacije(noveRezervacije);
        }

        // Resetiranje forme i zatvaranje prozora za unos podatak
        setIme("");
        setTelefon("");
        setOdabranoVrijeme(null);
      } else {
        // Ako je backend javio grešku (npr. termin je zauzet u međuvremenu)
        setPoruka({
          tekst: data.message || "Dogodila se greška prilikom spremanja.",
          tip: "greska",
        });
      }
    } catch (error) {
      console.error(error);
      setPoruka({
        tekst: "Komunikacija sa serverom nije uspjela.",
        tip: "greska",
      });
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-12 text-slate-800">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        {/* Zaglavlje */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-8 text-white text-center">
          <h1 className="text-4xl font-black tracking-tight">
            PADEL REZERVACIJE 🎾
          </h1>
          <p className="mt-2 text-emerald-100 font-medium">
            Odaberite datum i pronađite slobodan termin
          </p>
        </div>

        <div className="p-6 md:p-8">
          {/* Obavijesti o uspjehu/grešci */}
          {poruka && (
            <div
              className={`p-4 mb-6 rounded-xl font-semibold text-center text-sm border ${
                poruka.tip === "uspjeh"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {poruka.tekst}
            </div>
          )}

          {/* KORAK 1: ODABIR DATUMA */}
          <div className="mb-8 max-w-xs mx-auto text-center">
            <label className="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wider">
              1. Odaberite datum
            </label>
            <input
              type="date"
              value={odabraniDatum}
              min={danasnjiDatum} // Korisnik ne može birati dane u prošlosti
              onChange={(e) => {
                const noviDatum = e.target.value;
                setOdabraniDatum(noviDatum);
                localStorage.setItem("zadnjiOdabraniDatum", noviDatum); // SPREMAMO U LOCALSTORAGE
                setOdabranoVrijeme(null); // Resetiraj odabir vremena ako promijeni datum
                setPoruka(null);
              }}
              className="w-full p-3 text-center border-2 border-emerald-500 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg text-emerald-700 bg-emerald-50/50"
            />
          </div>

          {/* KORAK 2: PRIKAZ RASPOREDA ZA TAJ DAN */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-600 mb-4 uppercase tracking-wider text-center">
              2. Stanje termina za dan:{" "}
              <span className="text-slate-800 font-black">{odabraniDatum}</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sviTermini.map((satnica) => {
                // 1. Provjera je li termin već zauzet u bazi podataka
                const jeZauzet = rezervacije.some(
                  (r) => r.datum === odabraniDatum && r.vrijeme === satnica,
                );

                // 2. LOGIKA ZA TERMINE U PROŠLOSTI (ZA DANAŠNJI DAN)
                let jeUProslosti = false;

                if (odabraniDatum === danasnjiDatum) {
                  // Izvlačimo početno vrijeme termina (npr. iz "17:00 - 18:00" uzimamo "17:00")
                  const pocetnoVrijeme = satnica.split(" - ")[0];
                  const [satTermina, minutaTermina] = pocetnoVrijeme
                    .split(":")
                    .map(Number);

                  // Realno trenutno vrijeme na uređaju korisnika
                  const sada = new Date();
                  const trenutniSat = sada.getHours();
                  const trenutnaMinuta = sada.getMinutes();

                  // Ako je sat termina manji od trenutnog sata, termin je prošao
                  if (satTermina < trenutniSat) {
                    jeUProslosti = true;
                  }
                  // Ako je sat isti, ali je minuta termina manja od trenutne minute, također je prošao
                  else if (
                    satTermina === trenutniSat &&
                    minutaTermina < trenutnaMinuta
                  ) {
                    jeUProslosti = true;
                  }
                }

                // Gumb mora biti onemogućen ako je ILI zauzet ILI je u prošlosti
                const onemoguciGumb = jeZauzet || jeUProslosti;

                return (
                  <button
                    key={satnica}
                    disabled={onemoguciGumb}
                    onClick={() => {
                      setOdabranoVrijeme(satnica);
                      setPoruka(null);
                    }}
                    className={`p-4 rounded-2xl text-center font-bold transition duration-200 shadow-sm ${
                      onemoguciGumb
                        ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                        : odabranoVrijeme === satnica
                          ? "bg-emerald-600 text-white ring-4 ring-emerald-300 scale-95"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:scale-105"
                    }`}
                  >
                    <div className="text-sm">{satnica}</div>
                    <div className="text-xs mt-1 font-semibold uppercase tracking-wider">
                      {jeZauzet
                        ? "❌ Zauzeto"
                        : jeUProslosti
                          ? "🕒 Prošlo"
                          : "✅ Slobodno"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* KORAK 3: POJAVLJIVANJE FORME NAKON ODABIRA SLOBODNOG TERMINA */}
          {odabranoVrijeme && (
            <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-slate-800 mb-1 text-center">
                Unesite podatke za rezervaciju
              </h3>
              <p className="text-sm text-center text-emerald-600 font-semibold mb-4">
                Odabrano vrijeme: {odabranoVrijeme}
              </p>

              <form onSubmit={handleRezervacija} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">
                    Vaše Ime i Prezime
                  </label>
                  <input
                    type="text"
                    required
                    value={ime}
                    onChange={(e) => setIme(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="npr. Ivan Horvat"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">
                    Kontakt mobitel
                  </label>
                  <input
                    type="tel"
                    required
                    value={telefon}
                    onChange={(e) => setTelefon(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="npr. 091 234 5678"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOdabranoVrijeme(null)}
                    className="w-1/3 border border-slate-300 text-slate-600 p-3 rounded-xl font-bold hover:bg-slate-100 transition"
                  >
                    Odustani
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-xl font-bold transition shadow-md"
                  >
                    Potvrdi i Rezerviraj
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
