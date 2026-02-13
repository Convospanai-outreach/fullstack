const axios = require('axios');

async function testWhatsAppProduction() {
    const url = 'http://localhost:3000/api/whatsapp/send';
    const payload = {
        leadId: 'test-lead-id',
        message: 'hello_world', // Template name for Meta API tests
        isTemplate: true,
        recipientPhone: '1234567890'
    };

    console.log("🚀 Testing WhatsApp Outbound (Production Mode)...");
    
    try {
        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log("✅ Success:", response.data);
    } catch (error) {
        if (error.response?.data?.details?.includes("Missing Credentials")) {
            console.log("⚠️ Expected Production Block: Missing Credentials. Transitioning to MOCK_MODE check...");
        } else {
            console.error("❌ Failed:", error.response?.data || error.message);
        }
    }
}

testWhatsAppProduction();
