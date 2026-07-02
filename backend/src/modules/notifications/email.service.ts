import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private initialized = false;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(port, 10),
        secure: parseInt(port, 10) === 465,
        auth: { user, pass },
      });
      this.initialized = true;
    } else {
      this.logger.warn(
        'SMTP not configured. Email sending is disabled.',
      );
    }
  }

  private getFromAddress(): string {
    return process.env.SMTP_FROM || 'noreply@issuetracker.local';
  }

  private buildHtml(title: string, bodyLines: string[]): string {
    const lines = bodyLines.map((l) => `<p>${l}</p>`).join('');
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333;">${title}</h2>
  ${lines}
  <hr style="margin-top: 24px;">
  <p style="color: #888; font-size: 12px;">Issue Tracker Notification</p>
</body>
</html>`;
  }

  async sendAssignmentEmail(
    to: string,
    issueTitle: string,
    issueId: string,
  ): Promise<void> {
    if (!this.initialized || !this.transporter) {
      this.logger.log(
        `[Email skipped] Assignment: issue "${issueTitle}" to ${to}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject: `[Issue Tracker] You've been assigned: ${issueTitle}`,
        html: this.buildHtml('New Assignment', [
          `You have been assigned to issue: <strong>${issueTitle}</strong>`,
          `Issue ID: ${issueId}`,
        ]),
      });
      this.logger.log(`Assignment email sent to ${to} for issue ${issueId}`);
    } catch (err) {
      this.logger.error(
        `Failed to send assignment email to ${to}: ${(err as Error).message}`,
      );
    }
  }

  async sendOverdueEmail(
    to: string,
    issueTitle: string,
    issueId: string,
    deadline: Date,
  ): Promise<void> {
    if (!this.initialized || !this.transporter) {
      this.logger.log(
        `[Email skipped] Overdue: issue "${issueTitle}" to ${to}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject: `[Issue Tracker] OVERDUE: ${issueTitle}`,
        html: this.buildHtml('Issue Overdue', [
          `Issue <strong>${issueTitle}</strong> is past its deadline.`,
          `Issue ID: ${issueId}`,
          `Deadline was: ${deadline.toISOString()}`,
          `Please take action immediately.`,
        ]),
      });
      this.logger.log(`Overdue email sent to ${to} for issue ${issueId}`);
    } catch (err) {
      this.logger.error(
        `Failed to send overdue email to ${to}: ${(err as Error).message}`,
      );
    }
  }
}