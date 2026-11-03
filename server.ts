import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { PDFParse } from "pdf-parse";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Initialize GenAI lazily or check key safely to avoid crashes
const getGenAI = (userKey?: string) => {
  let apiKey = userKey;
  if (apiKey) {
    apiKey = apiKey.trim();
    if (apiKey === "" || apiKey === "null" || apiKey === "undefined") {
      apiKey = undefined;
    }
  }
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY;
  }
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// Main analyze endpoint
app.post("/api/analyze", async (req, res) => {
  try {
    const { action, text, prompt, schemaType, userApiKey, audio } = req.body;
    const headerKey = req.headers["x-api-key"] as string || req.headers["authorization"] as string;
    const resolvedKey = userApiKey || headerKey;

    console.log(`Received API instruction for action: ${action}, schemaType: ${schemaType}, hasAudio: ${!!audio}`);

    const ai = getGenAI(resolvedKey);
    if (!ai) {
      return res.status(503).json({
        error: "GEMINI_API_KEY_MISSING",
        message: "Ключ GEMINI_API_KEY не задан или является стандартной заглушкой. Пожалуйста, добавьте рабочий ключ в настройки (Secrets) или вставьте ваш личный API-ключ в поле вкладки «Безопасность и API». Вы также можете свободно пользоваться оффлайн-функционалом, копировать готовые промпты для веб-версий Gemini, Qwen или DeepSeek!"
      });
    }

    if (!text && !audio) {
      return res.status(400).json({ error: "MISSING_CONTENT", message: "Отсутствует текст или аудио файл для анализа." });
    }

    let finalPrompt = prompt || "Проанализируй данный текст.";
    let responseMimeType = undefined;
    let responseSchema = undefined;

    if (schemaType === "questionnaire") {
      responseMimeType = "application/json";
      responseSchema = {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "Название опросника" },
          blocks: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING", description: "Заголовок блока, например 'Блок 1: Языковая биография'" },
                description: { type: "STRING", description: "Краткое описание блока" },
                colorToken: { type: "STRING", description: "Цветовой маркер: amber, teal, violet, slate, or terracotta" },
                questions: {
                  type: "ARRAY",
                  items: { type: "STRING", description: "Текст вопроса" }
                }
              },
              required: ["title", "questions"]
            }
          }
        },
        required: ["blocks"]
      };
    } else if (schemaType === "linguistic") {
      responseMimeType = "application/json";
      responseSchema = {
        type: "OBJECT",
        properties: {
          summary: { type: "STRING", description: "Краткий вывод о языковой ситуации информанта" },
          segments: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                speaker: { type: "STRING", description: "Имя или ярлык говорящего" },
                text: { type: "STRING", description: "Текст реплики" },
                tags: {
                  type: "ARRAY",
                  items: { type: "STRING", description: "Теги, например: trasianka, code_switching, russian, belarusian, polish, mixed_home_speech, generation_older" }
                },
                analysis: { type: "STRING", description: "Лингвистические комментарии: особенности произношения, заимствования, лексика" }
              },
              required: ["speaker", "text", "tags"]
            }
          },
          biography: {
            type: "OBJECT",
            properties: {
              primaryLanguage: { type: "STRING", description: "Основной язык" },
              homeLanguage: { type: "STRING", description: "Язык общения в семье" },
              generationalPattern: { type: "STRING", description: "Поколенческий паттерн языка" },
              trasiankaUsage: { type: "STRING", description: "Использование трасянки или смешанной речи" },
              codeSwitchingNotes: { type: "STRING", description: "Особенности переключения кодов" }
            }
          }
        },
        required: ["summary", "segments"]
      };
    }

    const contents: any[] = [{ text: finalPrompt }];
    if (audio && audio.data && audio.mimeType) {
      contents.push({
        inlineData: {
          data: audio.data,
          mimeType: audio.mimeType
        }
      });
    } else {
      contents.push({ text: `ДАННЫЕ ДЛЯ АНАЛИЗА:\n${text || ""}` });
    }

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: responseMimeType ? {
          responseMimeType,
          responseSchema: responseSchema as any,
          temperature: 0.2
        } : undefined
      });
    } catch (primaryError: any) {
      const errMsg = String(primaryError.message || primaryError).toLowerCase();
      const isTransient = errMsg.includes("503") || 
                          errMsg.includes("unavailable") || 
                          errMsg.includes("demand") || 
                          errMsg.includes("limit") || 
                          errMsg.includes("quota") || 
                          errMsg.includes("overload") ||
                          errMsg.includes("spike");
      
      if (isTransient) {
        console.warn("Primary model gemini-3.5-flash overloaded/unavailable. Attempting fallback to gemini-3.1-flash-lite. Error was:", primaryError.message);
        response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents,
          config: responseMimeType ? {
            responseMimeType,
            responseSchema: responseSchema as any,
            temperature: 0.2
          } : undefined
        });
      } else {
        throw primaryError;
      }
    }

    res.json({ result: response.text });
  } catch (error: any) {
    console.error("API Error processing request:", error);
    res.status(500).json({
      error: "GEMINI_API_ERROR",
      message: error.message || "Произошла непредвиденная ошибка при обращении к Gemini API."
    });
  }
});

// PDF Parsing endpoint using pdf-parse library
app.post("/api/parse-pdf", async (req, res) => {
  try {
    const { base64Data } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: "MISSING_DATA", message: "Отсутствуют данные файла в запросе." });
    }
    const buffer = Buffer.from(base64Data, "base64");
    
    // Parse the PDF content
    const parser = new PDFParse({ data: buffer });
    try {
      const parsedData = await parser.getText();
      res.json({ text: parsedData.text });
    } finally {
      await parser.destroy();
    }
  } catch (error: any) {
    console.error("PDF parsing endpoint error:", error);
    res.status(500).json({
      error: "PDF_PARSE_ERROR",
      message: error.message || "Не удалось извлечь текст из PDF файла на сервере."
    });
  }
});


// Setup Vite & Static Assets serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Sociologist Workbench] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
