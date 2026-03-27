import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function convertImageToLatex(base64Image: string, mimeType: string): Promise<string> {
  // Using gemini-3-flash-preview for significantly faster processing
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

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image.split(',')[1],
              mimeType: mimeType
            }
          }
        ]
      }
    ],
    config: {
      thinkingConfig: {
        // Lower thinking level reduces latency while maintaining good accuracy for math
        thinkingLevel: ThinkingLevel.LOW
      }
    }
  });

  return response.text?.trim() || "";
}
