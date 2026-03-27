import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

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
        You are a professional LaTeX typesetter. Your task is to extract ALL content (both mathematical and textual) from the provided handwritten or printed notes and format them into a complete, polished LaTeX document.

        DOCUMENT STRUCTURE RULES:
        1. Use \\documentclass{article}
        2. Include \\usepackage{graphicx} and \\usepackage{amsmath, amssymb}
        3. Title: "Math\\_to\\_latex"
        4. Author: "Goh Jet Yun"
        5. Date: "March 2026"
        6. Use the main heading from the image (e.g., "Classification of Matrices") as the first \\section.
        7. Wrap all standalone equations/matrices in display math mode using \\[ ... \\].
        8. Use \\section* or \\subsection* for sub-headings found in the notes (e.g., "Hermitian Property", "Diagonal matrix").
        9. Include all explanatory text, definitions, and "Every symmetric matrix is hermitian" style statements as plain text within the document.

        MATRIX FORMATTING RULES (CRITICAL):
        - Use \\begin{pmatrix} ... \\end{pmatrix} for matrices with round brackets.
        - Use \\begin{bmatrix} ... \\end{bmatrix} for matrices with square brackets.
        - Use & to separate columns and \\\\ to separate rows.
        - For conditions like "k in R" or "a,b,c in R", use \\qquad followed by the condition (e.g., \\qquad k\\in\\mathbb{R}).
        - Ensure subscripts are correctly formatted (e.g., a_{ij} instead of aij).
        - Use \\overline{...} for conjugates.

        OUTPUT FORMAT:
        Return the FULL LaTeX document code starting from \\documentclass and ending with \\end{document}.
        Do NOT include any markdown code blocks (like \`\`\`latex). Just the raw text.
        Ensure the output is a valid, compilable LaTeX document that captures the full context of the notes.
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
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW
          }
        }
      });

      res.json({ latex: response.text?.trim() || "" });
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
