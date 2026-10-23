# To you: har network par call + app band ho tab bhi ring

Ek baar ka kaam, lagbhag 15 minute. Sirf **ek** insaan (aap) ye karega. Baaki sab ko bas address milega.
Relay sirf phone ko jagata hai, call ke raste batata hai, aur messages ko pass karta hai. Chat aur call ki awaaz wo kabhi nahi padh sakta (sab locked rehta hai).
Cloudflare ka free plan family ke liye kaafi hai.

## 0. Pehle: GitHub repo me files theek rakho

Repo (`To-you-`) ke **sabse upar (root)** me ye files honi chahiye:

`index.html`, `chat.html`, `chat-sw.js`, `chat-manifest.json`, `chat-192.png`, `chat-512.png`, `chat-maskable-512.png`, `chat-apple-180.png`

Phir `https://uzan0096.github.io/To-you-/` kholne par app khud khul jayegi.
(Pehle sirf README dikh raha tha, kyunki `index.html` nahi thi.)

**Link hamesha Safari ya Chrome me kholo, WhatsApp ke andar nahi.** WhatsApp ke browser me app install nahi hoti, aur mic aur notification theek se nahi chalte.

## 1. Relay banao (Cloudflare)

1. dash.cloudflare.com par free account banao ya login karo.
2. **Workers & Pages**, phir **Create**, phir **Create Worker**. Naam `toyou-push` rakho, **Deploy** dabao.
3. **Edit code** dabao. Purana code mita ke `push-worker.js` ka poora code paste karo, phir **Deploy**.
4. **Storage & Databases**, phir **KV**, phir **Create a namespace**. Naam `toyou-kv`.
5. Worker me wapas jao: **Settings**, phir **Bindings**, phir **Add**, phir **KV namespace**.
   Variable name bilkul `KV` likho (capital). Namespace `toyou-kv` chuno. Save/deploy karo.
6. Worker ka address copy karo, jaise `https://toyou-push.aapkanaam.workers.dev`.
7. Check: address browser me kholo. "To you push relay is running." aana chahiye.

## 2. Har network par call ke liye (free call relay)

Isi se calls Wi-Fi, office ya mobile data, kisi bhi network par judti hain (port 443 par bhi).

1. Cloudflare dashboard me **Realtime** (pehle "Calls" naam tha), phir **TURN Server**, phir **Create**. Naam `toyou-turn`.
2. Do cheezein copy karo: **Turn Key ID** aur **API Token** (token sirf ek baar dikhta hai).
3. Apne worker me jao: **Settings**, phir **Variables and Secrets**, phir **Add**:
   - Type **Text**, naam `TURN_KEY_ID`, value wo Key ID.
   - Type **Secret**, naam `TURN_KEY_TOKEN`, value wo API token.
4. **Deploy** dabao.
5. Check: `https://aapka-address/turn` kholo. `iceServers` wali text aani chahiye.

Free limit: 1000 GB (Cloudflare ke hisaab se). Family ki calls ke liye bahut zyada hai.
Worker ka address kisi ko public mat bhejo, sirf family ko do.

## 3. Address app me daalo

`chat.html` kholo, ye line dhundo:

```js
const DEF_PUSH='';
```

address daal do:

```js
const DEF_PUSH='https://toyou-push.aapkanaam.workers.dev';
```

GitHub par commit karo. Sab ke phone me address apne aap aa jayega.
(Ya har phone me Settings, phir "Ring me when the app is closed", wahan address paste karo.)

## 4. Har phone par check karo

1. Settings (⚙) kholo, "Check my network" dabao. "Relay: working" aana chahiye.
2. "Ring me when the app is closed" me **Turn on** dabao aur notification allow karo.
3. Agar kisi ek network par call phir bhi na judi, to "Always use the relay" ON kar do.

**iPhone:** Safari me Share, phir **Add to Home Screen**, aur app wahin se kholo. Iske bina notification nahi aate (iOS 16.4 ya naya).
**Android:** Chrome me app install karo. Battery settings me To you ko restriction se bahar rakho.

## Ab ye hota hai

- **Calls:** direct raasta chalta hai to wahi, warna free relay se. Dono taraf ka raasta khud chun leti hai.
- **Messages:** ntfy.sh aapke network par block ho ya ruk-ruk ke chale, to app khud aapke relay ke raste messages bhejti aur leti hai.
- **Notifications:** call par "Naam is calling", call uthne se pehle kat jaye to "Missed call", naye message par "New message". App khuli ho to notification nahi aata.

## Agar kaam na kare

- "Could not turn on": address galat ho sakta hai, ya KV binding ka naam `KV` nahi hai. Step 1.7 dobara dekho.
- "Check my network" me Relay "NOT working": Step 2 ke `TURN_KEY_ID` aur `TURN_KEY_TOKEN` dobara dekho, phir `/turn` kholo.
- Call uthane me 1 minute se zyada lage to wo missed call ban jati hai. Notification par jaldi tap karo.
