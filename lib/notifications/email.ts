import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendReceiptEmail(email: string, planName: string, amount: string, date: string) {
    if (!process.env.RESEND_API_KEY) {
        console.warn("Resend API Key missing. Skipping receipt email.");
        return;
    }

    try {
        await resend.emails.send({
            from: 'ReplyKaro <replykaro1704@gmail.com>',
            to: email,
            subject: `Payment Receipt for ${planName}`,
            html: `
                <h1>Payment Successful!</h1>
                <p>Thank you for subscribing to <strong>${planName}</strong>.</p>
                <p><strong>Amount:</strong> ₹${amount}</p>
                <p><strong>Date:</strong> ${date}</p>
                <p>You can verify your subscription status in your dashboard.</p>
                <br/>
                <p>Best,<br/>The ReplyKaro Team</p>
            `
        });
    } catch (error) {
        console.error("Failed to send receipt email:", error);
    }
}

export async function sendWelcomeEmail(email: string, name: string) {
    if (!process.env.RESEND_API_KEY) return;

    try {
        await resend.emails.send({
            from: 'ReplyKaro <replykaro1704@gmail.com>',
            to: email,
            subject: 'Welcome to ReplyKaro!',
            html: `
                <h1>Welcome, ${name}!</h1>
                <p>We are excited to have you on board.</p>
                <p>Get started by connecting your Instagram account in the dashboard.</p>
            `
        });
    } catch (error) {
        console.error("Failed to send welcome email:", error);
    }
}

export async function sendExpiryWarningEmail(email: string, expiryDate: string) {
    if (!process.env.RESEND_API_KEY) return;

    try {
        await resend.emails.send({
            from: 'ReplyKaro <replykaro1704@gmail.com>',
            to: email,
            subject: 'Your ReplyKaro Subscription is Expiring Soon',
            html: `
                <h1>Action Required</h1>
                <p>Your subscription is set to expire on <strong>${expiryDate}</strong>.</p>
                <p>Please renew your plan to avoid interruption of your automation services.</p>
            `
        });
    } catch (error) {
        console.error("Failed to send expiry warning email:", error);
    }
}

export async function sendPaymentFailedEmail(email: string, planName: string, retryLink: string) {
    if (!process.env.RESEND_API_KEY) return;

    try {
        await resend.emails.send({
            from: 'ReplyKaro <replykaro1704@gmail.com>',
            to: email,
            subject: 'Action Required: Payment Failed',
            html: `
                <h1>Payment Failed</h1>
                <p>We were unable to process the payment for your <strong>${planName}</strong> subscription.</p>
                <p>To avoid service interruption, please update your payment method or retry the payment.</p>
                <p><a href="${retryLink}">Update Payment Method</a></p>
                <br/>
                <p>If you have already updated your payment method, please ignore this email.</p>
            `
        });
    } catch (error) {
        console.error("Failed to send payment failed email:", error);
    }
}
export async function sendQuotaReachedEmail(email: string) {
    if (!process.env.RESEND_API_KEY) return;

    try {
        await resend.emails.send({
            from: 'ReplyKaro <replykaro1704@gmail.com>',
            to: email,
            subject: 'Action Required: Your Free Tier Limit Reached',
            html: `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                    <h1 style="color: #ff4d4d;">Free Tier Limit Reached</h1>
                    <p>Hello,</p>
                    <p>Your free tier DM quota is now exhausted. To ensure your automations continue running smoothly, please upgrade your plan.</p>
                    <p><strong>What happens now?</strong></p>
                    <ul>
                        <li>Your incoming comments and DMs are being safely <strong>queued</strong>.</li>
                        <li>No automation responses are being sent at the moment.</li>
                    </ul>
                    <p><strong>Good news:</strong> Once you upgrade, all the pending DMs currently in your queue will be <strong>automatically sent</strong>, so you won't lose any leads!</p>
                    <p><a href="https://replykaro.com/dashboard/billing" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">Upgrade Now</a></p>
                    <br/>
                    <p>Best,<br/>The ReplyKaro Team</p>
                </div>
            `
        });
    } catch (error) {
        console.error("Failed to send quota reached email:", error);
    }
}
