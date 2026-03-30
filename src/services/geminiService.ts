import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface EquationDetection {
  label: string;
  explanation: string;
  type: "mistake" | "correction";
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
}

export interface ConversionResult {
  latex: string;
  detections: EquationDetection[];
  difficulty: "Easy" | "Medium" | "Hard";
  difficultyFeedback: string;
  verification: string;
}

export async function convertImageToLatex(base64Image: string, mimeType: string): Promise<ConversionResult> {
  // Using gemini-3-flash-preview for significantly faster processing
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are a professional LaTeX typesetter and expert mathematics grader. Your task is threefold:
    1. Extract ALL content (both mathematical and textual) from the provided image and format it into a complete, polished LaTeX document.
    2. Analyze the work for mathematical errors. For every mistake found, provide a bounding box and a helpful explanation.
    3. For every correction or improvement you suggest, also provide a bounding box and an explanation of the fix.
    4. Judge the difficulty level of the question (Easy, Medium, or Hard) and provide feedback based on that difficulty.
    5. Verify if the student's final answer and the provided correction/explanation are mathematically correct. Provide a summary of this verification.

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
    - Provide bounding boxes for BOTH mistakes and corrections.
    - Label each detection with a short title (e.g., "Calculation Error", "Corrected Step").
    - Provide a brief, helpful explanation.
    - IMPORTANT: The explanation MUST be in plain text, NOT LaTeX format.
    - Coordinates must be in normalized [ymin, xmin, ymax, xmax] from 0 to 1000.
    - Specify the "type" as either "mistake" or "correction".

    OUTPUT FORMAT:
    Return a JSON object with:
    - "latex": The FULL LaTeX document code.
    - "detections": An array of objects, each with "label", "explanation", "type", and "box_2d".
    - "difficulty": A string representing the difficulty level ("Easy", "Medium", or "Hard").
    - "difficultyFeedback": A brief explanation of why this difficulty was chosen and general feedback for the student at this level.
    - "verification": A summary confirming whether the student's answer and the correction are mathematically sound.
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
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          latex: { type: Type.STRING },
          difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
          difficultyFeedback: { type: Type.STRING },
          verification: { type: Type.STRING },
          detections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                explanation: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["mistake", "correction"] },
                box_2d: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER }
                }
              },
              required: ["label", "explanation", "type", "box_2d"]
            }
          }
        },
        required: ["latex", "detections", "difficulty", "difficultyFeedback", "verification"]
      },
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}") as ConversionResult;
  } catch (e) {
    console.error("Failed to parse JSON response:", response.text);
    return { 
      latex: response.text || "", 
      detections: [], 
      difficulty: "Medium", 
      difficultyFeedback: "Error analyzing difficulty.",
      verification: "Error verifying correctness."
    };
  }
}
