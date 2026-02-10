
import axios from 'axios';

async function main() {
    try {
        const response = await axios.post('http://localhost:3000/api/test-auth', {
            email: 'audit_user@example.com',
            password: 'AuditPassword123!'
        });
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error: any) {
        if (error.response) {
            console.error('Error Status:', error.response.status);
            console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

main().catch(console.error);
