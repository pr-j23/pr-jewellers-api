export class MailgunService {
    async sendContactEmail(env, { email, message }) {
        const {
            MAILGUN_API_KEY,
            MAILGUN_DOMAIN_NAME,
            MAILGUN_SENDING_MAIL,
            STORE_CONTACT_EMAIL,
        } = env;

        if (
            !MAILGUN_API_KEY ||
            !MAILGUN_DOMAIN_NAME ||
            !MAILGUN_SENDING_MAIL ||
            !STORE_CONTACT_EMAIL
        ) {
            throw new Error('Mailgun configuration is incomplete');
        }

        const formData = new FormData();

        formData.append('from', MAILGUN_SENDING_MAIL);
        formData.append('to', STORE_CONTACT_EMAIL);
        formData.append('subject', 'Contact Form Submission');
        formData.append('text', message);
        formData.append('reply-to', email);

        const credentials = btoa(`api:${MAILGUN_API_KEY}`);

        const response = await fetch(
            `https://api.mailgun.net/v3/${MAILGUN_DOMAIN_NAME}/messages`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${credentials}`,
                },
                body: formData,
            }
        );

        if (!response.ok) {
            const errorBody = await response.text();

            console.error('Mailgun request failed:', {
                status: response.status,
                body: errorBody,
            });

            throw new Error('Unable to send contact email');
        }

        return response.json();
    }
}
