import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private initialized = false;

  constructor(private readonly prisma: PrismaService) {
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

  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'CRITICAL': return '#dc2626';
      case 'HIGH': return '#ea580c';
      case 'MEDIUM': return '#eab308';
      case 'LOW': return '#22c55e';
      default: return '#6b7280';
    }
  }

  private buildHtml(title: string, issue: any, extraLines: string[]): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const issueUrl = `${frontendUrl}/issues/${issue.id}`;
    const priorityColor = this.getPriorityColor(issue.priority);
    const description = issue.description 
      ? (issue.description.length > 200 ? issue.description.substring(0, 200) + '...' : issue.description)
      : 'No description provided.';
    const deadline = issue.deadline ? issue.deadline.toISOString().split('T')[0] : 'None';
    
    const extraHtml = extraLines.map(l => `<p style="margin: 0 0 10px 0; color: #4b5563; font-size: 15px;">${l}</p>`).join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
    <div style="background-color: #1f2937; padding: 24px; text-align: center;">
      <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">Flexcube Upgrade — Issue Tracker</h2>
    </div>
    <div style="padding: 32px;">
      <h3 style="color: #111827; margin-top: 0; margin-bottom: 20px; font-size: 18px;">${title}</h3>
      ${extraHtml}
      
      <div style="margin-top: 24px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <th style="padding: 12px 16px; background-color: #f9fafb; color: #4b5563; font-weight: 600; width: 100px;">Title</th>
            <td style="padding: 12px 16px; color: #111827; font-weight: 500;">${issue.title}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <th style="padding: 12px 16px; background-color: #f9fafb; color: #4b5563; font-weight: 600;">Type</th>
            <td style="padding: 12px 16px; color: #111827;">${issue.type}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <th style="padding: 12px 16px; background-color: #f9fafb; color: #4b5563; font-weight: 600;">Priority</th>
            <td style="padding: 12px 16px;">
              <span style="display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background-color: ${priorityColor}15; color: ${priorityColor}; border: 1px solid ${priorityColor}40;">
                ${issue.priority}
              </span>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <th style="padding: 12px 16px; background-color: #f9fafb; color: #4b5563; font-weight: 600;">Status</th>
            <td style="padding: 12px 16px; color: #111827;">${issue.status}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <th style="padding: 12px 16px; background-color: #f9fafb; color: #4b5563; font-weight: 600;">Module</th>
            <td style="padding: 12px 16px; color: #111827;">${issue.module || 'None'}</td>
          </tr>
          <tr>
            <th style="padding: 12px 16px; background-color: #f9fafb; color: #4b5563; font-weight: 600;">Deadline</th>
            <td style="padding: 12px 16px; color: #111827;">${deadline}</td>
          </tr>
        </table>
      </div>
      
      <div style="margin-top: 24px;">
        <h4 style="margin: 0 0 8px 0; color: #4b5563; font-size: 14px; font-weight: 600;">Description</h4>
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; color: #4b5563; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${description}</div>
      </div>
      
      <div style="margin-top: 32px; text-align: center;">
        <a href="${issueUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 15px;">View Issue</a>
      </div>
    </div>
    
    <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px; margin: 0;">This is an automated notification from the Flexcube Upgrade issue tracker. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private buildText(title: string, issue: any, extraLines: string[]): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const issueUrl = `${frontendUrl}/issues/${issue.id}`;
    const description = issue.description 
      ? (issue.description.length > 200 ? issue.description.substring(0, 200) + '...' : issue.description)
      : 'No description provided.';
    const deadline = issue.deadline ? issue.deadline.toISOString().split('T')[0] : 'None';

    return `Flexcube Upgrade — Issue Tracker
=====================================
${title}

${extraLines.join('\n')}

Issue Details:
-------------------------------------
Title:     ${issue.title}
Type:      ${issue.type}
Priority:  ${issue.priority}
Status:    ${issue.status}
Module:    ${issue.module || 'None'}
Deadline:  ${deadline}

Description:
${description}

View Issue: ${issueUrl}

-------------------------------------
This is an automated notification from the Flexcube Upgrade issue tracker. Do not reply to this email.`;
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
      const issue = await this.prisma.issue.findUnique({
        where: { id: issueId },
        include: {
          assignedBy: { select: { name: true } },
          raisedByOrg: { select: { name: true } },
        },
      });

      if (!issue) {
        this.logger.error(`Cannot send email: Issue ${issueId} not found`);
        return;
      }

      const assignedBy = issue.assignedBy?.name || 'System';
      const raisedByOrg = issue.raisedByOrg?.name || 'Unknown';

      const extraLinesHtml = [
        `You have been assigned to this issue by <strong>${assignedBy}</strong>.`,
        `This issue was raised by <strong>${raisedByOrg}</strong>.`
      ];

      const extraLinesText = [
        `You have been assigned to this issue by ${assignedBy}.`,
        `This issue was raised by ${raisedByOrg}.`
      ];

      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject: `[Issue Tracker] You've been assigned: ${issue.title}`,
        html: this.buildHtml('New Assignment', issue, extraLinesHtml),
        text: this.buildText('New Assignment', issue, extraLinesText),
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
      const issue = await this.prisma.issue.findUnique({
        where: { id: issueId },
        include: {
          assignedToUser: { select: { name: true } },
          assignedToOrg: { select: { name: true } },
        },
      });

      if (!issue) {
        this.logger.error(`Cannot send email: Issue ${issueId} not found`);
        return;
      }

      const assigneeName = issue.assignedToUser?.name || issue.assignedToOrg?.name || 'Unassigned';
      
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - deadline.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      
      let overdueText = '';
      if (diffDays > 0) {
        overdueText = `${diffDays} day${diffDays === 1 ? '' : 's'}`;
      } else {
        overdueText = `${diffHours} hour${diffHours === 1 ? '' : 's'}`;
      }

      const extraLinesHtml = [
        `This issue is currently <strong>${overdueText} overdue</strong>.`,
        `Current Assignee: <strong>${assigneeName}</strong>`,
        `Please take action immediately.`
      ];
      
      const extraLinesText = [
        `This issue is currently ${overdueText} overdue.`,
        `Current Assignee: ${assigneeName}`,
        `Please take action immediately.`
      ];

      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject: `[Issue Tracker] OVERDUE: ${issue.title}`,
        html: this.buildHtml('Issue Overdue', issue, extraLinesHtml),
        text: this.buildText('Issue Overdue', issue, extraLinesText),
      });
      this.logger.log(`Overdue email sent to ${to} for issue ${issueId}`);
    } catch (err) {
      this.logger.error(
        `Failed to send overdue email to ${to}: ${(err as Error).message}`,
      );
    }
  }
}