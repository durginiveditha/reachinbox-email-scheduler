import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;
let etherealAccount: { user: string; pass: string; previewUrl: string } | null = null;

export async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS,
      },
    });
    console.log('✅ Using configured Ethereal account');
  } else {
    // Auto-create a test Ethereal account
    const account = await nodemailer.createTestAccount();
    etherealAccount = {
      user: account.user,
      pass: account.pass,
      previewUrl: 'https://ethereal.email',
    };
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });
    console.log(`✅ Ethereal test account created: ${account.user}`);
    console.log(`   Preview emails at: https://ethereal.email`);
  }

  return transporter;
}

export interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ messageId: string; previewUrl?: string }> {
  const t = await getTransporter();
  const info = await t.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
  if (previewUrl) {
    console.log(`📧 Email preview: ${previewUrl}`);
  }

  return {
    messageId: info.messageId,
    previewUrl: typeof previewUrl === 'string' ? previewUrl : undefined,
  };
}

export function getEtherealAccount() {
  return etherealAccount;
}
