/**
 * Orb Component - Eleven Labs style voice visualization
 * Organic blob animation with smooth transitions
 */

import React, { useEffect, useRef } from 'react';

export type AgentState = 'listening' | 'talking' | null;

interface OrbProps {
    colors?: [string, string];
    agentState: AgentState;
}

export const Orb: React.FC<OrbProps> = ({ 
    colors = ['#8B9DC3', '#5C6B8A'],
    agentState 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const timeRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // High DPI support
        const dpr = window.devicePixelRatio || 1;
        const size = 128;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        ctx.scale(dpr, dpr);

        const centerX = size / 2;
        const centerY = size / 2;

        const animate = () => {
            timeRef.current += 0.008;
            const time = timeRef.current;

            ctx.clearRect(0, 0, size, size);

            // Animation parameters based on state
            let amplitude = 0.15;
            let speed = 1;
            let wobble = 0.02;
            
            if (agentState === 'listening') {
                amplitude = 0.2 + Math.sin(time * 2) * 0.05;
                speed = 1.5;
                wobble = 0.04;
            } else if (agentState === 'talking') {
                amplitude = 0.3 + Math.sin(time * 4) * 0.1;
                speed = 3;
                wobble = 0.08;
            }

            // Draw multiple layered blobs for depth
            const layers = [
                { scale: 1, alpha: 1, offset: 0 },
                { scale: 0.85, alpha: 0.7, offset: Math.PI / 3 },
                { scale: 0.7, alpha: 0.5, offset: Math.PI / 1.5 },
            ];

            layers.forEach((layer, layerIndex) => {
                const baseRadius = (size * 0.32) * layer.scale;
                const points: { x: number; y: number }[] = [];
                const numPoints = 6; // Petal-like shape

                // Generate organic blob points
                for (let i = 0; i < numPoints; i++) {
                    const angle = (i / numPoints) * Math.PI * 2 + layer.offset;
                    
                    // Multiple frequency noise for organic feel
                    const noise1 = Math.sin(angle * 2 + time * speed) * amplitude;
                    const noise2 = Math.sin(angle * 3 - time * speed * 0.7) * amplitude * 0.5;
                    const noise3 = Math.cos(angle * 4 + time * speed * 1.3) * wobble;
                    
                    const radius = baseRadius * (1 + noise1 + noise2 + noise3);
                    
                    points.push({
                        x: centerX + Math.cos(angle) * radius,
                        y: centerY + Math.sin(angle) * radius
                    });
                }

                // Draw smooth blob using bezier curves
                ctx.beginPath();
                
                for (let i = 0; i < points.length; i++) {
                    const current = points[i];
                    const next = points[(i + 1) % points.length];
                    const prev = points[(i - 1 + points.length) % points.length];
                    
                    if (i === 0) {
                        ctx.moveTo(current.x, current.y);
                    }
                    
                    // Control points for smooth curves
                    const cpX1 = current.x + (next.x - prev.x) * 0.25;
                    const cpY1 = current.y + (next.y - prev.y) * 0.25;
                    const cpX2 = next.x - (points[(i + 2) % points.length].x - current.x) * 0.25;
                    const cpY2 = next.y - (points[(i + 2) % points.length].y - current.y) * 0.25;
                    
                    ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, next.x, next.y);
                }
                
                ctx.closePath();

                // Gradient fill
                const gradient = ctx.createRadialGradient(
                    centerX - 10, centerY - 10, 0,
                    centerX, centerY, baseRadius * 1.5
                );
                
                // Parse colors and adjust alpha
                gradient.addColorStop(0, adjustAlpha(colors[0], layer.alpha));
                gradient.addColorStop(0.6, adjustAlpha(colors[1], layer.alpha * 0.9));
                gradient.addColorStop(1, adjustAlpha(colors[1], layer.alpha * 0.3));
                
                ctx.fillStyle = gradient;
                ctx.fill();
            });

            // Inner highlight
            const highlightGradient = ctx.createRadialGradient(
                centerX - 8, centerY - 8, 0,
                centerX, centerY, size * 0.2
            );
            highlightGradient.addColorStop(0, 'rgba(255,255,255,0.4)');
            highlightGradient.addColorStop(0.5, 'rgba(255,255,255,0.1)');
            highlightGradient.addColorStop(1, 'rgba(255,255,255,0)');
            
            ctx.beginPath();
            ctx.arc(centerX - 5, centerY - 5, size * 0.15, 0, Math.PI * 2);
            ctx.fillStyle = highlightGradient;
            ctx.fill();

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [agentState, colors]);

    return (
        <canvas 
            ref={canvasRef} 
            className="w-full h-full"
        />
    );
};

// Helper to adjust color alpha
function adjustAlpha(color: string, alpha: number): string {
    // Handle hex colors
    if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
    return color;
}

// Orb Demo Component for testing
export const OrbDemo: React.FC = () => {
    const [agentState, setAgentState] = React.useState<AgentState>(null);

    return (
        <div className="flex flex-col items-center gap-4 p-6">
            <div className="relative">
                <div className="h-32 w-32 rounded-full bg-muted p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)]">
                    <div className="h-full w-full overflow-hidden rounded-full bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.05)]">
                        <Orb agentState={agentState} />
                    </div>
                </div>
            </div>
            
            <div className="flex gap-2">
                <button
                    onClick={() => setAgentState(null)}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${
                        agentState === null ? 'bg-primary text-primary-foreground' : 'border-border'
                    }`}
                >
                    Idle
                </button>
                <button
                    onClick={() => setAgentState('listening')}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${
                        agentState === 'listening' ? 'bg-primary text-primary-foreground' : 'border-border'
                    }`}
                >
                    Listening
                </button>
                <button
                    onClick={() => setAgentState('talking')}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${
                        agentState === 'talking' ? 'bg-primary text-primary-foreground' : 'border-border'
                    }`}
                >
                    Talking
                </button>
            </div>
        </div>
    );
};
