
import { GoogleGenAI, Modality } from "@google/genai";

// Audio Decoding Helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Global context to avoid re-initialization overhead
let globalAudioContext: AudioContext | null = null;

export async function speakReminder(text: string) {
  if (!text) return;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // We start the network request immediately
    const responsePromise = ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ 
        parts: [{ 
          text: `Say: "You are near to ${text}. Buy the product."` 
        }] 
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const response = await responsePromise;
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) return;

    if (!globalAudioContext) {
      globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    
    if (globalAudioContext.state === 'suspended') {
      await globalAudioContext.resume();
    }

    const audioBuffer = await decodeAudioData(
      decode(base64Audio),
      globalAudioContext,
      24000,
      1,
    );
    
    const source = globalAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(globalAudioContext.destination);
    source.start();

  } catch (error) {
    console.error("Voice Assistant Error:", error);
  }
}
