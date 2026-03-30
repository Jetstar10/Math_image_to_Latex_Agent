import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase limit for base64 images
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Endpoint for others to test the model
  app.post("/api/convert", async (req, res) => {
    try {
      const { image, mimeType } = req.body;

      if (!image || !mimeType) {
        return res.status(400).json({ error: "Missing image or mimeType" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key not configured on server" });
      }

      const ai = new GoogleGenAI({ apiKey });
      const model = "gemini-3-flash-preview";
      
      const prompt = `
        You are a professional LaTeX typesetter and expert mathematics grader. Your task is twofold:
        1. Extract ALL content (both mathematical and textual) from the provided image and format it into a complete, polished LaTeX document.
        2. Analyze the work for mathematical errors. For every mistake found, provide a bounding box and a helpful explanation.
        3. Judge the difficulty level of the question (Easy, Medium, or Hard) and provide feedback based on that difficulty.

        DOCUMENT STRUCTURE RULES:
        - Use \\documentclass{article}
        - Include \\usepackage{graphicx} and \\usepackage{amsmath, amssymb}
        - Title: "Math\\_to\\_latex"
        - Author: "Goh Jet Yun"
        - Date: "March 2026"
        - Use the main heading from the image (e.g., "Classification of Matrices") as the first \\section.
        - Wrap all standalone equations/matrices in display math mode using \\[ ... \\].
        - Use \\section* or \\subsection* for sub-headings found in the notes.
        - Include all explanatory text, definitions, and statements as plain text within the document.

        MATRIX FORMATTING RULES (CRITICAL):
        - Use \\begin{pmatrix} ... \\end{pmatrix} for matrices with round brackets.
        - Use \\begin{bmatrix} ... \\end{bmatrix} for matrices with square brackets.
        - Use & to separate columns and \\\\ to separate rows.
        - Ensure subscripts are correctly formatted (e.g., a_{ij} instead of aij).
        - Use \\overline{...} for conjugates.

        BOUNDING BOX RULES:
        - ONLY provide bounding boxes for the specific areas where a MISTAKE occurs.
        - Label each detection with a short title for the mistake (e.g., "Calculation Error", "Sign Error").
        - Provide a brief, helpful explanation of what the mistake is and how to fix it.
        - IMPORTANT: The explanation MUST be in plain text, NOT LaTeX format.
        - Coordinates must be in normalized [ymin, xmin, ymax, xmax] from 0 to 1000.

        OUTPUT FORMAT:
        Return a JSON object with:
        - "latex": The FULL LaTeX document code.
        - "detections": An array of objects, each with "label", "explanation", and "box_2d".
        - "difficulty": A string representing the difficulty level ("Easy", "Medium", or "Hard").
        - "difficultyFeedback": A brief explanation of why this difficulty was chosen and general feedback for the student at this level.
      `;

      // Extract base64 data (handle both raw base64 and data URL)
      const base64Data = image.includes(',') ? image.split(',')[1] : image;

      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              latex: { type: Type.STRING },
              difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
              difficultyFeedback: { type: Type.STRING },
              detections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    box_2d: {
                      type: Type.ARRAY,
                      items: { type: Type.NUMBER }
                    }
                  },
                  required: ["label", "explanation", "box_2d"]
                }
              }
            },
            required: ["latex", "detections", "difficulty", "difficultyFeedback"]
          },
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW
          }
        }
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("API Error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
