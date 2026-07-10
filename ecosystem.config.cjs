// pm2 ecosystem — บอร์ดเกม 7 มหาราช
// รัน 2 โปรเซส: frontend (vite dev :5174 + proxy /api) และ backend (php -S :8000)
// ใช้ .cjs เพราะ package.json เป็น "type": "module"
// path อิง __dirname → วางโฟลเดอร์ไหนก็ใช้ได้ (C:\BoardGameAR หรือ C:\E-services\BoardgameAR-main)
//
// วิธีใช้ (ในโฟลเดอร์โปรเจกต์):
//   pm2 start ecosystem.config.cjs
//   pm2 save                 # จำ process list ไว้ให้ฟื้นหลังรีบูต
//   pm2 logs                 # ดู log รวม
//   pm2 restart all          # รีสตาร์ตหลัง git pull
//   pm2 delete all           # ลบทั้งหมด
//
// ⚠️ ต้องมี .env.local (VITE_API_BASE=/api) + server\config.php ก่อน ไม่งั้น API พัง
// ⚠️ php ต้องอยู่ใน PATH (หรือแก้ script ของ bg7-api เป็น full path เช่น "C:\\php\\php.exe")

const path = require('path');

module.exports = {
  apps: [
    {
      // frontend — vite dev server พอร์ต 5174 (เสิร์ฟหน้าเว็บ + proxy /api → php:8000)
      name: 'bg7-web',
      script: path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
      args: '--host 127.0.0.1 --port 5174',
      interpreter: 'node',
      cwd: __dirname,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
    },
    {
      // backend — php -S พอร์ต 8000 (เสิร์ฟ server\*.php + \uploads\*)
      name: 'bg7-api',
      script: 'php',
      args: '-S 127.0.0.1:8000 -t server',
      interpreter: 'none', // รัน php.exe ตรง ไม่ผ่าน node
      cwd: __dirname,
      autorestart: true,
      watch: false,
    },
  ],
};
