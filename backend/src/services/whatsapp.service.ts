import { Client, LocalAuth } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';
import { admin, isFirebaseInitialized } from '../firebase';
import * as fs from 'fs';
import * as path from 'path';

class WhatsAppService {
  private client: Client | null = null;
  private qrCode: string | null = null;
  private status: 'Connected' | 'Disconnected' | 'Connecting' = 'Disconnected';
  private clientInfo: any = null;

  constructor() {
    // Automatically attempt reconnection if initialized
    setTimeout(() => {
      this.initClient();
    }, 2000);
  }

  public async getStatus() {
    return {
      status: this.status,
      qr: this.qrCode,
      profileName: this.clientInfo?.pushname || null,
      phoneNumber: this.clientInfo?.wid?.user || null,
      lastSync: new Date().toISOString(),
    };
  }

  public async initClient() {
    if (this.client && this.status === 'Connecting') {
      console.log('[WhatsApp] Initialization already in progress.');
      return;
    }

    if (this.client && this.status !== 'Connected') {
      console.log('[WhatsApp] Re-initializing disconnected client instance...');
      try {
        await this.client.destroy();
      } catch (e) {}
      this.client = null;
    }

    if (this.client && this.status === 'Connected') {
      console.log('[WhatsApp] Client is already connected.');
      return;
    }

    console.log('[WhatsApp] Initializing client...');
    this.status = 'Connecting';
    this.updateStatusInFirebase();

    // Use LocalAuth with custom directory to ensure persistent sessions
    const authPath = path.join(process.cwd(), '.wwebjs_auth');

    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const puppeteerOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    };

    if (fs.existsSync(edgePath)) {
      console.log('[WhatsApp] Found Microsoft Edge executable. Using Edge to bypass headless launch timeouts.');
      puppeteerOptions.executablePath = edgePath;
    }

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: authPath
      }),
      puppeteer: puppeteerOptions
    });

    this.client.on('qr', async (qr) => {
      console.log('[WhatsApp] QR Code received. Generating data URL...');
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
        this.qrCode = qrDataUrl;
        this.status = 'Disconnected';
        this.updateStatusInFirebase();
      } catch (err) {
        console.error('[WhatsApp] Failed to generate QR Code:', err);
      }
    });

    this.client.on('ready', () => {
      console.log('[WhatsApp] Client is ready!');
      this.status = 'Connected';
      this.qrCode = null;
      if (this.client) {
        this.clientInfo = this.client.info;
      }
      this.updateStatusInFirebase();
    });

    this.client.on('authenticated', () => {
      console.log('[WhatsApp] Authenticated successfully.');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('[WhatsApp] Auth failure:', msg);
      this.status = 'Disconnected';
      this.qrCode = null;
      this.updateStatusInFirebase();
    });

    this.client.on('disconnected', (reason) => {
      console.log('[WhatsApp] Client disconnected:', reason);
      this.status = 'Disconnected';
      this.clientInfo = null;
      this.qrCode = null;
      this.updateStatusInFirebase();
    });

    try {
      await this.client.initialize();
    } catch (err) {
      console.error('[WhatsApp] Failed to initialize client:', err);
      this.status = 'Disconnected';
      this.updateStatusInFirebase();
    }
  }

  public async disconnectClient() {
    console.log('[WhatsApp] Disconnecting client...');
    this.status = 'Disconnected';
    this.qrCode = null;
    this.clientInfo = null;
    this.updateStatusInFirebase();

    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err) {
        console.error('[WhatsApp] Error during client destroy:', err);
      }
      this.client = null;
    }

    // Clean persistent authentication directories to reset login completely
    const authPath = path.join(process.cwd(), '.wwebjs_auth');
    try {
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log('[WhatsApp] Cleaned session directory.');
      }
    } catch (e) {
      console.warn('[WhatsApp] Failed to clean session folder:', e);
    }
  }

  public async reconnectClient() {
    await this.disconnectClient();
    await this.initClient();
  }

  public async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    if (this.status !== 'Connected' || !this.client) {
      console.warn('[WhatsApp] Cannot send message: client is not Connected');
      return false;
    }

    try {
      // Clean phone number: remove non-numeric chars, prefix with country code if missing
      let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
      if (cleanNumber.length === 10) {
        cleanNumber = '91' + cleanNumber; // Default to India country code
      }

      const formattedNumber = `${cleanNumber}@c.us`;
      await this.client.sendMessage(formattedNumber, message);
      console.log(`[WhatsApp] Message successfully sent to: ${formattedNumber}`);
      return true;
    } catch (err) {
      console.error('[WhatsApp] Failed to send message:', err);
      return false;
    }
  }

  private async updateStatusInFirebase() {
    if (!isFirebaseInitialized || !admin) return;
    try {
      const firestore = admin.firestore();
      await firestore.collection('whatsapp_status').doc('session').set({
        status: this.status,
        qr: this.qrCode,
        profileName: this.clientInfo?.pushname || null,
        phoneNumber: this.clientInfo?.wid?.user || null,
        lastSync: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error('[WhatsApp] Failed to write status to Firestore:', err);
    }
  }
}

export const whatsappService = new WhatsAppService();
