import * as fs from 'fs';
import * as path from 'path';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import { db, admin, isFirebaseInitialized } from '../firebase';

// Types
export interface SmtpConfig {
  host: string;
  port: string;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  triggers?: {
    welcome: boolean;
    expiry7: boolean;
    expiry3: boolean;
    payment: boolean;
    expired: boolean;
  };
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

// Default Templates
const DEFAULT_TEMPLATES: Record<string, EmailTemplate> = {
  welcome: {
    subject: 'Welcome to The Warrior Gym! 🎉',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><style>
  body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
  .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 32px rgba(0,0,0,0.08); }
  .hero { background: #000; padding: 40px 32px; text-align: center; }
  .hero h1 { color: #d4ff00; font-size: 28px; font-weight: 900; margin: 0; letter-spacing: -0.5px; }
  .hero p { color: rgba(255,255,255,0.6); font-size: 13px; margin: 8px 0 0; }
  .body { padding: 32px; }
  .body h2 { font-size: 20px; font-weight: 800; color: #0f172a; }
  .body p { color: #64748b; font-size: 14px; line-height: 1.7; }
  .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; }
  .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  .info-row:last-child { border: none; }
  .label { color: #94a3b8; font-weight: 600; }
  .value { color: #0f172a; font-weight: 700; }
  .btn { display: block; background: #000; color: #d4ff00; text-decoration: none; text-align: center; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 13px; margin: 24px 0 0; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; color: #94a3b8; font-size: 11px; }
</style></head>
<body>
  <div class="wrapper">
    <div class="hero">
      <h1>⚡ THE WARRIOR GYM</h1>
      <p>Beyond Strength. Beyond Limits.</p>
    </div>
    <div class="body">
      <h2>Welcome, {{memberName}}! 🎉</h2>
      <p>Your membership has been activated. Here are your details:</p>
      <div class="info-box">
        <div class="info-row"><span class="label">Plan</span><span class="value">{{plan}}</span></div>
        <div class="info-row"><span class="label">Start Date</span><span class="value">{{startDate}}</span></div>
        <div class="info-row"><span class="label">Expiry Date</span><span class="value">{{expiryDate}}</span></div>
        <div class="info-row"><span class="label">Branch</span><span class="value">{{branch}}</span></div>
      </div>
      <p>Head to the gym and scan your ID at the biometric gate to start your fitness journey.</p>
      <a class="btn" href="#">View My Membership Portal</a>
    </div>
    <div class="footer">The Warrior Gym · Mohali, Punjab · +91 98765 43210</div>
  </div>
</body>
</html>`
  },
  expiry: {
    subject: 'Your The Warrior Gym Membership Expires Soon ⚠️',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><style>
  body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
  .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 32px rgba(0,0,0,0.08); }
  .hero { background: linear-gradient(135deg, #ef4444, #dc2626); padding: 40px 32px; text-align: center; }
  .hero h1 { color: #fff; font-size: 24px; font-weight: 900; margin: 0; }
  .hero .badge { background: rgba(255,255,255,0.2); color: #fff; font-size: 13px; font-weight: 700; padding: 6px 16px; border-radius: 99px; display: inline-block; margin-top: 10px; }
  .body { padding: 32px; }
  .countdown { background: #fef2f2; border: 2px solid #ef4444; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
  .countdown .days { font-size: 48px; font-weight: 900; color: #ef4444; }
  .countdown p { color: #64748b; font-size: 13px; margin: 4px 0 0; }
  .btn { display: block; background: #ef4444; color: #fff; text-decoration: none; text-align: center; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 13px; margin: 24px 0 0; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; color: #94a3b8; font-size: 11px; }
</style></head>
<body>
  <div class="wrapper">
    <div class="hero">
      <h1>Membership Expiring Soon!</h1>
      <div class="badge">Action Required</div>
    </div>
    <div class="body">
      <p style="color:#0f172a;font-size:16px;font-weight:700">Hi {{memberName}},</p>
      <p style="color:#64748b;font-size:14px">Your <strong>{{plan}}</strong> membership is expiring soon. Renew now to keep your gym access uninterrupted.</p>
      <div class="countdown">
        <div class="days">{{daysLeft}}</div>
        <p>Days remaining · Expires on <strong>{{expiryDate}}</strong></p>
      </div>
      <a class="btn" href="#">Renew My Membership Now →</a>
    </div>
    <div class="footer">The Warrior Gym · Mohali, Punjab</div>
  </div>
</body>
</html>`
  },
  receipt: {
    subject: 'Payment Received — Invoice #{{invoice}} ✅',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><style>
  body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
  .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 32px rgba(0,0,0,0.08); }
  .hero { background: #10b981; padding: 32px; text-align: center; }
  .hero h1 { color: #fff; font-size: 22px; font-weight: 900; margin: 0; }
  .hero p { color: rgba(255,255,255,0.8); font-size: 13px; margin: 6px 0 0; }
  .body { padding: 32px; }
  .invoice-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  .invoice-table th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; }
  .invoice-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 600; }
  .total-row td { font-size: 16px; font-weight: 900; background: #f8fafc; border-radius: 8px; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; color: #94a3b8; font-size: 11px; }
</style></head>
<body>
  <div class="wrapper">
    <div class="hero">
      <h1>✅ Payment Received</h1>
      <p>Invoice #{{invoice}}</p>
    </div>
    <div class="body">
      <p style="color:#0f172a;font-weight:700">Dear {{memberName}},</p>
      <p style="color:#64748b;font-size:14px">Thank you for your payment. Your membership is now active. Please find your detailed PDF invoice attached to this email.</p>
      <table class="invoice-table">
        <tr><th>Description</th><th>Amount</th></tr>
        <tr><td>{{plan}} Membership</td><td>₹{{amount}}</td></tr>
        <tr><td>GST (18%)</td><td>₹{{gst}}</td></tr>
        <tr class="total-row"><td><strong>Total Paid</strong></td><td><strong>₹{{total}}</strong></td></tr>
      </table>
      <p style="color:#64748b;font-size:12px">Payment Method: {{method}} · Date: {{date}}</p>
    </div>
    <div class="footer">The Warrior Gym · Mohali, Punjab · GSTIN: 27AAAAA0000A1Z5</div>
  </div>
</body>
</html>`
  },
  renewal: {
    subject: 'Renew Your The Warrior Gym Membership & Keep Crushing It! 💪',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><style>
  body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
  .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 32px rgba(0,0,0,0.08); }
  .hero { background: #000; padding: 40px 32px; text-align: center; }
  .hero h1 { color: #d4ff00; font-size: 26px; font-weight: 900; margin: 0; }
  .hero p { color: rgba(255,255,255,0.6); font-size: 13px; margin: 8px 0 0; }
  .body { padding: 32px; }
  .plans { display: grid; gap: 12px; margin: 20px 0; }
  .plan-card { border: 2px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center; }
  .plan-card.highlight { border-color: #d4ff00; background: #fafff0; }
  .plan-name { font-weight: 800; color: #0f172a; font-size: 14px; }
  .plan-price { font-weight: 900; color: #0052FF; font-size: 16px; }
  .btn { display: block; background: #d4ff00; color: #000; text-decoration: none; text-align: center; padding: 16px 28px; border-radius: 12px; font-weight: 900; font-size: 14px; margin: 24px 0 0; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; color: #94a3b8; font-size: 11px; }
</style></head>
<body>
  <div class="wrapper">
    <div class="hero">
      <h1>Keep the Momentum! 💪</h1>
      <p>Your membership expired. Come back stronger!</p>
    </div>
    <div class="body">
      <p style="color:#0f172a;font-size:16px;font-weight:700">Hey {{memberName}},</p>
      <p style="color:#64748b;font-size:14px">Don't let your progress stop. Renew today and get back to crushing your goals.</p>
      <div class="plans">
        <div class="plan-card"><div class="plan-name">Monthly Access</div><div class="plan-price">₹2,500</div></div>
        <div class="plan-card highlight"><div class="plan-name">⭐ Quarterly Plan</div><div class="plan-price">₹6,500</div></div>
        <div class="plan-card"><div class="plan-name">Annual VIP Pass</div><div class="plan-price">₹18,000</div></div>
      </div>
      <a class="btn" href="#">Renew Now & Save →</a>
    </div>
    <div class="footer">The Warrior Gym · Mohali, Punjab · Unsubscribe</div>
  </div>
</body>
</html>`
  }
};

// Local storage for templates
let localTemplates: Record<string, EmailTemplate> = { ...DEFAULT_TEMPLATES };

export const getSavedTemplates = async (): Promise<Record<string, EmailTemplate>> => {
  const firestore = isFirebaseInitialized && admin ? admin.firestore() : null;
  if (firestore) {
    const doc = await firestore.collection('system_config').doc('templates').get();
    if (doc.exists) {
      return { ...DEFAULT_TEMPLATES, ...doc.data() };
    }
  }
  const templatesPath = './email_templates.json';
  if (fs.existsSync(templatesPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
      localTemplates = { ...DEFAULT_TEMPLATES, ...data };
      return localTemplates;
    } catch (e) {}
  }
  return DEFAULT_TEMPLATES;
};

export const saveTemplates = async (templatesData: any): Promise<any> => {
  const firestore = isFirebaseInitialized && admin ? admin.firestore() : null;
  if (firestore) {
    await firestore.collection('system_config').doc('templates').set(templatesData, { merge: true });
  }
  localTemplates = { ...localTemplates, ...templatesData };
  const templatesPath = './email_templates.json';
  try {
    fs.writeFileSync(templatesPath, JSON.stringify(templatesData, null, 2), 'utf8');
  } catch (e) {}
  return templatesData;
};

// Send SMTP Email helper
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: Buffer }[]
): Promise<boolean> => {
  try {
    const smtpConfig = await db.getSmtpConfig();
    if (!smtpConfig || !smtpConfig.user || !smtpConfig.pass || smtpConfig.user.includes('your-email') || process.env.NODE_ENV === 'test' || smtpConfig.pass.includes('password')) {
      console.log(`[Automation Simulated Email] Sent email to ${to}: "${subject}"`);
      return true;
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port, 10) || 587,
      secure: smtpConfig.secure, // true for port 465, false for other ports
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
      to,
      subject,
      html,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Automation] Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('[Automation] Failed to send email:', error);
    return false;
  }
};

// Replace variables in templates
const parseTemplate = (html: string, variables: Record<string, string>): string => {
  let parsed = html;
  for (const [key, value] of Object.entries(variables)) {
    parsed = parsed.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return parsed;
};

export const generateInvoicePdf = async (payment: any, member: any): Promise<Buffer> => {
  const getMembershipName = (planName: string): string => {
    const plan = (planName || '').toLowerCase();
    if (plan.includes('trial')) return 'Trial';
    if (plan.includes('1 month') || plan.includes('monthly') || plan.includes('30 day')) return '1 Month';
    if (plan.includes('3 month') || plan.includes('quarterly') || plan.includes('90 day') || plan.includes('2+1')) return '3 Months (Quarterly)';
    if (plan.includes('6 month') || plan.includes('semi') || plan.includes('180 day')) return '6 Months (Semi-Annual)';
    if (plan.includes('12 month') || plan.includes('annual') || plan.includes('365 day') || plan.includes('year')) return '12 Months (Annual)';
    if (plan.includes('lifetime')) return 'Lifetime Membership';
    if (plan.includes('pt') || plan.includes('personal training')) return 'Personal Training';
    if (plan.includes('premium')) return 'Premium Membership';
    return 'Custom Plan';
  };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    // Theme Colors
    const primaryColor = '#0f172a'; // Deep Slate
    const accentBlue = '#0052FF'; // Stripe Blue
    const accentLime = '#d4ff00'; // Lime Accent
    const textColor = '#334155'; // Slate 700
    const lightBg = '#f8fafc'; // Slate 50
    const borderColor = '#e2e8f0'; // Slate 200

    // Header Logo & Gym Info
    const logoPath = path.join(process.cwd(), 'gym_logo.png');

    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 40, 35, { height: 38 });
        doc.fillColor(accentBlue).fontSize(20).font('Helvetica-Bold').text('THE WARRIOR GYM', 92, 40);
        doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold').text('BEYOND LIMITS', 92, 62);
      } catch (imgErr) {
        doc.fillColor(accentBlue).fontSize(20).font('Helvetica-Bold').text('THE WARRIOR GYM', 40, 40);
        doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold').text('BEYOND LIMITS', 40, 62);
      }
    } else {
      doc.fillColor(accentBlue).fontSize(20).font('Helvetica-Bold').text('THE WARRIOR GYM', 40, 40);
      doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold').text('BEYOND LIMITS', 40, 62);
    }
    
    doc.fillColor(textColor).fontSize(8).font('Helvetica');
    doc.text('SCO 14-15, Phase 5, Sector 59', 40, 82);
    doc.text('Mohali, Punjab, India - 160059', 40, 92);
    doc.text('GSTIN: 27AAAAA0000A1Z5', 40, 102);
    doc.text('Phone: +91 97793 33155 | info@thewarriorgym.in', 40, 112);

    // Invoice Info Panel (Right side)
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', 380, 40, { align: 'right', width: 175 });
    
    doc.fillColor(textColor).fontSize(8).font('Helvetica-Bold').text('INVOICE NO:', 380, 62);
    doc.font('Helvetica').text(payment.invoice || 'INV-00000', 450, 62, { align: 'right', width: 105 });
    
    doc.font('Helvetica-Bold').text('DATE:', 380, 74);
    doc.font('Helvetica').text(payment.date || new Date().toISOString().split('T')[0], 450, 74, { align: 'right', width: 105 });
    
    doc.font('Helvetica-Bold').text('METHOD:', 380, 86);
    doc.font('Helvetica').text(payment.method || 'UPI', 450, 86, { align: 'right', width: 105 });

    doc.font('Helvetica-Bold').text('STATUS:', 380, 98);
    doc.fillColor('#10b981').text('PAID', 450, 98, { align: 'right', width: 105 });

    // Minimal Blue Accent Line
    doc.strokeColor(accentBlue).lineWidth(1.5).moveTo(40, 130).lineTo(555, 130).stroke();

    // Client & Billing Info Columns
    // Left: Billed To
    doc.fillColor(accentBlue).fontSize(9).font('Helvetica-Bold').text('BILLED TO', 40, 150);
    doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text(member.name || payment.memberName || 'Member', 40, 164);
    doc.fillColor(textColor).fontSize(8.5).font('Helvetica');
    doc.text(`Member ID: ${member.memberId || member.id || 'N/A'}`, 40, 180);
    doc.text(`Phone: +91 ${member.phone || 'N/A'}`, 40, 192);
    doc.text(`Email: ${member.email || 'N/A'}`, 40, 204);

    // Right: Branch & Coach Info
    doc.fillColor(accentBlue).fontSize(9).font('Helvetica-Bold').text('GYM WORKSPACE', 310, 150);
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text(`Branch: ${member.branch || 'Mohali, Punjab'}`, 310, 164);
    doc.fillColor(textColor).fontSize(8.5).font('Helvetica');
    doc.text(`Assigned Trainer: ${member.trainer || 'Unassigned'}`, 310, 180);
    doc.text(`Status: Active Member`, 310, 192);

    // Stripe-like Membership Card / Timeline
    doc.roundedRect(40, 230, 515, 52, 10).fill(lightBg);
    doc.roundedRect(40, 230, 515, 52, 10).lineWidth(1).strokeColor(borderColor).stroke();

    doc.fillColor(textColor).fontSize(8).font('Helvetica-Bold').text('MEMBERSHIP PERIOD', 55, 242);
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text(`${getMembershipName(payment.plan || member.plan)}`, 55, 256);
    
    // Timeline steps
    doc.fillColor(textColor).fontSize(7.5).font('Helvetica-Bold').text('PURCHASED', 240, 242);
    doc.font('Helvetica').text(payment.date || new Date().toISOString().split('T')[0], 240, 256);

    doc.font('Helvetica-Bold').text('ACTIVATED', 340, 242);
    doc.font('Helvetica').text(payment.date || new Date().toISOString().split('T')[0], 340, 256);

    doc.fillColor(accentBlue).font('Helvetica-Bold').text('EXPIRES ON', 450, 242);
    doc.font('Helvetica-Bold').text(member.expiryDate || 'N/A', 450, 256);

    // Billing Table Headers
    doc.fillColor(textColor).fontSize(8).font('Helvetica-Bold');
    doc.text('DESCRIPTION', 40, 310);
    doc.text('DURATION', 280, 310, { width: 80, align: 'center' });
    doc.text('QTY', 370, 310, { width: 30, align: 'center' });
    doc.text('PRICE (INR)', 410, 310, { width: 60, align: 'right' });
    doc.text('TOTAL (INR)', 485, 310, { width: 70, align: 'right' });

    doc.strokeColor(borderColor).lineWidth(1).moveTo(40, 322).lineTo(555, 322).stroke();

    // Billing Row
    const subtotal = payment.amount - (payment.gst || 0);
    doc.fillColor(primaryColor).fontSize(9.5).font('Helvetica-Bold').text(`${getMembershipName(payment.plan || member.plan)} Gym Access`, 40, 335);
    doc.fillColor(textColor).fontSize(8.5).font('Helvetica').text('Full access to gym workspace & biometric gate sync.', 40, 348);
    
    doc.fillColor(primaryColor).fontSize(9).font('Helvetica').text(`${payment.plan?.includes('Custom') ? 'Custom' : getMembershipName(payment.plan || member.plan)}`, 280, 335, { width: 80, align: 'center' });
    doc.text('1', 370, 335, { width: 30, align: 'center' });
    doc.text(`₹${subtotal.toLocaleString('en-IN')}`, 410, 335, { width: 60, align: 'right' });
    doc.font('Helvetica-Bold').text(`₹${subtotal.toLocaleString('en-IN')}`, 485, 335, { width: 70, align: 'right' });

    doc.strokeColor(borderColor).lineWidth(1).moveTo(40, 370).lineTo(555, 370).stroke();

    // Summary calculations block (Right bottom side)
    doc.roundedRect(320, 390, 235, 110, 10).fill(lightBg);
    doc.roundedRect(320, 390, 235, 110, 10).lineWidth(1).strokeColor(borderColor).stroke();

    doc.fillColor(textColor).fontSize(8.5).font('Helvetica').text('Subtotal:', 335, 404);
    doc.fillColor(primaryColor).font('Helvetica-Bold').text(`₹${subtotal.toLocaleString('en-IN')}`, 440, 404, { width: 100, align: 'right' });

    const cgst = Math.floor((payment.gst || 0) / 2);
    const sgst = Math.floor((payment.gst || 0) / 2);
    doc.font('Helvetica').fillColor(textColor).text('CGST (9%):', 335, 420);
    doc.fillColor(primaryColor).text(`₹${cgst.toLocaleString('en-IN')}`, 440, 420, { width: 100, align: 'right' });

    doc.font('Helvetica').fillColor(textColor).text('SGST (9%):', 335, 436);
    doc.fillColor(primaryColor).text(`₹${sgst.toLocaleString('en-IN')}`, 440, 436, { width: 100, align: 'right' });

    doc.strokeColor(borderColor).lineWidth(0.5).moveTo(335, 454).lineTo(540, 454).stroke();

    doc.fillColor(accentBlue).fontSize(10).font('Helvetica-Bold').text('Total Paid:', 335, 468);
    doc.fontSize(11).text(`₹${payment.amount.toLocaleString('en-IN')}`, 440, 468, { width: 100, align: 'right' });

    // Paid Digital Stamp (Minimal Apple style)
    doc.save();
    doc.translate(80, 400);
    doc.roundedRect(0, 0, 120, 38, 6).lineWidth(1.5).strokeColor('#10b981').stroke();
    doc.fillColor('#10b981').font('Helvetica-Bold').fontSize(11).text('PAYMENT RECEIVED', 0, 14, { width: 120, align: 'center' });
    doc.restore();

    // Terms & Conditions block
    doc.roundedRect(40, 520, 515, 80, 10).fill(lightBg);
    doc.roundedRect(40, 520, 515, 80, 10).lineWidth(1).strokeColor(borderColor).stroke();
    
    doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold').text('TERMS & CONDITIONS', 55, 532);
    doc.fillColor(textColor).fontSize(7.5).font('Helvetica');
    doc.text('1. Membership fees are strictly non-refundable and non-transferable.', 55, 547);
    doc.text('2. Biometric registration is mandatory for facility entry at the access control gates.', 55, 559);
    doc.text('3. Members must strictly follow gym rules, protocols, and safety measures at all times.', 55, 571);
    doc.text('4. Loss or damage to gym property due to negligence will be charged to the member.', 55, 583);

    // Lime accent line above footer
    doc.strokeColor(accentLime).lineWidth(2.5).moveTo(40, 735).lineTo(555, 735).stroke();

    // Footer Block
    doc.fillColor(textColor).fontSize(8).font('Helvetica-Bold').text('Thank you for choosing The Warrior Gym.', 40, 750);
    doc.font('Helvetica').text('Stay consistent. Stay healthy.', 40, 762);
    doc.fillColor(textColor).fontSize(8).font('Helvetica-Bold').text('Powered by The Warrior Gym CRM.', 380, 750, { align: 'right', width: 175 });

    doc.end();
  });
};
export const triggerWelcomeEmail = async (member: any) => {
  try {
    const config = await db.getSmtpConfig();
    if (!config || !config.triggers || !config.triggers.welcome) return;

    const templates = await getSavedTemplates();
    const welcomeTemplate = templates.welcome;
    if (!welcomeTemplate) return;

    const parsedHtml = parseTemplate(welcomeTemplate.html, {
      memberName: member.name,
      plan: member.plan || 'Monthly Access',
      startDate: member.joinDate || new Date().toISOString().split('T')[0],
      expiryDate: member.expiryDate || 'N/A',
      branch: member.branch || 'Mohali, Punjab'
    });

    await sendEmail(member.email, welcomeTemplate.subject, parsedHtml);
  } catch (error) {
    console.error('[Automation] Welcome Email failed:', error);
  }
};

export const triggerPaymentEmail = async (payment: any) => {
  try {
    const config = await db.getSmtpConfig();
    if (!config || !config.triggers || !config.triggers.payment) return;

    const templates = await getSavedTemplates();
    const receiptTemplate = templates.receipt;
    if (!receiptTemplate) return;

    const members = await db.getMembers();
    const member = members.find(m => m.id === payment.memberId || m.name === payment.memberName);
    if (!member || !member.email) {
      console.warn('[Automation] Member email not found for payment, skipping email receipt.');
      return;
    }

    const subtotal = payment.amount - (payment.gst || 0);
    const parsedHtml = parseTemplate(receiptTemplate.html, {
      memberName: member.name,
      invoice: payment.invoice || 'INV-00000',
      plan: payment.plan || member.plan || 'Monthly Access',
      amount: subtotal.toString(),
      gst: (payment.gst || 0).toString(),
      total: payment.amount.toString(),
      method: payment.method || 'UPI',
      date: payment.date || new Date().toISOString().split('T')[0]
    });

    // Generate PDF Attachments
    const pdfBuffer = await generateInvoicePdf(payment, member);
    const pdfFilename = `Invoice_${payment.invoice || 'INV-00000'}.pdf`;

    await sendEmail(member.email, receiptTemplate.subject.replace('{{invoice}}', payment.invoice || 'INV-00000'), parsedHtml, [
      { filename: pdfFilename, content: pdfBuffer }
    ]);
  } catch (error) {
    console.error('[Automation] Payment Email failed:', error);
  }
};

// Scheduler Automation checks (runs daily)
export const runDailyAutomationChecks = async () => {
  try {
    console.log('[Automation Scheduler] Running daily checks...');
    const config = await db.getSmtpConfig();
    if (!config || !config.triggers) return;

    const templates = await getSavedTemplates();
    const members = await db.getMembers();
    const todayStr = new Date().toISOString().split('T')[0];

    for (const member of members) {
      if (!member.email || !member.expiryDate) continue;

      const expiryTime = new Date(member.expiryDate).getTime();
      const todayTime = new Date(todayStr).getTime();
      const diffDays = Math.ceil((expiryTime - todayTime) / (1000 * 60 * 60 * 24));

      // 1. Membership Expiring in 7 days
      if (diffDays === 7 && config.triggers.expiry7 && templates.expiry) {
        const parsedHtml = parseTemplate(templates.expiry.html, {
          memberName: member.name,
          plan: member.plan || 'Monthly Access',
          daysLeft: '7',
          expiryDate: member.expiryDate
        });
        await sendEmail(member.email, templates.expiry.subject, parsedHtml);
      }

      // 2. Membership Expiring in 3 days
      if (diffDays === 3 && config.triggers.expiry3 && templates.expiry) {
        const parsedHtml = parseTemplate(templates.expiry.html, {
          memberName: member.name,
          plan: member.plan || 'Monthly Access',
          daysLeft: '3',
          expiryDate: member.expiryDate
        });
        await sendEmail(member.email, templates.expiry.subject, parsedHtml);
      }

      // 3. Membership Expired today (diffDays === 0 or -1 depending on date logic)
      if (diffDays === 0 && config.triggers.expired && templates.renewal) {
        const parsedHtml = parseTemplate(templates.renewal.html, {
          memberName: member.name,
          plan: member.plan || 'Monthly Access',
        });
        await sendEmail(member.email, templates.renewal.subject, parsedHtml);
      }
    }
  } catch (error) {
    console.error('[Automation Scheduler] Daily checks failed:', error);
  }
};

export const triggerPtWelcomeEmail = async (member: any) => {
  try {
    const subject = 'Welcome to Personal Training at The Warrior Gym! 🏋️';
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><style>
  body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
  .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 32px rgba(0,0,0,0.08); }
  .hero { background: #000; padding: 40px 32px; text-align: center; }
  .hero h1 { color: #d4ff00; font-size: 28px; font-weight: 900; margin: 0; letter-spacing: -0.5px; }
  .hero p { color: rgba(255,255,255,0.6); font-size: 13px; margin: 8px 0 0; }
  .body { padding: 32px; }
  .body h2 { font-size: 20px; font-weight: 800; color: #0f172a; }
  .body p { color: #64748b; font-size: 14px; line-height: 1.7; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; color: #94a3b8; font-size: 11px; }
</style></head>
<body>
  <div class="wrapper">
    <div class="hero">
      <h1>⚡ THE WARRIOR GYM Personal Training</h1>
      <p>Unlocking your highest potential</p>
    </div>
    <div class="body">
      <h2>Hello, ${member.name}! 👋</h2>
      <p>Congratulations! You are now a **Personal Training (PT) member** at The Warrior Gym.</p>
      <p>Your dedicated personal coach will connect with you shortly to build your customized diet plans and strength programs.</p>
      <p>Let's crush your fitness goals together!</p>
    </div>
    <div class="footer">The Warrior Gym · Mohali, Punjab · +91 98765 43210</div>
  </div>
</body>
</html>`;

    if (member.email) {
      await sendEmail(member.email, subject, html);
    }
  } catch (error) {
    console.error('[Automation] PT Welcome Email failed:', error);
  }
};
