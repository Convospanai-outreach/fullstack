import { HardwareService } from './services/HardwareService';

export async function register() {
    if (process.env['NEXT_RUNTIME'] === 'nodejs') {
        // Only run on the server side
        try {
            console.log('Starting Hardware Verification...');
            await HardwareService.verifyHardwareIdentity();
        } catch (error) {
            console.warn('Warning: Hardware Verification Failed (Running in Software-Only Mode)');
            // throw new Error('Hardware verification failed'); // Disabled for Beta
        }
    }
}
