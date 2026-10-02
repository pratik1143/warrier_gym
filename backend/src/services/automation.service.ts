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
    <div class="footer">The Warrior Gym · SCO 30, 31, Sector 89, Mohali · +91 98170 23336</div>
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
    subject: 'Membership Receipt — Invoice #{{invoice}}',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><style>
  body { font-family: Arial, sans-serif; background:#070707; color:#f7f1e4; margin:0; padding:24px; }
  .wrapper { max-width:620px; margin:0 auto; background:#0b0a08; border:2px solid #c99a3b; border-radius:18px; overflow:hidden; }
  .hero { padding:26px 30px 20px; text-align:center; border-bottom:1px solid #725722; background:linear-gradient(135deg,#171208,#080808); }
  .hero h1 { color:#efc65e; font-size:23px; letter-spacing:1px; margin:0; }
  .hero p { color:#d7c79e; font-size:12px; margin:9px 0 0; }
  .body { padding:24px 30px; }
  .body p { color:#e7dfce; font-size:14px; line-height:1.6; }
  .invoice-table { width:100%; border-collapse:collapse; margin:18px 0; font-size:13px; border:1px solid #8f6828; }
  .invoice-table th { background:#2a200d; color:#efc65e; padding:11px 12px; text-align:left; text-transform:uppercase; letter-spacing:1px; font-size:10px; }
  .invoice-table td { padding:12px; border-top:1px solid #5c471f; color:#f7f1e4; }
  .invoice-table td:last-child,.invoice-table th:last-child { text-align:right; }
  .total-row td { color:#efc65e; font-weight:bold; background:#15120b; }
  .footer { padding:16px; text-align:center; color:#d7ad50; font-size:10px; letter-spacing:1px; border-top:1px solid #725722; }
</style></head>
<body>
  <div class="wrapper">
    <div class="hero"><h1>THE WARRIOR GYM</h1><p>MEMBERSHIP RECEIPT · INVOICE #{{invoice}}</p></div>
    <div class="body">
      <p>Dear <strong>{{memberName}}</strong>, thank you for choosing The Warrior Gym. Your membership receipt is attached as a PDF.</p>
      <table class="invoice-table">
        <tr><th>Description</th><th>Amount</th></tr>
        <tr><td>{{plan}} Membership</td><td>₹{{amount}}</td></tr>
        <tr><td>GST / Tax</td><td>₹{{gst}}</td></tr>
        <tr class="total-row"><td>Paid · {{method}} · {{date}}</td><td>₹{{total}}</td></tr>
      </table>
      <p>We look forward to seeing you train. Stay strong!</p>
    </div>
    <div class="footer">SCO 30, 31, SECTOR 89, MOHALI · +91 98170 23336 · THEWARRIORGYM.IN</div>
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

const withCurrentReceiptDesign = (templates: Record<string, any>): Record<string, EmailTemplate> => ({
  ...DEFAULT_TEMPLATES,
  ...templates,
  receipt: {
    ...DEFAULT_TEMPLATES.receipt,
    ...(templates?.receipt || {}),
    html: DEFAULT_TEMPLATES.receipt.html,
  },
});

export const getSavedTemplates = async (): Promise<Record<string, EmailTemplate>> => {
  const firestore = isFirebaseInitialized && admin ? admin.firestore() : null;
  if (firestore) {
    const doc = await firestore.collection('system_config').doc('templates').get();
    if (doc.exists) {
      return withCurrentReceiptDesign(doc.data() || {});
    }
  }
  const templatesPath = './email_templates.json';
  if (fs.existsSync(templatesPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
      localTemplates = withCurrentReceiptDesign(data);
      return localTemplates;
    } catch (e) {}
  }
  return DEFAULT_TEMPLATES;
};

export const saveTemplates = async (templatesData: any): Promise<any> => {
  const normalizedTemplates = withCurrentReceiptDesign({ ...localTemplates, ...templatesData });
  const firestore = isFirebaseInitialized && admin ? admin.firestore() : null;
  if (firestore) {
    await firestore.collection('system_config').doc('templates').set(normalizedTemplates, { merge: true });
  }
  localTemplates = normalizedTemplates;
  const templatesPath = './email_templates.json';
  try {
    fs.writeFileSync(templatesPath, JSON.stringify(normalizedTemplates, null, 2), 'utf8');
  } catch (e) {}
  return normalizedTemplates;
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
  const invoiceNumber = payment.invoiceNumber || payment.invoice || 'INV-00000';
  const memberName = member.name || payment.memberName || 'Member';
  const memberPhone = member.phone || payment.memberPhone || '—';
  const planName = payment.plan || payment.packageName || member.plan || 'Membership';
  const billDate = payment.billingDate || payment.date || payment.paymentDate || new Date().toISOString().split('T')[0];
  const startDate = payment.startDate || member.startDate || member.joinDate || '—';
  const expiryDate = payment.expiryDate || payment.newExpiryDate || member.expiryDate || '—';
  const discount = Number(payment.discountAmount ?? payment.discount ?? 0);
  const tax = Number(payment.taxAmount ?? payment.tax ?? payment.gst ?? 0);
  const otherCharges = Number(payment.otherCharges || 0);
  const originalAmount = Number(payment.originalAmount ?? payment.packagePrice ?? (Number(payment.amount || 0) + discount - tax - otherCharges));
  const netPayable = Number(payment.netPayable ?? Math.max(0, originalAmount - discount + tax + otherCharges));
  const paid = Number(payment.amountPaid ?? payment.paid ?? payment.amount ?? netPayable);
  const pending = Number(payment.outstandingAmount ?? payment.pendingAmount ?? Math.max(0, netPayable - paid));
  const refund = Number(payment.refundedAmount ?? payment.refundAmount ?? payment.refunded ?? 0);
  const freezeDays = Number(payment.freezeDays ?? payment.noFreeze ?? payment.frozenDays ?? 0);
  const method = payment.paymentMethod || payment.method || 'UPI';
  const dateLabel = (value: any) => {
    if (!value || value === '—') return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(expiryDate).getTime();
  const days = Number.isFinite(startTime) && Number.isFinite(endTime) ? Math.max(0, Math.round((endTime - startTime) / 86400000) + 1) : Number(payment.durationDays || 0);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, compress: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const gold = '#D7AD50';
    const brightGold = '#F0C85D';
    const mutedGold = '#B89A5A';
    const white = '#F7F1E4';
    const dark = '#070707';
    const panel = '#11100D';
    const line = '#725722';
    const fmtText = (value: any) => String(value ?? '—');

    doc.rect(0, 0, pageWidth, pageHeight).fill(dark);
    doc.roundedRect(16, 16, pageWidth - 32, pageHeight - 32, 12).lineWidth(2).stroke(gold);
    doc.roundedRect(24, 24, pageWidth - 48, pageHeight - 48, 8).lineWidth(0.7).stroke('#765B27');

    const logoCandidates = [
      path.resolve(process.cwd(), '../frontend/public/gymlogo.png'),
      path.resolve(process.cwd(), 'frontend/public/gymlogo.png'),
      path.resolve(__dirname, '../../../frontend/public/gymlogo.png'),
      path.resolve(process.cwd(), 'public/gymlogo.png'),
      path.resolve(process.cwd(), 'gym_logo.png'),
    ];
    const logoPath = logoCandidates.find((candidate) => fs.existsSync(candidate));
    if (logoPath) {
      try { doc.image(logoPath, 40, 34, { fit: [112, 88], align: 'center', valign: 'center' }); } catch {}
    }

    doc.fillColor(brightGold).font('Helvetica-Bold').fontSize(31).text('THE WARRIOR GYM', 160, 52, { width: 430, lineBreak: false });
    doc.fillColor(white).font('Helvetica').fontSize(8.5).text('BUILDING STRENGTH, BUILDING WARRIORS', 162, 91, { characterSpacing: 2.1 });
    doc.strokeColor(line).lineWidth(1).moveTo(160, 108).lineTo(580, 108).stroke();
    doc.fillColor(white).font('Helvetica-Bold').fontSize(8).text('SCO 30, 31, Sector 89, Mohali 140308', 600, 40, { width: pageWidth - 644, align: 'right' });
    doc.font('Helvetica').fillColor('#D7C79E').fontSize(8).text('+91 98170 23336', 600, 55, { width: pageWidth - 644, align: 'right' });
    doc.text('thewarriorgym.in', 600, 69, { width: pageWidth - 644, align: 'right' });
    doc.text('Ramansingh6158@gmail.com', 600, 83, { width: pageWidth - 644, align: 'right' });
    doc.font('Helvetica-Bold').fillColor(brightGold).fontSize(8).text(`INVOICE  ${invoiceNumber}`, 600, 101, { width: pageWidth - 644, align: 'right' });

    const titleY = 125;
    doc.roundedRect(250, titleY, pageWidth - 500, 34, 8).fill('#211909');
    doc.roundedRect(250, titleY, pageWidth - 500, 34, 8).lineWidth(1).stroke(gold);
    doc.fillColor(brightGold).font('Helvetica-Bold').fontSize(15).text('MEMBERSHIP RECEIPT', 250, titleY + 9, { width: pageWidth - 500, align: 'center', characterSpacing: 1.6 });

    const infoY = 178;
    const colW = (pageWidth - 104) / 2;
    const drawInfo = (x: number, title: string, entries: Array<[string, string]>) => {
      doc.roundedRect(x, infoY, colW, 77, 6).lineWidth(0.8).stroke(line);
      doc.fillColor(brightGold).font('Helvetica-Bold').fontSize(8).text(title.toUpperCase(), x + 12, infoY + 10, { characterSpacing: 1.1 });
      entries.forEach(([label, value], index) => {
        const y = infoY + 28 + index * 15;
        doc.fillColor(mutedGold).font('Helvetica-Bold').fontSize(7.5).text(label.toUpperCase(), x + 12, y, { width: 112 });
        doc.fillColor(white).font('Helvetica').fontSize(8.5).text(fmtText(value), x + 126, y, { width: colW - 138, ellipsis: true, lineBreak: false });
      });
    };
    drawInfo(40, 'Member Details', [['Member Name', memberName], ['Phone', memberPhone], ['Member ID', member.biometricId || member.memberId || member.id || payment.memberId || '—']]);
    drawInfo(52 + colW, 'Membership Details', [['Billing Date', dateLabel(billDate)], ['Package', planName], ['Membership Period', `${dateLabel(startDate)} to ${dateLabel(expiryDate)}`]]);

    const tableX = 40;
    const tableY = 274;
    const tableW = pageWidth - 80;
    const headerH = 25;
    const rowH = 21;
    const columns = [tableX, tableX + tableW * 0.33, tableX + tableW * 0.66, tableX + tableW];
    doc.roundedRect(tableX, tableY, tableW, headerH, 5).fill('#2A200D');
    doc.fillColor(brightGold).font('Helvetica-Bold').fontSize(8.5);
    doc.text('DESCRIPTION', columns[0] + 12, tableY + 8, { width: tableW * 0.33 - 18 });
    doc.text('DETAILS', columns[1], tableY + 8, { width: tableW * 0.33, align: 'center' });
    doc.text('AMOUNT', columns[2], tableY + 8, { width: tableW * 0.34 - 12, align: 'right' });

    const rows: Array<[string, string, string, boolean]> = [
      ['PACKAGE', planName, money(originalAmount), false],
      ['NO. OF DAYS', days ? `${days} Days` : `${dateLabel(startDate)} — ${dateLabel(expiryDate)}`, '—', false],
      ['DISCOUNT', 'Membership offer', `− ${money(discount)}`, false],
      ['TAX / GST', 'Applicable tax', money(tax), false],
      ['TOTAL PAID', method, money(paid), true],
      ['NO. REFUNDED', 'Refunded amount', money(refund), false],
      ['NO. FREEZE', `${freezeDays} Days`, '—', false],
      ['BALANCE', pending > 0 ? 'Pending' : 'Fully paid', money(pending), true],
    ];
    rows.forEach(([label, detail, amount, strong], index) => {
      const y = tableY + headerH + index * rowH;
      doc.rect(tableX, y, tableW, rowH).fill(index % 2 === 0 ? '#0C0B09' : panel);
      doc.strokeColor(line).lineWidth(0.35).moveTo(tableX, y + rowH).lineTo(tableX + tableW, y + rowH).stroke();
      doc.fillColor(strong ? brightGold : white).font(strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      doc.text(label, columns[0] + 12, y + 6, { width: tableW * 0.33 - 18, lineBreak: false, ellipsis: true });
      doc.fillColor('#E2D8C3').font('Helvetica').text(fmtText(detail), columns[1] + 5, y + 6, { width: tableW * 0.33 - 10, align: 'center', lineBreak: false, ellipsis: true });
      doc.fillColor(strong ? brightGold : white).font(strong ? 'Helvetica-Bold' : 'Helvetica').text(fmtText(amount), columns[2], y + 6, { width: tableW * 0.34 - 12, align: 'right', lineBreak: false, ellipsis: true });
    });

    const footerY = tableY + headerH + rows.length * rowH + 15;
    doc.strokeColor(line).lineWidth(0.8).moveTo(40, footerY).lineTo(pageWidth - 40, footerY).stroke();
    doc.fillColor(brightGold).font('Helvetica-Bold').fontSize(8).text('ADDRESS', 48, footerY + 10);
    doc.fillColor('#D7C79E').font('Helvetica').fontSize(7.5).text('SCO 30, 31, Sector 89, Mohali, Punjab 140308', 48, footerY + 24, { width: 215 });
    doc.strokeColor(gold).lineWidth(0.6).moveTo(pageWidth / 2 - 90, footerY + 8).lineTo(pageWidth / 2 - 90, footerY + 43).stroke();
    doc.strokeColor(gold).lineWidth(0.6).moveTo(pageWidth / 2 + 90, footerY + 8).lineTo(pageWidth / 2 + 90, footerY + 43).stroke();
    doc.fillColor(brightGold).font('Helvetica-Bold').fontSize(7).text('THANK YOU FOR CHOOSING', pageWidth / 2 - 80, footerY + 12, { width: 160, align: 'center', characterSpacing: 0.5 });
    doc.fontSize(11).text('THE WARRIOR GYM', pageWidth / 2 - 80, footerY + 26, { width: 160, align: 'center', characterSpacing: 0.6 });
    doc.fillColor(brightGold).font('Helvetica-Oblique').fontSize(15).text('Ramandeep Singh', pageWidth - 250, footerY + 5, { width: 202, align: 'right' });
    doc.strokeColor(line).lineWidth(0.7).moveTo(pageWidth - 250, footerY + 29).lineTo(pageWidth - 48, footerY + 29).stroke();
    doc.fillColor('#D7C79E').font('Helvetica-Bold').fontSize(7).text('AUTHORIZED SIGNATURE', pageWidth - 250, footerY + 33, { width: 202, align: 'right', characterSpacing: 1 });
    doc.fillColor(brightGold).font('Helvetica-Bold').fontSize(8).text('STRONGER TODAY  ◆  BETTER TOMORROW', 40, pageHeight - 38, { width: pageWidth - 80, align: 'center', characterSpacing: 1.2 });
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
    <div class="footer">The Warrior Gym · SCO 30, 31, Sector 89, Mohali · +91 98170 23336</div>
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
