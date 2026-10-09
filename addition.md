tvoříme projekt na hackathon 
https://kickk.cz/hackathon-2026/ 

a máme použít data z 
https://www.datazapad.cz/search?collection=dataset&layout=grid 

a klidně i jiné zdroje 

téma není nějak omezené
Doporučuju zůstat u Next.js jako PWA a přidat Firebase přímo z prohlížeče. Flutter bych nepřidával.

Proč ne Flutter
Porota to musí otevřít. Pravidla chtějí veřejně dostupný výstup. Web otevřou přes odkaz, kdežto aplikaci by museli instalovat (APK nebo TestFlight), což je u 5minutové prezentace riziko.
Dva projekty za 24 hodin jsou past. Next jako úvodka a Flutter jako aplikace znamená dvě codebase, dvakrát načtená data a dvakrát řešený login. Přitom Flutter nepotřebujeme k ničemu, co nejde ve webu:
GPS zvládne navigator.geolocation.
Foťák zvládne <input type="file" accept="image/*" capture>.
Instalace na plochu řeší PWA.
Flutter by dával smysl jen pro GPS na pozadí nebo push notifikace „jsi blízko hradu". To je mimo rozsah hackathonu.
Firebase ano, a z Next.js
Firestore, Auth a Storage jdou volat z webového klienta bez vlastního backendu. Vercel pořád stačí. Je to jemná změna proti původnímu „bez backendu", ale souboje a žebříčky bez sdíleného stavu nejdou. Statická data míst zůstávají v JSON z build skriptu.

Jak udělat PETa
Foto → generovaný tvor je nejrizikovější část, takže ji dělej ve dvou vrstvách:

Základ (nutný, bez API).
PET je karta s fotkou v rámečku.
Druh a staty se odvodí z dat místa: hrad = tank, pramen = léčitel, rozhledna = střelec. K tomu se přidá náhodné číslo seedované ID místa a hashem fotky.
Je to deterministické a obhajitelné.
Bonus (stretch). Stylizace fotky na tvora přes obrazový model v Next route handleru, s cachováním do Storage a fallbackem na základ. Je to nejefektnější, ale stojí peníze a čas a je to právě to „AI, které musíte obhájit". Dělal bych to až na konci.
Souboje
Dělej je asynchronně a automaticky:

Vyzyvatel pošle výzvu a výsledek se spočítá deterministicky ze statů obou PETů a sdíleného seedu.
Výsledek se zapíše do Firestore. Žádný realtime a žádné Cloud Functions.
Podvodu se nevyhneš, protože výpočet běží na klientovi. Pro hackathon to ale stačí a je to na jednu větu v prezentaci.
Funkce navíc
Řady odznaků podle typu (rozhledny, prameny) i podle okresu („celý okres Cheb").
Questy na Dobroty. Dataset má souřadnice provozoven, takže „ochutnej dobrotu od místního výrobce" posílá lidi k místním firmám. Dobrá odpověď na kritérium přínosu pro region.
Mlha války. Mapa se postupně odkrývá tam, kde jsi byl.
Týmy a školní žebříček. Cílí na soutěž středoškoláků.
„Jak se tam dostanu bez auta." U každého místa ukáže nejbližší autobusovou zastávku. Data o zastávkách už máme.
Léto. Koupací místa s kvalitou vody jako sezónní odznaky.
Rizika
GPS se dá falšovat. Ber ho jako čestný systém a poznamenej si to do prezentace.
Fotky a děti. Pravidla mluví o účastnících pod 18 let. Fotky lidí v obličeji bych neukládal veřejně a v prezentaci je potřeba zmínit GDPR.
Bezpečnost míst. Některá místa (zříceniny, doly) nejsou vhodná pro děti, tak jim nedávej odznaky za nebezpečné vstupy.
Plán na 24 hodin
Build skript: stáhne vrstvy míst, spojí je a vyexportuje JSON.
Mapa míst a razítko podle GPS (localStorage).
Foto a PET karta.
Firebase login a sdílený žebříček.
Auto-souboj.
Odznaky a questy na Dobroty.
(stretch) AI stylizace.
Kroky 1 až 3 dávají použitelné demo i kdyby se vše ostatní nestihlo.

Chceš, abych rozjel krok 1, tedy skript pro stažení a spojení datasetů míst do JSON? Potřebuju k tomu vědět jen jedno: které kategorie míst mají být ve hře (hrady, zámky, rozhledny, prameny, UNESCO, muzea, ...)?