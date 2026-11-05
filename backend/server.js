


// // PARA O LINUX


import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// 1. CONFIGURAR FONTCONFIG
// ==========================================
const fontConfigPath = path.join(__dirname, 'fonts.conf');
const fontsDir = path.join(__dirname, 'fonts');

const fontConfigContent = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontsDir}</dir>
  <cachedir>${path.join(__dirname, 'fontconfig-cache')}</cachedir>
</fontconfig>`;

await fs.writeFile(fontConfigPath, fontConfigContent);

process.env.PANGOCAIRO_BACKEND = 'fontconfig';
process.env.FONTCONFIG_FILE = fontConfigPath;
process.env.FONTCONFIG_PATH = path.dirname(fontConfigPath);

try {
    execSync('fc-cache -f', { stdio: 'inherit' });
    console.log('[Fontconfig] Cache inicial atualizada.');
} catch (e) {
    console.warn('[Fontconfig] Aviso: fc-cache falhou.');
}

// ==========================================
// 2. IMPORTAR O RESTO
// ==========================================
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sharp from 'sharp';
import { BluetoothSerialPort } from 'bluetooth-serial-port';
import escpos from 'escpos';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage() });

const PRINTER_ADDRESS = "74:F0:7D:E7:54:FF";
const CHANNEL = 1;
const CONNECT_TIMEOUT_MS = 10000;

// ==========================================
// AS TUAS 20 FONTES FAVORITAS
// ==========================================
const PRIORITY_FONTS = [
    "BebasNeue-Regular", "GreatVibes-Regular", "AlexBrush-Regular",
    "PinyonScript-Regular", "Sacramento-Regular", "Oswald-Regular",
    "Cinzel-Regular", "UnifrakturMaguntia-Book", "SpecialElite-Regular",
    "RockSalt-Regular", "DancingScript-Regular", "Pacifico-Regular",
    "Lobster-Regular", "Caveat-Regular", "PermanentMarker-Regular",
    "AmaticSC-Regular", "PlayfairDisplay-Regular", "Raleway-Regular",
    "JosefinSans-Regular", "ShadowsIntoLight-Regular"
];

const CATEGORY_KEYWORDS = {
    "Script / Caligrafia": ["script", "brush", "calligraphy", "hand", "cursive", "vibes", "dancing", "pacifico", "lobster", "sacramento", "caveat", "satisfy", "cookie", "allura", "marck", "yellowtail", "kaushan"],
    "Bold / Impacto": ["bebas", "oswald", "anton", "impact", "black", "bold", "russo", "bungee", "archivo"],
    "Serif / Clássica": ["cinzel", "playfair", "merriweather", "lora", "garamond", "baskerville", "serif", "cormorant", "libre"],
    "Gótica": ["gothic", "fraktur", "pirata", "grenze", "unifraktur", "blackletter"],
    "Manuscrita / Rústica": ["rock", "salt", "marker", "elite", "shadows", "amatic", "patrick", "indie", "architect", "typewriter"],
    "Moderna / Sans": ["sans", "raleway", "josefin", "montserrat", "poppins", "quicksand", "comfortaa", "righteous", "modern"],
    "Stencil / Militar": ["stencil", "military", "ops"],
    "Display / Decorativa": ["display", "decorative", "theme", "fun", "comic", "cartoon"],
};

function classifyFont(filename) {
    const lower = filename.toLowerCase();
    const priority = ["Stencil / Militar", "Gótica", "Script / Caligrafia", "Manuscrita / Rústica", "Bold / Impacto", "Serif / Clássica", "Display / Decorativa", "Moderna / Sans"];
    for (const cat of priority) {
        if (CATEGORY_KEYWORDS[cat].some(kw => lower.includes(kw))) return cat;
    }
    return "Outras";
}

// ==========================================
// ENDPOINT PARA LISTAR FONTES
// ==========================================
app.get('/fonts', async (req, res) => {
    try {
        const files = await fs.readdir(fontsDir);
        const availableFonts = files.filter(f => f.toLowerCase().endsWith('.ttf')).map(f => f.replace('.ttf', ''));
        const grouped = {};

        const foundPriorities = PRIORITY_FONTS.filter(f => availableFonts.includes(f));
        if (foundPriorities.length > 0) grouped["⭐ Favoritas do Estúdio"] = foundPriorities;

        const remainingFonts = availableFonts.filter(f => !PRIORITY_FONTS.includes(f));
        for (const fontName of remainingFonts) {
            const category = classifyFont(fontName);
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(fontName);
        }

        for (const cat in grouped) grouped[cat].sort((a, b) => a.localeCompare(b));

        const ordered = {};
        const priority = ["⭐ Favoritas do Estúdio", "Script / Caligrafia", "Bold / Impacto", "Serif / Clássica", "Gótica", "Manuscrita / Rústica", "Moderna / Sans", "Stencil / Militar", "Display / Decorativa", "Outras"];
        for (const cat of priority) {
            if (grouped[cat] && grouped[cat].length > 0) ordered[cat] = grouped[cat];
        }
        res.json(ordered);
    } catch (error) {
        console.error("Erro ao listar fontes:", error);
        res.status(500).json({ error: "Erro ao listar fontes." });
    }
});

// ==========================================
// ENDPOINT PARA LIMPAR CACHE (NOVO)
// ==========================================
app.post('/reload-fonts', async (req, res) => {
    try {
        execSync('fc-cache -f', { stdio: 'ignore' });
        res.json({ message: "Cache recarregada com sucesso." });
    } catch (e) {
        res.status(500).json({ error: "Falha ao recarregar cache." });
    }
});

// ==========================================
// PROCESSAMENTO DE IMAGEM
// ==========================================
async function processImageForHorizontalPrint(imageBuffer) {
    try {
        return await sharp(imageBuffer).rotate(90).resize({ width: 215, fit: 'inside', withoutEnlargement: true }).grayscale().threshold(128).toBuffer();
    } catch (error) {
        throw new Error("Falha ao processar a imagem.");
    }
}







// ==========================================
// PROCESSAMENTO DE TEXTO (COM ANTI-CACHE)
// ==========================================




async function createTextImage(text, fontName) {
    try {
        const ttfPath = path.join(fontsDir, `${fontName}.ttf`);
        await fs.access(ttfPath);

        // ✅ A MÁGICA ACONTECE AQUI: Removemos a propriedade 'font'.
        // O 'sharp' é forçado a usar apenas o 'fontfile', ignorando o cache da fonte padrão.
        const textBuffer = await sharp({
            text: {
                text: text,
                fontfile: ttfPath, // Lê o ficheiro diretamente
                width: 500,
                height: 300,
                rgba: true,
                align: 'center',
            }
        }).png().toBuffer();

        return await sharp(textBuffer)
            .trim()
            .rotate(90)
            .resize({ width: 215, height: 215, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .grayscale()
            .threshold(128)
            .toBuffer();
    } catch (error) {
        console.error(`Erro ao criar imagem do texto (${fontName}):`, error);
        throw new Error(`Fonte "${fontName}" não encontrada ou inválida.`);
    }
}












// ==========================================
// IMPRESSÃO BLUETOOTH
// ==========================================
function printViaBluetooth(imagePath) {
    return new Promise((resolve, reject) => {
        const btSerial = new BluetoothSerialPort();
        let isConnected = false;

        const timeoutId = setTimeout(() => {
            if (!isConnected) {
                btSerial.close();
                reject(new Error("Timeout: A impressora não respondeu."));
            }
        }, CONNECT_TIMEOUT_MS);

        btSerial.connect(PRINTER_ADDRESS, CHANNEL, (err) => {
            if (err) {
                clearTimeout(timeoutId);
                return reject(new Error("Erro de ligação Bluetooth."));
            }
            isConnected = true;
            clearTimeout(timeoutId);

            try {
                const printer = new escpos.Printer(btSerial, { encoding: "UTF-8" });
                printer.font('a').align('ct').style('b').text("").text("");

                escpos.Image.load(imagePath, (image) => {
                    if (!image) {
                        btSerial.close();
                        return reject(new Error("Falha ao carregar a imagem."));
                    }
                    try {
                        printer.image(image, 's8');
                        printer.text("").text("------------------------------").text("Bom trabalho!").cut().close();
                        resolve();
                    } catch (printError) {
                        btSerial.close();
                        reject(new Error("Erro ao enviar os dados para a impressora."));
                    }
                });
            } catch (e) {
                btSerial.close();
                reject(new Error("Erro interno."));
            }
        });
    });
}

// ==========================================
// ROTA POST /print
// ==========================================
app.post('/print', upload.single('image'), async (req, res) => {
    const clientName = req.body.clientName || "";
    const printOption = req.body.printOption || "both";
    const fontName = req.body.fontName || "BebasNeue-Regular";
    const file = req.file;

    if ((printOption === 'image' || printOption === 'both') && !file) {
        return res.status(400).json({ error: "Nenhuma imagem enviada." });
    }
    if ((printOption === 'text' || printOption === 'both') && !clientName.trim()) {
        return res.status(400).json({ error: "O nome do cliente é obrigatório." });
    }

    let tempPath = null;

    try {
        if (file && (printOption === 'image' || printOption === 'both')) {
            const processedBuffer = await processImageForHorizontalPrint(file.buffer);
            tempPath = path.join(process.cwd(), `temp_${Date.now()}.png`);
            await fs.writeFile(tempPath, processedBuffer);
        } else if (printOption === 'text') {
            const textBuffer = await createTextImage(clientName, fontName);
            tempPath = path.join(process.cwd(), `temp_${Date.now()}.png`);
            await fs.writeFile(tempPath, textBuffer);
        }

        await printViaBluetooth(tempPath);
        if (tempPath) await fs.unlink(tempPath).catch(() => {});
        return res.status(200).json({ message: "Impresso com sucesso!" });

    } catch (error) {
        console.error("Erro no processo:", error.message);
        if (tempPath) await fs.unlink(tempPath).catch(() => {});
        return res.status(500).json({ error: error.message || "Erro desconhecido ao imprimir." });
    }
});

app.listen(3000, () => {
    console.log("Servidor de impressão a correr em http://localhost:3000");
});






































































































// // PARA O WINDOWS


// import fs from 'fs/promises';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import { execSync } from 'child_process';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // ==========================================
// // 1. CONFIGURAR FONTCONFIG
// // ==========================================
// const fontConfigPath = path.join(__dirname, 'fonts.conf');
// const fontsDir = path.join(__dirname, 'fonts');

// const fontConfigContent = `<?xml version="1.0"?>
// <!DOCTYPE fontconfig SYSTEM "fonts.dtd">
// <fontconfig>
//   <dir>${fontsDir}</dir>
//   <cachedir>${path.join(__dirname, 'fontconfig-cache')}</cachedir>
// </fontconfig>`;

// await fs.writeFile(fontConfigPath, fontConfigContent);

// process.env.PANGOCAIRO_BACKEND = 'fontconfig';
// process.env.FONTCONFIG_FILE = fontConfigPath;
// process.env.FONTCONFIG_PATH = path.dirname(fontConfigPath);

// // Só executa o fc-cache se não estiver no Windows (no Windows isso pode falhar)
// if (process.platform !== 'win32') {
//     try {
//         execSync('fc-cache -f', { stdio: 'inherit' });
//         console.log('[Fontconfig] Cache atualizada com as fontes locais.');
//     } catch (e) {
//         console.warn('[Fontconfig] Aviso: fc-cache falhou.');
//     }
// }

// // ==========================================
// // 2. IMPORTS
// // ==========================================
// import express from 'express';
// import cors from 'cors';
// import multer from 'multer';
// import sharp from 'sharp';
// import { SerialPort } from 'serialport';
// import escpos from 'escpos';

// const app = express();
// app.use(cors());
// app.use(express.json());
// app.use(express.static(path.join(__dirname, 'public')));

// const upload = multer({ storage: multer.memoryStorage() });

// // ⚠️ ATENÇÃO: NO WINDOWS, TENS DE MUDAR A PORTA COM AQUI
// // Vai às definições de Bluetooth do Windows, Portas COM, e procura a porta de "Saída" da impressora.
// const COM_PORT = 'COM3'; //
// const BAUDRATE = 9600;

// // ==========================================
// // AS TUAS 20 FONTES FAVORITAS
// // ==========================================
// const PRIORITY_FONTS = [
//     "BebasNeue-Regular", "GreatVibes-Regular", "AlexBrush-Regular",
//     "PinyonScript-Regular", "Sacramento-Regular", "Oswald-Regular",
//     "Cinzel-Regular", "UnifrakturMaguntia-Book", "SpecialElite-Regular",
//     "RockSalt-Regular", "DancingScript-Regular", "Pacifico-Regular",
//     "Lobster-Regular", "Caveat-Regular", "PermanentMarker-Regular",
//     "AmaticSC-Regular", "PlayfairDisplay-Regular", "Raleway-Regular",
//     "JosefinSans-Regular", "ShadowsIntoLight-Regular"
// ];

// const CATEGORY_KEYWORDS = {
//     "Script / Caligrafia": ["script", "brush", "calligraphy", "hand", "cursive", "vibes", "dancing", "pacifico", "lobster", "sacramento", "caveat", "satisfy", "cookie", "allura", "marck", "yellowtail", "kaushan"],
//     "Bold / Impacto": ["bebas", "oswald", "anton", "impact", "black", "bold", "russo", "bungee", "archivo"],
//     "Serif / Clássica": ["cinzel", "playfair", "merriweather", "lora", "garamond", "baskerville", "serif", "cormorant", "libre"],
//     "Gótica": ["gothic", "fraktur", "pirata", "grenze", "unifraktur", "blackletter"],
//     "Manuscrita / Rústica": ["rock", "salt", "marker", "elite", "shadows", "amatic", "patrick", "indie", "architect", "typewriter"],
//     "Moderna / Sans": ["sans", "raleway", "josefin", "montserrat", "poppins", "quicksand", "comfortaa", "righteous", "modern"],
//     "Stencil / Militar": ["stencil", "military", "ops"],
//     "Display / Decorativa": ["display", "decorative", "theme", "fun", "comic", "cartoon"],
// };

// function classifyFont(filename) {
//     const lower = filename.toLowerCase();
//     const priority = ["Stencil / Militar", "Gótica", "Script / Caligrafia", "Manuscrita / Rústica", "Bold / Impacto", "Serif / Clássica", "Display / Decorativa", "Moderna / Sans"];
//     for (const cat of priority) {
//         if (CATEGORY_KEYWORDS[cat].some(kw => lower.includes(kw))) return cat;
//     }
//     return "Outras";
// }

// // ==========================================
// // ENDPOINTS
// // ==========================================
// app.get('/fonts', async (req, res) => {
//     try {
//         const files = await fs.readdir(fontsDir);
//         const availableFonts = files.filter(f => f.toLowerCase().endsWith('.ttf')).map(f => f.replace('.ttf', ''));
//         const grouped = {};

//         const foundPriorities = PRIORITY_FONTS.filter(f => availableFonts.includes(f));
//         if (foundPriorities.length > 0) grouped["⭐ Favoritas do Estúdio"] = foundPriorities;

//         const remainingFonts = availableFonts.filter(f => !PRIORITY_FONTS.includes(f));
//         for (const fontName of remainingFonts) {
//             const category = classifyFont(fontName);
//             if (!grouped[category]) grouped[category] = [];
//             grouped[category].push(fontName);
//         }

//         for (const cat in grouped) grouped[cat].sort((a, b) => a.localeCompare(b));

//         const ordered = {};
//         const priority = ["⭐ Favoritas do Estúdio", "Script / Caligrafia", "Bold / Impacto", "Serif / Clássica", "Gótica", "Manuscrita / Rústica", "Moderna / Sans", "Stencil / Militar", "Display / Decorativa", "Outras"];
//         for (const cat of priority) {
//             if (grouped[cat] && grouped[cat].length > 0) ordered[cat] = grouped[cat];
//         }
//         res.json(ordered);
//     } catch (error) {
//         res.status(500).json({ error: "Erro ao listar fontes." });
//     }
// });

// // ==========================================
// // PROCESSAMENTO DE TEXTO (ANTI-CACHE WINDOWS)
// // ==========================================
// async function createTextImage(text, fontName) {
//     let tempFontPath = null;
//     try {
//         const originalTtfPath = path.join(fontsDir, `${fontName}.ttf`);
//         await fs.access(originalTtfPath);

//         // No Windows, o sharp às vezes ignora o fontfile.
//         // Para garantir que funciona, copiamos a fonte para um nome único e forçamos o seu uso.
//         const uniqueId = Date.now() + Math.floor(Math.random() * 1000);
//         tempFontPath = path.join(__dirname, `temp_font_${uniqueId}.ttf`);
        
//         // Copia a fonte para o ficheiro temporário
//         await fs.copyFile(originalTtfPath, tempFontPath);

//         // Renderiza o texto usando o ficheiro temporário
//         const textBuffer = await sharp({
//             text: {
//                 text: text,
//                 fontfile: tempFontPath, 
//                 width: 500,
//                 height: 300,
//                 rgba: true,
//                 align: 'center',
//             }
//         }).png().toBuffer();

//         return await sharp(textBuffer)
//             .trim()
//             .rotate(90)
//             .resize({ width: 215, height: 215, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
//             .grayscale()
//             .threshold(128)
//             .toBuffer();
//     } catch (error) {
//         console.error(`Erro ao criar imagem do texto (${fontName}):`, error);
//         throw new Error(`Fonte "${fontName}" não encontrada ou inválida.`);
//     } finally {
//         // Limpa o ficheiro temporário após a renderização
//         if (tempFontPath) await fs.unlink(tempFontPath).catch(() => {});
//     }
// }

// async function processImageForHorizontalPrint(imageBuffer) {
//     try {
//         return await sharp(imageBuffer).rotate(90).resize({ width: 215, fit: 'inside', withoutEnlargement: true }).grayscale().threshold(128).toBuffer();
//     } catch (error) {
//         throw new Error("Falha ao processar a imagem.");
//     }
// }

// // ==========================================
// // IMPRESSÃO WINDOWS (VIA PORTA COM)
// // ==========================================
// function printViaBluetooth(imagePath) {
//     return new Promise((resolve, reject) => {
//         // Abre a porta COM virtual do Windows
//         const port = new SerialPort({ path: COM_PORT, baudRate: BAUDRATE, autoOpen: false });

//         port.open((err) => {
//             if (err) {
//                 return reject(new Error(`Erro ao abrir a porta ${COM_PORT}. A impressora está ligada e emparelhada?`));
//             }

//             try {
//                 const printer = new escpos.Printer(port, { encoding: "UTF-8" });
//                 printer.font('a').align('ct').style('b').text("").text("");

//                 escpos.Image.load(imagePath, (image) => {
//                     if (!image) {
//                         port.close();
//                         return reject(new Error("Falha ao carregar a imagem para a impressora."));
//                     }

//                     try {
//                         // Envia a imagem e corta o papel
//                         printer.image(image, 's8');
//                         printer.text("").text("------------------------------").text("Bom trabalho!").cut().close();
                        
//                         // O close() da escpos fecha a porta, mas garantimos aqui também
//                         port.close((closeErr) => {
//                             if (closeErr) console.warn("Aviso ao fechar porta:", closeErr);
//                             resolve();
//                         });

//                     } catch (printError) {
//                         port.close();
//                         reject(new Error("Erro ao enviar os dados. O papel acabou?"));
//                     }
//                 });
//             } catch (e) {
//                 port.close();
//                 reject(new Error("Erro interno ao preparar a impressão."));
//             }
//         });
//     });
// }

// // ==========================================
// // ROTA POST /print
// // ==========================================
// app.post('/print', upload.single('image'), async (req, res) => {
//     const clientName = req.body.clientName || "";
//     const printOption = req.body.printOption || "both";
//     const fontName = req.body.fontName || "BebasNeue-Regular";
//     const file = req.file;

//     if ((printOption === 'image' || printOption === 'both') && !file) {
//         return res.status(400).json({ error: "Nenhuma imagem enviada." });
//     }
//     if ((printOption === 'text' || printOption === 'both') && !clientName.trim()) {
//         return res.status(400).json({ error: "O nome do cliente é obrigatório." });
//     }

//     let tempPath = null;

//     try {
//         if (file && (printOption === 'image' || printOption === 'both')) {
//             const processedBuffer = await processImageForHorizontalPrint(file.buffer);
//             tempPath = path.join(process.cwd(), `temp_${Date.now()}.png`);
//             await fs.writeFile(tempPath, processedBuffer);
//         } else if (printOption === 'text') {
//             const textBuffer = await createTextImage(clientName, fontName);
//             tempPath = path.join(process.cwd(), `temp_${Date.now()}.png`);
//             await fs.writeFile(tempPath, textBuffer);
//         }

//         await printViaBluetooth(tempPath);
        
//         if (tempPath) await fs.unlink(tempPath).catch(() => {});
//         return res.status(200).json({ message: "Impresso com sucesso!" });

//     } catch (error) {
//         console.error("Erro no processo:", error.message);
//         if (tempPath) await fs.unlink(tempPath).catch(() => {});
//         return res.status(500).json({ error: error.message || "Erro desconhecido ao imprimir." });
//     }
// });

// app.listen(3000, () => {
//     console.log("Servidor de impressão a correr em http://localhost:3000");
// });