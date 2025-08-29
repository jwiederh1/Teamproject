// webhook-server.cjs
// Streamlined webhook server focused on core webhook functionality

console.log('🚀 Starting streamlined webhook server...');

try {
    const express = require('express');
    const cors = require('cors');
    const WebSocket = require('ws');
    const http = require('http');

    const app = express();
    const PORT = 5174;
    const WS_PORT = 8080;

    console.log('✅ Dependencies loaded');

    // Minimal session tracking - only for active webhooks
    const activeWebhooks = new Map(); // sessionId -> latest webhook data
    const connectedClients = new Set(); // Set of WebSocket connections

    // WebSocket server for real-time communication
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ port: WS_PORT });

    // Helper function to broadcast to all connected clients
    function broadcastToClients(data) {
        let sentCount = 0;

        connectedClients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify(data));
                    sentCount++;
                } catch (error) {
                    console.error('❌ Error sending to client:', error);
                    connectedClients.delete(ws);
                }
            } else {
                connectedClients.delete(ws);
            }
        });

        return sentCount;
    }

    // WebSocket connection handling
    wss.on('connection', (ws) => {
        console.log('🔗 Frontend connected via WebSocket');
        connectedClients.add(ws);

        // Send connection confirmation
        ws.send(JSON.stringify({
            type: 'connection',
            message: 'WebSocket connected to webhook server',
            timestamp: new Date().toISOString()
        }));

        ws.on('close', () => {
            console.log('🔌 Frontend disconnected from WebSocket');
            connectedClients.delete(ws);
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error);
            connectedClients.delete(ws);
        });
    });

    // Middleware
    app.use(cors());
    app.use(express.json({ limit: '10mb' })); // Increased limit for large generation results
    console.log('✅ Middleware configured');

    // ================================
    // CORE WEBHOOK ENDPOINTS
    // ================================

    // Main webhook endpoint - handles both generation and refinement
    app.post('/api/sessions/:sessionId/webhook/generation-complete', (req, res) => {
        const sessionId = req.params.sessionId;
        const result = req.body;

        console.log('\n' + '='.repeat(60));
        console.log('🔥 WEBHOOK RECEIVED');
        console.log('Session ID:', sessionId);
        console.log('Success:', result.success);
        console.log('Type:', result.data?.isRefinement ? 'Refinement' : 'Generation');

        // Debug: Log the chat response to see if it's present
        console.log('Chat Response:', result.data?.backendAnswer);

        if (result.success) {
            console.log('Processing Time:', result.processingTime, 'seconds');
            if (result.data?.bestImplementation?.overall_score) {
                console.log('Best Score:', (result.data.bestImplementation.overall_score * 100).toFixed(2) + '%');
            }
            console.log('Total Implementations:', (result.data?.otherImplementations?.length || 0) + 1);
        } else {
            console.log('Error:', result.error);
        }
        console.log('='.repeat(60));

        // Store latest webhook data (replace any existing)
        activeWebhooks.set(sessionId, {
            ...result,
            receivedAt: new Date().toISOString(),
            type: result.data?.isRefinement ? 'refinement' : 'generation'
        });

        // Preserve the exact structure that the frontend expects
        const broadcastData = {
            type: 'generation-complete',
            sessionId: sessionId,
            success: result.success,
            data: result.data,
            error: result.error,
            processingTime: result.processingTime
        };

        const clientCount = broadcastToClients(broadcastData);
        console.log(`📡 Broadcasted to ${clientCount} client(s)`);

        if (clientCount > 0) {
            console.log('✅ WEBHOOK → FRONTEND: Results delivered via WebSocket');
        } else {
            console.log('⚠️  No frontends connected');
        }

        res.json({
            success: true,
            message: 'Webhook received and processed successfully',
            sessionId: sessionId,
            clientsNotified: clientCount
        });
    });

    // ================================
    // MINIMAL STATUS ENDPOINTS
    // ================================

    // Health check - essential for monitoring
    app.get('/api/health', (req, res) => {
        res.json({
            success: true,
            message: 'Webhook server is running',
            httpPort: PORT,
            websocketPort: WS_PORT,
            uptime: process.uptime(),
            connectedClients: connectedClients.size,
            activeWebhooks: activeWebhooks.size
        });
    });

    // Get latest webhook result for a session (minimal endpoint for debugging)
    app.get('/api/sessions/:sessionId/latest', (req, res) => {
        const sessionId = req.params.sessionId;
        const webhookData = activeWebhooks.get(sessionId);

        if (webhookData) {
            res.json({
                success: true,
                sessionId: sessionId,
                data: webhookData
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'No webhook data found for this session'
            });
        }
    });


    // ================================
    // CLEANUP AND MEMORY MANAGEMENT
    // ================================

    // Clean up old webhook data periodically (every 10 minutes)
    setInterval(() => {
        const cutoffTime = Date.now() - (10 * 60 * 1000); // 10 minutes ago
        let cleaned = 0;

        activeWebhooks.forEach((data, sessionId) => {
            const receivedTime = new Date(data.receivedAt).getTime();
            if (receivedTime < cutoffTime) {
                activeWebhooks.delete(sessionId);
                cleaned++;
            }
        });

        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} old webhook entries`);
        }
    }, 10 * 60 * 1000); // Run every 10 minutes

    console.log('✅ All routes configured');

    // Start HTTP server
    server.listen(PORT, () => {
        console.log('🚀 STREAMLINED WEBHOOK SERVER STARTED');
        console.log('='.repeat(60));
        console.log(`🌐 HTTP Server: http://localhost:${PORT}`);
        console.log(`🔗 WebSocket Server: ws://localhost:${WS_PORT}`);
        console.log('');
        console.log('🔥 Core Endpoints:');
        console.log(`   Webhook: POST /api/sessions/{sessionId}/webhook/generation-complete`);
        console.log(`   Health:  GET /api/health`);
        console.log(`   Latest:  GET /api/sessions/{sessionId}/latest`);
        console.log('');
        console.log('💡 Features:');
        console.log('   ✅ Real-time WebSocket broadcasting');
        console.log('   ✅ Automatic memory cleanup');
        console.log('   ✅ Legacy webhook compatibility');
        console.log('   ✅ Minimal resource usage');
        console.log('='.repeat(60));
        console.log('🛑 Press Ctrl+C to stop the server');
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down webhook server...');

        connectedClients.forEach((ws) => {
            ws.close();
        });

        wss.close(() => {
            console.log('✅ WebSocket server closed');
        });

        server.close(() => {
            console.log('✅ HTTP server closed gracefully');
            console.log(`📊 Final Statistics:`);
            console.log(`   Active Webhooks: ${activeWebhooks.size}`);
            console.log(`   Connected Clients: ${connectedClients.size}`);
            process.exit(0);
        });
    });

} catch (error) {
    console.error('❌ Fatal error starting webhook server:', error);
    console.error('Stack trace:', error.stack);

    if (error.code === 'MODULE_NOT_FOUND') {
        console.log('\n🔧 To fix missing dependencies, run:');
        console.log('npm install express cors ws');
    }

    process.exit(1);
}