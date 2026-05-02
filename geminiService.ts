import { GoogleGenAI, Type, Schema } from "@google/genai";
import { FileSystemItem, FileType } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to sanitize JSON string if necessary
const cleanJson = (text: string) => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

export const generateFileContent = async (prompt: string, fileName: string): Promise<string> => {
  if (!apiKey) throw new Error("API Key manquante");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Génère le contenu textuel pour un fichier nommé "${fileName}". 
      Instruction de l'utilisateur: ${prompt}. 
      Retourne uniquement le contenu du fichier, sans markdown autour (sauf si c'est du code markdown).`,
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini generation error:", error);
    throw error;
  }
};

export const smartSearchFiles = async (query: string, files: FileSystemItem[]): Promise<string[]> => {
  if (!apiKey) return [];

  // Prepare a lightweight context of files
  const fileContext = files.map(f => ({
    id: f.id,
    name: f.name,
    type: f.type,
    contentPreview: f.content ? f.content.substring(0, 100) : "N/A"
  }));

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.STRING
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `L'utilisateur recherche: "${query}".
      Voici la liste des fichiers disponibles (métadonnées):
      ${JSON.stringify(fileContext)}
      
      Retourne un tableau JSON contenant UNIQUEMENT les 'id' des fichiers qui correspondent le mieux à la recherche.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(cleanJson(text)) as string[];

  } catch (error) {
    console.error("Gemini search error:", error);
    return [];
  }
};

export const suggestFolderName = async (fileNames: string[]): Promise<string> => {
  if (!apiKey) return "Nouveau Dossier";
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Voici une liste de fichiers: ${fileNames.join(', ')}. 
      Suggère un nom de dossier court et pertinent (un seul nom) pour les regrouper.`,
    });
    return response.text?.trim() || "Dossier Intelligent";
  } catch (e) {
    return "Dossier Intelligent";
  }
}