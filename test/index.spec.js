import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src';

const mailgunResponse = {
    id: '<test-message-id>',
    message: 'Queued. Thank you.',
};

const createRequest = (body) =>
    new Request('http://example.com/contact', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

describe('CORS', () => {
    it.each([
        'https://pavanjewellers.in',
        'https://pr-jewellers.pages.dev',
    ])('allows requests from %s', async (origin) => {
        const request = new Request('http://example.com/contact', {
            method: 'OPTIONS',
            headers: {
                Origin: origin,
                'Access-Control-Request-Method': 'POST',
            },
        });

        const executionContext = createExecutionContext();
        const response = await worker.fetch(request, env, executionContext);

        await waitOnExecutionContext(executionContext);

        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    });

    it('does not allow an untrusted origin', async () => {
        const origin = 'https://untrusted.example.com';

        const request = new Request('http://example.com/contact', {
            method: 'OPTIONS',
            headers: {
                Origin: origin,
                'Access-Control-Request-Method': 'POST',
            },
        });

        const executionContext = createExecutionContext();
        const response = await worker.fetch(request, env, executionContext);

        await waitOnExecutionContext(executionContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
});

describe('POST /contact', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('sends a contact email and returns success', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify(mailgunResponse), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        );

        const request = createRequest({
            name: 'Monika',
            email: 'monika@example.com',
            message: 'I would like to know more about your products.',
        });

        const executionContext = createExecutionContext();
        const response = await worker.fetch(
            request,
            {
                ...env,
                MAILGUN_API_KEY: 'test-api-key',
                MAILGUN_DOMAIN_NAME: 'mg.example.com',
                MAILGUN_SENDING_MAIL: 'noreply@mg.example.com',
                STORE_CONTACT_EMAIL: 'store@example.com',
            },
            executionContext
        );

        await waitOnExecutionContext(executionContext);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true });

        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [url, options] = fetchMock.mock.calls[0];

        expect(url).toBe(
            'https://api.mailgun.net/v3/mg.example.com/messages'
        );
        expect(options.method).toBe('POST');
        expect(options.headers.Authorization).toBe(
            `Basic ${btoa('api:test-api-key')}`
        );

        const formData = options.body;

        expect(formData).toBeInstanceOf(FormData);
        expect(formData.get('from')).toBe('noreply@mg.example.com');
        expect(formData.get('to')).toBe('store@example.com');
        expect(formData.get('subject')).toBe('Contact Form Submission');
        expect(formData.get('text')).toBe(
            'I would like to know more about your products.'
        );
        expect(formData.get('reply-to')).toBe('monika@example.com');
    });

    it.each([
        {
            name: '',
            email: 'monika@example.com',
            message: 'Hello',
        },
        {
            name: 'Monika',
            email: '',
            message: 'Hello',
        },
        {
            name: 'Monika',
            email: 'monika@example.com',
            message: '',
        },
        {
            name: '   ',
            email: 'monika@example.com',
            message: 'Hello',
        },
        {
            name: 'Monika',
            email: '   ',
            message: 'Hello',
        },
        {
            name: 'Monika',
            email: 'monika@example.com',
            message: '   ',
        },
    ])('returns 400 when a required field is empty', async (body) => {
        const fetchMock = vi.spyOn(globalThis, 'fetch');

        const request = createRequest(body);
        const executionContext = createExecutionContext();

        const response = await worker.fetch(
            request,
            env,
            executionContext
        );

        await waitOnExecutionContext(executionContext);

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            message: 'Invalid contact form data',
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid email address', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch');

        const request = createRequest({
            name: 'Monika',
            email: 'not-an-email',
            message: 'Hello',
        });

        const executionContext = createExecutionContext();

        const response = await worker.fetch(
            request,
            env,
            executionContext
        );

        await waitOnExecutionContext(executionContext);

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            message: 'Invalid contact form data',
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 500 when Mailgun configuration is incomplete', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch');

        const request = createRequest({
            name: 'Monika',
            email: 'monika@example.com',
            message: 'Hello',
        });

        const executionContext = createExecutionContext();

        const response = await worker.fetch(
            request,
            {
                ...env,
                MAILGUN_API_KEY: '',
                MAILGUN_DOMAIN_NAME: 'mg.example.com',
                MAILGUN_SENDING_MAIL: 'noreply@mg.example.com',
                STORE_CONTACT_EMAIL: 'store@example.com',
            },
            executionContext
        );

        await waitOnExecutionContext(executionContext);

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({
            message: 'Unable to send your message. Please try again later.',
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it('returns 500 when Mailgun rejects the request', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('Mailgun error', {
                status: 400,
            })
        );

        const request = createRequest({
            name: 'Monika',
            email: 'monika@example.com',
            message: 'Hello',
        });

        const executionContext = createExecutionContext();

        const response = await worker.fetch(
            request,
            {
                ...env,
                MAILGUN_API_KEY: 'test-api-key',
                MAILGUN_DOMAIN_NAME: 'mg.example.com',
                MAILGUN_SENDING_MAIL: 'noreply@mg.example.com',
                STORE_CONTACT_EMAIL: 'store@example.com',
            },
            executionContext
        );

        await waitOnExecutionContext(executionContext);

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({
            message: 'Unable to send your message. Please try again later.',
        });
    });
});
