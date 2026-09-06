import { Request, Response } from 'express';
import { whatsappService } from '../services/whatsapp.service';

export const getStatus = async (req: Request, res: Response) => {
  try {
    const status = await whatsappService.getStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const connectWhatsApp = async (req: Request, res: Response) => {
  try {
    // Only Admin can connect/disconnect (Authorization check is done in middleware, but we can do extra checks)
    const userRole = (req as any).user?.role;
    if (userRole !== 'super_admin' && userRole !== 'gym_owner') {
      return res.status(403).json({ error: 'Security: Only Admin/Owner can modify WhatsApp connection settings.' });
    }

    await whatsappService.initClient();
    res.json({ success: true, message: 'WhatsApp initialization sequence started.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const disconnectWhatsApp = async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'super_admin' && userRole !== 'gym_owner') {
      return res.status(403).json({ error: 'Security: Only Admin/Owner can modify WhatsApp connection settings.' });
    }

    await whatsappService.disconnectClient();
    res.json({ success: true, message: 'WhatsApp disconnected and session cleaned.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const reconnectWhatsApp = async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'super_admin' && userRole !== 'gym_owner') {
      return res.status(403).json({ error: 'Security: Only Admin/Owner can modify WhatsApp connection settings.' });
    }

    await whatsappService.reconnectClient();
    res.json({ success: true, message: 'WhatsApp reconnect sequence initiated.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendTestMessage = async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone number and message text are required.' });
    }

    const success = await whatsappService.sendMessage(phone, message);
    if (success) {
      res.json({ success: true, message: 'Test message sent successfully.' });
    } else {
      res.status(400).json({ success: false, error: 'Failed to send message. Is WhatsApp connected?' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
