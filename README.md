# KepingUang v4.0 — Multi-user Edition

Sistem informasi keuangan pribadi berbasis web, siap dijalankan secara publik.

## Cara Deploy ke Railway (Pertama Kali)

Ikuti **PANDUAN_DEPLOY_RAILWAY.md** secara berurutan.
Estimasi: 30–60 menit.

## Cara Jalankan Secara Lokal (Untuk Testing)

Butuh PostgreSQL terinstall di laptop, lalu:

```bash
npm install
DATABASE_URL=postgresql://localhost/kepinguang node server.js
```

## Struktur File

```
KepingUang/
├── server.js          # Express server + semua API route
├── database.js        # PostgreSQL data layer (multi-user)
├── auth.js            # Autentikasi: hash password, cookie, middleware
├── validators.js      # Validasi input server-side
├── package.json       # Dependensi: express + pg
├── Procfile           # Instruksi Railway untuk menjalankan app
├── .gitignore         # File yang tidak boleh terupload ke GitHub
└── public/
    ├── index.html     # Struktur HTML + auth gate (register/login)
    ├── app.css        # Stylesheet
    └── js/
        ├── auth.js    # Login & register frontend
        ├── main.js    # Boot sequence
        ├── actions.js # Add/edit/delete data
        ├── api.js     # HTTP request wrapper
        ├── checkpoint.js # Snapshot management
        ├── helpers.js # Currency, formatter, utilitas
        ├── render.js  # Render semua section
        ├── state.js   # Global state + undo/redo
        └── ui.js      # Modal, toast, UI helpers
```

## Perubahan dari v3.x (Lokal) ke v4.0 (Multi-user)

| Aspek | v3.x | v4.0 |
|---|---|---|
| Database | SQLite (node:sqlite) | PostgreSQL |
| User | Satu user, satu password | Banyak user, email + password |
| Session | sessions.json | Tabel `sessions` di database |
| Deploy | Laptop lokal | Railway (cloud) |
| Registrasi | Setup password sekali | Register dengan email |

## Dependensi

- Node.js >= 18
- PostgreSQL (disediakan Railway sebagai add-on)
- `express` ^4.18.2
- `pg` ^8.11.3
