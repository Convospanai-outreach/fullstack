
import { Server } from 'socket.io';
import { logger } from './logger';

export function setupSocket(io: Server) {
    logger.info('🔌 Socket.IO setup initiated');

    io.on('connection', (socket) => {
        logger.info(`📱 Client connected: ${socket.id}`);

        socket.on('join_team', (teamId: string) => {
            socket.join(`team:${teamId}`);
            logger.info(`👥 Socket ${socket.id} joined team:${teamId}`);
        });

        socket.on('disconnect', () => {
            logger.info(`📱 Client disconnected: ${socket.id}`);
        });
    });
}

// Helper to emit events from elsewhere in the app
// Note: In a real app, you might want to use a Redis adapter for multi-instance support
export const emitToTeam = (io: Server, teamId: string, event: string, data: any) => {
    io.to(`team:${teamId}`).emit(event, data);
};
