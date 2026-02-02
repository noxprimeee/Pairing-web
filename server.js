import express from 'express';
import cors from 'cors';
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';

const app = express();
app.use(cors()); // Permet au site web de contacter le serveur
app.use(express.json());

const sessions = new Map();

app.get('/pairing', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Numéro requis (ex: 22505XXXXXXXX)" });
    
    num = num.replace(/[^0-9]/g, '');

    try {
        // Création d'un dossier unique par utilisateur
        const { state, saveCreds } = await useMultiFileAuthState(`./auth_sessions/${num}`);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        if (!sock.authState.creds.registered) {
            // Délai nécessaire pour que Baileys soit prêt à générer le code
            await delay(5000);
            const code = await sock.requestPairingCode(num);
            res.json({ code: code });
        } else {
            res.json({ message: "Déjà connecté" });
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') console.log(`[${num}] Connecté !`);
            if (connection === 'close') {
                console.log(`[${num}] Déconnecté.`);
                // Optionnel : supprimer le dossier session si déconnecté
                // fs.rmSync(`./auth_sessions/${num}`, { recursive: true, force: true });
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur lors de la génération du code" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
