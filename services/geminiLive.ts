/**
 * Gemini Live Service - Real-time bidirectional voice conversation
 * Uses WebSocket for streaming audio with Gemini 2.5 Flash Native Audio
 * 
 * Docs: https://ai.google.dev/gemini-api/docs/live-guide
 * API:  https://ai.google.dev/api/live
 */

export interface GeminiLiveConfig {
    onTranscript?: (text: string, isInput: boolean) => void;
    onResponse?: (text: string) => void;
    onAudioData?: (audioData: string) => void;
    onStateChange?: (state: 'connecting' | 'connected' | 'listening' | 'thinking' | 'speaking' | 'disconnected' | 'error') => void;
    onError?: (error: string) => void;
    systemPrompt?: string;
    tools?: any[];
    onToolCall?: (name: string, args: any) => Promise<any>;
}

class GeminiLiveService {
    private ws: WebSocket | null = null;
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private processorNode: ScriptProcessorNode | null = null;
    private config: GeminiLiveConfig = {};
    private isConnected = false;
    private isPlaying = false;
    private playbackContext: AudioContext | null = null;
    private scheduledSources: AudioBufferSourceNode[] = [];
    private nextPlaybackTime = 0;

    // Get API key
    private getApiKey(): string | null {
        return (import.meta as any).env?.VITE_GEMINI_API_KEY ||
               (import.meta as any).env?.API_KEY ||
               null;
    }

    // WebSocket URL - v1beta endpoint
    private getWebSocketUrl(): string {
        const apiKey = this.getApiKey();
        return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    }

    // Initialize and connect
    async connect(config: GeminiLiveConfig): Promise<boolean> {
        this.config = config;

        const apiKey = this.getApiKey();
        if (!apiKey) {
            config.onError?.('Clé API Gemini non configurée');
            config.onStateChange?.('error');
            return false;
        }

        try {
            this.config.onStateChange?.('connecting');

            const wsUrl = this.getWebSocketUrl();
            console.log('[GeminiLive] Connecting...');

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('[GeminiLive] WebSocket connected, sending setup');
                this.isConnected = true;
                this.sendSetup();
            };

            this.ws.onmessage = async (event) => {
                await this.handleMessage(event.data);
            };

            this.ws.onerror = (error) => {
                console.error('[GeminiLive] WebSocket error:', error);
                this.config.onError?.('Erreur de connexion WebSocket');
                this.config.onStateChange?.('error');
            };

            this.ws.onclose = (event) => {
                console.log('[GeminiLive] WebSocket closed:', event.code, event.reason);
                this.isConnected = false;
                this.config.onStateChange?.('disconnected');
                this.cleanup();
            };

            return true;
        } catch (error: any) {
            console.error('[GeminiLive] Connection error:', error);
            this.config.onError?.(error.message);
            this.config.onStateChange?.('error');
            return false;
        }
    }

    // Send setup message - MUST be the first message
    private sendSetup(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const systemPrompt = this.config.systemPrompt || `Tu es Lexia, une assistante IA pour le CRM Lexia. Tu parles TOUJOURS en français.`;

        // Setup per official docs:
        // - Only ONE responseModality allowed (AUDIO or TEXT, not both)
        // - Use outputAudioTranscription to also get text from audio responses
        // - Model must support bidiGenerateContent
        const setupMessage = {
            setup: {
                model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: "Puck"
                            }
                        }
                    }
                },
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
                tools: this.config.tools ? [{ functionDeclarations: this.config.tools }] : undefined,
                outputAudioTranscription: {},
                inputAudioTranscription: {}
            }
        };

        console.log('[GeminiLive] Sending setup');
        this.ws.send(JSON.stringify(setupMessage));
    }

    // Handle incoming messages from server
    private async handleMessage(data: string | Blob): Promise<void> {
        try {
            let messageText: string;

            if (data instanceof Blob) {
                messageText = await data.text();
            } else {
                messageText = data;
            }

            const message = JSON.parse(messageText);

            // Setup complete - start capturing audio
            if (message.setupComplete) {
                console.log('[GeminiLive] Setup complete!');
                this.config.onStateChange?.('connected');
                await this.startAudioCapture();
                return;
            }

            // Server content (model responses)
            if (message.serverContent) {
                const content = message.serverContent;

                // Model audio/text turn
                if (content.modelTurn?.parts) {
                    for (const part of content.modelTurn.parts) {
                        // Audio data
                        if (part.inlineData?.mimeType?.includes('audio')) {
                            this.config.onStateChange?.('speaking');
                            this.queueAudioPlayback(part.inlineData.data);
                        }
                        // Text (if model sends text parts)
                        if (part.text) {
                            console.log('[GeminiLive] Text:', part.text);
                            this.config.onResponse?.(part.text);
                        }
                    }
                }

                // Output transcription (text version of audio response)
                if (content.outputTranscription?.text) {
                    console.log('[GeminiLive] Output transcript:', content.outputTranscription.text);
                    this.config.onTranscript?.(content.outputTranscription.text, false);
                }

                // Input transcription (what the user said)
                if (content.inputTranscription?.text) {
                    console.log('[GeminiLive] Input transcript:', content.inputTranscription.text);
                    this.config.onTranscript?.(content.inputTranscription.text, true);
                }

                // Turn complete
                if (content.turnComplete) {
                    console.log('[GeminiLive] Turn complete');
                    if (!this.isPlaying) {
                        this.config.onStateChange?.('listening');
                    }
                }

                // Generation complete
                if (content.generationComplete) {
                    console.log('[GeminiLive] Generation complete');
                }

                // Interrupted by user
                if (content.interrupted) {
                    console.log('[GeminiLive] Interrupted');
                    this.stopAudio();
                    this.config.onStateChange?.('listening');
                }
            }

            // Tool calls
            if (message.toolCall) {
                const functionCalls = message.toolCall.functionCalls;
                if (functionCalls && this.config.onToolCall) {
                    for (const fc of functionCalls) {
                        console.log('[GeminiLive] Tool call:', fc.name, fc.args);
                        this.config.onStateChange?.('thinking');
                        const result = await this.config.onToolCall(fc.name, fc.args);
                        this.sendToolResponse(fc.id, result);
                    }
                }
            }

            // Tool call cancellation
            if (message.toolCallCancellation) {
                console.log('[GeminiLive] Tool call cancelled:', message.toolCallCancellation.ids);
            }

        } catch (error) {
            console.error('[GeminiLive] Message parse error:', error);
        }
    }

    // Send tool response
    private sendToolResponse(id: string, result: any): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const response = {
            toolResponse: {
                functionResponses: [{
                    id,
                    response: result
                }]
            }
        };

        this.ws.send(JSON.stringify(response));
    }

    // Start capturing microphone audio
    private async startAudioCapture(): Promise<void> {
        try {
            // Request mic access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // AudioContext at 16kHz for Gemini input
            this.audioContext = new AudioContext({ sampleRate: 16000 });
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

            // ScriptProcessor to capture PCM chunks
            this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

            this.processorNode.onaudioprocess = (event) => {
                if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

                const inputData = event.inputBuffer.getChannelData(0);

                // Float32 -> Int16 PCM
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                // Base64 encode
                const base64Audio = this.arrayBufferToBase64(pcmData.buffer);

                // Send using the new `audio` field (not deprecated mediaChunks)
                const message = {
                    realtimeInput: {
                        audio: {
                            mimeType: "audio/pcm;rate=16000",
                            data: base64Audio
                        }
                    }
                };

                this.ws!.send(JSON.stringify(message));
            };

            this.sourceNode.connect(this.processorNode);
            this.processorNode.connect(this.audioContext.destination);

            this.config.onStateChange?.('listening');
            console.log('[GeminiLive] Audio capture started');

        } catch (error: any) {
            console.error('[GeminiLive] Audio capture error:', error);
            this.config.onError?.(`Erreur micro: ${error.message}`);
        }
    }

    // Schedule audio chunk for gapless playback
    // Uses precise Web Audio timing to eliminate gaps between chunks
    private queueAudioPlayback(base64Audio: string): void {
        try {
            // Create/resume playback context at 24kHz (Gemini output rate)
            if (!this.playbackContext || this.playbackContext.state === 'closed') {
                this.playbackContext = new AudioContext({ sampleRate: 24000 });
                this.nextPlaybackTime = 0;
            }

            if (this.playbackContext.state === 'suspended') {
                this.playbackContext.resume();
            }

            // Decode base64 -> Int16 PCM -> Float32
            const audioData = this.base64ToArrayBuffer(base64Audio);
            const pcm16 = new Int16Array(audioData);

            if (pcm16.length === 0) return;

            const floatData = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
                floatData[i] = pcm16[i] / 32768;
            }

            // Create AudioBuffer
            const audioBuffer = this.playbackContext.createBuffer(1, floatData.length, 24000);
            audioBuffer.getChannelData(0).set(floatData);

            // Create source node
            const source = this.playbackContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.playbackContext.destination);

            // Schedule at precise time for gapless playback
            const now = this.playbackContext.currentTime;
            const startTime = Math.max(now + 0.005, this.nextPlaybackTime); // tiny 5ms buffer to avoid underruns
            
            source.start(startTime);
            this.nextPlaybackTime = startTime + audioBuffer.duration;

            // Track for cleanup
            this.scheduledSources.push(source);
            this.isPlaying = true;

            // Clean up finished sources and detect end of playback
            source.onended = () => {
                this.scheduledSources = this.scheduledSources.filter(s => s !== source);
                if (this.scheduledSources.length === 0) {
                    this.isPlaying = false;
                    if (this.isConnected) {
                        this.config.onStateChange?.('listening');
                    }
                }
            };

        } catch (error) {
            console.error('[GeminiLive] Playback error:', error);
        }
    }

    // Send text message via clientContent
    sendText(text: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        console.log('[GeminiLive] Sending text:', text);

        const message = {
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [{ text }]
                }],
                turnComplete: true
            }
        };

        this.ws.send(JSON.stringify(message));
        this.config.onStateChange?.('thinking');
    }

    // Stop all scheduled audio playback
    stopAudio(): void {
        for (const source of this.scheduledSources) {
            try { source.stop(); } catch {}
        }
        this.scheduledSources = [];
        this.nextPlaybackTime = 0;
        this.isPlaying = false;
    }

    // Clean up all audio resources
    private cleanup(): void {
        this.stopAudio();

        if (this.processorNode) {
            this.processorNode.disconnect();
            this.processorNode = null;
        }

        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }

        if (this.playbackContext && this.playbackContext.state !== 'closed') {
            this.playbackContext.close();
            this.playbackContext = null;
        }
    }

    // Disconnect session
    disconnect(): void {
        console.log('[GeminiLive] Disconnecting');
        this.cleanup();

        if (this.ws) {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.close();
            }
            this.ws = null;
        }

        this.isConnected = false;
    }

    // Check connection
    isLiveConnected(): boolean {
        return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
    }

    // ArrayBuffer -> Base64
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Base64 -> ArrayBuffer
    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

export const geminiLive = new GeminiLiveService();
