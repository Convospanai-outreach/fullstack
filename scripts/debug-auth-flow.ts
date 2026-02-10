
import axios from 'axios';

async function main() {
    try {
        console.log('1. Fetching CSRF Token...');
        const csrfRes = await axios.get('http://localhost:3000/api/auth/csrf');
        const csrfToken = csrfRes.data.csrfToken;
        const setCookieHeaders = csrfRes.headers['set-cookie'];

        console.log('CSRF Token:', csrfToken);
        console.log('Set-Cookie Headers:', setCookieHeaders);

        if (!setCookieHeaders) {
            throw new Error('No cookies received from CSRF endpoint');
        }

        // Simple cookie joiner
        const cookieHeader = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
        console.log('Sending Cookie Header:', cookieHeader);

        console.log('2. Attempting Login...');
        const LoginUrl = 'http://localhost:3000/api/auth/callback/credentials';

        // NextAuth v4 credential signin usually sends x-www-form-urlencoded body with json: true
        const params = new URLSearchParams();
        params.append('csrfToken', csrfToken);
        params.append('email', 'audit_user@example.com');
        params.append('password', 'AuditPassword123!');
        params.append('json', 'true');

        const loginRes = await axios.post(LoginUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookieHeader
            },
            validateStatus: () => true
        });

        console.log('Login Status:', loginRes.status);
        console.log('Login Data:', JSON.stringify(loginRes.data, null, 2));

    } catch (e: any) {
        console.error('Error:', e.message);
        if (e.response) {
            console.error('Response Status:', e.response.status);
            console.error('Response Data:', e.response.data);
        }
    }
}

main();
