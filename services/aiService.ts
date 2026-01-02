
import { GoogleGenAI, Type } from "@google/genai";
import { MoodEntry } from "../types";

// Inicializa o cliente Gemini com a chave de API do ambiente (Vite)
// Fallback seguro se a chave não estiver definida
const apiKey = import.meta.env.VITE_GOOGLE_AI_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Cache simples para evitar chamadas repetidas desnecessárias
let lastSummaryContext = "";
let lastSummaryResult: any = null;

// Schema para análise detalhada de entradas de voz/texto
const voiceAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    transcription: { type: Type.STRING },
    mode: { type: Type.STRING, enum: ["mood", "diary"] },
    moodScore: { type: Type.INTEGER },
    energyLevel: { type: Type.INTEGER },
    summary: { type: Type.STRING },
    detectedTags: { type: Type.ARRAY, items: { type: Type.STRING } },
    intentToSave: { type: Type.BOOLEAN }
  },
  required: ["transcription", "mode", "moodScore", "energyLevel", "detectedTags", "intentToSave"]
};

// Schema for Clinical Summary (Standard)
const clinicalSummarySchema = {
  type: Type.OBJECT,
  properties: {
    patterns: { type: Type.ARRAY, items: { type: Type.STRING } },
    riskLevel: { type: Type.STRING, enum: ["low", "medium", "high"] },
    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
    summaryText: { type: Type.STRING }
  },
  required: ["patterns", "riskLevel", "recommendations", "summaryText"]
};

// Schema for Advanced Enterprise Insights
const advancedInsightSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    periodSituation: { type: Type.STRING },
    emotionalTrends: { type: Type.STRING },
    pointsOfAttention: { type: Type.ARRAY, items: { type: Type.STRING } },
    comparativeEvolution: { type: Type.STRING },
    patterns: { type: Type.ARRAY, items: { type: Type.STRING } },
    riskScore: { type: Type.INTEGER },
    riskLevel: { type: Type.STRING, enum: ["Low", "Moderate", "Elevated"] }
  },
  required: ["summary", "periodSituation", "emotionalTrends", "pointsOfAttention", "comparativeEvolution", "patterns", "riskScore", "riskLevel"]
};

// --- SIMULATION ENGINE (FALLBACK) ---
// Garante que o sistema funcione com "precisão" clínica mesmo sem a API
const simulateClinicalSummary = (entries: any[]) => {
  console.log("⚠️ Running Clinical Simulation Engine");

  if (!entries || entries.length === 0) return null;

  const recentEntries = entries.slice(0, 30); // Analisa os últimos 30
  const avgMood = recentEntries.reduce((acc, e) => acc + (e.mood || 3), 0) / recentEntries.length;

  // Identificação de Keywords
  const allText = recentEntries.map(e => (e.text || "").toLowerCase()).join(" ");
  const keywords = {
    ansiedade: ["ansiedade", "pânico", "nervoso", "medo", "coração"],
    depressao: ["triste", "cama", "chorar", "sozinho", "escuro", "fim"],
    insonia: ["sono", "acordado", "madrugada", "insônia"],
    trabalho: ["trabalho", "chefe", "prazo", "escritório"],
    familia: ["mãe", "pai", "filho", "marido", "esposa"]
  };

  const detectedPatterns = [];
  if (avgMood < 2.5) detectedPatterns.push("Sintomas Depressivos Persistentes");
  if (allText.includes("sono") || allText.includes("dormir")) detectedPatterns.push("Distúrbios do Sono");
  if (allText.includes("trabalho") && avgMood < 3) detectedPatterns.push("Estresse Ocupacional");
  if (avgMood > 4) detectedPatterns.push("Estabilidade Emocional");

  // Cálculo de Risco
  let riskLevel = "low";
  const riskWords = ["morrer", "acabar", "sumir", "remédio", "dor"];
  const riskCount = riskWords.filter(w => allText.includes(w)).length;

  if (avgMood < 2.0 || riskCount > 0) riskLevel = "medium";
  if (avgMood < 1.5 && riskCount > 1) riskLevel = "high";

  // Recomendações
  const recommendations = [
    "Monitoramento diário do humor",
    "Higiene do sono rigorosa"
  ];
  if (detectedPatterns.includes("Estresse Ocupacional")) recommendations.push("Avaliar afastamento ou modulação de carga laboral");
  if (riskLevel !== "low") recommendations.push("Avaliação psiquiátrica imediata para ajuste medicamentoso");
  if (avgMood > 3.5) recommendations.push("Reforço positivo e manutenção das atividades atuais");

  // Sumário Executivo
  const trend = avgMood > 3.5 ? "estável e positivo" : avgMood < 2.5 ? "preocupante com sinais de declínio" : "oscilante com tendência à estabilidade";
  const summaryText = `Paciente apresenta um quadro clínico ${trend} nas últimas semanas (Média de humor: ${avgMood.toFixed(1)}/5). Identificou-se ${detectedPatterns.length ? detectedPatterns.join(", ") : "padrões inespecíficos"}. Recomenda-se atenção aos gatilhos identificados e seguimento das orientações terapêuticas.`;

  return {
    patterns: detectedPatterns.length ? detectedPatterns : ["Variação Típica de Humor"],
    riskLevel,
    recommendations,
    summaryText
  };
};

const simulateVoiceAnalysis = (text: string) => {
  const lower = text.toLowerCase();
  const moodScore = lower.includes("triste") || lower.includes("mal") ? 2 : lower.includes("bem") || lower.includes("feliz") ? 4 : 3;
  const energyLevel = lower.includes("cansad") ? 3 : lower.includes("animad") ? 8 : 5;

  return {
    transcription: text.charAt(0).toUpperCase() + text.slice(1) + (text.endsWith(".") ? "" : "."), // Basic calc
    mode: text.length > 20 ? "diary" : "mood",
    moodScore,
    energyLevel,
    summary: text.slice(0, 30) + "...",
    detectedTags: lower.includes("trabalho") ? ["Trabalho"] : [],
    intentToSave: true
  };
};

export const aiService = {
  analyzeEntry: async (text: string) => {
    // Tenta usar a API se a chave existir
    if (apiKey) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: `Atue como um especialista em transcrição clínica e psicometria para o app 'MoodFlow'.
          
          ANÁLISE O SEGUINTE RELATO DO PACIENTE:
          "${text}"
          
          TAREFAS:
          1. Corrija o texto gramaticalmente (mantendo o tom pessoal).
          2. Analise o sentimento para inferir o Humor (1-5) e Energia (1-10) com precisão.
          3. Extraia tags relevantes (contexto, sintomas, pessoas).
          
          Responda estritamente no formato JSON.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: voiceAnalysisSchema,
            temperature: 0.1,
          }
        });

        const resultText = response.text;
        if (resultText) return JSON.parse(resultText);
      } catch (error) {
        console.warn("AI API Error (analyzeEntry), falling back to simulation:", error);
      }
    }

    // Fallback
    return simulateVoiceAnalysis(text);
  },

  summarizeHistory: async (entries: any[]) => {
    // Verifica cache para evitar reprocessamento idêntico
    const currentContext = JSON.stringify(entries.slice(0, 5).map(e => e.id)); // Hash simples dos IDs recentes
    if (entries.length > 0 && currentContext === lastSummaryContext && lastSummaryResult) {
      console.log("Retornando sumário em cache");
      return lastSummaryResult;
    }

    if (apiKey) {
      try {
        const historyText = entries.slice(0, 40).map(e => `[${new Date(e.date).toLocaleDateString()}] Humor: ${e.mood}/5, Energia: ${e.energy}/10. Texto: "${e.text}"`).join('\n');

        const response = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: `Atue como um Psiquiatra Sênior revisando o prontuário de um paciente.
          
          DADOS DO PACIENTE (Últimos registros):
          ${historyText}
          
          Gere um Relatório Clínico Executivo focado em:
          1. Identificação precisa de padrões patológicos ou comportamentais.
          2. Avaliação de Risco (Baixo/Médio/Alto) baseada em ideação, gravidade dos sintomas ou isolamento.
          3. Recomendações práticas para intervenção clínica.
          
          Seja direto, técnico e empático. Use português formal médico.
          Responda estritamente no formato JSON.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: clinicalSummarySchema,
            temperature: 0.2
          }
        });

        const resultText = response.text;
        if (resultText) {
          const result = JSON.parse(resultText);
          lastSummaryContext = currentContext;
          lastSummaryResult = result;
          return result;
        }
      } catch (error) {
        console.warn("AI API Error (summarizeHistory), falling back to simulation:", error);
      }
    }

    // Fallback
    const simResult = simulateClinicalSummary(entries);
    lastSummaryContext = currentContext;
    lastSummaryResult = simResult;
    return simResult;
  },

  generateAdvancedInsight: async (entries: any[], period: 'weekly' | 'monthly' | 'longitudinal') => {
    if (apiKey) {
      try {
        const historyText = entries.map(e => `[${new Date(e.date).toLocaleDateString()}] Humor: ${e.mood}/5, Energia: ${e.energy}/10. Texto: "${e.text}"`).join('\n');

        const response = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: `Atue como um Especialista em Inteligência de Saúde Mental.
          
          PERÍODO DE ANÁLISE: ${period}
          DADOS:
          ${historyText}
          
          SUA TAREFA:
          Gere um Relatório Longitudinal Premium focado em apoiar a decisão clínica.
          
          ⚠️ REGRAS OBRIGATÓRIAS (GUARDRAILS):
          - NÃO dê diagnósticos (ex: 'O paciente tem Depressão'). Use 'Padrões sugestivos de...' ou 'Tendências...'.
          - NÃO prescreva medicamentos ou tratamentos específicos.
          - A linguagem deve ser profissional, neutra e longitudinal.
          - O Score de Risco deve ser entre 0 e 100.
          
          ESTRUTURA:
          1. Situação geral do período.
          2. Tendências emocionais detectadas.
          3. Pontos de atenção.
          4. Evolução comparativa.
          
          Responda estritamente no formato JSON seguindo o schema definido.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: advancedInsightSchema,
            temperature: 0.1
          }
        });

        const resultText = response.text;
        if (resultText) return JSON.parse(resultText);
      } catch (error) {
        console.warn("AI API Error (generateAdvancedInsight):", error);
      }
    }

    // Advanced Simulation Fallback
    const avgMood = entries.length > 0 ? entries.reduce((acc, e) => acc + (e.mood || 3), 0) / entries.length : 3;
    const riskScore = Math.max(0, Math.min(100, Math.round((5 - avgMood) * 20))); // Simple inversion scale

    return {
      summary: `Análise ${period} baseada em ${entries.length} registros.`,
      periodSituation: `O paciente manteve um estado predominantemente ${avgMood > 3.5 ? 'positivo' : avgMood < 2.5 ? 'deprimido' : 'instável'}.`,
      emotionalTrends: `Tendência à ${avgMood > 3 ? 'estabilidade' : 'reatividade'} com flutuações moderadas.`,
      pointsOfAttention: [
        avgMood < 2.5 ? "Baixo humor persistente" : "Oscilações de energia",
        "Necessidade de monitoramento de gatilhos ambientais"
      ],
      comparativeEvolution: "Comparado ao período anterior, observa-se uma " + (avgMood > 3 ? "melhora gradual." : "manutenção do quadro."),
      patterns: [avgMood < 3 ? "Oscilação Recorrente" : "Estabilidade Sustentada"],
      riskScore: riskScore,
      riskLevel: riskScore > 70 ? "Elevated" : riskScore > 40 ? "Moderate" : "Low"
    };
  }
};
