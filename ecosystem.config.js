module.exports = {
  apps: [
    {
      name: "discord-bot", // Naziv vašeg procesa u PM2
      script: "index.js",  // Ulazni fajl vašeg bota
      instances: 1,        // Koliko instanci da pokrene (1 je dovoljno za Discord bota)
      autorestart: true,   // Automatski restartuje bot ako pukne
      watch: false,        // Ako je `true`, PM2 će restartovati bot pri promeni fajlova (korisno za razvoj)
      max_memory_restart: "1G", // Restartuje bot ako pređe 1GB memorije
      env: {
        NODE_ENV: "production", // Postavlja Node okruženje na produkciju
        PORT: process.env.PORT || 3000
      },
      env_production: {
        NODE_ENV: "production"
      },
      env_development: {
        NODE_ENV: "development",
        watch: true
      },
      // Log fajlovi
      error_file: "logs/err.log",   // Greške
      out_file: "logs/out.log",      // Standardni output
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,                // Spaja sve logove u jedan
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: "5s"
    },
  ],
};