# ZÁPAD GO – scénář prezentačního videa (100 s, epic-cinematic)

**Formát:** 16:9, 1920×1080, 30 fps (24 fps, pokud chcete filmový look), výstup MP4 H.264.
**Délka:** 1:40. Střih se dá zkrátit na 1:00 vynecháním scén 6 a 9.
**Tón:** žádný „startupový" hlas. Výpravný trailer, jako když se odkrývá nový svět. Text na obrazovce, žádný voice-over (volitelně jedna věta ve scéně 10).
**Hlavní motiv:** *Kraj, který se dá sbírat.* (slogan přímo z úvodní stránky)

---

## 0. Co o aplikaci víme (z kódu, na tom stavíme scény)

| Prvek | Kde je v kódu | Použití ve videu |
|---|---|---|
| Mapa míst (hrady, rozhledny, prameny, kultura, příroda, dědictví, **Dobroty**) | `app/map`, `components/map/PlacesMap.tsx` | scény 3, 9 |
| Razítko: foto + GPS do 300 m, anticheat | `game/anticheat.py`, `app/place` | scéna 4 |
| PET deterministicky ze seedu (místo + foto + hráč), 6 typů, 4 vzácnosti (common → legendary) | `game/pets.py` | scéna 5 |
| Evoluce: Mládě → Dospělec → Prastarý | `pets.py` (STAGES) | scéna 5 |
| Typová věž jako kámen-nůžky-papír (Pevnost > Výhled > Příroda > Pramen > Kultura > Pevnost) | `battles/engine.py` (BEATS) | scéna 6 |
| Souboj v reálném čase přes WebSocket, kouzla podle typu (Ohnivá střela z hradeb, Blesk z výšin, Gejzír, Koláčová smršť…) | `battles/consumers.py`, `engine.py` | scéna 7 |
| Odznaky (Hradní pán, Rozhledník, Pramenař, Dobrotník, Bez auta, Letní otužilec…) | `game/fixtures/badges.json` | scéna 8 |
| Questy: Místo dne, 3 místa týdně, Ochutnej Dobrotu | `game/quests.py` | scéna 8 |
| Tým a žebříček | `app/team`, `app/leaderboard` | scéna 8 |
| Insights – statistiky návštěvnosti míst a okresů | `app/insights` | scéna 9 |
| Průvodci **Bóža** (hrady), **Vřídla** (prameny), **Kukadlo** (rozhledny) | `components/guide/Guide.tsx` | scéna 2, 10 |
| „Bez auta": nejbližší zastávka u každého místa | `nearest_stop_m` | scéna 9 |

> **Pravidlo pro dalších 20 h:** každá nová featura dostane v tomto scénáři jeden „slot" (viz sekce 6). Video se skládá z modulů, takže když něco přibude, přestřihne se jedna scéna, ne celé video.

---

## 1. Dramaturgie (3 akty podle hudby)

| Akt | Čas | Nálada | Hudba |
|---|---|---|---|
| I. Probuzení | 0:00 – 0:25 | ticho → údiv | ambient, hluboké pády, sólové piano/smyčce, 60–70 BPM |
| II. Výprava | 0:25 – 1:05 | rozjezd, objevování | přibývá perkuse, ostinato smyčců, 90 → 110 BPM |
| III. Bitva a vítězství | 1:05 – 1:40 | epický vrchol, katarze | plný orchestr + sbor, 120 BPM, poslední akord s dozvukem |

---

## 2. Scény a záběry

### Scéna 1 – Hook (0:00 – 0:10)
**Cíl:** v prvních 5 s zastavit porotu.

| # | Čas | Záběr | Obsah | Pohyb kamery |
|---|---|---|---|---|
| 1.1 | 0:00–0:03 | Černá. Zvuk větru. | Žádný obraz, po 1 s se rozsvítí jedna tečka (GPS pin). | – |
| 1.2 | 0:03–0:07 | Letecký záběr krajiny Karlovarského kraje (zalesněné kopce, mlha nad údolím, silueta hradu). Použít stock nebo AI video. | Text fade-in: **„Karlovarský kraj."** | pomalý dolly-in, mírný parallax |
| 1.3 | 0:07–0:10 | Zoom na hrad, detail věže. | Text: **„Kolik z jeho příběhů jsi opravdu viděl?"** | push-in, hudba nasadí první akord |

### Scéna 2 – Název a průvodci (0:10 – 0:20)
| # | Čas | Záběr | Obsah |
|---|---|---|---|
| 2.1 | 0:10–0:13 | Krajina z `Landscape.tsx` (ilustrovaná, vrstvené kopce) se vynoří z mlhy. | Kamera sjede z reálného záběru do ilustrace (match cut na siluetu kopce). |
| 2.2 | 0:13–0:18 | Tři průvodci vyskočí (animace `hop-in`): **Bóža** (vlevo), **Vřídla** (střed), **Kukadlo** (vpravo). | Pod každým se na zlomek vteřiny objeví jméno a role (písmo `font-hand`). |
| 2.3 | 0:18–0:20 | Titulek vyroste do celého záběru: **ZÁPAD GO** | Podtitul: *„Kraj, který se dá sbírat."* Hudební „hit" + ticho na 0,3 s. |

### Scéna 3 – Mapa (0:20 – 0:30)
| # | Čas | Záběr | Obsah |
|---|---|---|---|
| 3.1 | 0:20–0:24 | Telefon (mockup) na tmavém pozadí, na něm `/map`. Piny se rozsvěcují jeden po druhém podle kategorie (barvy z `CATEGORY`). | Text: **„Stovky míst z otevřených dat kraje."** (*doplnit přesné číslo z `/api` – počet features*) |
| 3.2 | 0:24–0:27 | Zoom na jeden pin → karta místa: název, vzdálenost, **nejbližší autobusová zastávka**. | Ikona autobusu, text: **„Bez auta? Taky to jde."** |
| 3.3 | 0:27–0:30 | Palec ťukne na „Vyrazit". | Hudba přidá perkusi. |

### Scéna 4 – Razítko (0:30 – 0:42)
**Klíčová scéna: ukazuje, že hra posílá lidi ven.**

| # | Čas | Záběr | Obsah |
|---|---|---|---|
| 4.1 | 0:30–0:34 | Reálný záběr: člověk (zezadu, **bez obličeje**, kvůli GDPR a dětem) stoupá k rozhledně, v ruce telefon. | Přes obraz se kreslí kruh o poloměru 300 m, který se zmenšuje. |
| 4.2 | 0:34–0:38 | Screen záznam: tlačítko „Vyfotit místo", foto rozhledny, ověření polohy. | Text: **„Dojdi blíž než 300 m. Poloha se ověří."** |
| 4.3 | 0:38–0:42 | **Razítko** dopadne na stránku Pasu (slow-mo, částice, haptický „thud" ve zvuku). | Text: **„Razítko je tvoje."** |

### Scéna 5 – Zrození PETa (0:42 – 0:55)
**Vizuální vrchol první půlky.** Ukazuje, že tvor není náhodný: je z místa, foto a hráče.

| # | Čas | Záběr | Obsah |
|---|---|---|---|
| 5.1 | 0:42–0:46 | Razítko praskne, ze světla vzniká vajíčko/jiskra. Kolem rotují tři malé „DNA" řetězce: *místo + foto + hráč*. | Text: **„Tvor se zrodí z místa, které jsi dobyl."** |
| 5.2 | 0:46–0:51 | Odhalení PETa (`PetCard`), rarity glow (common šedá → rare modrá → epic fialová → **legendary zlatá**). Pomalu se otáčí, staty naběhnou. | Jméno, typ (např. *Vyhlídal*, Výhled), statové pruhy HP/ATK/DEF/SPD/MAG. |
| 5.3 | 0:51–0:55 | Rychlý montage: stejný PET ve třech podobách – **Mládě → Dospělec → Prastarý**. | Text: **„Každý hráč má jiného. A roste s tebou."** |

### Scéna 6 – Typová věž (0:55 – 1:02) *(dá se vystřihnout)*
| # | Čas | Záběr | Obsah |
|---|---|---|---|
| 6.1 | 0:55–1:02 | Pět PETů v kruhu, šipky mezi nimi se rozsvěcují: Pevnost → Výhled → Příroda → Pramen → Kultura → Pevnost. | Text: **„Žádný tvor není nejsilnější. Vyber toho správného."** |

### Scéna 7 – Souboj (1:02 – 1:15)
**Epický vrchol. Tady musí hudba vybuchnout.**

| # | Čas | Záběr | Obsah |
|---|---|---|---|
| 7.1 | 1:02–1:05 | Dvě telefony vedle sebe (dva hráči), mezi nimi blesk. Matchmaking „Soupeř nalezen". | Text: **„Souboj v reálném čase."** |
| 7.2 | 1:05–1:12 | Střih rychlých momentů z `/battle`: **Ohnivá střela z hradeb**, **Blesk z výšin**, **Gejzír**, **Koláčová smršť**. Každý efekt (`fx`: projectile, bolt, geyser, rain) na tvrdý beat. Čísla zranění létají. | Slow-mo na poslední úder, HP bar spadne na nulu. |
| 7.3 | 1:12–1:15 | Vítěz zvedne tlapu, konfety v barvách kraje. | Text: **„Každý tah počítá server. Nikdo nepodvádí."** (anticheat + serverový zdroj stavu) |

### Scéna 8 – Postup a komunita (1:15 – 1:25)
| # | Čas | Záběr | Obsah |
|---|---|---|---|
| 8.1 | 1:15–1:19 | Pas se zaplňuje razítky, vyskakují odznaky: 🏰 Hradní pán, 🗼 Rozhledník, 💧 Pramenař, 🥨 Dobrotník. | Hudba: sbor nasazuje. |
| 8.2 | 1:19–1:22 | Questy: **Místo dne**, **3 místa týdně**, **Ochutnej Dobrotu**. | Text: **„Každý den nový důvod vyrazit."** |
| 8.3 | 1:22–1:25 | Týmový žebříček, třída vs. třída. | Text: **„Soutěž s kamarády, ne s obrazovkou."** |

### Scéna 9 – Dopad na region (1:25 – 1:32) *(dá se vystřihnout)*
| # | Čas | Záběr | Obsah |
|---|---|---|---|
| 9.1 | 1:25–1:32 | Stránka `/insights`: mapa zahoří, hlavní kategorie a okresy se vybarví podle návštěvnosti. Skokem na místo **Dobroty** (místní výrobce). | Text: **„Turisté dojdou i tam, kam se jinak nedostanou. A utratí to u místních."** |

### Scéna 10 – Finále a výzva (1:32 – 1:40)
| # | Čas | Záběr | Obsah |
|---|---|---|---|
| 10.1 | 1:32–1:36 | Pohled z výšky na kraj, ve kterém svítí tisíce pinů/stop (stylizovaně). Tři průvodci stojí na hřebeni. | Text: **„Karlovarský kraj. Odemkni ho celý."** |
| 10.2 | 1:36–1:40 | Logo **ZÁPAD GO**, QR kód na živou aplikaci, tým, název hackathonu. | Poslední akord, dozvuk do ticha, fade to black. |

---

## 3. Hudba

### Doporučený postup
1. **Vygenerovat skladbu** přes Suno / Udio (jedna skladba 1:40, ať je to jeden kus) nebo vybrat royalty-free (Pixabay Music, Uppbeat, Artlist, Epidemic Sound). **Zkontrolovat licenci pro soutěžní/veřejné použití a uložit odkaz.**
2. Pokud generujete, použijte tento prompt:

> *Epic cinematic trailer score, 1 minute 40 seconds. Starts with sparse ambient pads and a lone piano, wind in the background. Builds with low strings ostinato and war drums. At 0:20 a big hit followed by a heroic theme with brass and strings. At 1:00 a short silence, then a full orchestral climax with choir and taiko drums. Ends on one sustained major chord with long reverb tail. No vocals except wordless choir. Inspired by Hans Zimmer and Two Steps From Hell, but with a warm, adventurous, almost folk-fantasy feel.*

### Hudební osnova (synchronizace se střihem)

| Čas | Hudba | Obraz |
|---|---|---|
| 0:00–0:10 | vítr, nízký drone, jediný tón piana | Hook, krajina |
| 0:10 | první akord (pad + smyčce) | „Kolik z jeho příběhů…" |
| 0:18–0:20 | riser (náběh) | titulek |
| **0:20** | **HIT** + ticho 0,3 s, pak ostinato smyčců | **ZÁPAD GO** |
| 0:20–0:42 | rytmus se zrychluje, perkuse | mapa → razítko |
| **0:38** | tupý úder (thud) sladěný s dopadem razítka | razítko v Pasu |
| 0:42–0:55 | téma v dřevěných dechách a harfě, jemný zázračný „shimmer" | zrození PETa |
| 0:55–1:02 | napětí, tiká hodiny, rostoucí riser | typová věž |
| **1:02** | **DROP**: plný orchestr, taiko | souboj |
| 1:02–1:15 | každý efekt kouzla na doby (beat), slow-mo na break | souboj |
| 1:15–1:25 | sbor „aaah", triumfální téma | odznaky, žebříček |
| 1:25–1:32 | dozní do jemnější verze tématu | dopad na region |
| 1:32–1:40 | závěrečný crescendo → jediný dlouhý akord s dozvukem | logo, QR |

### Zvukové efekty (SFX) – samostatná stopa
- razítko: dřevěný „thud" + papírové zašustění
- zrození PETa: skleněný zvonek + vzdušný „whoosh"
- kouzla: ohnivá střela (svist + výbuch), blesk (praskot), gejzír (voda + bublání), koláčová smršť (hravé „pop")
- HP bar: mechanické cvaknutí, hlasité „KO" na posledním úderu
- UI: lehké kliknutí při ťuknutí palcem

---

## 4. Jak to vyrobit (tady jste se ptal na „Framer")

**Úprava termínu:** Framer je nástroj na tvorbu webů, ne videa. Video z něj nevypadne. Pro tento případ jsou vhodné dvě cesty:

### Varianta A (doporučená): **Remotion** – video napsané v Reactu
- Remotion vyrenderuje MP4 z React komponent. Dá se přímo **zavést existující komponenty z aplikace** (`PetArt`, `Landscape`, `GuideAvatar`, `TrailMark`), takže video vypadá přesně jako aplikace.
- **Claude Code umí napsat celý Remotion projekt** (scény jako komponenty, časování podle tabulky výše, titulky, přechody) a vyrenderovat ho příkazem `npx remotion render`.
- Reálné záběry aplikace nahrajeme pomocí **Playwright** (skript, který projde `/map` → `/place` → `/pets` → `/battle` a nahraje video v rozlišení telefonu). Vloží se do mockupu telefonu.

### Varianta B: ruční střih (záloha)
- **DaVinci Resolve** (zdarma) nebo **CapCut**: screen záznamy z telefonu + stock záběry + hudba.
- Hodí se, pokud se Remotion „nepovede" v časovém limitu.

### Zdroje obrazu
| Co | Odkud |
|---|---|
| Letecké záběry kraje, hrady, mlha | Pexels / Pixabay video, vlastní dron, případně AI video (Runway, Veo, Kling) – **označit jako AI** |
| UI aplikace | živý záznam z `localhost` / produkční verze |
| Mockup telefonu | Remotion komponenta (rámeček), případně prázdný frame z Figma Community |
| Písma | stejná jako v aplikaci (kvůli kontinuitě), nadpisy tučné, popisky `font-hand` |

### Barevný grading
Zachovat paletu aplikace: **tmavě zelená** (`--hill-near`), krémově bílá `#f6f8f1`, jeden akcent pro každou kategorii (hrady červená, rozhledny modrá, prameny zelená…). Lehká filmová zrna (grain), vinětace, teplé světlo na krajině.

---

## 5. Časový plán (zbývá ~20 h)

| Kdy | Co | Kdo |
|---|---|---|
| **Hned** | Vybrat hudbu / vygenerovat skladbu. Hudba určuje střih. | člověk |
| **Hned** | Claude postaví kostru Remotion projektu (10 scén jako prázdné komponenty + časová osa + hudba). | Claude |
| H+2 až H+14 | Vyvíjí se aplikace. **Video se nenatáčí**, jen se připravují scény, které se nemění (scény 1, 2, 5, 6, 10). | Claude |
| **H−6** (6 h před odevzdáním) | **Zmrazit featury (feature freeze).** Naseedovat demo data (hezké PETy, plný Pas, žebříček). | tým |
| H−5 až H−3 | Natočit živé záznamy aplikace (Playwright + telefon), terénní záběr (scéna 4). | tým + Claude |
| H−3 až H−1 | Smontovat, doladit synchronizaci s hudbou, render. | Claude + člověk |
| H−1 | Kontrola na jiném zařízení / projektoru, záložní MP4 na USB a v cloudu. | tým |

---

## 6. Sloty pro nové featury

Pokud se během zbývajících hodin objeví něco nového, vejde se sem (každá scéna max. 6–8 s):

| Možná featura | Kam ve videu | Úprava |
|---|---|---|
| Mlha války (mapa se odkrývá) | scéna 3 | přidat záběr: mapa je zahalená, pod prstem se rozplývá |
| AI stylizace fotky na tvora | scéna 5 | foto se přímo před očima promění v PETa (**nejsilnější vizuální moment**) |
| Koupací místa / kvalita vody (léto) | scéna 8 | sezónní odznak s vlnou |
| Push notifikace „jsi blízko hradu" | scéna 4 | zvonek na telefonu |
| Lepší AI lore (příběh tvora) | scéna 5 | text se píše pod PETem |
| Nový typ souboje / turnaj | scéna 7 | rozšířit montage |
| Školní žebříček pro středoškoláky | scéna 8 | zvýraznit, pokud cílíte na soutěž |

---

## 7. Co nesmí ve videu chybět (kritéria hackathonu)

- [ ] **Použitá otevřená data** viditelně (logo / titulek „Data: datazapad.cz, Dobroty Karlovarského kraje") – ideálně ve scénách 3 a 9.
- [ ] **Přínos pro region**: lidé jdou do terénu, k místním výrobcům, bez auta.
- [ ] **Ochrana dětí (GDPR)**: žádné obličeje, fotky se nezveřejňují. Jedna věta ve scéně 4 nebo v závěru: *„Foť místo, ne lidi."* (už je v aplikaci).
- [ ] **Bezpečnost**: nebezpečná místa nedávají odznaky (`is_hazardous`), nezmiňovat zbytečně, ale mít připravené do Q&A.
- [ ] **Veřejný odkaz / QR** na poslední snímek.
- [ ] **Titulky** v češtině (porota může sledovat bez zvuku na projektoru).
- [ ] **Licence** hudby a stock záběrů zapsaná v popisku.

---

## 8. Poznámky k prezentaci

- Video pustit **na začátku**, ne uprostřed: za 100 s se vytvoří nálada a pak mluvíte 3 min naživo a ukážete aplikaci.
- Připravte **verzi bez hudby** (jen titulky) pro případ, že na místě nebude fungovat zvuk.
- Připravte **15 s trailer** (scény 1.3 + 2.3 + 5.2 + 7.2 + 10.2) na sociální sítě a na úvodní slide.
