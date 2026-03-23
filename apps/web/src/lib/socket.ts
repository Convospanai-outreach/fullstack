
import { logger } from './logger';

export function setupSocket(io: any) {
    logger.info('ðŸ”Œ Socket.IO setup initiated');
    const sharedSecret = process.env['SOCKET_SHARED_SECRET'];

    io.on('connection', (socket: any) => {
        logger.info(`ðŸ“± Client connected: ${socket.id}`);

        socket.on('join_team', (teamId: string) => {
            if (!sharedSecret) return;
            const token = socket.handshake?.auth?.token || socket.handshake?.headers?.['x-socket-token'];
            if (token !== sharedSecret) return;
            socket.join(`team:${teamId}`);
            logger.info(`ðŸ‘¥ Socket ${socket.id} joined team:${teamId}`);
        });

        socket.on('disconnect', () => {
            logger.info(`ðŸ“± Client disconnected: ${socket.id}`);
        });
    });
}

// Helper to emit events from elsewhere in the app
// Note: In a real app, you might want to use a Redis adapter for multi-instance support
export const emitToTeam = (io: any, teamId: string, event: string, data: any) => {
    io.to(`team:${teamId}`).emit(event, data);
};
