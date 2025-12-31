
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

// Schema for Clinical Summary
const clinicalSummarySchema = {
  type: Type.OBJECT,
  properties: {
    patterns: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Padrões comportamentais ou gatilhos identificados."
    },
    riskLevel: {
      type: Type.STRING,
      enum: ["low", "medium", "high"],
      description: "Nível de risco clínico estimado com base no histórico."
    },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Sugestões de tópicos para abordar na próxima consulta."
    },
    summaryText: {
      type: Type.STRING,
      description: "Um resumo executivo profissional da evolução do paciente."
    }
  },
  required: ["patterns", "riskLevel", "recommendations", "summaryText"]
};

export const aiService = {
  analyzeEntry: async (text: string) => {
    try {
      if (!process.env.API_KEY) throw new Error("API Key missing");

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
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
          temperature: 0.1,
          topP: 0.95,
          topK: 40
        }
      });

      const resultText = response.text;
      if (!resultText) return null;
      return JSON.parse(resultText);
    } catch (error) {
      console.error("AI Analysis Error:", error);
      return null;
    }
  },

  summarizeHistory: async (entries: any[]) => {
    try {
      if (!process.env.API_KEY) throw new Error("API Key missing");

      const historyText = entries.map(e => `[${new Date(e.date).toLocaleDateString()}] Humor: ${e.mood}/5, Energia: ${e.energy}/10. Texto: ${e.text}`).join('\n---\n');

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: `Atue como um assistente de análise clínica para psicólogos e psiquiatras.
        Sua tarefa é ler os registros diários (mood tracking) de um paciente e gerar um resumo executivo profissional.
        
        FOCO:
        1. Identificação de gatilhos (triggers).
        2. Ciclos de humor (ex: piora matinal, melhora aos fins de semana).
        3. Nível de risco e urgência.
        4. Recomendações de intervenção.

        Histórico do Paciente:
        ${historyText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: clinicalSummarySchema,
          temperature: 0.2
        }
      });

      const resultText = response.text;
      if (!resultText) return null;
      return JSON.parse(resultText);
    } catch (error) {
      console.error("AI Summary Error:", error);
      return null;
    }
  }
};
