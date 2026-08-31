import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getBaseSiteUrl } from '@/lib/apiCatalog';

export const dynamic = 'force-static';
export const revalidate = 86400;

export async function GET(req: NextRequest) {
    const origin = req.nextUrl.origin || getBaseSiteUrl();

    const openapiSpec = {
        openapi: '3.1.0',
        info: {
            title: 'CraftMyFunnel Outbound & AI Governance API',
            version: '1.0.0',
            description:
                'Public and developer REST APIs for CraftMyFunnel — Governed B2B Outbound Sales Engine. Provides endpoints for lead management, campaign execution, mailbox health, human approval workflows, and deliverability monitoring.',
            contact: {
                name: 'CraftMyFunnel Engineering & API Support',
                url: `${origin}/contact`,
                email: 'support@craftmyfunnel.live',
            },
            license: {
                name: 'Proprietary / Terms of Service',
                url: `${origin}/terms`,
            },
        },
        servers: [
            {
                url: origin,
                description: 'Production API Gateway',
            },
        ],
        paths: {
            '/api/health': {
                get: {
                    summary: 'System and database health probe',
                    description: 'Returns real-time health status of database, workers, and platform services.',
                    responses: {
                        '200': {
                            description: 'Service is operational',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            status: { type: 'string', example: 'pass' },
                                            timestamp: { type: 'string', format: 'date-time' },
                                            services: { type: 'object' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '/api/v1/leads': {
                get: {
                    summary: 'List team leads',
                    description: 'Fetches paginated list of leads scoped to authenticated workspace.',
                    security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
                    responses: {
                        '200': { description: 'List of leads' },
                        '401': { description: 'Unauthorized' },
                    },
                },
            },
            '/api/v1/campaigns': {
                get: {
                    summary: 'List campaigns',
                    description: 'Retrieves outreach campaigns, funnel metrics, and delivery status.',
                    security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
                    responses: {
                        '200': { description: 'List of campaigns' },
                        '401': { description: 'Unauthorized' },
                    },
                },
            },
            '/api/email/unsubscribe/{trackingId}': {
                post: {
                    summary: 'RFC 8058 One-Click Unsubscribe',
                    description: 'Processes one-click unsubscribe request from mail user agents without redirection.',
                    parameters: [
                        {
                            name: 'trackingId',
                            in: 'path',
                            required: true,
                            schema: { type: 'string' },
                        },
                    ],
                    responses: {
                        '200': { description: 'Unsubscribe processed' },
                        '404': { description: 'Invalid tracking token' },
                    },
                },
            },
        },
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-api-key',
                },
            },
        },
    };

    return new NextResponse(JSON.stringify(openapiSpec, null, 2), {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
    });
}
