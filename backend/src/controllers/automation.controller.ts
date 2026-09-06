import { Request, Response } from 'express';
import { db } from '../firebase';
import { sendEmail, getSavedTemplates, saveTemplates, generateInvoicePdf } from '../services/automation.service';

export const getSmtpConfig = async (req: Request, res: Response) => {
  try {
    const config = await (db as any).getSmtpConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const saveSmtpConfig = async (req: Request, res: Response) => {
  try {
    const config = req.body;
    const saved = await (db as any).saveSmtpConfig(config);
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTemplates = async (req: Request, res: Response) => {
  try {
    const templates = await getSavedTemplates();
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const saveTemplatesController = async (req: Request, res: Response) => {
  try {
    const templatesData = req.body;
    const saved = await saveTemplates(templatesData);
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendTestEmail = async (req: Request, res: Response) => {
  try {
    const { to, subject, body } = req.body;
    if (!to) {
      return res.status(400).json({ error: 'Recipient email "to" is required' });
    }

    const testSubject = subject || 'The Warrior Gym Test Email ⚡';
    const testBody = body || `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 500px; margin: auto;">
        <h2 style="color: #0f172a; border-bottom: 2px solid #d4ff00; padding-bottom: 8px;">The Warrior Gym SMTP Test</h2>
        <p>Your SMTP configurations are correct! Mail was sent successfully.</p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Sent at: ${new Date().toLocaleString()}</p>
      </div>
    `;

    const success = await sendEmail(to, testSubject, testBody);
    if (success) {
      res.json({ message: `Test email sent successfully to ${to}` });
    } else {
      res.status(500).json({ error: 'Failed to send test email. Verify SMTP settings.' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getInvoicePreview = async (req: Request, res: Response) => {
  try {
    const mockPayment = {
      invoice: 'INV-125281',
      date: new Date().toISOString().split('T')[0],
      method: 'UPI',
      plan: 'Annual Premium VIP',
      amount: 18000,
      gst: 2745,
    };
    const mockMember = {
      name: 'Pratik Chaudhary',
      memberId: 'TWG-2026-0009',
      phone: '9859527050',
      email: 'pratikdc11@gmail.com',
      joinDate: '2026-06-27',
      expiryDate: '2027-06-27',
    };

    const pdfBuffer = await generateInvoicePdf(mockPayment, mockMember);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="invoice_preview.pdf"');
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
