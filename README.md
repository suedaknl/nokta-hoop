# nokta-hoop

`nokta-hoop`, Nokta fikir geliştirme akışına AI destekli Mascot, insan
mentor/uzman devri, gerçek zamanlı video görüşme ve transkript tabanlı bilgi
geri yazımı ekleyen bir orkestrasyon katmanıdır.

Bu proje yalnızca bir video görüşme uygulaması değildir. Amaç, kullanıcının
Mascot ile konuşurken gerektiği noktada bir insana bağlanabilmesi, görüşmenin
transkript olarak yakalanması ve bu insan bilgisinin sonraki konuşma bağlamına
geri dönebilmesidir.

## Mevcut Ürün Akışı

Şu an çalışan MVP akışı:

1. Kullanıcı mobil uygulamada Nokta Mascot ile konuşur.
2. Mascot cevap üretir veya konunun uzman gerektirip gerektirmediğine karar
   verir.
3. Kullanıcı açıkça uzman/mentor isterse mentor isteği hemen oluşturulur.
4. Konu uzmanlık gerektiriyorsa Mascot önce kullanıcıdan onay ister.
5. Mentor, uygulamadaki mentor kuyruğundan isteği kabul eder.
6. Kabul sonrası Mascot gizlenir ve Stream Video görüşmesi açılır.
7. Taraflardan biri görüşmeyi bitirince görüşme herkes için kapanır.
8. Stream transcript hazırlanır.
9. Transcript hazır olunca Mascot konuşmasına geri eklenir.
10. Transcript uygulama içinde okunabilir ve MD, TXT veya JSON olarak dışa
    aktarılabilir.

Konuşma olmayan görüşmelerde transcript bekleme sonsuza kadar sürmez; uygulama
görüşmeyi tamamlanmış kabul eder ve “konuşma algılanmadı” mesajı gösterir.

## Özellikler

- Android Expo dev-client mobil uygulaması.
- 3D Nokta Mascot ekranı.
- Yazılı ve sesli kullanıcı girişi.
- Cihaz TTS motoru ile Mascot sesli cevapları.
- Opsiyonel Groq destekli Mascot cevapları.
- Groq yoksa deterministic fallback karar motoru.
- Uzmanlık sinyallerinde mentor yönlendirme kararı.
- Uzmanlık önerisi için kullanıcı onayı.
- Mentor istek kuyruğu.
- Mentor kabul edince Stream Video handoff.
- Görüşme sonlandığında iki tarafın da görüşmeden çıkması.
- Stream transcription başlatma/durdurma.
- Transcript polling, okuma ekranı ve export.
- Chat sıfırlama.

## Repo Yapısı

```text
nokta-hoop/
|-- apps/
|   `-- mobile/              # Expo React Native dev-client uygulaması
|-- packages/
|   |-- hoop-call/           # Stream call ID, transcript parse/format yardımcıları
|   `-- hoop-core/           # Mascot, escalation ve transcript dönüş domain mantığı
|-- services/
|   `-- token-server/        # Stream token, Mascot decision, escalation ve transcript API
|-- DEVELOPER_SETUP.md       # Yeni geliştirici Android kurulum rehberi
|-- CHANGELOG.md             # Sürümlendirilmiş değişiklik günlüğü
|-- AGENT.md                 # Ajan çalışma kuralları
|-- DESIGN.md                # Tasarım yönü
|-- IDEA.md                  # Ürün fikri
`-- PLAN.md                  # Repo planı
```

`example/`, `node_modules/`, lokal `.env` dosyaları ve generated build çıktıları
Git dışında bırakılır.

## Temel Mimari

Mobil uygulama doğrudan Stream secret veya Groq key taşımaz. Bunlar
`services/token-server` içinde tutulur.

```text
Mobile app
  -> token-server /mascot/decide
  -> token-server /escalations
  -> token-server /token
  -> Stream Video SDK
  -> token-server /calls/:type/:id/transcript
```

`token-server` şu işleri yapar:

- Stream user token üretir.
- Mascot karar endpoint’ini sunar.
- Groq varsa AI cevap/karar üretir.
- Groq yoksa `hoop-core` deterministic karar motorunu kullanır.
- Mentor escalation isteklerini bellekte tutar.
- Stream transcript asset’lerini alır, parse eder ve export eder.
- Görüşmeyi herkes için sonlandıran Stream call end endpoint’ini proxy eder.

## Gereksinimler

- Node.js LTS
- npm
- Android Studio ve Android SDK
- Java JDK 17
- Stream Video API key ve secret
- Stream Video transcription özelliği
- Cloudflare Tunnel client (`cloudflared`)
- Nokta Hoop Android dev-client APK
- Opsiyonel: Groq API key

Uygulama Expo Go içinde çalışmaz. Stream Video native WebRTC modülleri kullandığı
için özel dev-client APK gerekir.

## Ortam Dosyaları

Lokal ortam dosyalarını oluştur:

```powershell
copy services\token-server\.env.example services\token-server\.env
copy apps\mobile\.env.example apps\mobile\.env
```

`services/token-server/.env`:

```env
PORT=8787
HOST=0.0.0.0
STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret
ALLOWED_ORIGINS=*
STREAM_TRANSCRIPTION_LANGUAGE=tr
GROQ_API_KEY=optional_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
```

`apps/mobile/.env`:

```env
EXPO_PUBLIC_STREAM_API_KEY=your_stream_api_key
EXPO_PUBLIC_TOKEN_SERVER_URL=https://your-token-server-url
EXPO_PUBLIC_STREAM_ENABLE_TRANSCRIPTION=true
EXPO_PUBLIC_STREAM_TRANSCRIPTION_LANGUAGE=tr
```

Gerçek secret, API key ve lokal `.env` dosyaları commit edilmemelidir.

## Kurulum

```powershell
npm install
```

## Çalıştırma

Token server:

```powershell
npm run server:dev
```

Telefon testi için token server’ı dışarı aç:

```powershell
cloudflared tunnel --url http://127.0.0.1:8787
```

Cloudflare’ın verdiği URL’yi `apps/mobile/.env` içindeki
`EXPO_PUBLIC_TOKEN_SERVER_URL` değerine yaz ve Metro’yu yeniden başlat.

Metro:

```powershell
npm run mobile:start -- --clear
```

Android dev-client build:

```powershell
npm run mobile:android
```

Debug APK genellikle burada oluşur:

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Detaylı Android ve telefonda test adımları için `DEVELOPER_SETUP.md` dosyasını
kullan.

## Komutlar

```powershell
npm run server:dev       # Token/Mascot/escalation/transcript backend'i
npm run mobile:start     # Expo Metro
npm run mobile:android   # Android dev-client build/install
npm run typecheck        # Tüm workspace typecheck
npm run test             # Paket testleri
```

## Token Server API

```text
GET  /health
GET  /users
POST /token

POST /mascot/decide

GET  /escalations
POST /escalations
GET  /escalations/:id
POST /escalations/:id/accept
POST /escalations/:id/resolve

POST /calls/:callType/:callId/end
GET  /calls/:callType/:callId/transcriptions
GET  /calls/:callType/:callId/transcript
GET  /calls/:callType/:callId/export?format=md|txt|json
```

## Uzman Yönlendirme Mantığı

Mascot iki farklı davranış gösterir:

- Kullanıcı açıkça “uzman iste”, “mentor bağla” gibi bir şey söylerse mentor
  isteği doğrudan oluşturulur.
- Konu uzmanlık gerektiriyorsa Mascot önce kullanıcıdan onay ister.

Uzmanlık sinyalleri arasında hukuk, sağlık, finans, yatırım, pazar doğrulaması,
regülasyon, güvenlik, teknik doğrulama, algoritmalar, veri yapıları, çizge,
Hamilton döngüsü ve benzeri konular bulunur.

## Kapsam

Şu an implement edilen ana kapsam:

- Mascot tabanlı sohbet.
- Opsiyonel AI cevapları.
- Mentor escalation ve kabul akışı.
- Stream Video görüşme handoff.
- Görüşme transcript’i ve export.

Daha büyük `nokta-hoop` fikrinde ileride planlananlar:

- Kalıcı escalation storage.
- Mentor bildirimleri.
- Wiki/writeback entegrasyonu.
- Policy tabanlı HITL/HOTL/HOOTL akışları.
- Slack, WhatsApp, email gibi adapter kanalları.
- Transcript özetleme ve bilgi hafızasına yazma.

## Doğrulama

```powershell
npm run typecheck
npm run test
```
