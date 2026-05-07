# nokta-hoop

`nokta-hoop`, Nokta fikir kuluçka akışına insan döngüsü yönetişimi,
gerçek zamanlı danışmanlık ve transkript tabanlı bilgi geri yazımı ekleyen
bir orkestrasyon katmanıdır.

Bu proje yalnızca bir video görüşme uygulaması değildir. Uzun vadeli hedef,
Nokta içindeki fikirlerin yapılandırılmış insan değerlendirmesinden geçmesini
sağlamaktır: öğrenci, kurucu, mentor veya uzman gerçek zamanlı görüşebilir;
görüşme transkript olarak kaydedilir; bu insan geri bildirimi daha sonra karar
kayıtlarına, wiki hafızasına ve sonraki fikir iterasyonlarına aktarılabilir.

Bu repodaki ilk çalışan parça, gerçek zamanlı danışmanlık katmanıdır:
Stream Video ile çalışan Android development build, otomatik transkript alma
ve transkripti dışa aktarma akışı.

## Proje Amacı

Nokta tarafında fikir gelişimi çoğunlukla asenkron bir artifact akışı olarak
ilerler: fikir belgeye, spece, pull request'e veya değerlendirme hedefine
dönüşür. `nokta-hoop`, bu akışın etrafına eksik olan insan etkileşimi
katmanını ekler.

Hedeflenen ürün yönü:

- Riskli veya önemli kararlar için HITL/HOTL/HOOTL yönetişim akışları.
- Mentor/uzman ile gerçek zamanlı video veya sesli danışmanlık.
- Görüşme transkriptlerinin kalıcı proje kanıtı olarak saklanması.
- Transkriptlerin wiki, hafıza, karar logları veya RAG benzeri bilgi katmanına
  geri yazılması.
- İleride yapılandırılmış insan değerlendirmesi için policy ve escalation
  adapter'ları.
- Uygun yerlerde AI/avatar destekli danışmanlık akışları.

## Mevcut Uygulama

Şu anki kod tek bir çalışan MVP'ye odaklanır:

- Android Expo dev-client mobil uygulaması.
- Stream Video oda katılım akışı.
- Dinamik guest kullanıcılar.
- Lokal Stream token server.
- Görüşme başladığında otomatik transkripsiyon başlatma.
- Görüşme bittiğinde transkripsiyonu durdurma ve transkripti bekleme.
- Kullanıcının beklemesi gerektiğini gösteren transcript loading durumu.
- Transkript okuma ekranı.
- Transkripti Markdown, düz metin veya JSON olarak dışa aktarma.

Bu parça, daha büyük Hoop iş akışının temelidir: önce insan görüşmesini
güvenilir biçimde yakalamak, sonra bu transkripti yönetişim ve writeback
özelliklerine bağlamak.

## Repo Yapısı

```text
nokta-hoop/
|-- apps/
|   `-- mobile/              # Expo React Native dev-client uygulaması
|-- packages/
|   `-- hoop-call/           # Görüşme ID ve transkript yardımcıları
|-- services/
|   `-- token-server/        # Stream token, transcript ve export backend'i
|-- DEVELOPER_SETUP.md       # Android geliştirici kurulum rehberi
|-- CHANGELOG.md             # Sürümlendirilmiş değişiklik günlüğü
|-- AGENT.md                 # Ajan çalışma kuralları
|-- DESIGN.md                # Tasarım yönü
|-- IDEA.md                  # Tam ürün ve mimari fikri
`-- PLAN.md                  # İlk repo planı
```

`example/`, `node_modules/`, lokal `.env` dosyaları ve generated build çıktıları
Git dışında bırakılır.

## MVP Nasıl Çalışır?

1. Mobil uygulama `services/token-server` servisinden Stream user token ister.
2. Token server, Stream API secret ile token üretir.
3. Kullanıcı Stream Video odasına katılır.
4. Uygulama görüşme için Stream transkripsiyonunu başlatır.
5. Kullanıcı görüşmeyi bitirdiğinde transkripsiyon durdurulur.
6. Transcript ekranı hemen açılır ve işlem sürüyorsa loading durumu gösterir.
7. Mobil uygulama, Stream transcription asset hazır olana kadar token server'ı
   yoklar.
8. `packages/hoop-call` transkripti parse eder ve formatlar.
9. Transkript uygulama içinde okunabilir veya MD, TXT, JSON olarak dışa
   aktarılabilir.

## Gereksinimler

- Node.js LTS
- npm
- Android Studio ve Android SDK
- Java JDK 17
- Stream Video API key ve secret
- Stream uygulamasında veya call type tarafında transcription özelliği
- Fiziksel telefon testi için gerektiğinde Cloudflare Tunnel client
- Nokta Hoop Android dev-client APK

Uygulama Expo Go içinde çalışmaz. Stream Video native WebRTC modülleri
kullandığı için projeye özel dev-client APK gerekir.

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
```

`apps/mobile/.env`:

```env
EXPO_PUBLIC_STREAM_API_KEY=your_stream_api_key
EXPO_PUBLIC_TOKEN_SERVER_URL=https://your-token-server-url
EXPO_PUBLIC_STREAM_ENABLE_TRANSCRIPTION=true
EXPO_PUBLIC_STREAM_TRANSCRIPTION_LANGUAGE=tr
```

Gerçek Stream secret değerleri commit edilmemelidir.

## Kurulum

```powershell
npm install
```

## Çalıştırma

Token server'ı başlat:

```powershell
npm run server:dev
```

Telefon testi için token server'ı dışarı aç:

```powershell
cloudflared tunnel --url http://127.0.0.1:8787
```

Cloudflare'ın ürettiği URL'yi `apps/mobile/.env` içindeki
`EXPO_PUBLIC_TOKEN_SERVER_URL` değerine yaz, sonra Metro'yu yeniden başlat.

Metro'yu başlat:

```powershell
npm run mobile:start -- --clear
```

Gerekirse Android dev-client build al:

```powershell
npm run mobile:android
```

Oluşan debug APK genellikle buradadır:

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Detaylı Android kurulum adımları `DEVELOPER_SETUP.md` içinde yer alır.

## Komutlar

```powershell
npm run server:dev       # Token/transcript backend'ini başlatır
npm run mobile:start     # Expo Metro'yu başlatır
npm run mobile:android   # Android dev-client build/install yapar
npm run typecheck        # Aktif workspace'leri typecheck eder
npm run test             # Paket testlerini çalıştırır
```

## Token Server API

```text
GET  /health
GET  /users
POST /token
GET  /calls/:callType/:callId/transcriptions
GET  /calls/:callType/:callId/transcript
GET  /calls/:callType/:callId/export?format=md|txt|json
```

## Kapsam

Şu an implement edilenler:

- Android Stream Video görüşme akışı.
- Token backend.
- Transkript alma ve parse etme.
- Transkript dışa aktarma.

Daha büyük `nokta-hoop` fikrinde planlananlar:

- Hoop policy ve runtime orkestrasyonu.
- HITL/HOTL/HOOTL escalation akışları.
- Slack, WhatsApp veya email gibi adapter kanalları.
- Transkriptin wiki'ye geri yazılması.
- Bilgi hafızası ve karar logları.
- AI/avatar destekli danışmanlık.

## Doğrulama

```powershell
npm run typecheck
npm run test
```
