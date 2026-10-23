# Connective: app band ho tab bhi ring (Push setup)

Ek baar ka kaam hai, lagbhag 10 minute. Sirf **ek** insaan ye karega (aap). Baaki sab ko bas address milega.
Relay sirf phone ko jagata hai. Chat aur call ki awaaz ko wo kabhi nahi dekhta.
Cloudflare ka free plan kaafi hai.

## 1. Relay banao (Cloudflare)

1. dash.cloudflare.com par free account banao ya login karo.
2. **Workers & Pages** kholo, phir **Create**, phir **Create Worker**. Naam rakho `connective-push`, aur **Deploy** dabao.
3. **Edit code** dabao. Jo code pehle se likha hai wo poora mita do. Is folder ki `push-worker.js` file ka poora code paste karo, phir **Deploy** dabao.
4. Left menu me **Storage & Databases**, phir **KV**, phir **Create a namespace**. Naam rakho `connective-kv`.
5. Wapas apne worker me jao: **Settings**, phir **Bindings**, phir **Add**, phir **KV namespace**.
   - **Variable name** me bilkul `KV` likho (capital letters).
   - Namespace me `connective-kv` chuno, aur save/deploy karo.
6. Worker ka address copy karo, jaise `https://connective-push.aapkanaam.workers.dev`.
7. Check: us address ko browser me kholo. "Connective push relay is running." likha aana chahiye. Address ke aage `/vapid` laga ke kholo to ek lambi si text aani chahiye.

(Cloudflare ke menu ke naam kabhi thode badal jaate hain, par cheezein yahi rehti hain: Worker, KV namespace, aur binding ka naam `KV`.)

## 2. Address app me daalo

**Aasaan tareeka (sabke liye ek saath):** `chat.html` kholo, ye line dhundo:

```js
const DEF_PUSH='';
```

aur address daal do:

```js
const DEF_PUSH='https://connective-push.aapkanaam.workers.dev';
```

GitHub par `chat.html` ko commit karo. Sab ke phone me address apne aap aa jayega.

**Dusra tareeka:** har phone me Settings, phir "Ring me when the app is closed", wahan address paste karo.

## 3. Har phone par ON karo

1. Connective kholo, phir Settings (⚙).
2. "Ring me when the app is closed" me **Turn on** dabao.
3. Notifications ki ijazat do. "On" likha aa jaye to ho gaya.

**iPhone:** pehle Safari me Share dabao, phir **Add to Home Screen**, aur app wahin se kholo. Iske bina iPhone par push nahi chalta (iOS 16.4 ya naya chahiye).

**Android:** Chrome me app install karna behtar hai. Phone ki settings me Connective ko battery restriction se bahar rakho.

## Kaise kaam karta hai

- Aap kisi ko call karte ho, to uske phone par "Aap ka naam is calling" notification aata hai. Tap karne par app khulta hai aur call judti hai.
- Call uthne se pehle aap kaat do, to uske phone par "Missed call from ..." aa jata hai.
- Naye message par "Naam, New message" aata hai. Message ka matlab notification me nahi aata.
- App khuli ho to notification nahi aata, app khud sambhal leti hai.

## Agar kaam na kare

- "Could not turn on": address galat ho sakta hai, ya KV binding ka naam `KV` nahi hai. Step 7 dobara check karo.
- Notification nahi aata: browser ki settings me site ke notifications allowed hain ya nahi dekho. Android par app ko battery restriction se bahar rakho.
- Call uthane me der ho (1 minute se zyada) to wo missed call ban jati hai. Isliye notification par jaldi tap karo.
- Free plan ki limit: roz 100,000 requests. Family ke liye bahut zyada hai.
