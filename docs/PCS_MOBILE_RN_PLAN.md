# PCS FieldService — Native Tech-App (React Native + Expo)

**Implementierungsplan · Stand: 14. Juli 2026**
Ziel: Der **Techniker-Teil** von PCS FieldService (aktuell `app/mobile` als PWA) wird als **native iOS- und Android-App** ausgeliefert — über dieselbe Pipeline wie deine Chronicle-App.

---

## 1. Architekturentscheidung

**Gewählt: React Native + Expo (SDK 54), EAS Build/Submit.** Verworfen: Capacitor.

Begründung: Du betreibst mit Chronicle bereits eine **erprobte Expo/EAS-Pipeline** (Apple- + Play-Konten verdrahtet, iOS-Build in der Cloud ohne Mac, TestFlight, .aab-Upload). Diese Infrastruktur nutzen wir 1:1 wieder. Eine Toolchain über beide Apps statt paralleler Capacitor-Kette. Kein Apple-„Wrapper"-Ablehnungsrisiko. Echte native Push-Notifications.

Wir bleiben bewusst auf **SDK 54** (wie Chronicle), nicht auf dem neuesten SDK 56 — Konsistenz mit deiner laufenden Pipeline ist mehr wert als das neueste Release.

---

## 2. Projekt-Setup

**Neues, separates Expo-Projekt** (eigenes Repo/Ordner, eigener EAS-Slug, eigene Store-Einträge). Vorschlag: `C:\FSM\pcs-mobile\`.

Struktur nach Chronicle-Muster:

```
pcs-mobile/
  app.json              # Expo-Konfig (Bundle-IDs, Permissions, Plugins)
  eas.json              # Build-/Submit-Profile (aus Chronicle übernommen)
  index.ts              # registerRootComponent
  App.tsx               # Root: SafeArea → Auth → Navigation → Screens
  src/
    lib/supabase.ts     # RN-Supabase-Client (url-polyfill + AsyncStorage)
    lib/api.ts          # NEU: absolute Vercel-API-Base für /api-Aufrufe
    contexts/
      AuthContext.tsx   # PIN-Auth (aus authService portiert)
      LanguageContext.tsx  # EN/ES (aus app/mobile portiert)
    navigation/NavigationContext.tsx  # leichte eigene Navigation
    components/BottomTabBar.tsx, ErrorBoundary.tsx, ...
    screens/            # Tech-Screens (neu in RN gebaut)
    services/           # Datenlogik (aus app/mobile portiert)
    hooks/              # aus app/mobile portiert
    utils/              # aus app/mobile portiert (Berechnungen, Datum, i18n)
    offline/            # NEU: expo-sqlite statt IndexedDB
```

**Bundle-IDs (neu, getrennt von Chronicle `church.chronicle.app`):**
- iOS: `com.pcsllc.fieldservice` (Vorschlag — final bei dir)
- Android: `com.pcsllc.fieldservice`

---

## 3. Wiederverwenden vs. neu bauen

| Schicht | Aus `app/mobile` | Aufwand |
|---|---|---|
| **Utils** (Berechnungen, Datum, Formatter, Übersetzungen) | direkt portierbar | niedrig |
| **Services** (workOrder, dailyHours, availability, team, quote, auth) | portierbar, nur Supabase-Import + API-Base anpassen | niedrig–mittel |
| **Hooks** (useWorkOrders, useDailyHours, useAuth, useTeam, useAvailability, useQuotes) | portierbar, JSX-freie Logik | niedrig–mittel |
| **i18n / LanguageContext** | portierbar | niedrig |
| **Präsentation** (alle Screens, Modals, Cards) | **Neubau in RN** (div/button/input → View/Pressable/TextInput; Tailwind → StyleSheet/NativeWind) | **hoch** |
| **Offline** (IndexedDB + Service Worker) | **Neubau** mit `expo-sqlite` + Sync-Logik | mittel–hoch |
| **Auth** | PIN-Logik portierbar; UI neu | mittel |
| **Push** (web-push/VAPID) | **Neubau** mit `expo-notifications` (FCM/APNs) | mittel |

Kernaussage: **Die gesamte Geschäftslogik wandert weitgehend mit; neu gebaut wird die sichtbare Oberfläche, die Offline-Persistenz und Push.**

---

## 4. Datenzugriff

- **Supabase direkt:** Der Großteil der Daten läuft schon über den Supabase-Client (anon key, app-level PIN-Filterung, kein RLS — wie im Web). In RN identisch via `src/lib/supabase.ts`.
- **Absolute API-Base:** Die ~6 relativen `/api/...`-Aufrufe funktionieren in einer nativen App nicht (kein lokaler Server). Sie bekommen eine konfigurierbare Basis-URL auf deine Vercel-Domain:
  - `/api/push/subscribe`, `/api/push/send`
  - `/api/verify-photos/[wo]`, `/api/verify-writeups/[wo]`
  - `/api/verify-admin-pin`
  - `/api/weather`
  - `translationService` nutzt bereits die absolute LibreTranslate-URL — unverändert.

`src/lib/api.ts`:
```ts
export const API_BASE = 'https://<deine-vercel-domain>';
export const apiUrl = (path: string) => `${API_BASE}${path}`;
```

---

## 5. Feature-Mapping (Techniker-Funktionen)

Alle bestehenden Tech-Features werden abgebildet:

1. **Login / PIN-Auth** + PIN ändern
2. **Work-Order-Liste** (Status: Assigned, In Progress, Tech Review [rot pulsierend], Return Trip, Completed) + Completed-Ansicht
3. **Work-Order-Detail**: Check-In/Out, Kommentare, Materialien, Equipment, Zusatzkosten, Foto-/Writeup-Verify
4. **Daily Hours** (Erfassen/Bearbeiten, Primär- und Team-Techniker)
5. **Signatur-Erfassung** (Kunde) → `react-native-signature-canvas`
6. **Fotos/Belege** → `expo-image-picker` / `expo-camera`, Versand per E-Mail-Flow
7. **NTE-Erhöhung** erstellen (Logik aus `useQuotes`/`quoteService`)
8. **Verfügbarkeit** (18–20 Uhr EST Prompt-Fenster, Wochentagslogik)
9. **Team-Verwaltung**, Wetter-Widget
10. **EN/ES zweisprachig**
11. **Offline-Modus** (Check-In/Out, Kommentare, Status, Daily Hours, Completion offline; Sync bei Reconnect)
12. **Push-Notifications** (neue Work Order) — v1

---

## 6. Native Features & Plugins

- `expo-notifications` — native Push (FCM Android / APNs iOS)
- `expo-image-picker` + `expo-camera` — Fotos/Belege
- `expo-file-system` — Datei-/Bild-Handling
- `react-native-signature-canvas` — Kundensignatur
- `expo-sqlite` — Offline-Persistenz (ersetzt IndexedDB)
- `@react-native-async-storage/async-storage` — Session/Settings (wie Chronicle)
- `react-native-safe-area-context`, `expo-linear-gradient`, `expo-status-bar` — UI (wie Chronicle)

---

## 7. Push-Notifications v1 — Server-Anpassung

Deine aktuelle Web-Push-Infrastruktur (`web-push`/VAPID) funktioniert **nicht** für native Apps. Native braucht:

1. **Client:** `expo-notifications` holt einen **Expo Push Token**, speichert ihn in Supabase (Tabelle `push_subscriptions` erweitern um `expo_push_token` + Plattform).
2. **Server:** Neuer/erweiterter Endpoint sendet über die **Expo Push API** (`https://exp.host/--/api/v2/push/send`) an Expo-Tokens — parallel zum bestehenden Web-Push für die Browser-Nutzer.
3. **Credentials:** FCM-Server-Key (Android) in EAS hinterlegen; APNs-Key verwaltet EAS automatisch bei iOS-Builds.

So bleiben Web-Push (Dashboard/Browser) und native Push (App) nebeneinander bestehen.

---

## 8. Build & Store-Abgabe (bestehende Konten)

**EAS-Setup:** `eas.json` aus Chronicle übernommen (development/preview/production-Profile). Neuer EAS-Projekt-Slug `pcs-mobile` unter deinem Owner `pcsllcsc`.

**Android (Play Store):**
- `eas build --platform android --profile production` → `.aab`
- Neuer App-Eintrag in der Play Console; `google-service-account.json` (wie bei Chronicle) für `eas submit`
- Erst einmal manuell in „Internal testing" hochladen, dann via EAS Submit

**iOS (App Store):**
- `eas build --platform ios --profile production` → Cloud-Build (kein Mac nötig)
- `eas submit --platform ios` → App Store Connect → TestFlight
- Neuer App-Eintrag in App Store Connect (neue Bundle-ID); Review manuell einreichen

---

## 9. Phasen & realistischer Aufwand

| Phase | Inhalt | grober Umfang |
|---|---|---|
| **0** | Projekt scaffolden (Konfig, Supabase, Auth, Navigation, 1. Screen lauffähig) | kurz |
| **1** | WO-Liste + WO-Detail + Daily Hours (online) | mittel |
| **2** | Signatur, Fotos, NTE, Verfügbarkeit, Team, Wetter | mittel |
| **3** | Offline (expo-sqlite) + Sync | mittel–hoch |
| **4** | Push v1 (Client + Server) | mittel |
| **5** | EAS-Builds, Store-Einträge, TestFlight/Internal, Abgabe | mittel |

Realistisch ist das **mehrere Arbeitssessions**, kein Einzeltag — der Präsentations-Neubau + Offline sind die Brocken.

---

## 10. Offene Punkte / zu bestätigen

1. **Projektpfad**: `C:\FSM\pcs-mobile\` ok? (dafür brauche ich Zugriff auf `C:\FSM`)
2. **Bundle-IDs**: `com.pcsllc.fieldservice` ok, oder andere Wunsch-ID?
3. **App-Name im Store**: „PCS FieldService"? „EMF Mobile"? (aktueller PWA-Name: „EMF Mobile - Field Service")
4. **Vercel-Domain** für die absolute API-Base (Produktions-URL)?
5. **Design**: 1:1 an aktuelle PWA-Optik anlehnen, oder native-typisch neu (wie Chronicles dunkle Optik)?

---

## 11. Nächster Schritt

Nach deiner Freigabe: **Phase 0** — ich scaffolde das lauffähige Grundgerüst (Konfig + Supabase + PIN-Auth + Navigation + Login- und WO-Listen-Screen), das du auf dem Laptop mit `npm install` und `expo start` sofort testen kannst.
