/**
 * Email Service
 * 
 * Handles all email sending for Infinity Assistant
 * Uses Resend for email delivery
 */

import { Resend } from 'resend';
import logger from '@/utils/logger';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface WelcomeEmailData {
  email: string;
  name?: string;
  product?: 'assistant' | 'builder';
}

export interface VerificationEmailData {
  email: string;
  verificationToken: string;
  name?: string;
}

export interface OnboardingCompleteEmailData {
  email: string;
  name?: string;
  product: 'assistant' | 'builder';
  preferences?: any;
}

/**
 * Email Service
 * Sends transactional emails for Infinity Assistant
 */
export class EmailService {
  private fromEmail = process.env.FROM_EMAIL || 'Infinity Assistant <onboarding@infinityassistant.io>';
  private fromName = 'Infinity Assistant';

  /**
   * Send welcome email after signup
   */
  async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    try {
      const productName = data.product === 'builder' ? 'Infinity Builder' : 'Infinity Assistant';
      const productDescription = data.product === 'builder' 
        ? 'Build full-stack applications with AI assistance'
        : 'Your personal AI assistant that remembers and learns';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ${productName}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 32px;">Welcome to ${productName}!</h1>
          </div>
          
          <div style="background: #ffffff; padding: 40px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            ${data.name ? `<p style="font-size: 18px; margin-bottom: 20px;">Hi ${data.name},</p>` : '<p style="font-size: 18px; margin-bottom: 20px;">Hi there,</p>'}
            
            <p>Thank you for signing up for ${productName}! We're excited to have you on board.</p>
            
            <p><strong>${productDescription}</strong></p>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <h2 style="margin-top: 0; color: #8b5cf6;">Getting Started</h2>
              <ol style="padding-left: 20px;">
                <li style="margin-bottom: 10px;">Complete your onboarding to personalize your experience</li>
                <li style="margin-bottom: 10px;">Start chatting with your AI assistant</li>
                <li style="margin-bottom: 10px;">Explore features and customize your preferences</li>
              </ol>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://infinityassistant.io'}" 
                 style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Get Started
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
              If you have any questions, feel free to reach out to our support team.
            </p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              Best regards,<br>
              The Infinity Assistant Team
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Infinity Assistant. All rights reserved.</p>
          </div>
        </body>
        </html>
      `;

      const result = await resend.emails.send({
        from: this.fromEmail,
        to: data.email,
        subject: `Welcome to ${productName}! 🎉`,
        html
      });

      logger.info('[EmailService] Welcome email sent:', {
        email: data.email,
        product: data.product,
        emailId: result.data?.id
      });

      return true;
    } catch (error) {
      logger.error('[EmailService] Failed to send welcome email:', error);
      return false;
    }
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(data: VerificationEmailData): Promise<boolean> {
    try {
      const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://infinityassistant.io'}/verify-email?token=${data.verificationToken}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 32px;">Verify Your Email</h1>
          </div>
          
          <div style="background: #ffffff; padding: 40px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            ${data.name ? `<p style="font-size: 18px; margin-bottom: 20px;">Hi ${data.name},</p>` : '<p style="font-size: 18px; margin-bottom: 20px;">Hi there,</p>'}
            
            <p>Please verify your email address to complete your account setup.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
              Or copy and paste this link into your browser:<br>
              <a href="${verificationUrl}" style="color: #8b5cf6; word-break: break-all;">${verificationUrl}</a>
            </p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              This link will expire in 24 hours.
            </p>
          </div>
        </body>
        </html>
      `;

      const result = await resend.emails.send({
        from: this.fromEmail,
        to: data.email,
        subject: 'Verify Your Email Address',
        html
      });

      logger.info('[EmailService] Verification email sent:', {
        email: data.email,
        emailId: result.data?.id
      });

      return true;
    } catch (error) {
      logger.error('[EmailService] Failed to send verification email:', error);
      return false;
    }
  }

  /**
   * Send onboarding completion email
   */
  async sendOnboardingCompleteEmail(data: OnboardingCompleteEmailData): Promise<boolean> {
    try {
      const productName = data.product === 'builder' ? 'Infinity Builder' : 'Infinity Assistant';
      const nextSteps = data.product === 'builder'
        ? ['Start your first project', 'Explore templates', 'Deploy to production']
        : ['Ask your first question', 'Customize preferences', 'Explore features'];

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>You're All Set!</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 32px;">You're All Set! 🎉</h1>
          </div>
          
          <div style="background: #ffffff; padding: 40px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            ${data.name ? `<p style="font-size: 18px; margin-bottom: 20px;">Hi ${data.name},</p>` : '<p style="font-size: 18px; margin-bottom: 20px;">Hi there,</p>'}
            
            <p>Great job completing your onboarding! Your ${productName} is now personalized and ready to use.</p>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <h2 style="margin-top: 0; color: #8b5cf6;">Next Steps</h2>
              <ul style="padding-left: 20px;">
                ${nextSteps.map(step => `<li style="margin-bottom: 10px;">${step}</li>`).join('')}
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://infinityassistant.io'}" 
                 style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Start Using ${productName}
              </a>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await resend.emails.send({
        from: this.fromEmail,
        to: data.email,
        subject: `Your ${productName} is Ready!`,
        html
      });

      logger.info('[EmailService] Onboarding complete email sent:', {
        email: data.email,
        product: data.product,
        emailId: result.data?.id
      });

      return true;
    } catch (error) {
      logger.error('[EmailService] Failed to send onboarding complete email:', error);
      return false;
    }
  }
}

// Singleton instance
let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

