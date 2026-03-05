import { GoogleGenAI, GenerateContentResponse, Type, ThinkingLevel } from "@google/genai";
import { 
  SYSTEM_INSTRUCTION_ADVISOR, 
  SYSTEM_INSTRUCTION_TRAINER, 
  SYSTEM_INSTRUCTION_WEEKLY_TIP, 
  SYSTEM_INSTRUCTION_GLOBAL_TRENDS,
  SYSTEM_INSTRUCTION_AUDIT_TACTICAL,
  SYSTEM_INSTRUCTION_CHECKLIST_AUDIT,
  SYSTEM_INSTRUCTION_INCIDENT_AUDIT
} from "../constants";
import { ChatMessage } from "../types";

const FLASH_MODEL = 'gemini-3.1-flash-lite-preview';
const PRO_MODEL = 'gemini-3.1-flash-lite-preview'; // Switched to lite for maximum speed

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
};

const isQuotaError = (error: any): boolean => {
  const errorString = typeof error === 'string' ? error : JSON.stringify(error);
  const msg = errorString.toUpperCase() + (error?.message?.toUpperCase() || "");
  return (
    msg.includes('RESOURCE_EXHAUSTED') || 
    msg.includes('429') || 
    msg.includes('QUOTA') ||
    msg.includes('RATE_LIMIT')
  );
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  let attempt = 0;
  const execute = async (): Promise<T> => {
    try {
      return await fn();
    } catch (error: any) {
      if (isQuotaError(error) && attempt < maxRetries) {
        attempt++;
        // Try to extract retry delay from error message if possible (e.g., "retry in 18s")
        let delay = Math.pow(3, attempt) * 2000; // 6s, 18s, 54s, 162s
        
        const errorString = JSON.stringify(error);
        const retryMatch = errorString.match(/retry in ([\d.]+)s/i) || errorString.match(/retryDelay":\s*"(\d+)s"/i);
        if (retryMatch && retryMatch[1]) {
          delay = (parseFloat(retryMatch[1]) + 1) * 1000;
        }
        
        console.warn(`Quota hit, retrying in ${delay}ms (attempt ${attempt})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return execute();
      }
      throw error;
    }
  };
  return execute();
}

export const analyzeReportStream = async (
  reportText: string, 
  type: 'CHECKLIST' | 'INCIDENT' | 'GENERAL' = 'GENERAL',
  onChunk: (text: string) => void,
  onComplete: (fullText: string) => void
) => {
  const execute = async () => {
    const ai = getAIClient();
    let systemInstruction = SYSTEM_INSTRUCTION_AUDIT_TACTICAL;
    if (type === 'CHECKLIST') systemInstruction = SYSTEM_INSTRUCTION_CHECKLIST_AUDIT;
    else if (type === 'INCIDENT') systemInstruction = SYSTEM_INSTRUCTION_INCIDENT_AUDIT;

    const responseStream = await ai.models.generateContentStream({
      model: PRO_MODEL,
      contents: reportText,
      config: { 
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      fullText += chunk.text || "";
      onChunk(fullText);
    }
    onComplete(fullText);
  };

  try {
    await withRetry(execute);
  } catch (error) {
    throw error;
  }
};

export const generateAdvisorStream = async (
  history: ChatMessage[], 
  currentMessage: string,
  onChunk: (text: string) => void,
  onComplete: (sources?: Array<{ title: string; url: string }>) => void
) => {
  const execute = async () => {
    const ai = getAIClient();
    const chatHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    const chat = ai.chats.create({
      model: PRO_MODEL,
      history: chatHistory,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_ADVISOR,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    const responseStream = await chat.sendMessageStream({ message: currentMessage });

    let fullText = "";
    let finalSources: Array<{ title: string; url: string }> | undefined = undefined;

    for await (const chunk of responseStream) {
      fullText += chunk.text || "";
      onChunk(fullText);
      
      const sources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((c: any) => c.web?.uri).map((c: any) => ({ title: c.web.title, url: c.web.uri }));
      
      if (sources && sources.length > 0) finalSources = sources;
    }
    onComplete(finalSources);
  };

  try {
    await withRetry(execute);
  } catch (error) {
    throw error;
  }
};

export const fetchBestPracticesStream = async (
  topic: string | undefined,
  onChunk: (text: string) => void,
  onComplete: (sources?: Array<{ title: string; url: string }>) => void
) => {
  const execute = async () => {
    const ai = getAIClient();
    const responseStream = await ai.models.generateContentStream({
      model: FLASH_MODEL,
      contents: `Provide 10 critical updates for Nigerian Security CEOs regarding ${topic || 'Compliance, Licensing, and NSCDC Rules'}.`,
      config: { 
        systemInstruction: SYSTEM_INSTRUCTION_GLOBAL_TRENDS,
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    let fullText = "";
    let finalSources: Array<{ title: string; url: string }> | undefined = undefined;
    for await (const chunk of responseStream) {
      fullText += chunk.text || "";
      onChunk(fullText);
      const sources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((c: any) => c.web?.uri).map((c: any) => ({ title: c.web.title, url: c.web.uri }));
      if (sources && sources.length > 0) finalSources = sources;
    }
    onComplete(finalSources);
  };

  try {
    await withRetry(execute);
  } catch (error) {
    throw error;
  }
};

export const generateWeeklyTip = async (): Promise<string> => {
  return withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: "Strategic executive directive.",
      config: { 
        systemInstruction: SYSTEM_INSTRUCTION_WEEKLY_TIP,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return response.text || "Drafting Focus...";
  });
};

export const generateTrainingModuleStream = async (
  topic: string, 
  week: number = 1, 
  role: string = "Security Guard",
  onChunk: (text: string) => void,
  onComplete: () => void
) => {
  const execute = async () => {
    const ai = getAIClient();
    const responseStream = await ai.models.generateContentStream({
      model: PRO_MODEL,
      contents: `Architect Week ${week} syllabus for ${role} focusing on ${topic}.`,
      config: { 
        systemInstruction: SYSTEM_INSTRUCTION_TRAINER,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      fullText += chunk.text || "";
      onChunk(fullText);
    }
    onComplete();
  };

  try {
    await withRetry(execute);
  } catch (error) {
    throw error;
  }
};

export const getSuggestedTopics = async (query: string): Promise<string[]> => {
  if (!query || query.length < 3) return [];
  return withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: `3 security training topics for "${query}". Return as comma-separated list.`,
      config: { responseMimeType: "text/plain" }
    });
    return (response.text || "").split(',').map(s => s.trim()).filter(Boolean);
  });
};