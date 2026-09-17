import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { MailgunService } from '../services/mailgun-service';

const router = new Hono();
const mailgunService = new MailgunService();

const contactSchema = z.object({
    name: z.string().trim().min(1, 'Name is required'),
    email: z.string().trim().min(1, 'Email is required').email('Invalid email address'),
    message: z.string().trim().min(1, 'Message is required'),
});

router.post(
    '/',
    zValidator('json', contactSchema, (result, c) => {
        if (!result.success) {
            return c.json({ message: 'Invalid contact form data' }, 400);
        }
    }),
    async (c) => {
        const { email, message } = c.req.valid('json');

        try {
            await mailgunService.sendContactEmail(c.env, {
                email,
                message,
            });

            return c.json({ success: true });
        } catch (error) {
            console.error('Contact form email failed:', error);

            return c.json(
                { message: 'Unable to send your message. Please try again later.' },
                500
            );
        }
    }
);

export { router as contactRouter };