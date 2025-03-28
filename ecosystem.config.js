module.exports = {
  apps: [
    {
      name: "discord-bot", // Naziv vašeg procesa u PM2
      script: "index.js",  // Ulazni fajl vašeg bota
      instances: 1,        // Koliko instanci da pokrene (1 je dovoljno za Discord bota)
      autorestart: true,   // Automatski restartuje bot ako pukne
      watch: false,        // Ako je `true`, PM2 će restartovati bot pri promeni fajlova (korisno za razvoj)
      max_memory_restart: "500M", // Restartuje bot ako pređe 500MB memorije
      env: {
        NODE_ENV: "production", // Postavlja Node okruženje na produkciju
      },
      // Log fajlovi
      error_file: "./logs/error.log",   // Greške
      out_file: "./logs/out.log",      // Standardni output
      merge_logs: true,                // Spaja sve logove u jedan
      time: true,                      // Dodaje vremenske oznake u logove
    },
  ],
};