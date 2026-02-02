import express from 'express';
import cors from 'cors';
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/pairing', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Numéro requis" });
    
    num = num.replace(/[^0-9]/g, '');

    try {
        // Dossier unique pour chaque utilisateur dans /tmp (nécessaire sur Render)
        const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${num}`);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu("Chrome"), // Très important pour le pairing
            printQRInTerminal: false
        });

        if (!sock.authState.creds.registered) {
            await delay(5000); // On attend que le socket soit prêt
            const code = await sock.requestPairingCode(num);
            res.json({ code: code });
        } else {
            res.json({ message: "Déjà connecté" });
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection } = update;
            if (connection === 'open') console.log(`[${num}] Connecté !`);
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
