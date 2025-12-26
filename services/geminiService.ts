
import { GoogleGenAI, Type } from "@google/genai";

// Inicializa o cliente Gemini com a chave de API do ambiente
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Schema para análise detalhada de entradas de voz/texto
const voiceAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    transcription: { 
      type: Type.STRING, 
      description: "O texto corrigido, pontuado e gramaticalmente preciso do que o usuário disse." 
    },
    mode: { 
      type: Type.STRING, 
      enum: ["mood", "diary"], 
      description: "Detecte se o usuário está apenas relatando humor/stats ('mood') ou contando uma história/desabafo ('diary')." 
    },
    moodScore: { 
      type: Type.INTEGER, 
      description: "Humor estimado de 1 (péssimo) a 5 (ótimo). OBRIGATÓRIO." 
    },
    energyLevel: { 
      type: Type.INTEGER, 
      description: "Nível de energia de 1 (baixo) a 10 (alto). OBRIGATÓRIO." 
    },
    summary: { 
      type: Type.STRING, 
      description: "Um título curto ou resumo da entrada." 
    },
    detectedTags: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Lista de atividades ou sintomas mencionados no texto." 
    },
    intentToSave: { 
      type: Type.BOOLEAN, 
      description: "True se o usuário deu a entender que deseja salvar ou registrar isso." 
    }
  },
  required: ["transcription", "mode", "moodScore", "energyLevel", "detectedTags", "intentToSave"]
};

export const geminiService = {
  analyzeEntry: async (text: string) => {
    try {
      if (!process.env.API_KEY) throw new Error("API Key missing");
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Atue como um especialista em transcrição e correção de texto para o app 'MoodFlow'.
        
        Sua tarefa é limpar e analisar o texto capturado via microfone.
        
        REGRAS DE OURO:
        1. CORREÇÃO: Pontue o texto e corrija erros fonéticos óbvios.
        2. SENTIMENTO: Estime o humor (1-5) e energia (1-10) de forma empática.
        3. TAGS: Identifique atividades como 'Trabalho', 'Academia', ou sintomas como 'Ansiedade'.
        
        Texto Original: "${text}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: voiceAnalysisSchema,
          temperature: 0.1, // Baixa temperatura para manter a precisão gramatical
          topP: 0.95,
          topK: 40
        }
      });
      
      const resultText = response.text;
      if (!resultText) return null;
      return JSON.parse(resultText);
    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      return null;
    }
  }
};
